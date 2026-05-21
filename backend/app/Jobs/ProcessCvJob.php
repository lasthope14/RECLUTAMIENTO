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
use App\Jobs\EvaluateCandidateJob;

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

            $resultado = $gemini->parsearCV($archivoPath, $mime);

            $datos = $resultado['datos'];

            // Actualizar nombre y email de la postulación si Gemini los encontró
            if (!empty($datos['nombre_completo']) && $postulacion->nombre_completo === 'Sin nombre') {
                $postulacion->update(['nombre_completo' => $datos['nombre_completo']]);
            }
            if (!empty($datos['email']) && empty($postulacion->email)) {
                $postulacion->update(['email' => $datos['email']]);
            }
            if (!empty($datos['telefono']) && empty($postulacion->telefono)) {
                $postulacion->update(['telefono' => $datos['telefono']]);
            }

            $candidato->update([
                'datos_extraidos' => $datos,
                'resumen_ia'      => $datos['resumen_profesional'] ?? null,
                'estado_parseo'   => 'procesado',
                'modelo_ia'       => config('services.gemini.model'),
                'tokens_usados'   => $resultado['tokens'],
            ]);

            Log::info("CV procesado correctamente para postulación #{$postulacion->id}");

            // Auto-clasificación al Perfil de Cargo
            $perfilesActivos = PerfilCargo::where('activo', true)->get()->toArray();
            if (!empty($perfilesActivos)) {
                $perfilId = $gemini->clasificarCandidato($datos, $perfilesActivos);
                if ($perfilId) {
                    $postulacion->update(['perfil_cargo_id' => $perfilId]);
                    Log::info("Postulación #{$postulacion->id} auto-clasificada al perfil ID {$perfilId}. Lanzando evaluación.");
                    EvaluateCandidateJob::dispatchSync($candidato->id, $perfilId);
                } else {
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
