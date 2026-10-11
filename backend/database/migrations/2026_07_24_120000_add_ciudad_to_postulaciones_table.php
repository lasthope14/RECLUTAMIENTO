<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('postulaciones', function (Blueprint $table) {
            $table->string('ciudad')->nullable()->after('telefono');
            $table->index('ciudad');
        });

        // Backfill: promover la ciudad ya extraída por la IA (guardada en
        // candidatos.datos_extraidos->ciudad) a la nueva columna de postulaciones.
        DB::table('candidatos')
            ->whereNotNull('datos_extraidos')
            ->orderBy('id')
            ->chunk(200, function ($candidatos) {
                foreach ($candidatos as $c) {
                    $datos = json_decode($c->datos_extraidos, true);
                    $ciudad = $datos['ciudad'] ?? null;
                    if (!empty($ciudad)) {
                        DB::table('postulaciones')
                            ->where('id', $c->postulacion_id)
                            ->update(['ciudad' => $ciudad]);
                    }
                }
            });
    }

    public function down(): void
    {
        Schema::table('postulaciones', function (Blueprint $table) {
            $table->dropIndex(['ciudad']);
            $table->dropColumn('ciudad');
        });
    }
};
