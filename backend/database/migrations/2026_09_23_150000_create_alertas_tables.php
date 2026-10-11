<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Alertas por correo del proceso de selección.
 *
 * - configuracion_alertas: destinatarios y plazos (días hábiles), editables
 *   desde la pantalla de Alertas.
 * - alertas_enviadas: registro de cada correo enviado (y para no repetir los
 *   avisos que son de una sola vez, como "se cargó la afiliación a la ARL").
 * - postulaciones.arl_*: seguimiento de la afiliación a la ARL. Si el
 *   aspirante se afilia y no llega a trabajar, la empresa paga ARL por días
 *   sin trabajo hasta que se reporte el retiro.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('configuracion_alertas', function (Blueprint $table) {
            $table->id();
            $table->string('clave', 60)->unique();
            $table->json('valor')->nullable();
            $table->timestamps();
        });

        Schema::create('alertas_enviadas', function (Blueprint $table) {
            $table->id();
            // resumen_diario | arl_afiliacion
            $table->string('tipo', 30)->index();
            $table->foreignId('postulacion_id')->nullable()->constrained('postulaciones')->nullOnDelete();
            // Para los avisos de una sola vez: "documento:<id>".
            $table->string('referencia', 100)->nullable()->index();
            $table->string('asunto');
            $table->text('destinatarios');
            $table->unsignedInteger('items')->default(0);
            $table->json('resumen')->nullable();
            // enviado | error
            $table->string('estado', 10)->default('enviado');
            $table->text('error')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::table('postulaciones', function (Blueprint $table) {
            // ingreso_confirmado | retiro_reportado
            $table->string('arl_seguimiento', 20)->nullable();
            // Fecha en que ingresó o en que se reportó el retiro ante la ARL.
            $table->date('arl_seguimiento_fecha')->nullable();
            $table->string('arl_seguimiento_por')->nullable();
            $table->text('arl_seguimiento_nota')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('postulaciones', function (Blueprint $table) {
            $table->dropColumn(['arl_seguimiento', 'arl_seguimiento_fecha', 'arl_seguimiento_por', 'arl_seguimiento_nota']);
        });
        Schema::dropIfExists('alertas_enviadas');
        Schema::dropIfExists('configuracion_alertas');
    }
};
