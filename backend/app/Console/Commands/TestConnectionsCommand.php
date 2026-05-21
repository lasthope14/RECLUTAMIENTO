<?php

namespace App\Console\Commands;

use App\Services\GeminiService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class TestConnectionsCommand extends Command
{
    protected $signature   = 'conexiones:probar {--gemini} {--email} {--all}';
    protected $description = 'Prueba las conexiones con Gemini API y el servidor de correo';

    public function handle(): int
    {
        $testAll    = $this->option('all');
        $testGemini = $this->option('gemini') || $testAll;
        $testEmail  = $this->option('email')  || $testAll;

        if (!$testGemini && !$testEmail) {
            $this->error('Especifica --gemini, --email o --all');
            return Command::FAILURE;
        }

        // ── Gemini ──────────────────────────────────────────────────────────
        if ($testGemini) {
            $this->info('');
            $this->info('🤖 Probando conexión con Google Gemini API...');

            $apiKey = config('services.gemini.key');
            $model  = config('services.gemini.model', 'gemini-1.5-pro');

            if (empty($apiKey)) {
                $this->error('   ❌ GEMINI_API_KEY está vacía en el .env');
            } else {
                $this->line("   Modelo: {$model}");
                try {
                    $response = Http::timeout(30)->post(
                        "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}",
                        [
                            'contents' => [
                                ['parts' => [['text' => 'Responde solo con: "Conexión exitosa con Hidroobras Recruiter"']]]],
                            ],
                            'generationConfig' => ['maxOutputTokens' => 50, 'temperature' => 0],
                        ]
                    );

                    if ($response->successful()) {
                        $text   = $response->json('candidates.0.content.parts.0.text', '');
                        $tokens = $response->json('usageMetadata.totalTokenCount', '?');
                        $this->info("   ✅ Gemini responde correctamente");
                        $this->line("   Respuesta: " . trim($text));
                        $this->line("   Tokens usados: {$tokens}");

                        // Listar modelos disponibles
                        $modelsRes = Http::timeout(15)->get(
                            "https://generativelanguage.googleapis.com/v1beta/models?key={$apiKey}"
                        );
                        if ($modelsRes->successful()) {
                            $modelos = collect($modelsRes->json('models', []))
                                ->filter(fn($m) => str_contains($m['name'] ?? '', 'gemini'))
                                ->pluck('name')
                                ->map(fn($n) => str_replace('models/', '', $n))
                                ->values();
                            $this->line('');
                            $this->line('   📋 Modelos Gemini disponibles en tu cuenta:');
                            foreach ($modelos as $m) {
                                $marker = $m === $model ? ' ← (activo)' : '';
                                $this->line("      - {$m}{$marker}");
                            }
                        }
                    } else {
                        $this->error('   ❌ Error HTTP ' . $response->status());
                        $this->line('   ' . $response->body());
                    }
                } catch (\Exception $e) {
                    $this->error('   ❌ Excepción: ' . $e->getMessage());
                }
            }
        }

        // ── Email IMAP ───────────────────────────────────────────────────────
        if ($testEmail) {
            $this->info('');
            $this->info('📧 Probando conexión IMAP con coordinadorsst@hidroobras.com.co ...');

            $host     = env('IMAP_HOST_1');
            $port     = env('IMAP_PORT_1', 993);
            $user     = env('IMAP_USERNAME_1');
            $pass     = env('IMAP_PASSWORD_1');
            $enc      = env('IMAP_ENCRYPTION_1', 'ssl');

            if (empty($host) || empty($user) || empty($pass)) {
                $this->error('   ❌ Faltan credenciales IMAP en el .env (IMAP_HOST_1, IMAP_USERNAME_1, IMAP_PASSWORD_1)');
            } else {
                $this->line("   Host: {$host}:{$port} ({$enc})");
                $this->line("   Usuario: {$user}");
                try {
                    $cm = new \Webklex\PHPIMAP\ClientManager();
                    $client = $cm->make([
                        'host'          => $host,
                        'port'          => (int)$port,
                        'encryption'    => $enc,
                        'validate_cert' => false,
                        'username'      => $user,
                        'password'      => $pass,
                        'protocol'      => 'imap',
                    ]);
                    $client->connect();
                    $folders = $client->getFolders();
                    $inbox   = $client->getFolder('INBOX');
                    $total   = $inbox->query()->all()->count();
                    $client->disconnect();

                    $this->info("   ✅ Conexión IMAP exitosa");
                    $this->line("   📬 Mensajes en INBOX: {$total}");
                    $this->line("   📁 Carpetas disponibles: " . count($folders));
                } catch (\Exception $e) {
                    $this->error('   ❌ Error IMAP: ' . $e->getMessage());
                }
            }

            // SMTP test
            $this->info('');
            $this->info('📤 Probando conexión SMTP para envío...');
            $smtpHost = config('mail.mailers.smtp.host');
            $smtpUser = config('mail.username');
            $smtpPass = config('mail.password');

            if (empty($smtpUser) || empty($smtpPass)) {
                $this->warn('   ⚠️  Credenciales SMTP vacías en .env (MAIL_USERNAME / MAIL_PASSWORD)');
            } else {
                try {
                    $transport = new \Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport(
                        $smtpHost,
                        (int)config('mail.mailers.smtp.port', 587),
                        false
                    );
                    $transport->setUsername($smtpUser);
                    $transport->setPassword($smtpPass);
                    $transport->start();
                    $this->info("   ✅ Conexión SMTP exitosa → {$smtpHost}");
                } catch (\Exception $e) {
                    $this->error('   ❌ Error SMTP: ' . $e->getMessage());
                }
            }
        }

        $this->info('');
        return Command::SUCCESS;
    }
}
