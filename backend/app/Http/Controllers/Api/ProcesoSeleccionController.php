<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentoAspirante;
use App\Models\Postulacion;
use App\Models\PostulacionFase;
use App\Jobs\AvisarAfiliacionArlJob;
use App\Services\AlertasService;
use App\Services\GestionClient;
use App\Services\GestionException;
use App\Services\ProcesoSeleccionService;
use App\Services\VinculacionService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Proceso de selección de un aspirante (fases, documentos de ingreso y
 * vinculación a gestión) y el tablero con sus indicadores.
 */
class ProcesoSeleccionController extends Controller
{
    public function __construct(
        private readonly ProcesoSeleccionService $proceso,
        private readonly VinculacionService $vinculacion,
        private readonly GestionClient $gestion,
        private readonly AlertasService $alertas,
    ) {
    }

    /** Catálogo de gestión (tipos de documento, empresas, sedes...) y las fases. */
    public function catalogo(Request $request): JsonResponse
    {
        return $this->conGestion(fn () => response()->json(
            $this->gestion->catalogo($request->boolean('fresco')) + ['fases' => ProcesoSeleccionService::fases()]
        ));
    }

    /** Todo lo del proceso de un aspirante para la pestaña "Proceso". */
    public function show(Postulacion $postulacion): JsonResponse
    {
        $postulacion->load(['fases', 'documentos', 'perfilCargo:id,nombre']);

        try {
            $catalogo = $this->gestion->catalogo();
            $errorGestion = null;
        } catch (GestionException|ConnectionException $e) {
            $catalogo = [];
            $errorGestion = $e->getMessage();
        }

        return response()->json([
            'fase' => $postulacion->fase,
            'fase_label' => ProcesoSeleccionService::etiqueta($postulacion->fase),
            'fase_desde' => $postulacion->fase_desde,
            'estado' => $postulacion->estado,
            'en_proceso' => ProcesoSeleccionService::enProceso($postulacion),
            'fases' => ProcesoSeleccionService::fases(),
            'historial' => $postulacion->fases->map(fn (PostulacionFase $f) => $f->toArray() + [
                'fase_label' => ProcesoSeleccionService::etiqueta($f->fase),
            ]),
            'datos_vinculacion' => $this->datosConSugerencias($postulacion),
            'datos_faltantes' => $this->vinculacion->datosFaltantes($postulacion),
            'checklist' => $catalogo ? $this->vinculacion->checklist($postulacion, $catalogo) : [],
            'documentos_sin_catalogo' => $catalogo ? [] : $postulacion->documentos,
            'gestion_employee_id' => $postulacion->gestion_employee_id,
            'vinculado_at' => $postulacion->vinculado_at,
            'vinculado_por' => $postulacion->vinculado_por,
            'vinculacion' => [
                'estado' => $postulacion->vinculacion_estado,
                'en_marcha' => VinculacionService::enMarcha($postulacion),
                'mensaje' => $postulacion->vinculacion_mensaje,
                'solicitada_at' => $postulacion->vinculacion_solicitada_at,
                'documentos_enviados' => $postulacion->documentos->whereNotNull('gestion_document_id')->count(),
                'documentos_total' => $postulacion->documentos->count(),
            ],
            'arl' => $postulacion->documentos->contains('codigo', AlertasService::CODIGO_ARL)
                ? $this->alertas->seguimientoArl(soloPostulacion: $postulacion->id)->first()
                : null,
            'error_gestion' => $errorGestion,
        ]);
    }

