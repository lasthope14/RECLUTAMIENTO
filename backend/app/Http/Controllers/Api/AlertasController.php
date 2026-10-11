<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AlertaEnviada;
use App\Services\AlertasService;
use App\Services\ProcesoSeleccionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Pantalla de Alertas: configuración, pendientes de hoy e historial de envíos. */
class AlertasController extends Controller
{
    public function __construct(private readonly AlertasService $alertas)
    {
    }

    public function index(): JsonResponse
    {
        return response()->json([
            'config' => $this->alertas->config(),
            'destinatarios_efectivos' => $this->alertas->destinatarios(),
            'destinatarios_arl_efectivos' => $this->alertas->destinatarios(arl: true),
            'fases' => ProcesoSeleccionService::fases(),
            'pendientes' => $this->alertas->pendientes(),
            'historial' => AlertaEnviada::latest('created_at')->latest('id')->limit(30)->get(),
        ]);
    }

    public function guardar(Request $request): JsonResponse
    {
        $fases = implode(',', array_keys(ProcesoSeleccionService::FASES));

        $datos = $request->validate([
            'activo' => 'required|boolean',
            'destinatarios' => 'present|array|max:20',
            'destinatarios.*' => 'email',
            'destinatarios_arl' => 'present|array|max:20',
            'destinatarios_arl.*' => 'email',
            'dias_hv_sin_revisar' => 'required|integer|min:1|max:60',
            'dias_respuesta_descartado' => 'required|integer|min:1|max:60',
            'dias_arl_sin_ingreso' => 'required|integer|min:0|max:30',
            'dias_fase' => 'required|array',
            'dias_fase.*' => 'integer|min:1|max:60',
        ]);

        $datos['dias_fase'] = array_intersect_key($datos['dias_fase'], array_flip(explode(',', $fases)));

        $this->alertas->guardarConfig($datos);

        return $this->index();
    }

    /** "Enviar ahora": manda el resumen aunque ya se haya enviado hoy o no haya pendientes. */
    public function enviarAhora(): JsonResponse
    {
        $envio = $this->alertas->enviarResumen(forzar: true);

        return response()->json($envio, $envio?->estado === 'enviado' ? 200 : 502);
    }
}
