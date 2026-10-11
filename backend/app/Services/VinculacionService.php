<?php

namespace App\Services;

use App\Jobs\VincularPostulacionJob;
use App\Models\DocumentoAspirante;
use App\Models\Postulacion;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Paso del aspirante seleccionado a empleado en gestión:
 *   1. crea el empleado (con los datos de vinculación),
 *   2. envía cada documento de ingreso (gestión lo sube al NAS),
 *   3. cierra el proceso como "vinculado".
 *
 * Se puede repetir sin miedo: gestión reconoce el empleado por
 * "postulacion:<id>" y cada documento por "documento:<id>", así que un
 * reintento solo manda lo que faltó.
 *
 * solicitar() valida en el momento y deja el trabajo en la cola
 * (VincularPostulacionJob); ejecutar() es el trabajo en sí. El avance queda
 * en postulaciones.vinculacion_estado para que la pantalla lo muestre.
 */
class VinculacionService
{
    public const EN_COLA = 'en_cola';
    public const EN_CURSO = 'en_curso';
    public const ERROR = 'error';
    public const COMPLETO = 'completo';

    /** Tipo de documento de la hoja de vida: la cumple el CV con el que llegó la postulación. */
    public const CODIGO_HV = 'ING-HV';

    /** Pasado este tiempo, una vinculación "en curso" se da por atascada y se puede relanzar. */
    public const MINUTOS_ATASCADA = 20;

    /** Datos sin los que gestión no puede crear el empleado. */
    public const DATOS_OBLIGATORIOS = [
        'cedula'        => 'Cédula',
        'nombres'       => 'Nombres',
        'apellidos'     => 'Apellidos',
        'cargo'         => 'Cargo',
        'fecha_ingreso' => 'Fecha de ingreso',
        'tipo_empleado' => 'Tipo de empleado (campo o administrativo)',
    ];

    /** Campo de datos_vinculacion → campo del empleado en gestión. */
    private const MAPA = [
        'cedula'              => 'cedula',
        'nombres'             => 'first_name',
        'apellidos'           => 'last_name',
        'email'               => 'email',
        'telefono'            => 'phone',
        'cargo'               => 'position',
        'fecha_ingreso'       => 'hire_date',
        'tipo_contrato'       => 'contract_type',
        'fecha_fin_contrato'  => 'contract_end_date',
        'tipo_empleado'       => 'employee_type',
        'salario'             => 'salary',
        'fecha_nacimiento'    => 'birth_date',
        'genero'              => 'gender',
        'direccion'           => 'address',
        'contacto_emergencia' => 'emergency_contact',
        'telefono_emergencia' => 'emergency_phone',
        'eps'                 => 'eps',
        'arl'                 => 'arl',
        'fondo_pension'       => 'pension_fund',
        'banco'               => 'bank',
        'cuenta_bancaria'     => 'bank_account',
        'tipo_cuenta'         => 'account_type',
        'company_id'          => 'company_id',
        'location_id'         => 'location_id',
        'schedule_id'         => 'schedule_id',
        'department_id'       => 'department_id',
    ];

    public function __construct(
        private readonly GestionClient $gestion,
        private readonly ProcesoSeleccionService $proceso,
    ) {
    }

    /**
     * Checklist de documentos: los tipos del catálogo de gestión, marcando
     * cuáles se le exigen a este aspirante (applies_to = all o su tipo) y los
     * documentos que ya se cargaron para cada uno.
     *
     * La hoja de vida es lo primero que se recibe: si la postulación trae CV,
     * ese archivo cumple el requisito (cv_postulacion) sin pedirlo de nuevo.
     */
    public function checklist(Postulacion $p, array $catalogo): array
    {
        $tipo = $p->datos_vinculacion['tipo_empleado'] ?? null;
        $documentos = $p->documentos->groupBy('codigo');
        $cv = $p->archivo_cv ? ['archivo_nombre' => $p->archivo_nombre ?: 'Hoja de vida'] : null;

        return collect($catalogo['document_types'] ?? [])
            ->map(function (array $t) use ($tipo, $documentos, $cv) {
                $requerido = $t['applies_to'] === 'all' || ($tipo !== null && $t['applies_to'] === $tipo);
                $cargados = $documentos->get($t['code'], collect())->values();

                return [
                    'codigo' => $t['code'],
                    'nombre' => $t['name'],
                    'categoria' => $t['category_name'],
                    'vigencia_meses' => $t['validity_months'],
                    'sensible' => (bool) $t['sensitive'],
                    'bloquea_ingreso' => (bool) $t['blocks_site_entry'],
                    'requerido' => $requerido,
                    'documentos' => $cargados,
                    'cv_postulacion' => $t['code'] === self::CODIGO_HV && $cargados->isEmpty() ? $cv : null,
                ];
            })
            ->values()
            ->all();
    }

