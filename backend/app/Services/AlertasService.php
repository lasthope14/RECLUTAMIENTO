<?php

namespace App\Services;

use App\Mail\AlertaMail;
use App\Models\AlertaEnviada;
use App\Models\ConfiguracionAlerta;
use App\Models\DocumentoAspirante;
use App\Models\Postulacion;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Alertas por correo del proceso de selección.
 *
 * Ninguna norma colombiana fija un plazo para responderle a un aspirante: los
 * plazos de aquí son política interna, en días hábiles (sin fines de semana
 * ni festivos) y se ajustan desde la pantalla de Alertas.
 *
 * La ARL sí cuesta por día: si alguien se afilia y no llega a trabajar, la
 * empresa paga cotización hasta que se reporte el retiro. Por eso hay un
 * aviso inmediato al cargar la afiliación y un seguimiento diario de quien
 * está afiliado sin haber ingresado.
 */
class AlertasService
{
    public const CODIGO_ARL = 'SS-ARL';

    public const DEFAULTS = [
        'activo' => true,
        // Vacío: se envía a los administradores de la app.
        'destinatarios' => [],
        // Además de los anteriores, quién recibe los avisos de ARL (gerencia, contabilidad).
        'destinatarios_arl' => [],
        'dias_hv_sin_revisar' => 5,
        'dias_respuesta_descartado' => 3,
        'dias_fase' => [
            'entrevista' => 5,
            'pruebas' => 5,
            'referencias' => 3,
            'examen_medico' => 5,
            'documentacion' => 5,
            'vinculacion' => 2,
        ],
        // Días hábiles tras la fecha de ingreso sin vincular ni marcar asistencia.
        'dias_arl_sin_ingreso' => 1,
    ];

    /**
     * Tarifa de cotización a la ARL por clase de riesgo, sobre el IBC
     * (Decreto 1772 de 1994, art. 13; compilado en el Decreto 1072 de 2015).
     */
    public const TARIFAS_ARL = [1 => 0.00522, 2 => 0.01044, 3 => 0.02436, 4 => 0.04350, 5 => 0.06960];

    /** Estados del seguimiento de ARL que requieren acción. */
    public const ARL_ALERTA = ['no_continuo', 'sin_vincular', 'sin_marcacion'];

    public function __construct(private readonly GestionClient $gestion)
    {
    }

    // ---------------------------------------------------------------------
    // Configuración
    // ---------------------------------------------------------------------

    public function config(): array
    {
        $guardado = ConfiguracionAlerta::pluck('valor', 'clave')->all();
        $config = array_replace(self::DEFAULTS, array_intersect_key($guardado, self::DEFAULTS));
        $config['dias_fase'] = array_replace(self::DEFAULTS['dias_fase'], (array) ($guardado['dias_fase'] ?? []));

        return $config;
    }

    public function guardarConfig(array $datos): array
    {
        foreach (array_intersect_key($datos, self::DEFAULTS) as $clave => $valor) {
            ConfiguracionAlerta::updateOrCreate(['clave' => $clave], ['valor' => $valor]);
        }

        return $this->config();
    }

    /** Correos que reciben el resumen (y, con $arl, también los de ARL). */
    public function destinatarios(bool $arl = false): array
    {
        $config = $this->config();
        $lista = $config['destinatarios'] ?: User::where('role_id', 1)->whereNotNull('email')->pluck('email')->all();

        if ($arl) {
            $lista = array_merge($lista, $config['destinatarios_arl']);
        }

        return array_values(array_unique(array_filter(array_map('trim', $lista))));
    }

    // ---------------------------------------------------------------------
    // Días hábiles
    // ---------------------------------------------------------------------

    public static function esHabil(Carbon $dia): bool
    {
        return !$dia->isWeekend() && !ColombianHolidays::isHoliday($dia->toDateString());
    }

    /** Días hábiles transcurridos después de $desde y hasta $hasta (incluido). */
    public static function diasHabiles(Carbon $desde, ?Carbon $hasta = null): int
    {
        $hasta = ($hasta ?? now())->copy()->startOfDay();
        $dia = $desde->copy()->startOfDay()->addDay();
        $n = 0;

        // Tope por si llega una fecha absurda: nadie necesita contar más de dos años.
        for ($i = 0; $dia->lte($hasta) && $i < 800; $i++, $dia->addDay()) {
            if (self::esHabil($dia)) {
                $n++;
            }
        }

        return $n;
    }

