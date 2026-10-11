<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withSchedule(function (\Illuminate\Console\Scheduling\Schedule $schedule): void {
        // Revisar correos cada 15 minutos. Sin encimarse si una revision tarda
        // (el bloqueo se libera solo a los 30 min por si el proceso muere), y con
        // su propio log para poder ver que paso sin buscar en laravel.log.
        $schedule->command('email:check-cvs')
            ->everyFifteenMinutes()
            ->withoutOverlapping(30)
            ->appendOutputTo(storage_path('logs/revision-correos.log'));
        // Limpiar tokens vencidos diariamente
        $schedule->command('sanctum:prune-expired --hours=24')->daily();
        // Resumen de pendientes vencidos del proceso de selección (ARL sin
        // ingreso, fases detenidas, descartados sin respuesta...). La app
        // corre en UTC: la hora va en la de Colombia. El comando se salta los
        // festivos.
        $schedule->command('alertas:resumen')
            ->weekdays()
            ->dailyAt('07:00')
            ->timezone('America/Bogota')
            ->withoutOverlapping(30)
            ->appendOutputTo(storage_path('logs/alertas.log'));
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
