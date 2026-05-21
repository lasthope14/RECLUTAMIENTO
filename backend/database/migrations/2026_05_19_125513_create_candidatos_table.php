<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidatos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('postulacion_id')->constrained('postulaciones')->cascadeOnDelete();
            $table->json('datos_extraidos')->nullable(); // educacion, experiencia, habilidades, idiomas, certs
            $table->text('resumen_ia')->nullable();
            $table->enum('estado_parseo', ['pendiente', 'procesando', 'procesado', 'error'])->default('pendiente');
            $table->text('error_parseo')->nullable();
            $table->string('modelo_ia')->nullable();
            $table->integer('tokens_usados')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidatos');
    }
};
