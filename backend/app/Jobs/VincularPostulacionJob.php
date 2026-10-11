<?php

namespace App\Jobs;

use App\Models\Postulacion;
use App\Models\User;
use App\Services\VinculacionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Vinculación de un aspirante a gestión en segundo plano: crear el empleado y
 * subir sus documentos al NAS puede tardar más que el Timeout de Apache (60 s).
 *
 * Un solo intento: si algo falla queda en error y la persona reintenta desde
 * el botón, que retoma lo que faltó sin duplicar nada.
 */
class VincularPostulacionJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    /** Segundos. Debe ser menor que DB_QUEUE_RETRY_AFTER y que --timeout del worker. */
    public int $timeout = 900;

    public function __construct(
        public readonly int $postulacionId,
        public readonly ?int $userId,
    ) {
        $this->onConnection(config('services.gestion.cola'));
        $this->onQueue('vinculacion');
    }

    public function handle(VinculacionService $vinculacion): void
    {
        $postulacion = Postulacion::find($this->postulacionId);

        if ($postulacion) {
            $vinculacion->ejecutar($postulacion, $this->userId ? User::find($this->userId) : null);
        }
    }

    /** Lo que se escape de ejecutar() (p. ej. el worker lo mató por tiempo). */
    public function failed(?\Throwable $e): void
    {
        Postulacion::whereKey($this->postulacionId)
            ->whereIn('vinculacion_estado', [VinculacionService::EN_COLA, VinculacionService::EN_CURSO])
            ->update([
                'vinculacion_estado' => VinculacionService::ERROR,
                'vinculacion_mensaje' => 'La vinculación se interrumpió: ' . ($e?->getMessage() ?: 'error desconocido') . ' Vuelva a oprimir «Vincular».',
            ]);
    }
}
