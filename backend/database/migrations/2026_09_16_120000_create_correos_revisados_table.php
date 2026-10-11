<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Correos ya revisados que NO terminaron en postulacion.
 *
 * Los que si son hojas de vida ya quedan en postulaciones.mensaje_id_email.
 * Sin esta tabla, cada revision volvia a enviar a Gemini todos los correos
 * que no son postulaciones (facturas, notificaciones...), hasta 200 por buzon.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('correos_revisados', function (Blueprint $table) {
            $table->id();
            $table->string('mensaje_id')->unique();
            $table->string('resultado', 30); // no_postulacion | sin_cv
            $table->string('cuenta')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('correos_revisados');
    }
};