    // ---------------------------------------------------------------------
    // Qué está pendiente
    // ---------------------------------------------------------------------

    /**
     * Todo lo que ya pasó de su plazo, agrupado por regla.
     *
     * @return array{hv_sin_revisar: Collection, sin_respuesta: Collection, fases_estancadas: Collection, arl: Collection}
     */
    public function pendientes(): array
    {
        $config = $this->config();

        $hvSinRevisar = Postulacion::with('perfilCargo:id,nombre')
            ->where('estado', 'recibida')
            ->orderBy('fecha_recepcion')
            ->get(['id', 'nombre_completo', 'perfil_cargo_id', 'ciudad', 'fecha_recepcion', 'created_at'])
            ->map(fn ($p) => [
                'id' => $p->id,
                'nombre' => $p->nombre_completo,
                'cargo' => $p->perfilCargo?->nombre,
                'desde' => ($p->fecha_recepcion ?? $p->created_at)->toDateString(),
                'dias' => self::diasHabiles($p->fecha_recepcion ?? $p->created_at),
            ])
            ->filter(fn ($i) => $i['dias'] > $config['dias_hv_sin_revisar'])
            ->values();

        // Descartados a los que no se les ha enviado ningún correo.
        $sinRespuesta = Postulacion::with('perfilCargo:id,nombre')
            ->where('estado', 'descartado')
            ->whereDoesntHave('emailLogs', fn ($q) => $q->where('estado', 'enviado'))
            ->orderBy('updated_at')
            ->get(['id', 'nombre_completo', 'email', 'perfil_cargo_id', 'fase', 'updated_at'])
            ->map(fn ($p) => [
                'id' => $p->id,
                'nombre' => $p->nombre_completo,
                'cargo' => $p->perfilCargo?->nombre,
                'email' => $p->email,
                'fase' => ProcesoSeleccionService::etiqueta($p->fase) ?? 'Revisión de hoja de vida',
                'desde' => $p->updated_at->toDateString(),
                'dias' => self::diasHabiles($p->updated_at),
            ])
            ->filter(fn ($i) => $i['dias'] > $config['dias_respuesta_descartado'])
            ->values();

        $fasesEstancadas = $this->fasesEstancadas($config);

        $arl = $this->seguimientoArl()
            ->filter(fn ($c) => in_array($c['estado'], self::ARL_ALERTA, true))
            ->values();

        return [
            'hv_sin_revisar' => $hvSinRevisar,
            'sin_respuesta' => $sinRespuesta,
            'fases_estancadas' => $fasesEstancadas,
            'arl' => $arl,
        ];
    }

    private function fasesEstancadas(array $config): Collection
    {
        $enProceso = Postulacion::with(['perfilCargo:id,nombre', 'documentos'])
            ->whereNotNull('fase')
            ->where('fase', '!=', ProcesoSeleccionService::VINCULADO)
            ->where('estado', '!=', 'descartado')
            ->orderBy('fase_desde')
            ->get();

        try {
            $catalogo = $this->gestion->catalogo();
        } catch (\Throwable) {
            $catalogo = null;
        }
        $vinculacion = app(VinculacionService::class);

        return $enProceso
            ->map(function (Postulacion $p) use ($config, $catalogo, $vinculacion) {
                $dias = self::diasHabiles($p->fase_desde ?? $p->updated_at);
                $plazo = (int) ($config['dias_fase'][$p->fase] ?? 5);

                return [
                    'id' => $p->id,
                    'nombre' => $p->nombre_completo,
                    'cargo' => $p->perfilCargo?->nombre,
                    'fase' => ProcesoSeleccionService::etiqueta($p->fase),
                    'desde' => ($p->fase_desde ?? $p->updated_at)->toDateString(),
                    'dias' => $dias,
                    'plazo' => $plazo,
                    'documentos_faltantes' => $catalogo && in_array($p->fase, ['documentacion', 'vinculacion'], true)
                        ? $vinculacion->faltantes($p, $catalogo)
                        : [],
                ];
            })
            ->filter(fn ($i) => $i['dias'] > $i['plazo'])
            ->values();
    }

    // ---------------------------------------------------------------------
    // Seguimiento de la ARL
    // ---------------------------------------------------------------------

