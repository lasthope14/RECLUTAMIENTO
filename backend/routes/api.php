<?php

use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EvaluacionIaController;
use App\Http\Controllers\Api\NotificacionController;
use App\Http\Controllers\Api\PerfilCargoController;
use App\Http\Controllers\Api\PostulacionController;
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

    // Perfiles de Cargo
    Route::apiResource('perfiles-cargo', PerfilCargoController::class);

    // Postulaciones
    Route::get('/postulaciones/kanban', [PostulacionController::class, 'kanban']);
    Route::get('/postulaciones/exportar', [PostulacionController::class, 'exportar']);
    Route::post('/postulaciones/{postulacion}/reprocesar', [PostulacionController::class, 'reprocesarCv']);
    Route::post('/postulaciones/{postulacion}/ia-sync', [PostulacionController::class, 'procesarIaSync']);
    Route::get('/postulaciones/{postulacion}/cv', [PostulacionController::class, 'descargarCv']);
    Route::apiResource('postulaciones', PostulacionController::class)
        ->parameters(['postulaciones' => 'postulacion']);

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