    /** Requisitos que aún no tienen ningún documento cargado. */
    public function faltantes(Postulacion $p, array $catalogo): array
    {
        return collect($this->checklist($p, $catalogo))
            ->filter(fn ($r) => $r['requerido'] && count($r['documentos']) === 0 && !$r['cv_postulacion'])
            ->pluck('nombre')
            ->values()
            ->all();
    }

    public function datosFaltantes(Postulacion $p): array
    {
        $datos = $p->datos_vinculacion ?? [];

        return collect(self::DATOS_OBLIGATORIOS)
            ->filter(fn ($label, $campo) => blank($datos[$campo] ?? null))
            ->values()
            ->all();
    }

    /** Hay una vinculación en cola o corriendo que aún no se da por atascada. */
    public static function enMarcha(Postulacion $p): bool
    {
        return in_array($p->vinculacion_estado, [self::EN_COLA, self::EN_CURSO], true)
            && $p->vinculacion_solicitada_at?->gt(now()->subMinutes(self::MINUTOS_ATASCADA));
    }

    /**
     * El botón "Vincular": valida lo que se puede validar al instante y deja
     * la vinculación en la cola. Un doble clic no lanza dos.
     */
    public function solicitar(Postulacion $p, ?User $user, bool $aceptarFaltantes = false): void
    {
        if ($p->fase === ProcesoSeleccionService::VINCULADO) {
            throw ValidationException::withMessages(['vinculacion' => 'Este aspirante ya fue vinculado.']);
        }

        // Si ya se creó el empleado (reintento tras un error de envío), solo
        // falta mandar documentos: no hace falta volver a exigir la fase.
        if (!$p->gestion_employee_id) {
            if ($p->fase !== 'vinculacion' || $p->estado === 'descartado') {
                throw ValidationException::withMessages([
                    'vinculacion' => 'Para vincular, el aspirante debe haber aprobado todas las fases («' . ProcesoSeleccionService::FASES['vinculacion'] . '»).',
                ]);
            }

            if ($faltan = $this->datosFaltantes($p)) {
                throw ValidationException::withMessages(['vinculacion' => 'Faltan datos de vinculación: ' . implode(', ', $faltan) . '.']);
            }

            $faltantes = $this->faltantes($p, $this->gestion->catalogo());
            if ($faltantes && !$aceptarFaltantes) {
                throw ValidationException::withMessages([
                    'documentos' => 'Faltan documentos requeridos: ' . implode(', ', $faltantes) . '.',
                ]);
            }
        }

        // Toma el turno en una sola sentencia: si otra petición ya lo tomó, no
        // actualiza ninguna fila.
        $tomado = Postulacion::whereKey($p->id)
            ->where(fn ($q) => $q->whereNull('vinculacion_estado')
                ->orWhereNotIn('vinculacion_estado', [self::EN_COLA, self::EN_CURSO])
                ->orWhere('vinculacion_solicitada_at', '<', now()->subMinutes(self::MINUTOS_ATASCADA)))
            ->update([
                'vinculacion_estado' => self::EN_COLA,
                'vinculacion_mensaje' => null,
                'vinculacion_solicitada_at' => now(),
            ]);

        if (!$tomado) {
            throw ValidationException::withMessages(['vinculacion' => 'Ya hay una vinculación en curso para este aspirante.']);
        }

        try {
            $this->adjuntarHojaDeVida($p, $user);
        } catch (\Throwable $e) {
            // Ya se tomó el turno: un fallo aquí no puede dejar la vinculación atascada.
            Log::warning('[Vinculación] No se adjuntó la hoja de vida', ['postulacion_id' => $p->id, 'error' => $e->getMessage()]);
        }

        VincularPostulacionJob::dispatch($p->id, $user?->id);
    }

    /**
     * Copia el CV de la postulación como documento ING-HV para que viaje a
     * gestión y al NAS con los demás. Se hace aquí, en la petición web, porque
     * el worker de la cola no tiene permiso de leer los CV. Si no se puede
     * copiar, la vinculación sigue: la hoja de vida se puede cargar a mano.
     */
    private function adjuntarHojaDeVida(Postulacion $p, ?User $user): void
    {
        if (!$p->archivo_cv || $p->documentos()->where('codigo', self::CODIGO_HV)->exists()) {
            return;
        }

        $contenido = Storage::disk('local')->get($p->archivo_cv);
        if ($contenido === null || $contenido === '') {
            Log::warning('[Vinculación] No se pudo leer el CV de la postulación', ['postulacion_id' => $p->id, 'archivo' => $p->archivo_cv]);

            return;
        }

        $nombre = $p->archivo_nombre ?: basename($p->archivo_cv);
        $ext = Str::lower(pathinfo($nombre, PATHINFO_EXTENSION) ?: pathinfo($p->archivo_cv, PATHINFO_EXTENSION) ?: 'pdf');
        $ruta = $p->id . '/' . Str::uuid() . '.' . $ext;

        if (!Storage::disk(DocumentoAspirante::DISCO)->put($ruta, $contenido)) {
            Log::warning('[Vinculación] No se pudo copiar el CV a los documentos del aspirante', ['postulacion_id' => $p->id]);

            return;
        }

        $p->documentos()->create([
            'codigo' => self::CODIGO_HV,
            'archivo' => $ruta,
            'archivo_nombre' => $nombre,
            'archivo_mime' => $p->archivo_mime ?: (Storage::disk(DocumentoAspirante::DISCO)->mimeType($ruta) ?: null),
            'tamano' => strlen($contenido),
            'detalle' => 'Recibida con la postulación',
            'user_id' => $user?->id,
            'autor_nombre' => $user?->name,
        ]);
    }

