<?php

namespace App\Console\Commands;

use App\Models\Candidato;
use App\Models\EvaluacionIa;
use App\Models\PerfilCargo;
use App\Models\Postulacion;
use App\Services\GeminiService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;

class ReevaluarCandidatosCommand extends Command
{
    protected $signature   = 'candidatos:re-evaluar-todo';
    protected $description = 'Limpia perfiles antiguos, carga los 14 perfiles del Manual F-27 V-03 y re-clasifica/re-evalúa a todos los candidatos mediante la API de Gemini';

    public function handle(GeminiService $gemini): int
    {
        $this->info("===============================================================");
        $this->info("🚀 INICIANDO MIGRACIÓN DE PERFILES Y RE-EVALUACIÓN IA");
        $this->info("===============================================================");

        // 1. Limpiar perfiles antiguos
        $this->info("🧹 Eliminando todos los perfiles de cargo existentes para evitar conflictos...");
        PerfilCargo::query()->delete();
        $this->info("✅ Perfiles eliminados. Las postulaciones han sido desvinculadas temporalmente.");

        // 2. Sembrar nuevos perfiles
        $this->info("🌱 Cargando los 14 perfiles oficiales del Manual Unificado F-27 V-03...");
        Artisan::call('db:seed', ['--class' => 'Database\\Seeders\\DatabaseSeeder']);
        $this->info(Artisan::output());
        $this->info("✅ Siembra de nuevos perfiles completada con éxito.");

        // 3. Obtener candidatos procesados
        $candidatos = Candidato::where('estado_parseo', 'procesado')
            ->with('postulacion')
            ->get();

        $total = $candidatos->count();
        $this->info("🎯 Encontrados {$total} candidatos con datos de CV parseados y listos para procesar.");

        if ($total === 0) {
            $this->warn("⚠️ No se encontraron candidatos con estado 'procesado' en la base de datos.");
            return Command::SUCCESS;
        }

        $perfilesActivos = PerfilCargo::where('activo', true)->get()->toArray();
        $this->info("📋 Cargados los 14 perfiles de cargo activos para la auto-clasificación.");

        // Barra de progreso
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $successCount = 0;
        $unclassifiedCount = 0;
        $errorCount = 0;

        foreach ($candidatos as $index => $candidato) {
            $postulacion = $candidato->postulacion;
            if (!$postulacion) {
                $bar->advance();
                continue;
            }

            $nombreCandidato = $postulacion->nombre_completo ?? 'Candidato #' . $candidato->id;

            try {
                // 1. Clasificar con Gemini
                $perfilAsignadoId = $gemini->clasificarCandidato($candidato->datos_extraidos, $perfilesActivos);

                if ($perfilAsignadoId) {
                    $perfil = PerfilCargo::find($perfilAsignadoId);

                    if ($perfil) {
                        // Asociar a la postulación
                        $postulacion->update(['perfil_cargo_id' => $perfilAsignadoId]);

                        // 2. Evaluar con Gemini
                        $resultado = $gemini->evaluarCandidato(
                            $candidato->datos_extraidos,
                            $perfil->requisitos ?? [],
                            $perfil->nombre
                        );

                        $ev = $resultado['evaluacion'];

                        // Guardar evaluación en la base de datos
                        EvaluacionIa::updateOrCreate(
                            [
                                'candidato_id'    => $candidato->id,
                                'perfil_cargo_id' => $perfilAsignadoId,
                            ],
                            [
                                'puntaje_total'          => $ev['puntaje_total'],
                                'puntaje_educacion'      => $ev['puntaje_educacion'],
                                'puntaje_experiencia'    => $ev['puntaje_experiencia'],
                                'puntaje_habilidades'    => $ev['puntaje_habilidades'],
                                'puntaje_perfil_general' => $ev['puntaje_perfil_general'],
                                'fortalezas'             => $ev['fortalezas'],
                                'brechas'                => $ev['brechas'],
                                'justificacion'          => $ev['justificacion'],
                                'recomendacion'          => $ev['recomendacion'],
                                'modelo_ia'              => config('services.gemini.model'),
                                'tokens_usados'          => $resultado['tokens'],
                            ]
                        );

                        $successCount++;
                        Log::info("Re-evaluación exitosa: Candidate '{$nombreCandidato}' clasificado como '{$perfil->nombre}' con score {$ev['puntaje_total']}");
                    } else {
                        $errorCount++;
                        Log::warning("Candidato #{$candidato->id} clasificado a un ID de perfil inexistente: {$perfilAsignadoId}");
                    }
                } else {
                    // No encaja en ningún perfil
                    $postulacion->update(['perfil_cargo_id' => null]);
                    $unclassifiedCount++;
                    Log::info("Re-evaluación: Candidate '{$nombreCandidato}' no clasifica en ningún perfil de cargo oficial.");
                }

            } catch (\Exception $e) {
                $errorCount++;
                Log::error("Error en re-evaluación del candidato #{$candidato->id} ({$nombreCandidato}): " . $e->getMessage());
                // Mensaje en consola sin interrumpir la barra de progreso de forma drástica
                $this->output->write("\n❌ Error en {$nombreCandidato}: " . $e->getMessage() . "\n");
            }

            // Retardo de 1 segundo para no saturar los límites de peticiones (RPM/TPM) de la API de Gemini
            sleep(1);
            $bar->advance();
        }

        $bar->finish();
        $this->info("\n");
        $this->info("===============================================================");
        $this->info("📊 RESUMEN DEL PROCESO DE MIGRACIÓN");
        $this->info("===============================================================");
        $this->info("✅ Clasificados y Evaluados con Éxito: {$successCount}");
        $this->info("⏭️  Sin clasificar (no encajaron):       {$unclassifiedCount}");
        $this->info("❌ Errores encontrados:                 {$errorCount}");
        $this->info("===============================================================");

        return $errorCount === 0 ? Command::SUCCESS : Command::FAILURE;
    }
}
