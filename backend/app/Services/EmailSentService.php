<?php

namespace App\Services;

use Webklex\PHPIMAP\ClientManager;
use Illuminate\Support\Facades\Log;

class EmailSentService
{
    /**
     * Save a sent email to the IMAP 'Sent' folder.
     */
    public function registrarEmailEnviado(string $toEmail, string $subject, string $bodyHtml): bool
    {
        // No queremos bloquear el flujo de envío del sistema si falla la copia por IMAP
        try {
            $user = env('IMAP_USERNAME_1');
            $pass = env('IMAP_PASSWORD_1');
            $host = env('IMAP_HOST_1');
            
            if (!$user || !$host || !$pass) {
                Log::warning("EmailSentService: Credenciales IMAP no configuradas en .env. No se puede guardar copia en Enviados.");
                return false;
            }

            $cm = new ClientManager();
            $client = $cm->make([
                'host'          => $host,
                'port'          => env('IMAP_PORT_1', 993),
                'encryption'    => env('IMAP_ENCRYPTION_1', 'ssl'),
                'validate_cert' => false,
                'username'      => $user,
                'password'      => $pass,
                'protocol'      => 'imap',
                'timeout'       => 15,
            ]);

            $client->connect();
            $folder = $client->getFolder('Sent');
            
            if (!$folder) {
                Log::warning("EmailSentService: No se encontró la carpeta 'Sent' en el servidor IMAP.");
                $client->disconnect();
                return false;
            }

            // Codificar el asunto y remitente en Base64 para cumplir con especificaciones MIME UTF-8
            $fromAddress = config('mail.from.address') ?: 'postulaciones@hidroobras.com.co';
            $fromName = config('mail.from.name') ?: 'Talento Humano Hidroobras';

            $rawMessage = "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <" . $fromAddress . ">\r\n" .
                          "To: <" . $toEmail . ">\r\n" .
                          "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n" .
                          "MIME-Version: 1.0\r\n" .
                          "Content-Type: text/html; charset=utf-8\r\n" .
                          "Date: " . date('r') . "\r\n\r\n" .
                          $bodyHtml;

            $folder->appendMessage($rawMessage);
            $client->disconnect();
            
            Log::info("EmailSentService: Copia guardada en la carpeta 'Sent' para {$toEmail}.");
            return true;
        } catch (\Exception $e) {
            Log::error("EmailSentService: Error al guardar copia en carpeta 'Sent': " . $e->getMessage());
            return false;
        }
    }
}
