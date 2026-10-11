<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Proceso de selección hasta la vinculación.
 *
 * - postulaciones.fase: en qué fase va el aspirante (App\Support\ProcesoSeleccion).
 *   Si no aprueba una fase, queda en esa fase con estado "descartado".
 * - postulacion_fases: historial de cada movimiento; de aquí salen los
 *   indicadores (embudo, dónde se caen, cuánto tarda cada fase).
 * - documentos_aspirante: documentos de ingreso con los códigos del catálogo
 *   de gestión (FSI-44). Al vincular se envían a gestión, que los sube al NAS.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('postulaciones', function (Blueprint $table) {
            $table->string('fase', 30)->nullable()->after('estado')->index();
            $table->timestamp('fase_desde')->nullable()->after('fase');
            $table->string('cedula', 20)->nullable()->after('nombre_completo')->index();
            // Datos para crear el empleado en gestión (nombres, cargo, fecha de
            // ingreso, EPS...). Se llenan durante el proceso.
            $table->json('datos_vinculacion')->nullable();
            $table->unsignedBigInteger('gestion_employee_id')->nullable()->index();
            $table->timestamp('vinculado_at')->nullable();
            $table->string('vinculado_por')->nullable();
            // La vinculación corre en cola (sube archivos al NAS):
            // en_cola | en_curso | error | completo
            $table->string('vinculacion_estado', 10)->nullable();
            $table->text('vinculacion_mensaje')->nullable();
            $table->timestamp('vinculacion_solicitada_at')->nullable();
        });

        Schema::create('postulacion_fases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('postulacion_id')->constrained('postulaciones')->cascadeOnDelete();
            $table->string('fase', 30);
            // entra | aprueba | no_aprueba | reabre | vinculado
            $table->string('evento', 12);
            $table->text('observacion')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('autor_nombre')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['fase', 'evento']);
        });

        Schema::create('documentos_aspirante', function (Blueprint $table) {
            $table->id();
            $table->foreignId('postulacion_id')->constrained('postulaciones')->cascadeOnDelete();
            // Código del tipo de documento en gestión (document_types.code).
            $table->string('codigo', 12);
            $table->string('archivo');
            $table->string('archivo_nombre');
            $table->string('archivo_mime')->nullable();
            $table->unsignedBigInteger('tamano')->default(0);
            $table->date('fecha_expedicion')->nullable();
            $table->date('fecha_vencimiento')->nullable();
            $table->string('detalle', 100)->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('autor_nombre')->nullable();
            // Envío a gestión
            $table->unsignedBigInteger('gestion_document_id')->nullable();
            $table->string('ruta_nas', 1024)->nullable();
            $table->timestamp('enviado_at')->nullable();
            $table->text('error_envio')->nullable();
            $table->timestamps();

            $table->index(['postulacion_id', 'codigo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documentos_aspirante');
        Schema::dropIfExists('postulacion_fases');

        Schema::table('postulaciones', function (Blueprint $table) {
            $table->dropIndex(['fase']);
            $table->dropIndex(['cedula']);
            $table->dropIndex(['gestion_employee_id']);
            $table->dropColumn([
                'fase', 'fase_desde', 'cedula', 'datos_vinculacion', 'gestion_employee_id', 'vinculado_at', 'vinculado_por',
                'vinculacion_estado', 'vinculacion_mensaje', 'vinculacion_solicitada_at',
            ]);
        });
    }
};
