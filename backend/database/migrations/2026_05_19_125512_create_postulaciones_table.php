<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('postulaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('perfil_cargo_id')->nullable()->constrained('perfiles_cargo')->nullOnDelete();
            $table->string('nombre_completo');
            $table->string('email')->nullable();
            $table->string('telefono')->nullable();
            $table->enum('fuente', ['email', 'manual', 'linkedin', 'whatsapp', 'portal', 'otro'])->default('email');
            $table->enum('estado', ['recibida', 'en_revision', 'preseleccionado', 'descartado', 'contratado'])->default('recibida');
            $table->string('email_origen')->nullable();   // cual cuenta recibió el email
            $table->text('asunto_email')->nullable();     // asunto del correo original
            $table->text('cuerpo_email')->nullable();     // cuerpo del email
            $table->string('archivo_cv')->nullable();     // ruta del archivo
            $table->string('archivo_nombre')->nullable(); // nombre original del archivo
            $table->string('archivo_mime')->nullable();
            $table->string('mensaje_id_email')->nullable()->unique(); // Message-ID para deduplicación
            $table->text('notas_hr')->nullable();
            $table->timestamp('fecha_recepcion')->nullable();
            $table->timestamps();

            $table->index(['estado', 'perfil_cargo_id']);
            $table->index('email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('postulaciones');
    }
};
