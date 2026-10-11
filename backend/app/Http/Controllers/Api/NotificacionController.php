<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailLog;
use App\Models\Postulacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class NotificacionController extends Controller
{
    public function enviarPreseleccion(Request $request): JsonResponse
    {
        $request->validate([
            'postulacion_id' => 'required|exists:postulaciones,id',
            'asunto'         => 'required|string|max:255',
            'cuerpo'         => 'required|string',
            'tipo'           => 'required|in:preseleccion,entrevista,solicitud_documentos,rechazo,otro',
        ]);

        $postulacion = Postulacion::findOrFail($request->postulacion_id);

        if (!$postulacion->email) {
            return response()->json(['message' => 'El candidato no tiene email registrado'], 422);
        }

        // Convert the plain-text custom message to paragraphs and wrap in corporate HTML layout
        $paragraphsHtml = $this->convertTextToParagraphs($request->cuerpo);
        
        $emailTitle = 'Proceso de Selección - Hidroobras';
        if ($request->tipo === 'preseleccion') {
            $emailTitle = '¡Has sido preseleccionado/a!';
        } elseif ($request->tipo === 'entrevista') {
            $emailTitle = 'Citación a Entrevista';
        } elseif ($request->tipo === 'solicitud_documentos') {
            $emailTitle = 'Solicitud de Soporte de Documentos';
        } elseif ($request->tipo === 'rechazo') {
            $emailTitle = 'Agradecemos tu postulación';
        }

        $cuerpoCompilado = $this->wrapInHtmlLayout($emailTitle, $paragraphsHtml);

        $log = EmailLog::create([
            'postulacion_id' => $postulacion->id,
            'tipo'           => $request->tipo,
            'asunto'         => $request->asunto,
            'cuerpo'         => $cuerpoCompilado,
            'estado'         => 'pendiente',
            'enviado_por'    => auth()->id(),
        ]);

        try {
            Mail::html($cuerpoCompilado, function ($message) use ($postulacion, $request) {
                $message->to($postulacion->email, $postulacion->nombre_completo)
                    ->subject($request->asunto)
                    ->replyTo(config('mail.from.address'), config('mail.from.name'));
            });

            $log->update([
                'estado'     => 'enviado',
                'enviado_en' => now(),
            ]);

            // Guardar copia del correo enviado en la carpeta Sent vía IMAP
            try {
                $emailSentService = app(\App\Services\EmailSentService::class);
                $emailSentService->registrarEmailEnviado($postulacion->email, $request->asunto, $cuerpoCompilado);
            } catch (\Exception $imapEx) {
                \Illuminate\Support\Facades\Log::error("NotificacionController IMAP copy error: " . $imapEx->getMessage());
            }

            // Actualizar estado de postulación si es preselección
            if ($request->tipo === 'preseleccion') {
                $postulacion->update(['estado' => 'preseleccionado']);
            } elseif ($request->tipo === 'rechazo') {
                $postulacion->update(['estado' => 'descartado']);
            }

            return response()->json(['message' => 'Email enviado correctamente']);
        } catch (\Exception $e) {
            $log->update([
                'estado'          => 'error',
                'error_mensaje'   => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Error al enviar email: ' . $e->getMessage()], 500);
        }
    }

    public function plantillas(): JsonResponse
    {
        return response()->json([
            [
                'tipo'   => 'preseleccion',
                'asunto' => 'Preseleccionado/a - Proceso de selección Hidroobras',
                'cuerpo' => "Hola {{nombre}},\n\nNos complace informarte que tu perfil se destaca positivamente en nuestro proceso de selección para la vacante de {{cargo}}. Tu trayectoria y aptitudes se encuentran alineadas con lo que buscamos en Hidroobras.\n\nPor este motivo, has sido preseleccionado/a para continuar con las siguientes fases del proceso. Nos pondremos en contacto contigo próximamente para indicarte los siguientes pasos.",
            ],
            [
                'tipo'   => 'entrevista',
                'asunto' => 'Citación a entrevista - Hidroobras',
                'cuerpo' => "Hola {{nombre}},\n\nTe informamos que has sido seleccionado/a para participar en una entrevista de selección para el cargo de {{cargo}}. Queremos conversar en detalle sobre tu experiencia y la vacante disponible.\n\nLos detalles de la programación son:\n- Fecha: [FECHA]\n- Hora: [HORA]\n- Modalidad: [Virtual via Teams / Presencial en oficinas]\n\nPor favor, confírmanos tu disponibilidad respondiendo directamente a este correo electrónico.",
            ],
            [
                'tipo'   => 'solicitud_documentos',
                'asunto' => 'Solicitud de documentos - Proceso de selección Hidroobras',
                'cuerpo' => "Hola {{nombre}},\n\nAgradecemos tu activa participación en nuestro proceso de selección para el cargo de {{cargo}}. Con el fin de avanzar hacia la fase final del proceso, te solicitamos amablemente remitir los siguientes documentos de soporte:\n\n- Copia legible de tu cédula de ciudadanía\n- Título profesional y/o acta de grado\n- Certificaciones laborales recientes\n- Certificado de afiliación vigente a EPS y Fondo de Pensiones\n- Certificado de alturas / SST (si aplica para el cargo)\n\nPor favor, remítenos estos soportes como adjuntos respondiendo a este mensaje.",
            ],
            [
                'tipo'   => 'rechazo',
                'asunto' => 'Agradecimiento por tu postulación - Hidroobras',
                'cuerpo' => "Hola {{nombre}},\n\nQueremos agradecerte sinceramente el tiempo y el interés que has dedicado a postularte para la vacante de {{cargo}} en Hidroobras S.A.S.\n\nTe informamos que en esta ocasión hemos decidido continuar con otros perfiles cuyas competencias y trayectoria técnica se ajustan de manera más específica a los requerimientos actuales del cargo. Tu expediente quedará registrado en nuestro banco de talento para futuras convocatorias.",
            ],
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