    /**
     * Cada aspirante con afiliación a la ARL cargada y en qué va:
     *   ingreso_confirmado → ya trabaja (marcó asistencia o alguien lo confirmó)
     *   retiro_reportado   → no ingresó y ya se reportó el retiro ante la ARL
     *   no_continuo        → se afilió y salió del proceso: ¡reportar retiro!
     *   sin_vincular       → pasó la fecha de ingreso y no se ha vinculado
     *   sin_marcacion      → vinculado, pero sin ninguna marcación de asistencia
     *   en_espera          → aún no llega la fecha de ingreso
     *
     * Con $desde/$hasta se limita a las afiliaciones de ese periodo.
     */
    public function seguimientoArl(?Carbon $desde = null, ?Carbon $hasta = null, ?int $soloPostulacion = null): Collection
    {
        $docs = DocumentoAspirante::where('codigo', self::CODIGO_ARL)
            ->when($soloPostulacion, fn ($q) => $q->where('postulacion_id', $soloPostulacion))
            ->orderByDesc('id')
            ->get()
            ->unique('postulacion_id');

        if ($docs->isEmpty()) {
            return collect();
        }

        $postulaciones = Postulacion::with('perfilCargo:id,nombre')->whereIn('id', $docs->pluck('postulacion_id'))->get()->keyBy('id');

        $empleados = $postulaciones->pluck('gestion_employee_id')->filter()->values()->all();
        $asistencia = [];
        $errorGestion = null;
        try {
            $asistencia = $this->gestion->asistencia($empleados);
        } catch (\Throwable $e) {
            $errorGestion = $e->getMessage();
        }

        $plazo = (int) $this->config()['dias_arl_sin_ingreso'];

        return $docs
            ->map(function (DocumentoAspirante $doc) use ($postulaciones, $asistencia, $errorGestion, $plazo) {
                $p = $postulaciones[$doc->postulacion_id] ?? null;
                if (!$p) {
                    return null;
                }

                $datos = $p->datos_vinculacion ?? [];
                $afiliacion = ($doc->fecha_expedicion ?? $doc->created_at)->copy()->startOfDay();
                $ingreso = !empty($datos['fecha_ingreso']) ? Carbon::parse($datos['fecha_ingreso']) : $afiliacion->copy()->addDay();
                $marcas = $p->gestion_employee_id ? ($asistencia[$p->gestion_employee_id] ?? null) : null;
                $vencido = self::diasHabiles($ingreso) > $plazo;

                $estado = match (true) {
                    $p->arl_seguimiento === 'retiro_reportado' => 'retiro_reportado',
                    $p->arl_seguimiento === 'ingreso_confirmado', !empty($marcas['primera_marcacion']) => 'ingreso_confirmado',
                    $p->estado === 'descartado' => 'no_continuo',
                    $p->fase !== ProcesoSeleccionService::VINCULADO && $vencido => 'sin_vincular',
                    $p->fase === ProcesoSeleccionService::VINCULADO && $vencido && $errorGestion === null => 'sin_marcacion',
                    default => 'en_espera',
                };

                // Días de ARL pagados sin que la persona trabajara: desde la
                // afiliación hasta el reporte del retiro (o hasta hoy, si sigue pendiente).
                $diasSinTrabajo = match ($estado) {
                    'retiro_reportado' => $afiliacion->diffInDays(Carbon::parse($p->arl_seguimiento_fecha ?? now())) + 1,
                    'no_continuo', 'sin_vincular', 'sin_marcacion' => $afiliacion->diffInDays(now()->startOfDay()) + 1,
                    default => 0,
                };
                $diasSinTrabajo = max(0, (int) $diasSinTrabajo);

                $salario = (float) ($datos['salario'] ?? 0);
                $tarifa = self::TARIFAS_ARL[(int) ($datos['clase_riesgo_arl'] ?? 0)] ?? null;
                $costoDia = $salario > 0 && $tarifa ? round($salario * $tarifa / 30, 0) : null;

                return [
                    'id' => $p->id,
                    'nombre' => $p->nombre_completo,
                    'cedula' => $p->cedula,
                    'cargo' => $datos['cargo'] ?? $p->perfilCargo?->nombre,
                    'fase' => ProcesoSeleccionService::etiqueta($p->fase),
                    'documento_id' => $doc->id,
                    'fecha_afiliacion' => $afiliacion->toDateString(),
                    'fecha_ingreso' => $ingreso->toDateString(),
                    'estado' => $estado,
                    'primera_marcacion' => $marcas['primera_marcacion'] ?? null,
                    'empleado_id' => $p->gestion_employee_id,
                    'seguimiento_fecha' => $p->arl_seguimiento_fecha?->toDateString(),
                    'seguimiento_por' => $p->arl_seguimiento_por,
                    'seguimiento_nota' => $p->arl_seguimiento_nota,
                    'clase_riesgo' => $datos['clase_riesgo_arl'] ?? null,
                    'costo_dia' => $costoDia,
                    'dias_sin_trabajo' => $diasSinTrabajo,
                    'costo_estimado' => $costoDia !== null ? $costoDia * $diasSinTrabajo : null,
                    'error_gestion' => $errorGestion,
                ];
            })
            ->filter()
            ->when($desde, fn ($c) => $c->filter(fn ($i) => $i['fecha_afiliacion'] >= $desde->toDateString()))
            ->when($hasta, fn ($c) => $c->filter(fn ($i) => $i['fecha_afiliacion'] <= $hasta->toDateString()))
            ->sortBy('fecha_afiliacion')
            ->values();
    }

