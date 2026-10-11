<?php

namespace App\Console\Commands;

use App\Services\EmailImportService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class CheckEmailCvsCommand extends Command
{
    protected $signature   = 'email:check-cvs {--dias=60}';
    protected $description = 'Revisa los buzones de correo y captura hojas de vida recibidas';

    /** Donde queda el resultado de la ultima ejecucion; el panel lo muestra. */
    public const CLAVE_ULTIMA_REVISION = 'email_check_cvs.ultima';

    public function handle(EmailImportService $emailService): int
    {
        $dias = (int) $this->option('dias');
        $this->info('[' . now()->toDateTimeString() . "] 🔍 Revisando buzones de correo de Hidroobras (Últimos {$dias} días)...");

        try {
            $resultados = $emailService->importarDesdeCorreo($dias);

            $this->info("✅ Importados:  {$resultados['importados']}");
            $this->info("⏭️  Duplicados:  {$resultados['duplicados']}");

            if ($resultados['errores'] > 0) {
                $this->warn("⚠️  Errores:     {$resultados['errores']}");
            }

            // Los errores por cuenta (IMAP caido, Gemini sin cuota...) no lanzan
            // excepcion: se cuentan. Tambien deben verse como fallo en el panel.
            $this->registrar($resultados['errores'] === 0, $resultados, $resultados['errores'] > 0
                ? 'Hubo errores al revisar los buzones. Revisar storage/logs/laravel.log.'
                : null);

            return $resultados['errores'] > 0 ? Command::FAILURE : Command::SUCCESS;
        } catch (\Throwable $e) {
            $this->error('❌ Error al revisar correos: ' . $e->getMessage());
            $this->registrar(false, null, $e->getMessage());

            return Command::FAILURE;
        }
    }

    private function registrar(bool $ok, ?array $resultados, ?string $mensaje): void
    {
        Cache::forever(self::CLAVE_ULTIMA_REVISION, [
            'fecha' => now()->toIso8601String(),
            'ok' => $ok,
            'resultados' => $resultados,
            'mensaje' => $mensaje,
        ]);
    }
}
