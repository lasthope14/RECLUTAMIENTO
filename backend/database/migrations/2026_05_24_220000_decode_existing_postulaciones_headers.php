<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Postulacion;

return new class extends Migration
{
    public function up(): void
    {
        // Fix existing postulaciones with MIME encoded names/subjects
        $postulaciones = Postulacion::where('nombre_completo', 'like', '%=?%')
            ->orWhere('asunto_email', 'like', '%=?%')
            ->get();

        foreach ($postulaciones as $p) {
            $nombre = $p->nombre_completo;
            $asunto = $p->asunto_email;

            if (str_contains($nombre, '=?')) {
                $decoded = @iconv_mime_decode($nombre, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8') 
                    ?: @mb_decode_mimeheader($nombre) 
                    ?: $nombre;
                $p->nombre_completo = $decoded;
            }

            if (str_contains($asunto, '=?')) {
                $decoded = @iconv_mime_decode($asunto, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8') 
                    ?: @mb_decode_mimeheader($asunto) 
                    ?: $asunto;
                $p->asunto_email = $decoded;
            }

            $p->save();
        }
    }

    public function down(): void
    {
        // No-op
    }
};
