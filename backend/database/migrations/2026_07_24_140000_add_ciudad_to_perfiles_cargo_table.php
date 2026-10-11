<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('perfiles_cargo', function (Blueprint $table) {
            $table->string('ciudad')->nullable()->after('area'); // ubicación/ciudad de la vacante
        });
    }

    public function down(): void
    {
        Schema::table('perfiles_cargo', function (Blueprint $table) {
            $table->dropColumn('ciudad');
        });
    }
};
