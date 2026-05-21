<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Candidato;
use App\Models\EvaluacionIa;
use App\Models\Postulacion;
use App\Models\PerfilCargo;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $hoy    = now()->startOfDay();
        $semana = now()->subDays(7);
        $mes    = now()->subDays(30);

        return response()->json([
            'estadisticas' => [
                'total_postulaciones'  => Postulacion::count(),
                'hoy'                  => Postulacion::whereDate('created_at', today())->count(),
                'esta_semana'          => Postulacion::where('created_at', '>=', $semana)->count(),
                'este_mes'             => Postulacion::where('created_at', '>=', $mes)->count(),
                'recibidas'            => Postulacion::where('estado', 'recibida')->count(),
                'en_revision'          => Postulacion::where('estado', 'en_revision')->count(),
                'preseleccionados'     => Postulacion::where('estado', 'preseleccionado')->count(),
                'descartados'          => Postulacion::where('estado', 'descartado')->count(),
                'contratados'          => Postulacion::where('estado', 'contratado')->count(),
                'cvs_pendientes_ia'    => Candidato::where('estado_parseo', 'procesado')
                    ->whereHas('postulacion', function ($q) {
                        $q->whereNotNull('perfil_cargo_id');
                    })
                    ->whereDoesntHave('evaluaciones')
                    ->count(),
                'cvs_procesados'       => Candidato::where('estado_parseo', 'procesado')->count(),
                'evaluaciones_ia'      => EvaluacionIa::count(),
                'perfiles_activos'     => PerfilCargo::where('activo', true)->count(),
            ],
            'por_cargo' => Postulacion::selectRaw('perfil_cargo_id, count(*) as total')
                ->with('perfilCargo:id,nombre')
                ->whereNotNull('perfil_cargo_id')
                ->groupBy('perfil_cargo_id')
                ->get()
                ->map(fn($p) => [
                    'id'     => $p->perfil_cargo_id,
                    'nombre' => $p->perfilCargo?->nombre ?? 'Sin asignar',
                    'total'  => $p->total,
                ]),
            'por_fuente' => Postulacion::selectRaw('fuente, count(*) as total')
                ->groupBy('fuente')
                ->get(),
            'recientes' => Postulacion::with('perfilCargo:id,nombre')
                ->latest()
                ->limit(8)
                ->get(['id', 'nombre_completo', 'email', 'estado', 'fuente', 'perfil_cargo_id', 'created_at']),
        ]);
    }
}
