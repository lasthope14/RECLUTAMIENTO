<?php

namespace App\Console\Commands;

use App\Services\EmailImportService;
use Illuminate\Console\Command;

class CheckEmailCvsCommand extends Command
{
    protected $signature   = 'email:check-cvs {--dias=60}';
    protected $description = 'Revisa los buzones de correo y captura hojas de vida recibidas';

    public function handle(EmailImportService $emailService): int
    {
        $dias = (int) $this->option('dias');
        $this->info("🔍 Revisando buzones de correo de Hidroobras (Últimos {$dias} días)...");

        try {
            $resultados = $emailService->importarDesdeCorreo($dias);

            $this->info("✅ Importados:  {$resultados['importados']}");
            $this->info("⏭️  Duplicados:  {$resultados['duplicados']}");

            if ($resultados['errores'] > 0) {
                $this->warn("⚠️  Errores:     {$resultados['errores']}");
            }

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('❌ Error al revisar correos: ' . $e->getMessage());
            return Command::FAILURE;
        }
    }
}
