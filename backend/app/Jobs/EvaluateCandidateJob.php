<?php

namespace App\Jobs;

use App\Models\Candidato;
use App\Models\EvaluacionIa;
use App\Models\PerfilCargo;
use App\Services\GeminiService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class EvaluateCandidateJob implements ShouldQueue
{
    use Queueable, InteractsWithQueue, SerializesModels;

    public int $tries = 2;
    public int $timeout = 90;

    public function __construct(
        public int $candidatoId,
        public int $perfilCargoId
    ) {}

    public function handle(GeminiService $gemini): void
    {
        $candidato = Candidato::with('postulacion')->findOrFail($this->candidatoId);
        $perfil    = PerfilCargo::findOrFail($this->perfilCargoId);

        if (!$candidato->datos_extraidos) {
            Log::warning("Candidato #{$this->candidatoId} sin datos extraídos, no se puede evaluar.");
            return;
        }

        try {
            $resultado = $gemini->evaluarCandidato(
                $candidato->datos_extraidos,
                $perfil->requisitos ?? [],
                $perfil->nombre
            );

            $ev = $resultado['evaluacion'];

            EvaluacionIa::updateOrCreate(
                [
                    'candidato_id'    => $this->candidatoId,
                    'perfil_cargo_id' => $this->perfilCargoId,
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

            Log::info("Candidato #{$this->candidatoId} evaluado para cargo '{$perfil->nombre}'. Score: {$ev['puntaje_total']}");
        } catch (\Exception $e) {
            Log::error("Error evaluando candidato #{$this->candidatoId}: " . $e->getMessage());
            $this->fail($e);
        }
    }
}