    /**
     * Seguimiento de la afiliación a la ARL: confirmar que ingresó a trabajar
     * o dejar constancia de que se reportó el retiro ante la ARL. "limpiar"
     * deshace lo marcado.
     */
    public function arlSeguimiento(Request $request, Postulacion $postulacion): JsonResponse
    {
        $validated = $request->validate([
            'accion' => 'required|in:ingreso_confirmado,retiro_reportado,limpiar',
            'fecha'  => 'required_unless:accion,limpiar|nullable|date|before_or_equal:today',
            'nota'   => 'nullable|string|max:1000',
        ]);

        $postulacion->update($validated['accion'] === 'limpiar'
            ? ['arl_seguimiento' => null, 'arl_seguimiento_fecha' => null, 'arl_seguimiento_por' => null, 'arl_seguimiento_nota' => null]
            : [
                'arl_seguimiento' => $validated['accion'],
                'arl_seguimiento_fecha' => $validated['fecha'],
                'arl_seguimiento_por' => $request->user()?->name,
                'arl_seguimiento_nota' => $validated['nota'] ?? null,
            ]);

        return $this->show($postulacion->fresh());
    }

    public function iniciar(Request $request, Postulacion $postulacion): JsonResponse
    {
        $this->proceso->iniciar($postulacion, $request->user(), $request->input('observacion'));

        return $this->show($postulacion->fresh());
    }

    public function aprobar(Request $request, Postulacion $postulacion): JsonResponse
    {
        $request->validate(['observacion' => 'nullable|string|max:2000']);
        $this->proceso->aprobar($postulacion, $request->user(), $request->input('observacion'));

        return $this->show($postulacion->fresh());
    }

    public function noAprueba(Request $request, Postulacion $postulacion): JsonResponse
    {
        $request->validate(['motivo' => 'required|string|max:2000']);
        $this->proceso->noAprueba($postulacion, $request->user(), $request->input('motivo'));

        return $this->show($postulacion->fresh());
    }

    public function reabrir(Request $request, Postulacion $postulacion): JsonResponse
    {
        $request->validate(['observacion' => 'nullable|string|max:2000']);
        $this->proceso->reabrir($postulacion, $request->user(), $request->input('observacion'));

        return $this->show($postulacion->fresh());
    }

    /** Guarda los datos para crear el empleado (se pueden ir llenando por partes). */
    public function guardarDatos(Request $request, Postulacion $postulacion): JsonResponse
    {
        $this->exigirNoVinculado($postulacion);

        $datos = $request->validate([
            'cedula'              => 'nullable|string|max:20',
            'nombres'             => 'nullable|string|max:255',
            'apellidos'           => 'nullable|string|max:255',
            'email'               => 'nullable|email|max:255',
            'telefono'            => 'nullable|string|max:20',
            'cargo'               => 'nullable|string|max:255',
            'fecha_ingreso'       => 'nullable|date',
            'tipo_contrato'       => 'nullable|in:indefinido,fijo,obra_labor,prestacion_servicios',
            'fecha_fin_contrato'  => 'nullable|date',
            'tipo_empleado'       => 'nullable|in:field,administrative',
            'salario'             => 'nullable|numeric|min:0',
            'fecha_nacimiento'    => 'nullable|date',
            'genero'              => 'nullable|string|max:20',
            'direccion'           => 'nullable|string|max:255',
            'contacto_emergencia' => 'nullable|string|max:255',
            'telefono_emergencia' => 'nullable|string|max:20',
            'eps'                 => 'nullable|string|max:255',
            'arl'                 => 'nullable|string|max:255',
            'fondo_pension'       => 'nullable|string|max:255',
            'banco'               => 'nullable|string|max:255',
            'cuenta_bancaria'     => 'nullable|string|max:50',
            'tipo_cuenta'         => 'nullable|string|max:30',
            'company_id'          => 'nullable|integer',
            'location_id'         => 'nullable|integer',
            'schedule_id'         => 'nullable|integer',
            'department_id'       => 'nullable|integer',
            // Para estimar lo que cuesta cada día de ARL (tarifa por clase de riesgo).
            'clase_riesgo_arl'    => 'nullable|integer|between:1,5',
        ]);

        if (!empty($datos['cedula'])) {
            $datos['cedula'] = preg_replace('/\D/', '', $datos['cedula']);
        }

        $postulacion->update([
            'datos_vinculacion' => array_merge($postulacion->datos_vinculacion ?? [], $datos),
            'cedula' => $datos['cedula'] ?? $postulacion->cedula,
        ]);

        return $this->show($postulacion->fresh());
    }

