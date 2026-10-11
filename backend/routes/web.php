<?php

use App\Http\Controllers\Auth\HidroobrasIdController;
use Illuminate\Support\Facades\Route;

// Inicio de sesion con Hidroobras ID. Van antes del fallback para que no las
// atienda la app de React.
Route::get('auth/hidroobras', [HidroobrasIdController::class, 'redirect'])->name('sso.redirect');
Route::get('auth/hidroobras/callback', [HidroobrasIdController::class, 'callback'])->name('sso.callback');

// For non-API routes, fallback to serving the compiled React index.html.
Route::fallback(function () {
    $indexPath = public_path('index.html');
    if (file_exists($indexPath)) {
        return file_get_contents($indexPath);
    }
    return view('welcome');
});
