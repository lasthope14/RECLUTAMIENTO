<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserControllerTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test listing users by an admin.
     */
    public function test_authenticated_user_can_list_users(): void
    {
        $admin = User::factory()->create([
            'name'    => 'Admin User',
            'email'   => 'admin@test.com',
            'role_id' => 1,
        ]);
        User::factory()->count(2)->create([
            'role_id' => 2,
        ]);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/usuarios');

        $response->assertStatus(200)
                 ->assertJsonCount(3);
    }

    /**
     * Test that non-admin users cannot access the user endpoints.
     */
    public function test_non_admin_user_cannot_access_user_endpoints(): void
    {
        $user = User::factory()->create([
            'name'    => 'Normal User',
            'email'   => 'user@test.com',
            'role_id' => 2,
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/usuarios');

        $response->assertStatus(403)
                 ->assertJsonFragment([
                     'message' => 'Acceso denegado: Se requieren privilegios de administrador para realizar esta operación.'
                 ]);
    }

    /**
     * Test creating a user by an admin.
     */
    public function test_authenticated_user_can_create_user(): void
    {
        $admin = User::factory()->create([
            'role_id' => 1,
        ]);

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/usuarios', [
            'name'     => 'Nuevo Colaborador',
            'email'    => 'nuevo@hidroobras.com.co',
            'password' => 'supersecretpassword123',
            'role_id'  => 2,
        ]);

        $response->assertStatus(201)
                 ->assertJsonPath('name', 'Nuevo Colaborador')
                 ->assertJsonPath('email', 'nuevo@hidroobras.com.co')
                 ->assertJsonPath('role_id', 2);

        $this->assertDatabaseHas('users', [
            'email'   => 'nuevo@hidroobras.com.co',
            'role_id' => 2,
        ]);
    }

    /**
     * Test updating a user by an admin.
     */
    public function test_authenticated_user_can_update_user(): void
    {
        $admin = User::factory()->create([
            'role_id' => 1,
        ]);
        $otherUser = User::factory()->create([
            'name'    => 'User Old Name',
            'email'   => 'old@test.com',
            'role_id' => 2,
        ]);

        Sanctum::actingAs($admin);

        $response = $this->putJson("/api/usuarios/{$otherUser->id}", [
            'name'    => 'User New Name',
            'email'   => 'new@test.com',
            'role_id' => 1,
        ]);

        $response->assertStatus(200)
                 ->assertJsonPath('name', 'User New Name')
                 ->assertJsonPath('email', 'new@test.com')
                 ->assertJsonPath('role_id', 1);

        $this->assertDatabaseHas('users', [
            'id'      => $otherUser->id,
            'name'    => 'User New Name',
            'email'   => 'new@test.com',
            'role_id' => 1,
        ]);
    }

    /**
     * Test self-deletion is prevented even for admins.
     */
    public function test_authenticated_user_cannot_delete_self(): void
    {
        $admin = User::factory()->create([
            'role_id' => 1,
        ]);

        Sanctum::actingAs($admin);

        $response = $this->deleteJson("/api/usuarios/{$admin->id}");

        $response->assertStatus(400)
                 ->assertJsonFragment([
                     'message' => 'Acción denegada: No puedes eliminar tu propia cuenta de usuario en esta sesión.'
                 ]);

        $this->assertDatabaseHas('users', [
            'id' => $admin->id,
        ]);
    }

    /**
     * Test deleting another user by an admin.
     */
    public function test_authenticated_user_can_delete_other_user(): void
    {
        $admin = User::factory()->create([
            'role_id' => 1,
        ]);
        $otherUser = User::factory()->create([
            'role_id' => 2,
        ]);

        Sanctum::actingAs($admin);

        $response = $this->deleteJson("/api/usuarios/{$otherUser->id}");

        $response->assertStatus(200)
                 ->assertJsonFragment([
                     'message' => 'Usuario eliminado correctamente.'
                 ]);

        $this->assertDatabaseMissing('users', [
            'id' => $otherUser->id,
        ]);
    }
}
