<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Candidato;
use App\Services\GeminiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class IaSearchController extends Controller
{
    public function chatSearch(Request $request, GeminiService $gemini): JsonResponse
    {
        $validated = $request->validate([
            'query'   => 'required|string|max:1000',
            'history' => 'nullable|array',
        ]);

        try {
            // Obtener todos los candidatos con CV procesados
            $candidatos = Candidato::with(['postulacion.perfilCargo', 'evaluaciones'])
                ->where('estado_parseo', 'procesado')
                ->get();

            // Contar candidatos pendientes de analizar
            $pendientesAnalisis = Candidato::where('estado_parseo', '!=', 'procesado')->count();

            // Mapear a una estructura compacta pero con todo el detalle de educación y experiencia laboral
            $compactData = $candidatos->map(function ($c) {
                $post = $c->postulacion;
                $eval = $c->evaluaciones->first();
                $datos = $c->datos_extraidos ?? [];

                return [
                    'postulacion_id'      => $post->id,
                    'nombre_completo'    => $post->nombre_completo,
                    'email'              => $post->email,
                    'cargo_postulado'    => $post->perfilCargo?->nombre ?? 'Sin cargo asignado',
                    'anos_experiencia'   => $datos['años_experiencia_total'] ?? 0,
                    'educacion'          => $datos['educacion'] ?? [],
                    'experiencia_detallada' => $datos['experiencia'] ?? [],
                    'habilidades'        => array_merge($datos['habilidades_tecnicas'] ?? [], $datos['habilidades_blandas'] ?? []),
                    'certificaciones'    => $datos['certificaciones'] ?? [],
                    'maquinaria'         => $datos['maquinaria_equipos'] ?? [],
                    'ciudad'             => $datos['ciudad'] ?? 'No especificada',
                    'resumen_profesional'=> $c->resumen_ia ?? $datos['resumen_profesional'] ?? '',
                    'recomendacion_ia'   => $eval?->recomendacion ?? 'Sin evaluar',
                    'puntaje_ia'         => $eval?->puntaje_total ?? null,
                ];
            })->toArray();

            $resultado = $gemini->chatSearch(
                $validated['query'],
                $compactData,
                $pendientesAnalisis,
                $validated['history'] ?? []
            );

            return response()->json($resultado);

        } catch (\Exception $e) {
            Log::error('IaSearchController chatSearch error: ' . $e->getMessage());
            return response()->json([
                'response' => '❌ Ocurrió un error en el asistente de inteligencia artificial: ' . $e->getMessage(),
                'postulacion_ids' => []
            ], 500);
        }
    }
}
