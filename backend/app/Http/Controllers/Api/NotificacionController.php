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

        $log = EmailLog::create([
            'postulacion_id' => $postulacion->id,
            'tipo'           => $request->tipo,
            'asunto'         => $request->asunto,
            'cuerpo'         => $request->cuerpo,
            'estado'         => 'pendiente',
            'enviado_por'    => auth()->id(),
        ]);

        try {
            Mail::html($request->cuerpo, function ($message) use ($postulacion, $request) {
                $message->to($postulacion->email, $postulacion->nombre_completo)
                    ->subject($request->asunto)
                    ->replyTo(config('mail.from.address'), config('mail.from.name'));
            });

            $log->update([
                'estado'     => 'enviado',
                'enviado_en' => now(),
            ]);

            // Actualizar estado de postulación si es preselección
            if ($request->tipo === 'preseleccion') {
                $postulacion->update(['estado' => 'preseleccionado']);
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
                'cuerpo' => '<p>Estimado/a <strong>{{nombre}}</strong>,</p>
<p>Nos complace informarle que su hoja de vida ha sido revisada y ha sido <strong>preseleccionado/a</strong> para continuar en nuestro proceso de selección para el cargo de <strong>{{cargo}}</strong>.</p>
<p>Nos pondremos en contacto con usted próximamente para coordinar los siguientes pasos del proceso.</p>
<p>Atentamente,<br><strong>Equipo de Recursos Humanos</strong><br>Hidroobras S.A.S</p>',
            ],
            [
                'tipo'   => 'entrevista',
                'asunto' => 'Citación a entrevista - Hidroobras',
                'cuerpo' => '<p>Estimado/a <strong>{{nombre}}</strong>,</p>
<p>Le informamos que ha sido seleccionado/a para participar en una entrevista para el cargo de <strong>{{cargo}}</strong>.</p>
<p><strong>Fecha:</strong> [FECHA]<br><strong>Hora:</strong> [HORA]<br><strong>Lugar:</strong> [DIRECCIÓN / Virtual]</p>
<p>Por favor confirme su asistencia respondiendo este correo.</p>
<p>Atentamente,<br><strong>Equipo de Recursos Humanos</strong><br>Hidroobras S.A.S</p>',
            ],
            [
                'tipo'   => 'solicitud_documentos',
                'asunto' => 'Solicitud de documentos - Proceso de selección Hidroobras',
                'cuerpo' => '<p>Estimado/a <strong>{{nombre}}</strong>,</p>
<p>Como parte del proceso de selección, le solicitamos amablemente remitir los siguientes documentos:</p>
<ul>
<li>Fotocopia de cédula de ciudadanía</li>
<li>Diploma y acta de grado</li>
<li>Certificaciones laborales</li>
<li>Hoja de vida actualizada (formato único de hoja de vida)</li>
</ul>
<p>Atentamente,<br><strong>Equipo de Recursos Humanos</strong><br>Hidroobras S.A.S</p>',
            ],
        ]);
    }
}
