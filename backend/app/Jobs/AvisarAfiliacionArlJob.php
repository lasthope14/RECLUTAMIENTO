<?php

namespace App\Jobs;

use App\Models\DocumentoAspirante;
use App\Services\AlertasService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Correo inmediato cuando se carga la afiliación a la ARL de un aspirante.
 * Va por la cola para que subir el documento no espere al servidor de correo.
 */
class AvisarAfiliacionArlJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 120;

    public function __construct(public readonly int $documentoId)
    {
        $this->onConnection(config('services.gestion.cola'));
        $this->onQueue('alertas');
    }

    public function handle(AlertasService $alertas): void
    {
        if ($doc = DocumentoAspirante::find($this->documentoId)) {
            $alertas->avisarAfiliacionArl($doc);
        }
    }
}
