<?php

namespace App\Jobs;

use App\Models\Candidato;
use App\Models\Postulacion;
use App\Services\GeminiService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use App\Models\PerfilCargo;
use App\Models\EvaluacionIa;

class ProcessCvJob implements ShouldQueue
{
    use Queueable, InteractsWithQueue, SerializesModels;

    public int $tries = 3;
    public int $timeout = 120;

    public function __construct(public int $postulacionId) {}

    public function handle(GeminiService $gemini): void
    {
        $postulacion = Postulacion::findOrFail($this->postulacionId);

        // Crear o recuperar candidato
        $candidato = Candidato::firstOrCreate(
            ['postulacion_id' => $postulacion->id],
            ['estado_parseo' => 'pendiente']
        );

        $candidato->update(['estado_parseo' => 'procesando']);

        try {
            $archivoPath = Storage::disk('local')->path($postulacion->archivo_cv);

            if (!file_exists($archivoPath)) {
                throw new \Exception("Archivo CV no encontrado: {$postulacion->archivo_cv}");
            }

            $mime = $postulacion->archivo_mime ?? 'application/pdf';
            // Normalizar mime
            $extension = strtolower(pathinfo($postulacion->archivo_nombre ?? '', PATHINFO_EXTENSION));
            if ($extension === 'docx') {
                $mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            } elseif ($extension === 'doc') {
                $mime = 'application/msword';
            } else {
                $mime = 'application/pdf';
            }

            // Una sola llamada: extrae datos, asigna cargo y evalúa
            $perfilesActivos = PerfilCargo::where('activo', true)->get()->toArray();
            $resultado       = $gemini->analizarCV($archivoPath, $mime, $perfilesActivos);

            $datos = $resultado['datos'];

            // El nombre SIEMPRE debe salir de la hoja de vida analizada, no del
            // remitente del correo (p. ej. la esposa envía el CV del esposo).
            $updates = [];
            if (!empty($datos['nombre_completo'])) {
                $updates['nombre_completo'] = $datos['nombre_completo'];
            }
            if (!empty($datos['email']) && empty($postulacion->email)) {
                $updates['email'] = $datos['email'];
            }
            if (!empty($datos['telefono']) && empty($postulacion->telefono)) {
                $updates['telefono'] = $datos['telefono'];
            }
            if (!empty($datos['ciudad'])) {
                $updates['ciudad'] = $datos['ciudad'];
            }
            if ($updates) {
                $postulacion->update($updates);
            }

            $candidato->update([
                'datos_extraidos' => $datos,
                'resumen_ia'      => $datos['resumen_profesional'] ?? null,
                'estado_parseo'   => 'procesado',
                'modelo_ia'       => config('services.gemini.model'),
                'tokens_usados'   => $resultado['tokens'],
            ]);

            Log::info("CV procesado correctamente para postulación #{$postulacion->id}");

            // Auto-clasificación al Perfil de Cargo y evaluación (ya vienen en la misma respuesta)
            if (!empty($perfilesActivos)) {
                $perfilId = $resultado['perfil_id'];
                $ev       = $resultado['evaluacion'];
                if ($perfilId) {
                    $postulacion->update(['perfil_cargo_id' => $perfilId]);
                    Log::info("Postulación #{$postulacion->id} auto-clasificada al perfil ID {$perfilId}.");
                }
                if ($perfilId && $ev) {
                    // Los tokens de la llamada quedan contados en el candidato
                    EvaluacionIa::updateOrCreate(
                        ['candidato_id' => $candidato->id, 'perfil_cargo_id' => $perfilId],
                        [
                            'puntaje_total'          => $ev['puntaje_total'],
                            'puntaje_educacion'      => $ev['puntaje_educacion'] ?? 0,
                            'puntaje_experiencia'    => $ev['puntaje_experiencia'] ?? 0,
                            'puntaje_habilidades'    => $ev['puntaje_habilidades'] ?? 0,
                            'puntaje_perfil_general' => $ev['puntaje_perfil_general'] ?? 0,
                            'fortalezas'             => $ev['fortalezas'] ?? [],
                            'brechas'                => $ev['brechas'] ?? [],
                            'justificacion'          => $ev['justificacion'],
                            'recomendacion'          => $ev['recomendacion'],
                            'modelo_ia'              => config('services.gemini.model'),
                            'tokens_usados'          => null,
                        ]
                    );
                    Log::info("Candidato #{$candidato->id} evaluado. Score: {$ev['puntaje_total']}");
                } elseif (!$perfilId) {
                    Log::info("Postulación #{$postulacion->id} no encajó en ningún perfil activo.");
                }
            }

        } catch (\Exception $e) {
            Log::error("Error procesando CV #{$postulacion->id}: " . $e->getMessage());
            $candidato->update([
                'estado_parseo' => 'error',
                'error_parseo'  => $e->getMessage(),
            ]);
            $this->fail($e);
        }
    }
}
