<?php

namespace App\Services;

use App\Models\Postulacion;
use App\Services\GeminiService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Webklex\PHPIMAP\ClientManager;
use App\Jobs\ProcessCvJob;

class EmailImportService
{
    protected array $extensionesPermitidas = ['pdf', 'doc', 'docx'];

    public function importarDesdeCorreo(int $dias = 60): array
    {
        // CVs grandes (6-13 MB en base64) requieren más memoria
        ini_set('memory_limit', '1G');

        $cuentas    = $this->obtenerCuentas();
        $resultados = ['importados' => 0, 'duplicados' => 0, 'ignorados' => 0, 'errores' => 0];

        foreach ($cuentas as $cuenta) {
            try {
                $res = $this->procesarCuenta($cuenta, $dias);
                $resultados['importados'] += $res['importados'];
                $resultados['duplicados'] += $res['duplicados'];
                $resultados['ignorados']  += $res['ignorados'];
                $resultados['errores']    += $res['errores'];
            } catch (\Exception $e) {
                Log::error("EmailImport error en cuenta {$cuenta['username']}: " . $e->getMessage());
                $resultados['errores']++;
            }
        }

        return $resultados;
    }

    protected function obtenerCuentas(): array
    {
        $cuentas = [];
        for ($i = 1; $i <= 2; $i++) {
            $user = env("IMAP_USERNAME_{$i}");
            $pass = env("IMAP_PASSWORD_{$i}");
            $host = env("IMAP_HOST_{$i}");
            if ($user && $host && $pass) {
                $cuentas[] = [
                    'host'       => $host,
                    'port'       => env("IMAP_PORT_{$i}", 993),
                    'encryption' => env("IMAP_ENCRYPTION_{$i}", 'ssl'),
                    'username'   => $user,
                    'password'   => $pass,
                    'folder'     => env("IMAP_FOLDER_{$i}", 'INBOX'),
                ];
            }
        }
        return $cuentas;
    }

    protected function procesarCuenta(array $config, int $dias): array
    {
        $resultados = ['importados' => 0, 'duplicados' => 0, 'ignorados' => 0, 'errores' => 0];

        $cm     = new ClientManager();
        $client = $cm->make([
            'host'          => $config['host'],
            'port'          => $config['port'],
            'encryption'    => $config['encryption'],
            'validate_cert' => false,
            'username'      => $config['username'],
            'password'      => $config['password'],
            'protocol'      => 'imap',
            'timeout'       => 15,
        ]);

        $client->connect();
        $folder = $client->getFolder($config['folder']);

        // ── FASE 1: obtener solo headers, sin descargar nada ──────────────────
        $messages = $folder->query()
            ->since(now()->subDays($dias))
            ->setFetchOrder('desc')
            ->setFetchBody(false)
            ->setFetchFlags(false)
            ->limit(200, 1)
            ->get();

        if ($messages->isEmpty()) {
            $client->disconnect();
            return $resultados;
        }

        // ── FASE 2: construir lista liviana para la IA ────────────────────────
        $lista    = [];   // [{idx, from, nombre, asunto, fecha}]  — solo texto
        $indexMap = [];   // idx => message object
        $msgIds   = [];   // idx => Message-ID

        $idx = 0;
        foreach ($messages as $message) {
            $msgId = (string)($message->getMessageId()->first() ?? '');

            // Descartar lo ya revisado (postulaciones y descartados) antes de enviar a la IA
            if ($this->yaRevisado($msgId)) {
                $resultados['duplicados']++;
                continue;
            }

            $msgIds[$idx]  = $msgId;
            $lista[]       = [
                'idx'    => $idx,
                'from'   => (string)($message->getFrom()->first()?->mail ?? ''),
                'nombre' => $this->decodeHeaderValue((string)($message->getFrom()->first()?->personal ?? '')),
                'asunto' => $this->decodeHeaderValue((string)($message->getSubject()->first() ?? '')),
                'fecha'  => $message->getDate()->first()?->toDateTime()?->format('Y-m-d') ?? '',
            ];
            $indexMap[$idx] = $message;
            $idx++;
        }

        if (empty($lista)) {
            $client->disconnect();
            return $resultados;
        }

        // ── FASE 3: la IA decide qué emails son postulaciones ─────────────────
        Log::info("EmailImport: enviando {$idx} correos a Gemini para clasificar...");
        $gemini      = app(GeminiService::class);
        $seleccionados = $gemini->filtrarPostulaciones($lista);

        Log::info("EmailImport: Gemini identificó " . count($seleccionados) . " postulaciones de {$idx} correos.");

        // Llegar aqui significa que Gemini respondio bien (si falla, lanza
        // excepcion), asi que los no seleccionados se pueden recordar.
        foreach (array_diff(array_keys($msgIds), $seleccionados) as $descartado) {
            $this->marcarRevisado($msgIds[$descartado], 'no_postulacion', $config['username']);
        }

        // ── FASE 4: solo descargar y guardar los que la IA aprobó ─────────────
        foreach ($seleccionados as $selIdx) {
            if (!isset($indexMap[$selIdx])) continue;
            $message = $indexMap[$selIdx];
            $meta    = $lista[$selIdx];

            try {
                $resultado = $this->guardarPostulacion($message, $meta, $config['username']);
                if ($resultado === 'importado') $resultados['importados']++;
                if ($resultado === 'duplicado') $resultados['duplicados']++;
            } catch (\Exception $e) {
                Log::error("Error guardando postulación idx={$selIdx}: " . $e->getMessage());
                $resultados['errores']++;
            }
        }

        $resultados['ignorados'] = count($lista) - count($seleccionados);

        $client->disconnect();
        return $resultados;
    }

