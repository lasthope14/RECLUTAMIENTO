<?php

namespace App\Console\Commands;

use App\Services\AlertasService;
use Illuminate\Console\Command;

/**
 * Resumen diario de pendientes vencidos del proceso de selección (hojas de
 * vida sin revisar, descartados sin respuesta, aspirantes detenidos en una
 * fase y afiliados a la ARL sin ingreso). Programado los días hábiles.
 */
class EnviarResumenAlertasCommand extends Command
{
    protected $signature = 'alertas:resumen {--forzar : Enviar aunque no haya pendientes o ya se haya enviado hoy}';

    protected $description = 'Envía por correo el resumen de pendientes vencidos del proceso de selección';

    public function handle(AlertasService $alertas): int
    {
        if (!$this->option('forzar') && !AlertasService::esHabil(now())) {
            $this->info('Hoy no es día hábil: no se envía el resumen.');

            return self::SUCCESS;
        }

        $envio = $alertas->enviarResumen((bool) $this->option('forzar'));

        if (!$envio) {
            $this->info('Sin pendientes vencidos (o ya se envió hoy): no se mandó correo.');

            return self::SUCCESS;
        }

        if ($envio->estado !== 'enviado') {
            $this->error("No se envió: {$envio->error}");

            return self::FAILURE;
        }

        $this->info("Enviado a {$envio->destinatarios}: {$envio->asunto}");

        return self::SUCCESS;
    }
}