    /** ¿La cédula ya pasó por la empresa? (activo, retirado o vetado en gestión) */
    public function verificarCedula(Postulacion $postulacion): JsonResponse
    {
        $cedula = $postulacion->cedula ?: ($postulacion->datos_vinculacion['cedula'] ?? null);
        abort_if(blank($cedula), 422, 'Primero registre la cédula del aspirante.');

        return $this->conGestion(fn () => response()->json($this->gestion->persona($cedula)));
    }

    public function subirDocumento(Request $request, Postulacion $postulacion): JsonResponse
    {
        $this->exigirNoVinculado($postulacion);

        $validated = $request->validate([
            'codigo'            => 'required|string|max:12',
            'archivo'           => 'required|file|max:25600|mimes:pdf,jpg,jpeg,png,webp,doc,docx,xls,xlsx',
            'fecha_expedicion'  => 'nullable|date',
            'fecha_vencimiento' => 'nullable|date',
            'detalle'           => 'nullable|string|max:100',
        ]);

        return $this->conGestion(function () use ($request, $postulacion, $validated) {
            $tipo = collect($this->gestion->catalogo()['document_types'] ?? [])->firstWhere('code', $validated['codigo']);
            abort_if(!$tipo, 422, 'Ese tipo de documento no existe en el catálogo de gestión.');

            // Con la fecha de expedición y la vigencia del tipo, el vencimiento sale solo.
            if (empty($validated['fecha_vencimiento']) && !empty($validated['fecha_expedicion']) && $tipo['validity_months']) {
                $validated['fecha_vencimiento'] = Carbon::parse($validated['fecha_expedicion'])
                    ->addMonths((int) $tipo['validity_months'])->toDateString();
            }

            $file = $request->file('archivo');
            $ruta = $file->storeAs(
                (string) $postulacion->id,
                Str::uuid() . '.' . Str::lower($file->getClientOriginalExtension()),
                DocumentoAspirante::DISCO,
            );

            $doc = $postulacion->documentos()->create([
                'codigo' => $validated['codigo'],
                'archivo' => $ruta,
                'archivo_nombre' => $file->getClientOriginalName(),
                'archivo_mime' => $file->getClientMimeType(),
                'tamano' => $file->getSize(),
                'fecha_expedicion' => $validated['fecha_expedicion'] ?? null,
                'fecha_vencimiento' => $validated['fecha_vencimiento'] ?? null,
                'detalle' => $validated['detalle'] ?? null,
                'user_id' => $request->user()?->id,
                'autor_nombre' => $request->user()?->name,
            ]);

            // La afiliación a la ARL avisa de inmediato: desde ahí se paga por día.
            if ($doc->codigo === AlertasService::CODIGO_ARL) {
                AvisarAfiliacionArlJob::dispatch($doc->id);
            }

            return response()->json($doc, 201);
        });
    }

    public function descargarDocumento(Postulacion $postulacion, DocumentoAspirante $documento)
    {
        abort_if($documento->postulacion_id !== $postulacion->id, 404);
        abort_if(!Storage::disk(DocumentoAspirante::DISCO)->exists($documento->archivo), 404, 'Archivo no encontrado');

        return Storage::disk(DocumentoAspirante::DISCO)->response($documento->archivo, $documento->archivo_nombre);
    }

    public function eliminarDocumento(Postulacion $postulacion, DocumentoAspirante $documento): JsonResponse
    {
        abort_if($documento->postulacion_id !== $postulacion->id, 404);
        abort_if($documento->enviado(), 422, 'Este documento ya está en gestión; corríjalo allá.');
        $this->exigirNoVinculado($postulacion);

        Storage::disk(DocumentoAspirante::DISCO)->delete($documento->archivo);
        $documento->delete();

        return response()->json(['message' => 'Documento eliminado']);
    }

