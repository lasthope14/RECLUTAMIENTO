<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('perfiles_cargo', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('area')->nullable();
            $table->text('descripcion')->nullable();
            $table->json('requisitos')->nullable(); // {educacion_min, experiencia_min_años, habilidades, certs, tipo_contrato}
            $table->string('salario_rango')->nullable();
            $table->boolean('activo')->default(true);
            $table->date('fecha_apertura')->nullable();
            $table->date('fecha_cierre')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('perfiles_cargo');
    }
};
