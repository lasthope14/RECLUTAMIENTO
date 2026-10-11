<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('email_templates', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('subject');
            $table->text('body');
            $table->timestamps();
        });

        // Seed default premium HTML courtesy email layout
        $body = <<<TEXT
Hola {{nombre}},

Te confirmamos que hemos recibido satisfactoriamente tu hoja de vida para la vacante de {{cargo}}.

Nuestro equipo de Selección ya se encuentra revisando detalladamente tu perfil. Si tu trayectoria se alinea con lo que estamos buscando para este cargo, nos pondremos en contacto contigo pronto para iniciar las siguientes fases del proceso.
TEXT;

        $bodyRejection = <<<TEXT
Hola {{nombre}},

Queremos agradecerte sinceramente tu interés en formar parte de nuestro equipo y por postularte para la vacante de {{cargo}}.

Te informamos que para este proceso de selección en particular la vacante ya ha sido cubierta. No obstante, tu hoja de vida ha sido registrada con éxito en nuestra base de datos de talento para ser tenida en cuenta de forma prioritaria en futuras convocatorias que se ajusten a tu perfil profesional.
TEXT;

        DB::table('email_templates')->insert([
            [
                'key'        => 'cortesia',
                'subject'    => 'Confirmación de Postulación Recibida - Hidroobras S.A.S',
                'body'       => $body,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'key'        => 'cortesia_rechazo',
                'subject'    => 'Agradecimiento por tu participación - Hidroobras S.A.S',
                'body'       => $bodyRejection,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('email_templates');
    }
};