    /**
     * El botón "Vincular a gestión": valida y deja el trabajo en la cola. La
     * pantalla sigue el avance consultando el proceso (vinculacion_estado).
     */
    public function vincular(Request $request, Postulacion $postulacion): JsonResponse
    {
        return $this->conGestion(function () use ($request, $postulacion) {
            $this->vinculacion->solicitar($postulacion, $request->user(), $request->boolean('aceptar_faltantes'));

            return response()->json($this->show($postulacion->fresh())->getData(true), 202);
        });
    }

    /**
     * Tablero: aspirantes en proceso por fase e indicadores del periodo
     * (por defecto, los últimos 90 días).
     */
    public function tablero(Request $request): JsonResponse
    {
        $desde = Carbon::parse($request->input('desde', now()->subDays(90)->toDateString()))->startOfDay();
        $hasta = Carbon::parse($request->input('hasta', now()->toDateString()))->endOfDay();

        $enProceso = Postulacion::with('perfilCargo:id,nombre')
            ->whereNotNull('fase')
            ->where('fase', '!=', ProcesoSeleccionService::VINCULADO)
            ->where('estado', '!=', 'descartado')
            ->withCount('documentos')
            ->orderBy('fase_desde')
            ->get(['id', 'nombre_completo', 'perfil_cargo_id', 'ciudad', 'fase', 'fase_desde', 'estado', 'gestion_employee_id']);

        $eventos = PostulacionFase::whereBetween('created_at', [$desde, $hasta])->get();
        $todos = PostulacionFase::whereIn('postulacion_id', $eventos->pluck('postulacion_id')->unique())
            ->orderBy('created_at')->orderBy('id')->get()->groupBy('postulacion_id');

        $indicadores = collect(ProcesoSeleccionService::FASES)->map(function ($label, $fase) use ($eventos, $todos) {
            $entraron = $eventos->where('fase', $fase)->where('evento', 'entra')->pluck('postulacion_id')->unique();
            $caidas = $eventos->where('fase', $fase)->where('evento', 'no_aprueba');

            // Días entre que entra a la fase y la aprueba o no la aprueba.
            $duraciones = [];
            foreach ($todos as $historial) {
                $entrada = null;
                foreach ($historial as $e) {
                    if ($e->fase !== $fase) {
                        continue;
                    }
                    if (in_array($e->evento, ['entra', 'reabre'], true)) {
                        $entrada = $e->created_at;
                    } elseif ($entrada && in_array($e->evento, ['aprueba', 'no_aprueba'], true)) {
                        $duraciones[] = $entrada->floatDiffInDays($e->created_at);
                        $entrada = null;
                    }
                }
            }

            return [
                'fase' => $fase,
                'label' => $label,
                'entraron' => $entraron->count(),
                'aprobaron' => $eventos->where('fase', $fase)->where('evento', 'aprueba')->pluck('postulacion_id')->unique()->count(),
                'no_aprobaron' => $caidas->pluck('postulacion_id')->unique()->count(),
                'dias_promedio' => $duraciones ? round(array_sum($duraciones) / count($duraciones), 1) : null,
                'motivos' => $caidas->sortByDesc('created_at')->take(5)->pluck('observacion')->filter()->values(),
            ];
        })->values();

        $vinculados = Postulacion::whereBetween('vinculado_at', [$desde, $hasta])->get(['id', 'fecha_recepcion', 'created_at', 'vinculado_at']);
        $inicios = PostulacionFase::whereIn('postulacion_id', $vinculados->pluck('id'))
            ->where('evento', 'entra')
            ->where('fase', array_key_first(ProcesoSeleccionService::FASES))
            ->get()->groupBy('postulacion_id')->map(fn ($g) => $g->min('created_at'));

        $promedio = fn ($valores) => $valores->isEmpty() ? null : round($valores->avg(), 1);

        // Preseleccionados a los que aún no se les ha abierto el proceso
        // (p. ej. los de antes de existir el proceso de selección).
        $porIniciar = Postulacion::with('perfilCargo:id,nombre')
            ->where('estado', 'preseleccionado')
            ->whereNull('fase')
            ->orderBy('updated_at')
            ->get(['id', 'nombre_completo', 'perfil_cargo_id', 'ciudad', 'updated_at']);

        // Los que no continuaron dentro del proceso: su fase y el motivo.
        $caidas = PostulacionFase::where('evento', 'no_aprueba')
            ->whereBetween('created_at', [$desde, $hasta])
            ->orderByDesc('created_at')->orderByDesc('id')
            ->get()
            ->unique('postulacion_id');
        $cerradas = Postulacion::with('perfilCargo:id,nombre')
            ->whereIn('id', $caidas->pluck('postulacion_id'))
            ->where('estado', 'descartado') // si se retomó, ya no cuenta como caído
            ->get(['id', 'nombre_completo', 'perfil_cargo_id', 'ciudad', 'fase'])
            ->keyBy('id');
        $noContinuaron = $caidas
            ->filter(fn ($e) => $cerradas->has($e->postulacion_id))
            ->map(fn ($e) => [
                'id' => $e->postulacion_id,
                'nombre_completo' => $cerradas[$e->postulacion_id]->nombre_completo,
                'cargo' => $cerradas[$e->postulacion_id]->perfilCargo?->nombre,
                'ciudad' => $cerradas[$e->postulacion_id]->ciudad,
                'fase' => $e->fase,
                'fase_label' => ProcesoSeleccionService::etiqueta($e->fase),
                'motivo' => $e->observacion,
                'fecha' => $e->created_at,
                'autor' => $e->autor_nombre,
            ])
            ->values();

        // Descartados en la revisión de hojas de vida, antes del proceso. No
        // tienen un motivo registrado aparte: se muestran las notas de RR. HH.
        $descartadosRevision = Postulacion::with('perfilCargo:id,nombre')
            ->where('estado', 'descartado')
            ->whereNull('fase')
            ->whereBetween('updated_at', [$desde, $hasta])
            ->orderByDesc('updated_at')
            ->get(['id', 'nombre_completo', 'perfil_cargo_id', 'ciudad', 'notas_hr', 'updated_at'])
            ->map(fn ($p) => [
                'id' => $p->id,
                'nombre_completo' => $p->nombre_completo,
                'cargo' => $p->perfilCargo?->nombre,
                'ciudad' => $p->ciudad,
                'motivo' => $p->notas_hr,
                'fecha' => $p->updated_at,
            ]);

        $listaVinculados = Postulacion::with('perfilCargo:id,nombre')
            ->whereBetween('vinculado_at', [$desde, $hasta])
            ->orderByDesc('vinculado_at')
            ->get(['id', 'nombre_completo', 'perfil_cargo_id', 'ciudad', 'gestion_employee_id', 'vinculado_at', 'vinculado_por'])
            ->map(fn ($p) => [
                'id' => $p->id,
                'nombre_completo' => $p->nombre_completo,
                'cargo' => $p->perfilCargo?->nombre,
                'ciudad' => $p->ciudad,
                'empleado_id' => $p->gestion_employee_id,
                'fecha' => $p->vinculado_at,
                'autor' => $p->vinculado_por,
            ]);

        // ARL: afiliaciones del periodo y cuánto se ha pagado sin que la persona trabajara.
        $arl = $this->alertas->seguimientoArl($desde, $hasta);
        $arlSinIngreso = $arl->filter(fn ($c) => in_array($c['estado'], [...AlertasService::ARL_ALERTA, 'retiro_reportado'], true));

        return response()->json([
            'desde' => $desde->toDateString(),
            'hasta' => $hasta->toDateString(),
            'fases' => ProcesoSeleccionService::fases(),
            'arl' => $arl,
            'en_proceso' => $enProceso,
            'por_iniciar' => $porIniciar,
            'no_continuaron' => $noContinuaron,
            'descartados_revision' => $descartadosRevision,
            'vinculados' => $listaVinculados,
            'indicadores' => $indicadores,
            'resumen' => [
                'en_proceso' => $enProceso->count(),
                'arl_afiliados' => $arl->count(),
                'arl_sin_ingreso' => $arlSinIngreso->count(),
                'arl_pendientes' => $arl->whereIn('estado', AlertasService::ARL_ALERTA)->count(),
                'arl_dias_sin_trabajo' => $arlSinIngreso->sum('dias_sin_trabajo'),
                'arl_costo_estimado' => $arlSinIngreso->sum(fn ($c) => $c['costo_estimado'] ?? 0),
                'arl_costo_incompleto' => $arlSinIngreso->contains(fn ($c) => $c['costo_estimado'] === null),
                'iniciados' => $eventos->where('evento', 'entra')->where('fase', array_key_first(ProcesoSeleccionService::FASES))->pluck('postulacion_id')->unique()->count(),
                'no_continuaron' => $eventos->where('evento', 'no_aprueba')->pluck('postulacion_id')->unique()->count(),
                'vinculados' => $vinculados->count(),
                // Desde que llegó la hoja de vida hasta que quedó como empleado.
                'dias_hasta_vinculacion' => $promedio($vinculados->map(
                    fn ($p) => ($p->fecha_recepcion ?? $p->created_at)->floatDiffInDays($p->vinculado_at)
                )),
                // Solo el proceso de selección (desde la primera fase).
                'dias_proceso' => $promedio($vinculados->filter(fn ($p) => $inicios->has($p->id))->map(
                    fn ($p) => Carbon::parse($inicios[$p->id])->floatDiffInDays($p->vinculado_at)
                )),
            ],
        ]);
    }

