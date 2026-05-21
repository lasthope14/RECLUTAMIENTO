<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evaluaciones_ia', function (Blueprint $table) {
            $table->id();
            $table->foreignId('candidato_id')->constrained('candidatos')->cascadeOnDelete();
            $table->foreignId('perfil_cargo_id')->constrained('perfiles_cargo')->cascadeOnDelete();
            $table->decimal('puntaje_total', 5, 2)->default(0);
            $table->decimal('puntaje_educacion', 5, 2)->default(0);
            $table->decimal('puntaje_experiencia', 5, 2)->default(0);
            $table->decimal('puntaje_habilidades', 5, 2)->default(0);
            $table->decimal('puntaje_perfil_general', 5, 2)->default(0);
            $table->json('fortalezas')->nullable();
            $table->json('brechas')->nullable();
            $table->text('justificacion')->nullable();
            $table->enum('recomendacion', ['altamente_recomendado', 'recomendado', 'con_reservas', 'no_recomendado'])->nullable();
            $table->string('modelo_ia')->nullable();
            $table->integer('tokens_usados')->nullable();
            $table->timestamps();

            $table->unique(['candidato_id', 'perfil_cargo_id']);
            $table->index(['perfil_cargo_id', 'puntaje_total']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evaluaciones_ia');
    }
};
