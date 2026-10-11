<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailLog;
use App\Models\EmailTemplate;
use App\Models\Postulacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class EmailTemplateController extends Controller
{
    /**
     * Get the courtesy email template.
     */
    public function getCortesia(): JsonResponse
    {
        $template = EmailTemplate::where('key', 'cortesia')->first();

        if (!$template) {
            return response()->json(['message' => 'Plantilla de cortesía no encontrada.'], 404);
        }

        return response()->json($template);
    }

    /**
     * Update the courtesy email template.
     */
    public function updateCortesia(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'subject' => 'required|string|max:255',
            'body'    => 'required|string',
        ]);

        $template = EmailTemplate::where('key', 'cortesia')->first();

        if (!$template) {
            return response()->json(['message' => 'Plantilla de cortesía no encontrada.'], 404);
        }

        $template->update($validated);

        return response()->json([
            'message'  => 'Plantilla de cortesía actualizada con éxito.',
            'template' => $template
        ]);
    }

    /**
     * Get the courtesy rejection email template.
     */
    public function getCortesiaRechazo(): JsonResponse
    {
        $template = EmailTemplate::where('key', 'cortesia_rechazo')->first();

        if (!$template) {
            return response()->json(['message' => 'Plantilla de cortesía para rechazados no encontrada.'], 404);
        }

        return response()->json($template);
    }

    /**
     * Update the courtesy rejection email template.
     */
    public function updateCortesiaRechazo(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'subject' => 'required|string|max:255',
            'body'    => 'required|string',
        ]);

        $template = EmailTemplate::where('key', 'cortesia_rechazo')->first();

        if (!$template) {
            return response()->json(['message' => 'Plantilla de cortesía para rechazados no encontrada.'], 404);
        }

        $template->update($validated);

        return response()->json([
            'message'  => 'Plantilla de cortesía para rechazados actualizada con éxito.',
            'template' => $template
        ]);
    }

    /**
     * Send a test email to review styling.
     */
    public function sendTest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email'   => 'required|email|max:255',
            'subject' => 'required|string|max:255',
            'body'    => 'required|string',
        ]);

        // Compile placeholders with mockup data for testing
        $nombreMock = 'Alejandro Santamaría (Prueba)';
        $cargoMock  = 'Ingeniero Residente / Hidráulico';

        $cuerpoReemplazado = str_replace(
            ['{{nombre}}', '{{cargo}}'],
            [$nombreMock, $cargoMock],
            $validated['body']
        );

        // Convert plain text paragraphs to styled HTML paragraphs and wrap in layout
        $paragraphsHtml = $this->convertTextToParagraphs($cuerpoReemplazado);
        $previewTitle = (str_contains($validated['subject'], 'Agradecimiento') || str_contains(strtolower($validated['subject']), 'participación') || str_contains(strtolower($validated['subject']), 'rechazo'))
            ? 'Agradecemos tu postulación'
            : '¡Hemos recibido tu postulación!';

        $cuerpoCompilado = $this->wrapInHtmlLayout($previewTitle, $paragraphsHtml);

        try {
            Mail::html($cuerpoCompilado, function ($message) use ($validated) {
                $message->to($validated['email'])
                        ->subject('[PRUEBA] ' . $validated['subject'])
                        ->replyTo(config('mail.from.address'), config('mail.from.name'));
            });

            return response()->json([
                'message' => 'Correo de prueba enviado con éxito a ' . $validated['email'] . '. Por favor revisa tu bandeja de entrada.'
            ]);
        } catch (\Exception $e) {
            Log::error('Test Email error: ' . $e->getMessage());
            return response()->json([
                'message' => 'Error al enviar el correo de prueba: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Send courtesy email to selected candidates.
     */
    public function sendCourtesyEmail(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'postulacion_ids' => 'required|array',
            'postulacion_ids.*' => 'required|exists:postulaciones,id',
        ]);

        $templateStandard = EmailTemplate::where('key', 'cortesia')->first();
        $templateRejection = EmailTemplate::where('key', 'cortesia_rechazo')->first();

        if (!$templateStandard) {
            return response()->json(['message' => 'Plantilla de cortesía estándar no encontrada.'], 404);
        }

        $exitos = [];
        $errores = [];

        foreach ($validated['postulacion_ids'] as $id) {
            $postulacion = Postulacion::with(['perfilCargo', 'candidato.evaluaciones'])->find($id);

            if (!$postulacion || !$postulacion->email) {
                $errores[] = [
                    'id'      => $id,
                    'nombre'  => $postulacion->nombre_completo ?? 'Desconocido',
                    'mensaje' => 'El candidato no posee un correo electrónico válido.'
                ];
                continue;
            }

            // Check AI Evaluation Score
            $score = null;
            if ($postulacion->candidato && $postulacion->candidato->evaluaciones) {
                $eval = $postulacion->candidato->evaluaciones
                    ->where('perfil_cargo_id', $postulacion->perfil_cargo_id)
                    ->first();
                if ($eval) {
                    $score = floatval($eval->puntaje_total);
                }
            }

            // Route standard template or rejection template based on score threshold (70%)
            $isRejected = ($score !== null && $score < 70);
            $template = ($isRejected && $templateRejection) ? $templateRejection : $templateStandard;

            $nombreCandidato = $postulacion->nombre_completo;
            $cargoNombre = $postulacion->perfilCargo ? $postulacion->perfilCargo->nombre : 'Cargo Técnico';

            // Compile template body with placeholders
            $cuerpoReemplazado = str_replace(
                ['{{nombre}}', '{{cargo}}'],
                [$nombreCandidato, $cargoNombre],
                $template->body
            );

            // Convert to paragraphs and wrap in corporate layout HTML
            $paragraphsHtml = $this->convertTextToParagraphs($cuerpoReemplazado);
            $emailTitle = $isRejected ? 'Agradecemos tu postulación' : '¡Hemos recibido tu postulación!';
            $cuerpoCompilado = $this->wrapInHtmlLayout($emailTitle, $paragraphsHtml);

            $asuntoCompilado = str_replace(
                ['{{cargo}}'],
                [$cargoNombre],
                $template->subject
            );

            // Log the email in database
            $emailLog = EmailLog::create([
                'postulacion_id' => $postulacion->id,
                'tipo'           => 'otro', // mapped in schema enum
                'asunto'         => $asuntoCompilado,
                'cuerpo'         => $cuerpoCompilado,
                'estado'         => 'pendiente',
                'enviado_por'    => auth()->id(),
            ]);

            try {
                Mail::html($cuerpoCompilado, function ($message) use ($postulacion, $asuntoCompilado) {
                    $message->to($postulacion->email, $postulacion->nombre_completo)
                            ->subject($asuntoCompilado)
                            ->replyTo(config('mail.from.address'), config('mail.from.name'));
                });

                $emailLog->update([
                    'estado'     => 'enviado',
                    'enviado_en' => now(),
                ]);

                // Guardar copia del correo de cortesía enviado en la carpeta Sent vía IMAP
                try {
                    $emailSentService = app(\App\Services\EmailSentService::class);
                    $emailSentService->registrarEmailEnviado($postulacion->email, $asuntoCompilado, $cuerpoCompilado);
                } catch (\Exception $imapEx) {
                    Log::error("EmailTemplateController IMAP copy error: " . $imapEx->getMessage());
                }

                // Update postulation state based on evaluation score
                if ($postulacion->estado === 'recibida') {
                    if ($isRejected) {
                        $postulacion->update(['estado' => 'descartado']);
                    } else {
                        $postulacion->update(['estado' => 'en_revision']);
                    }
                }

                $exitos[] = [
                    'id'     => $postulacion->id,
                    'nombre' => $postulacion->nombre_completo,
                    'email'  => $postulacion->email,
                    'estado' => $isRejected ? 'descartado' : 'en_revision',
                ];
            } catch (\Exception $e) {
                Log::error("Bulk Courtesy Email Error for candidate ID {$id}: " . $e->getMessage());

                $emailLog->update([
                    'estado'        => 'error',
                    'error_mensaje' => $e->getMessage(),
                ]);

                $errores[] = [
                    'id'      => $postulacion->id,
                    'nombre'  => $postulacion->nombre_completo,
                    'mensaje' => $e->getMessage()
                ];
            }
        }

        return response()->json([
            'message' => 'Proceso de envío finalizado.',
            'sent_count' => count($exitos),
            'failed_count' => count($errores),
            'success_list' => $exitos,
            'failed_list' => $errores,
        ]);
    }

    /**
     * Convert plain text content to HTML paragraphs with styling.
     */
    private function convertTextToParagraphs(string $plainText): string
    {
        $normalized = str_replace("\r", "", $plainText);
        $parts = explode("\n\n", $normalized);
        
        $html = '';
        foreach ($parts as $part) {
            $trimmed = trim($part);
            if ($trimmed === '') {
                continue;
            }
            
            $escaped = e($trimmed);
            $withBreaks = nl2br($escaped);
            
            $html .= '<p style="font-size: 14.5px; color: #475569; line-height: 1.6; margin-bottom: 20px;">' . $withBreaks . '</p>';
        }
        
        return $html;
    }

    /**
     * Wrap paragraphs HTML in the premium corporate Hidroobras template.
     */
    private function wrapInHtmlLayout(string $title, string $paragraphsHtml): string
    {
        return <<<HTML
<div style="font-family: 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif; background-color: #f8fafc; padding: 40px 20px; text-align: center; margin: 0;">
    <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03); text-align: left; padding: 40px;">
        
        <!-- Logo -->
        <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://reclutamiento.hidroobras.com.co/assets/logo.png" alt="Hidroobras S.A.S" style="max-width: 220px; height: auto; display: inline-block;" />
        </div>

        <!-- Title -->
        <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 25px; text-align: center; text-transform: uppercase; letter-spacing: 0.02em;">{$title}</h2>

        <!-- Paragraphs Content -->
        {$paragraphsHtml}

        <!-- Accent Line -->
        <div style="height: 1px; background-color: #e2e8f0; margin-top: 25px; margin-bottom: 25px;"></div>

        <!-- Footer / Signature -->
        <div style="text-align: center;">
            <p style="margin: 0; font-size: 14px; font-weight: 700; color: #0f172a;">Atentamente,</p>
            <p style="margin: 4px 0 0 0; font-size: 13.5px; font-weight: 600; color: #64748b;">Equipo de Gestión Humana</p>
            <p style="margin: 2px 0 0 0; font-size: 13.5px; font-weight: 700; color: #0284c7;">Hidroobras S.A.S</p>
            
            <p style="margin-top: 30px; font-size: 11px; color: #94a3b8; line-height: 1.4; border-top: 1px dashed #e2e8f0; padding-top: 15px;">
                Este es un mensaje automático. Por favor, no respondas directamente a esta dirección de correo.
            </p>
        </div>

    </div>
</div>
HTML;
    }
}
