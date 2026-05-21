<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('postulacion_id')->constrained('postulaciones')->cascadeOnDelete();
            $table->enum('tipo', ['preseleccion', 'entrevista', 'solicitud_documentos', 'rechazo', 'otro'])->default('preseleccion');
            $table->string('asunto');
            $table->text('cuerpo');
            $table->enum('estado', ['pendiente', 'enviado', 'error'])->default('pendiente');
            $table->text('error_mensaje')->nullable();
            $table->timestamp('enviado_en')->nullable();
            $table->foreignId('enviado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_logs');
    }
};