    /**
     * El trabajo de la cola. Nunca lanza: el resultado queda en
     * vinculacion_estado / vinculacion_mensaje.
     *
     * @return array{empleado_id:?int, enviados:int, errores:array<int,array{documento:string,error:string}>, completo:bool}
     */
    public function ejecutar(Postulacion $p, ?User $user): array
    {
        $p->update(['vinculacion_estado' => self::EN_CURSO]);

        try {
            if (!$p->gestion_employee_id) {
                [$status, $body] = $this->gestion->contratar($this->datosEmpleado($p, $user));

                if ($status === 409) {
                    return $this->terminar($p, self::ERROR, $body['message'] ?? 'La cédula ya existe en gestión.');
                }

                $p->update(['gestion_employee_id' => $body['data']['id']]);
            }
        } catch (\Throwable $e) {
            Log::warning('[Vinculación] No se creó el empleado en gestión', ['postulacion_id' => $p->id, 'error' => $e->getMessage()]);

            return $this->terminar($p, self::ERROR, 'No se pudo crear el empleado en gestión: ' . $e->getMessage());
        }

        $enviados = 0;
        $errores = [];

        foreach ($p->documentos()->whereNull('gestion_document_id')->get() as $doc) {
            try {
                $data = $this->gestion->enviarDocumento($p->gestion_employee_id, $doc);
                $doc->update([
                    'gestion_document_id' => $data['id'] ?? null,
                    'ruta_nas' => $data['path'] ?? null,
                    'enviado_at' => now(),
                    'error_envio' => null,
                ]);
                $enviados++;
            } catch (\Throwable $e) {
                Log::warning('[Vinculación] No se envió un documento a gestión', [
                    'postulacion_id' => $p->id,
                    'documento_id' => $doc->id,
                    'error' => $e->getMessage(),
                ]);
                $doc->update(['error_envio' => $e->getMessage()]);
                $errores[] = ['documento' => $doc->archivo_nombre, 'error' => $e->getMessage()];
            }
        }

        // Solo se cierra cuando todo llegó; si algo falló se reintenta con el
        // mismo botón y el empleado ya creado no se duplica.
        if ($errores) {
            return $this->terminar($p, self::ERROR,
                "El empleado #{$p->gestion_employee_id} quedó creado en gestión, pero " . count($errores) . ' documento(s) no se enviaron: '
                . collect($errores)->map(fn ($e) => "{$e['documento']} ({$e['error']})")->implode('; ')
                . '. Vuelva a oprimir «Vincular» para reintentar.',
                $enviados, $errores);
        }

        $this->proceso->marcarVinculado($p, $user, $p->gestion_employee_id);

        return $this->terminar($p, self::COMPLETO,
            "Empleado #{$p->gestion_employee_id} creado en gestión. {$enviados} documento(s) archivados en el NAS.", $enviados);
    }

    private function terminar(Postulacion $p, string $estado, string $mensaje, int $enviados = 0, array $errores = []): array
    {
        $p->update(['vinculacion_estado' => $estado, 'vinculacion_mensaje' => $mensaje]);

        return [
            'empleado_id' => $p->gestion_employee_id,
            'enviados' => $enviados,
            'errores' => $errores,
            'completo' => $estado === self::COMPLETO,
        ];
    }

    private function datosEmpleado(Postulacion $p, ?User $user): array
    {
        $datos = $p->datos_vinculacion ?? [];
        $payload = [
            'recruitment_ref' => "postulacion:{$p->id}",
            'registered_by' => $user?->name,
            'notes' => $p->perfilCargo ? "Cargo en reclutamiento: {$p->perfilCargo->nombre}." : null,
        ];

        foreach (self::MAPA as $campo => $destino) {
            if (!blank($datos[$campo] ?? null)) {
                $payload[$destino] = $datos[$campo];
            }
        }

        return array_filter($payload, fn ($v) => $v !== null);
    }
}