    /**
     * Sugerencias para el formulario de vinculación con lo que ya se sabe del
     * aspirante (nombre, correo, teléfono, cargo). No se guardan hasta que el
     * usuario guarda el formulario.
     */
    private function datosConSugerencias(Postulacion $p): array
    {
        $datos = $p->datos_vinculacion ?? [];

        if (blank($datos['nombres'] ?? null) && blank($datos['apellidos'] ?? null)) {
            $partes = preg_split('/\s+/', trim((string) $p->nombre_completo));
            // "Juan Carlos Pérez Gómez": dos nombres y dos apellidos es lo más común.
            $corte = count($partes) >= 4 ? 2 : (count($partes) >= 2 ? 1 : count($partes));
            $datos['nombres'] = implode(' ', array_slice($partes, 0, $corte));
            $datos['apellidos'] = implode(' ', array_slice($partes, $corte));
        }

        $datos['email'] ??= $p->email;
        $datos['telefono'] ??= $p->telefono;
        $datos['cargo'] ??= $p->perfilCargo?->nombre;
        $datos['cedula'] ??= $p->cedula;

        return $datos;
    }

    private function exigirNoVinculado(Postulacion $p): void
    {
        abort_if($p->fase === ProcesoSeleccionService::VINCULADO, 422, 'El aspirante ya está vinculado: los cambios se hacen en gestión.');
        abort_if(VinculacionService::enMarcha($p), 409, 'Hay una vinculación en curso; espere a que termine.');
    }

    /** Los errores de conexión con gestión se muestran tal cual al usuario. */
    private function conGestion(callable $fn): JsonResponse
    {
        try {
            return $fn();
        } catch (GestionException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        } catch (ConnectionException $e) {
            return response()->json(['message' => 'No se pudo conectar con la app de gestión. Intente de nuevo en un momento.'], 502);
        }
    }
}