    /**
     * true si el correo ya termino en postulacion, o ya se reviso y se
     * descarto. En ambos casos no hay que volver a mandarlo a Gemini.
     */
    public function yaRevisado(string $mensajeId): bool
    {
        if ($mensajeId === '') {
            return false;
        }

        return Postulacion::where('mensaje_id_email', $mensajeId)->exists()
            || DB::table('correos_revisados')->where('mensaje_id', $mensajeId)->exists();
    }

    /** Recuerda un correo descartado para no reclasificarlo en la siguiente revision. */
    public function marcarRevisado(string $mensajeId, string $resultado, ?string $cuenta = null): void
    {
        if ($mensajeId === '') {
            return;
        }

        DB::table('correos_revisados')->insertOrIgnore([
            'mensaje_id' => $mensajeId,
            'resultado' => $resultado,
            'cuenta' => $cuenta,
            'created_at' => now(),
        ]);
    }

    protected function guardarPostulacion($message, array $meta, string $emailOrigen): string
    {
        $messageId = (string)($message->getMessageId()->first() ?? '');

        // Doble check de duplicado (por si acaso)
        if ($messageId && Postulacion::where('mensaje_id_email', $messageId)->exists()) {
            return 'duplicado';
        }

        // Ahora sí descargamos body + adjuntos (solo para los aprobados por la IA)
        try {
            $message->parseBody();
        } catch (\Exception $e) {
            Log::warning("No se pudo parsear body del mensaje {$messageId}: " . $e->getMessage());
        }

        $cuerpo      = $message->getTextBody() ?: $message->getHTMLBody() ?: '';
        $attachments = $message->getAttachments();
        $cvGuardado  = null;
        $cvNombre    = null;
        $cvMime      = null;

        foreach ($attachments as $attachment) {
            $nombre    = $this->decodeHeaderValue((string)$attachment->getName());
            $extension = strtolower(pathinfo($nombre, PATHINFO_EXTENSION));

            if (in_array($extension, $this->extensionesPermitidas)) {
                $contenido  = $attachment->getContent();
                $ruta       = 'cvs/' . date('Y/m') . '/' . uniqid() . '_' . $nombre;
                Storage::disk('local')->put($ruta, $contenido);
                $cvGuardado = $ruta;
                $cvNombre   = $nombre;
                $cvMime     = match ($extension) {
                    'pdf'   => 'application/pdf',
                    'docx'  => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'doc'   => 'application/msword',
                    default => 'application/octet-stream',
                };
                break;
            }
        }

        if (!$cvGuardado) {
            Log::info("EmailImport: El correo #{$messageId} de {$meta['from']} no tiene adjunto de CV válido. Ignorando.");
            // Sin recordarlo, se volvia a descargar completo (hasta 13 MB) en cada revision.
            $this->marcarRevisado($messageId, 'sin_cv', $emailOrigen);
            return 'sin_cv';
        }

        $fecha = $message->getDate()->first()?->toDateTime() ?? now();

        $postulacion = Postulacion::create([
            'nombre_completo'  => $meta['nombre'] ?: $meta['from'] ?: 'Sin nombre',
            'email'            => $meta['from'],
            'fuente'           => 'email',
            'estado'           => 'recibida',
            'email_origen'     => $emailOrigen,
            'asunto_email'     => $meta['asunto'],
            'cuerpo_email'     => mb_substr($cuerpo, 0, 5000),
            'archivo_cv'       => $cvGuardado,
            'archivo_nombre'   => $cvNombre,
            'archivo_mime'     => $cvMime,
            'mensaje_id_email' => $messageId,
            'fecha_recepcion'  => $fecha,
        ]);

        if ($cvGuardado) {
            // Procesar y evaluar al candidato con IA inmediatamente de forma síncrona
            try {
                \App\Jobs\ProcessCvJob::dispatchSync($postulacion->id);
            } catch (\Exception $e) {
                Log::error("EmailImportService: Error al evaluar CV con IA para la postulación #{$postulacion->id}: " . $e->getMessage());
                // Registrar el estado de error en el candidato para que el usuario pueda reintentarlo
                \App\Models\Candidato::updateOrCreate(
                    ['postulacion_id' => $postulacion->id],
                    [
                        'estado_parseo' => 'error',
                        'error_parseo'  => $e->getMessage()
                    ]
                );
            }
        }

        return 'importado';
    }

