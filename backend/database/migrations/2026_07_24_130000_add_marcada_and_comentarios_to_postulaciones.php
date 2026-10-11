<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Marca especial, independiente del flujo de estados del proceso.
        Schema::table('postulaciones', function (Blueprint $table) {
            $table->boolean('marcada')->default(false)->after('estado');
            $table->index('marcada');
        });

        // Hilo de observaciones/comentarios con autor y fecha.
        Schema::create('comentarios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('postulacion_id')->constrained('postulaciones')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('autor_nombre')->nullable(); // snapshot del nombre por si se borra el usuario
            $table->text('comentario');
            $table->timestamps();

            $table->index('postulacion_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comentarios');
        Schema::table('postulaciones', function (Blueprint $table) {
            $table->dropIndex(['marcada']);
            $table->dropColumn('marcada');
        });
    }
};
