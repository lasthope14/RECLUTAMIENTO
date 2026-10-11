<?php

use App\Http\Controllers\Api\AlertasController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EvaluacionIaController;
use App\Http\Controllers\Api\IaSearchController;
use App\Http\Controllers\Api\IaConfigController;
use App\Http\Controllers\Api\NotificacionController;
use App\Http\Controllers\Api\PerfilCargoController;
use App\Http\Controllers\Api\PostulacionController;
use App\Http\Controllers\Api\ProcesoSeleccionController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\EmailTemplateController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Auth rutas
Route::post('/login', function (Request $request) {
    $request->validate([
        'email'    => 'required|email',
        'password' => 'required',
    ]);

    $user = \App\Models\User::where('email', $request->email)->first();

    if (!$user || !\Illuminate\Support\Facades\Hash::check($request->password, $user->password)) {
        return response()->json(['message' => 'Credenciales incorrectas'], 401);
    }

    $token = $user->createToken('hr-panel')->plainTextToken;
    return response()->json(['token' => $token, 'user' => $user]);
});

Route::middleware('auth:sanctum')->group(function () {

    Route::post('/logout', function (Request $request) {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Sesión cerrada']);
    });

    Route::get('/me', fn(Request $req) => response()->json($req->user()));

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Asistente Conversacional IA
    Route::post('/ia/chat-search', [IaSearchController::class, 'chatSearch']);
    Route::get('/ia/live-config', [IaConfigController::class, 'getLiveConfig']);

    // Perfiles de Cargo
    Route::apiResource('perfiles-cargo', PerfilCargoController::class);

    // Usuarios
    Route::apiResource('usuarios', UserController::class)
        ->parameters(['usuarios' => 'usuario'])
        ->middleware(\App\Http\Middleware\EnsureUserIsAdmin::class);

    // Postulaciones
    Route::get('/postulaciones/kanban', [PostulacionController::class, 'kanban']);
    Route::get('/postulaciones/ciudades', [PostulacionController::class, 'ciudades']);
    Route::get('/postulaciones/exportar', [PostulacionController::class, 'exportar']);
    Route::post('/postulaciones/{postulacion}/reprocesar', [PostulacionController::class, 'reprocesarCv']);
    Route::post('/postulaciones/{postulacion}/ia-sync', [PostulacionController::class, 'procesarIaSync']);
    Route::get('/postulaciones/{postulacion}/cv', [PostulacionController::class, 'descargarCv']);
    Route::patch('/postulaciones/{postulacion}/marca', [PostulacionController::class, 'toggleMarca']);
    Route::post('/postulaciones/{postulacion}/comentarios', [PostulacionController::class, 'agregarComentario']);
    Route::delete('/postulaciones/{postulacion}/comentarios/{comentario}', [PostulacionController::class, 'eliminarComentario']);
    Route::apiResource('postulaciones', PostulacionController::class)
        ->parameters(['postulaciones' => 'postulacion']);

    // Proceso de selección → vinculación a gestión (empleado + documentos al NAS)
    Route::get('/seleccion/catalogo', [ProcesoSeleccionController::class, 'catalogo']);
    Route::get('/seleccion/tablero', [ProcesoSeleccionController::class, 'tablero']);
    Route::prefix('postulaciones/{postulacion}')->group(function () {
        Route::get('/proceso', [ProcesoSeleccionController::class, 'show']);
        Route::post('/proceso/iniciar', [ProcesoSeleccionController::class, 'iniciar']);
        Route::post('/proceso/aprobar', [ProcesoSeleccionController::class, 'aprobar']);
        Route::post('/proceso/no-aprueba', [ProcesoSeleccionController::class, 'noAprueba']);
        Route::post('/proceso/reabrir', [ProcesoSeleccionController::class, 'reabrir']);
        Route::put('/vinculacion/datos', [ProcesoSeleccionController::class, 'guardarDatos']);
        Route::get('/vinculacion/verificar-cedula', [ProcesoSeleccionController::class, 'verificarCedula']);
        Route::post('/vinculacion', [ProcesoSeleccionController::class, 'vincular']);
        Route::post('/documentos', [ProcesoSeleccionController::class, 'subirDocumento']);
        Route::get('/documentos/{documento}', [ProcesoSeleccionController::class, 'descargarDocumento']);
        Route::delete('/documentos/{documento}', [ProcesoSeleccionController::class, 'eliminarDocumento']);
        Route::post('/arl-seguimiento', [ProcesoSeleccionController::class, 'arlSeguimiento']);
    });

    // Alertas por correo (resumen diario de vencidos + aviso de afiliación a la ARL).
    // Ver la pantalla es de todos; cambiar destinatarios/plazos o forzar un envío, de administradores.
    Route::get('/alertas', [AlertasController::class, 'index']);
    Route::middleware(\App\Http\Middleware\EnsureUserIsAdmin::class)->group(function () {
        Route::put('/alertas/config', [AlertasController::class, 'guardar']);
        Route::post('/alertas/enviar-ahora', [AlertasController::class, 'enviarAhora']);
    });

    // Evaluaciones IA
    Route::get('/evaluaciones/pendientes-count', [EvaluacionIaController::class, 'pendientesCount']);
    Route::get('/evaluaciones/pendientes', [EvaluacionIaController::class, 'pendientesList']);
    Route::get('/evaluaciones/ranking', [EvaluacionIaController::class, 'ranking']);
    Route::post('/evaluaciones/evaluar-pendientes', [EvaluacionIaController::class, 'evaluarPendientes']);
    Route::post('/evaluaciones/evaluar-todos', [EvaluacionIaController::class, 'evaluarTodos']);
    Route::post('/evaluaciones/evaluar-uno', [EvaluacionIaController::class, 'evaluarUno']);
    Route::get('/evaluaciones/estadisticas/{perfilCargoId}', [EvaluacionIaController::class, 'estadisticas']);

    // Notificaciones
    Route::post('/notificaciones/enviar', [NotificacionController::class, 'enviarPreseleccion']);
    Route::get('/notificaciones/plantillas', [NotificacionController::class, 'plantillas']);

    // Plantillas de Correo Dinámicas (Cortesía)
    Route::get('/email-templates/cortesia', [EmailTemplateController::class, 'getCortesia']);
    Route::put('/email-templates/cortesia', [EmailTemplateController::class, 'updateCortesia']);
    Route::get('/email-templates/cortesia-rechazo', [EmailTemplateController::class, 'getCortesiaRechazo']);
    Route::put('/email-templates/cortesia-rechazo', [EmailTemplateController::class, 'updateCortesiaRechazo']);
    Route::post('/email-templates/enviar-prueba', [EmailTemplateController::class, 'sendTest']);
    Route::post('/email-templates/enviar-candidatos', [EmailTemplateController::class, 'sendCourtesyEmail']);

    // Estado de la revisión automática de correos (cada 15 min). El panel lo
    // muestra para que se note si deja de correr, en vez de fallar en silencio.
    Route::get('/email/estado-automatico', function () {
        $ultima = \Illuminate\Support\Facades\Cache::get(\App\Console\Commands\CheckEmailCvsCommand::CLAVE_ULTIMA_REVISION);

        $atrasada = !$ultima
            || \Illuminate\Support\Carbon::parse($ultima['fecha'])->lt(now()->subMinutes(45));

        return response()->json([
            'ultima'   => $ultima,
            'atrasada' => $atrasada,
        ]);
    });

    // Trigger manual de revisión de emails
    Route::post('/email/check', function (Request $request) {
        set_time_limit(300);
        $dias = (int) $request->input('dias', 60);
        try {
            $service = app(\App\Services\EmailImportService::class);
            $resultados = $service->importarDesdeCorreo($dias);
            return response()->json([
                'message'    => "Revisión completada (últimos {$dias} días)",
                'resultados' => $resultados,
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Email check HTTP error: ' . $e->getMessage());
            return response()->json(['message' => 'Error al revisar correos: ' . $e->getMessage()], 500);
        }
    });

    Route::post('/email/check-headers', function (Request $request) {
        set_time_limit(300);
        $dias = (int) $request->input('dias', 30);
        try {
            $service = app(\App\Services\EmailImportService::class);
            $headers = $service->obtenerNuevosHeaders($dias);
            return response()->json([
                'headers' => $headers,
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('check-headers error: ' . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 500);
        }
    });

    Route::post('/email/classify', function (Request $request) {
        set_time_limit(300);
        $headers = $request->input('headers', []);
        try {
            $service = app(\App\Services\EmailImportService::class);
            $seleccionados = $service->clasificarHeaders($headers);
            return response()->json([
                'seleccionados' => $seleccionados,
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('classify headers error: ' . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 500);
        }
    });

    Route::post('/email/import-single', function (Request $request) {
        set_time_limit(300);
        $meta = $request->input('email', []);
        try {
            $service = app(\App\Services\EmailImportService::class);
            $status = $service->importarMensajeIndividual($meta);
            return response()->json([
                'status'          => $status,
                'nombre_completo' => $meta['nombre'] ?? 'Sin nombre',
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('import-single error: ' . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 500);
        }
    });
});