    // ---------------------------------------------------------------------
    // Envío
    // ---------------------------------------------------------------------

    /**
     * Resumen diario con todo lo vencido. No manda nada si no hay pendientes
     * ni repite el mismo día, salvo con $forzar (el botón "Enviar ahora").
     */
    public function enviarResumen(bool $forzar = false): ?AlertaEnviada
    {
        $config = $this->config();
        if (!$config['activo'] && !$forzar) {
            return null;
        }

        if (!$forzar && AlertaEnviada::where('tipo', 'resumen_diario')->where('estado', 'enviado')->whereDate('created_at', today())->exists()) {
            return null;
        }

        $pendientes = $this->pendientes();
        $total = collect($pendientes)->sum(fn ($c) => $c->count());

        if ($total === 0 && !$forzar) {
            return null;
        }

        $arl = $pendientes['arl']->isNotEmpty();
        $asunto = $total === 0
            ? 'Selección: sin pendientes vencidos'
            : "Selección: {$total} pendiente(s) vencido(s)" . ($arl ? ' · ARL sin ingreso' : '');

        return $this->enviar(
            'resumen_diario',
            $asunto,
            $this->destinatarios($arl),
            'emails.alertas-resumen',
            ['pendientes' => $pendientes, 'config' => $config, 'total' => $total],
            $total,
            array_map(fn ($c) => $c->count(), $pendientes),
        );
    }

    /** Aviso inmediato: se cargó la afiliación a la ARL de un aspirante. Una sola vez por documento. */
    public function avisarAfiliacionArl(DocumentoAspirante $doc): ?AlertaEnviada
    {
        $referencia = "documento:{$doc->id}";
        if (AlertaEnviada::where('tipo', 'arl_afiliacion')->where('referencia', $referencia)->where('estado', 'enviado')->exists()) {
            return null;
        }

        $caso = $this->seguimientoArl(soloPostulacion: $doc->postulacion_id)->first();
        if (!$caso) {
            return null;
        }

        return $this->enviar(
            'arl_afiliacion',
            "ARL: se afilió a {$caso['nombre']} (ingreso previsto {$caso['fecha_ingreso']})",
            $this->destinatarios(arl: true),
            'emails.alerta-arl',
            ['caso' => $caso, 'plazo' => $this->config()['dias_arl_sin_ingreso']],
            1,
            ['arl' => 1],
            $doc->postulacion_id,
            $referencia,
        );
    }

    private function enviar(
        string $tipo,
        string $asunto,
        array $destinatarios,
        string $vista,
        array $datos,
        int $items,
        array $resumen,
        ?int $postulacionId = null,
        ?string $referencia = null,
    ): AlertaEnviada {
        $registro = [
            'tipo' => $tipo,
            'postulacion_id' => $postulacionId,
            'referencia' => $referencia,
            'asunto' => $asunto,
            'destinatarios' => implode(', ', $destinatarios),
            'items' => $items,
            'resumen' => $resumen,
        ];

        if (!$destinatarios) {
            return AlertaEnviada::create($registro + ['estado' => 'error', 'error' => 'No hay destinatarios configurados.']);
        }

        try {
            Mail::to($destinatarios)->send(new AlertaMail($asunto, $vista, $datos + ['urlApp' => rtrim(config('app.url'), '/')]));
        } catch (\Throwable $e) {
            Log::error('[Alertas] No se pudo enviar el correo', ['tipo' => $tipo, 'error' => $e->getMessage()]);

            return AlertaEnviada::create($registro + ['estado' => 'error', 'error' => $e->getMessage()]);
        }

        return AlertaEnviada::create($registro + ['estado' => 'enviado']);
    }
}