    public function obtenerNuevosHeaders(int $dias = 60): array
    {
        ini_set('memory_limit', '1G');
        
        $cuentas = $this->obtenerCuentas();
        $todosNuevos = [];

        foreach ($cuentas as $idx => $cuenta) {
            try {
                $cm = new ClientManager();
                $client = $cm->make([
                    'host'          => $cuenta['host'],
                    'port'          => $cuenta['port'],
                    'encryption'    => $cuenta['encryption'],
                    'validate_cert' => false,
                    'username'      => $cuenta['username'],
                    'password'      => $cuenta['password'],
                    'protocol'      => 'imap',
                    'timeout'       => 15,
                ]);

                $client->connect();
                $folder = $client->getFolder($cuenta['folder']);

                $messages = $folder->query()
                    ->since(now()->subDays($dias))
                    ->setFetchOrder('desc')
                    ->setFetchBody(false)
                    ->setFetchFlags(false)
                    ->limit(200, 1)
                    ->get();

                foreach ($messages as $message) {
                    $msgId = (string)($message->getMessageId()->first() ?? '');
                    $uid = (int)($message->getUid() ?? 0);

                    if (!$uid) continue;

                    if ($this->yaRevisado($msgId)) {
                        continue;
                    }

                    $todosNuevos[] = [
                        'uid'        => $uid,
                        'message_id' => $msgId,
                        'from'       => (string)($message->getFrom()->first()?->mail ?? ''),
                        'nombre'     => $this->decodeHeaderValue((string)($message->getFrom()->first()?->personal ?? '')),
                        'asunto'     => $this->decodeHeaderValue((string)($message->getSubject()->first() ?? '')),
                        'fecha'      => $message->getDate()->first()?->toDateTime()?->format('Y-m-d') ?? '',
                        'cuenta_idx' => $idx,
                    ];
                }

                $client->disconnect();
            } catch (\Exception $e) {
                Log::error("EmailImport error en cuenta headers {$cuenta['username']}: " . $e->getMessage());
            }
        }

        return $todosNuevos;
    }

    public function clasificarHeaders(array $headers): array
    {
        if (empty($headers)) {
            return [];
        }

        $lista = [];
        foreach ($headers as $idx => $h) {
            $lista[] = [
                'idx'    => $idx,
                'from'   => $h['from'],
                'nombre' => $h['nombre'],
                'asunto' => $h['asunto'],
                'fecha'  => $h['fecha'],
            ];
        }

        Log::info("EmailImport: enviando " . count($lista) . " correos a Gemini para clasificar...");
        $gemini = app(GeminiService::class);
        $seleccionados = $gemini->filtrarPostulaciones($lista);

        Log::info("EmailImport: Gemini identificó " . count($seleccionados) . " postulaciones de " . count($headers) . " correos.");

        $resultado = [];
        foreach ($seleccionados as $selIdx) {
            if (isset($headers[$selIdx])) {
                $resultado[] = $headers[$selIdx];
            }
        }

        // Gemini respondio bien: los no seleccionados se recuerdan.
        foreach (array_diff(array_keys($headers), $seleccionados) as $descartado) {
            $this->marcarRevisado((string) ($headers[$descartado]['message_id'] ?? ''), 'no_postulacion');
        }

        return $resultado;
    }

    public function importarMensajeIndividual(array $meta): string
    {
        $cuentaIdx = (int)$meta['cuenta_idx'];
        $uid = (int)$meta['uid'];
        $messageId = $meta['message_id'];

        if ($messageId && Postulacion::where('mensaje_id_email', $messageId)->exists()) {
            return 'duplicado';
        }

        $cuentas = $this->obtenerCuentas();
        if (!isset($cuentas[$cuentaIdx])) {
            throw new \Exception("Cuenta index {$cuentaIdx} no existe.");
        }

        $cuenta = $cuentas[$cuentaIdx];

        $cm = new ClientManager();
        $client = $cm->make([
            'host'          => $cuenta['host'],
            'port'          => $cuenta['port'],
            'encryption'    => $cuenta['encryption'],
            'validate_cert' => false,
            'username'      => $cuenta['username'],
            'password'      => $cuenta['password'],
            'protocol'      => 'imap',
            'timeout'       => 20,
        ]);

        $client->connect();
        $folder = $client->getFolder($cuenta['folder']);

        $message = $folder->query()->getMessageByUid($uid);

        if (!$message) {
            $client->disconnect();
            throw new \Exception("Mensaje con UID {$uid} no encontrado.");
        }

        $resultado = $this->guardarPostulacion($message, $meta, $cuenta['username']);

        $client->disconnect();
        return $resultado;
    }

    private function decodeHeaderValue(?string $value): string
    {
        if (empty($value)) {
            return '';
        }
        if (str_contains($value, '=?')) {
            $decoded = @iconv_mime_decode($value, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8');
            if ($decoded !== false) {
                return $decoded;
            }
            $decoded = @mb_decode_mimeheader($value);
            if ($decoded !== false) {
                return $decoded;
            }
        }
        return $value;
    }
}
