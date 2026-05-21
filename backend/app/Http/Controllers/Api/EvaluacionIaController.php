<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\EvaluateCandidateJob;
use App\Models\Candidato;
use App\Models\EvaluacionIa;
use App\Models\PerfilCargo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EvaluacionIaController extends Controller
{
    /**
     * Conteo rápido de candidatos pendientes de evaluación IA.
     * Usado por el indicador de progreso en tiempo real del frontend.
     */
    public function pendientesCount(): JsonResponse
    {
        $count = DB::table('candidatos')
            ->join('postulaciones', 'postulaciones.id', '=', 'candidatos.postulacion_id')
            ->whereNotNull('postulaciones.perfil_cargo_id')
            ->where('candidatos.estado_parseo', 'procesado')
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                  ->from('evaluaciones_ia')
                  ->whereColumn('evaluaciones_ia.candidato_id', 'candidatos.id')
                  ->whereColumn('evaluaciones_ia.perfil_cargo_id', 'postulaciones.perfil_cargo_id');
            })
            ->count();

        $procesando = Candidato::where('estado_parseo', 'procesando')->count();

        return response()->json([
            'pendientes'  => $count,
            'procesando'  => $procesando,
        ]);
    }

    /**
     * Ranking de candidatos para un cargo.
     */
    public function ranking(Request $request): JsonResponse
    {
        $request->validate(['perfil_cargo_id' => 'required|exists:perfiles_cargo,id']);

        $evaluaciones = EvaluacionIa::where('perfil_cargo_id', $request->perfil_cargo_id)
            ->with([
                'candidato.postulacion:id,nombre_completo,email,telefono,estado,fuente',
                'perfilCargo:id,nombre',
            ])
            ->orderByDesc('puntaje_total')
            ->get();

        return response()->json($evaluaciones);
    }

    /**
     * Lanzar evaluación de todos los candidatos procesados para un cargo.
     */
    public function evaluarTodos(Request $request): JsonResponse
    {
        $request->validate(['perfil_cargo_id' => 'required|exists:perfiles_cargo,id']);

        $perfil = PerfilCargo::findOrFail($request->perfil_cargo_id);

        // Candidatos con CV procesado que aún no tienen evaluación para este cargo
        $candidatos = Candidato::where('estado_parseo', 'procesado')
            ->whereDoesntHave('evaluaciones', fn($q) =>
                $q->where('perfil_cargo_id', $request->perfil_cargo_id)
            )
            ->get();

        $count = 0;
        foreach ($candidatos as $candidato) {
            EvaluateCandidateJob::dispatch($candidato->id, $request->perfil_cargo_id)->onQueue('default');
            $count++;
        }

        return response()->json([
            'message'  => "Se lanzaron {$count} evaluaciones para el cargo '{$perfil->nombre}'",
            'total'    => $count,
        ]);
    }

    /**
     * Evaluar un candidato específico para un cargo de forma síncrona.
     */
    public function evaluarUno(Request $request): JsonResponse
    {
        $request->validate([
            'candidato_id'    => 'required|exists:candidatos,id',
            'perfil_cargo_id' => 'required|exists:perfiles_cargo,id',
        ]);

        $candidato = Candidato::findOrFail($request->candidato_id);

        if ($candidato->estado_parseo !== 'procesado') {
            return response()->json(['message' => 'El CV de este candidato aún no ha sido procesado por IA'], 422);
        }

        // Ejecutar el Job de forma síncrona usando app()->call para inyectar GeminiService
        $job = new EvaluateCandidateJob($request->candidato_id, $request->perfil_cargo_id);
        app()->call([$job, 'handle']);

        // Obtener la evaluación recién creada para retornarla
        $evaluacion = EvaluacionIa::where('candidato_id', $request->candidato_id)
            ->where('perfil_cargo_id', $request->perfil_cargo_id)
            ->first();

        return response()->json([
            'message'    => 'Evaluación completada con éxito',
            'evaluacion' => $evaluacion
        ]);
    }

    /**
     * Obtener el listado de candidatos y cargos pendientes de evaluar.
     */
    public function pendientesList(): JsonResponse
    {
        $pendientes = DB::table('candidatos')
            ->join('postulaciones', 'postulaciones.id', '=', 'candidatos.postulacion_id')
            ->whereNotNull('postulaciones.perfil_cargo_id')
            ->where('candidatos.estado_parseo', 'procesado')
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                  ->from('evaluaciones_ia')
                  ->whereColumn('evaluaciones_ia.candidato_id', 'candidatos.id')
                  ->whereColumn('evaluaciones_ia.perfil_cargo_id', 'postulaciones.perfil_cargo_id');
            })
            ->select('candidatos.id as candidato_id', 'postulaciones.perfil_cargo_id', 'postulaciones.nombre_completo')
            ->get();

        return response()->json($pendientes);
    }

    /**
     * Evaluar todos los candidatos procesados que aún no tienen evaluación
     * para el cargo asignado en su postulación.
     */
    public function evaluarPendientes(): JsonResponse
    {
        $candidatos = Candidato::where('estado_parseo', 'procesado')
            ->with('postulacion:id,perfil_cargo_id')
            ->whereHas('postulacion', fn($q) => $q->whereNotNull('perfil_cargo_id'))
            ->get();

        $count = 0;
        foreach ($candidatos as $candidato) {
            $perfilId = $candidato->postulacion->perfil_cargo_id;
            $yaEvaluado = EvaluacionIa::where('candidato_id', $candidato->id)
                ->where('perfil_cargo_id', $perfilId)
                ->exists();
            if (!$yaEvaluado) {
                EvaluateCandidateJob::dispatch($candidato->id, $perfilId)->onQueue('default');
                $count++;
            }
        }

        return response()->json([
            'message' => "Se lanzaron {$count} evaluaciones pendientes en segundo plano",
            'total'   => $count,
        ]);
    }

    /**
     * Estadísticas por cargo.
     */
    public function estadisticas(int $perfilCargoId): JsonResponse
    {
        $evaluaciones = EvaluacionIa::where('perfil_cargo_id', $perfilCargoId)->get();

        return response()->json([
            'total'                => $evaluaciones->count(),
            'promedio_puntaje'     => round($evaluaciones->avg('puntaje_total'), 1),
            'altamente_recomendado'=> $evaluaciones->where('recomendacion', 'altamente_recomendado')->count(),
            'recomendado'          => $evaluaciones->where('recomendacion', 'recomendado')->count(),
            'con_reservas'         => $evaluaciones->where('recomendacion', 'con_reservas')->count(),
            'no_recomendado'       => $evaluaciones->where('recomendacion', 'no_recomendado')->count(),
        ]);
    }
}
