<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Create roles table
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('display_name');
            $table->timestamps();
        });

        // 2. Seed default roles immediately
        DB::table('roles')->insert([
            ['id' => 1, 'name' => 'admin', 'display_name' => 'Administrador', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'name' => 'user', 'display_name' => 'Reclutador', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // 3. Add role_id foreign key column to users
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('role_id')->default(2)->after('email')->constrained('roles');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['role_id']);
            $table->dropColumn('role_id');
        });

        Schema::dropIfExists('roles');
    }
};
