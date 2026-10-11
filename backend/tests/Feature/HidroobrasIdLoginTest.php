<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Arma solo las tablas que necesita en SQLite en memoria para no tocar la base
 * real.
 *
 *   DB_CONNECTION=sqlite DB_DATABASE=:memory: php vendor/bin/phpunit --filter HidroobrasIdLoginTest
 */
class HidroobrasIdLoginTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        if (DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== ':memory:') {
            $this->markTestSkipped('Ejecutar con DB_CONNECTION=sqlite DB_DATABASE=:memory:');
        }

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->unsignedBigInteger('role_id')->default(2);
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->text('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        config([
            'services.hidroobras_id.url' => 'https://id.test',
            'services.hidroobras_id.client_id' => 'client-123',
            'services.hidroobras_id.client_secret' => 'secret',
            'services.hidroobras_id.redirect' => 'https://reclutamiento.test/auth/hidroobras/callback',
        ]);
    }

    private function fakeId(array $claims): void
    {
        Http::fake([
            'id.test/oauth/token' => Http::response(['access_token' => 'tok', 'token_type' => 'Bearer']),
            'id.test/api/userinfo' => Http::response($claims),
        ]);
    }

    private function volverDeId(array $params = [], bool $popup = false)
    {
        return $this->withSession(['sso_state' => 'estado', 'sso_verifier' => 'verificador', 'sso_popup' => $popup])
            ->get('/auth/hidroobras/callback?' . http_build_query($params + ['state' => 'estado', 'code' => 'abc']));
    }

    public function test_redirige_a_hidroobras_id_con_pkce(): void
    {
        $response = $this->get('/auth/hidroobras?popup=1');

        $response->assertRedirect();
        $this->assertStringStartsWith('https://id.test/oauth/authorize?', $response->headers->get('Location'));
        $this->assertStringContainsString('code_challenge_method=S256', $response->headers->get('Location'));
        $this->assertTrue(session('sso_popup'));
    }

    public function test_usuario_registrado_recibe_token_del_panel_y_conserva_su_rol(): void
    {
        $admin = User::create(['name' => 'Admin', 'email' => 'admin@hidroobras.com.co', 'password' => 'x', 'role_id' => 1]);

        $this->fakeId(['sub' => '9', 'email' => 'ADMIN@hidroobras.com.co', 'name' => 'Otro Nombre']);

        $respuesta = $this->volverDeId(popup: true);

        $respuesta->assertOk()
            ->assertSee("localStorage.setItem('token'", false)
            ->assertSee('window.opener', false)
            ->assertHeader('Cache-Control', 'no-store, private');

        $this->assertSame(1, $admin->tokens()->count());
        $this->assertSame(1, $admin->fresh()->role_id);
        $this->assertSame('hr-panel-sso', $admin->tokens()->first()->name);
    }

    public function test_el_token_emitido_sirve_para_la_api(): void
    {
        User::create(['name' => 'Rec', 'email' => 'rec@hidroobras.com.co', 'password' => 'x', 'role_id' => 2]);

        $this->fakeId(['sub' => '9', 'email' => 'rec@hidroobras.com.co', 'name' => 'Rec']);

        $html = $this->volverDeId()->getContent();

        preg_match('/var token = "([^"]+)"/', $html, $coincidencia);
        $this->assertNotEmpty($coincidencia[1] ?? null);

        $this->withToken(stripslashes($coincidencia[1]))
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('email', 'rec@hidroobras.com.co');
    }

    public function test_app_privada_un_correo_no_registrado_no_entra_ni_se_crea(): void
    {
        $this->fakeId(['sub' => '5', 'email' => 'nuevo@hidroobras.com.co', 'name' => 'Nuevo']);

        $respuesta = $this->volverDeId();

        $respuesta->assertOk()
            ->assertSee('var token = null', false)
            ->assertSee('sso_error', false);

        $this->assertSame(0, User::count());
        $this->assertSame(0, DB::table('personal_access_tokens')->count());
    }

    public function test_rechaza_correos_fuera_del_dominio(): void
    {
        User::create(['name' => 'Ext', 'email' => 'alguien@gmail.com', 'password' => 'x', 'role_id' => 1]);
        $this->fakeId(['sub' => '5', 'email' => 'alguien@gmail.com', 'name' => 'Externo']);

        $this->volverDeId()->assertOk()->assertSee('var token = null', false);

        $this->assertSame(0, DB::table('personal_access_tokens')->count());
    }

    public function test_rechaza_state_invalido(): void
    {
        $this->fakeId(['email' => 'ana@hidroobras.com.co']);

        $this->volverDeId(['state' => 'manipulado'])->assertOk()->assertSee('var token = null', false);

        Http::assertNothingSent();
    }

    public function test_si_hidroobras_id_falla_no_hay_excepcion(): void
    {
        Http::fake(['id.test/*' => Http::response(['error' => 'invalid_grant'], 400)]);

        $this->volverDeId()->assertOk()->assertSee('var token = null', false);
    }

    public function test_cancelar_en_hidroobras_id_vuelve_al_login(): void
    {
        $this->volverDeId(['error' => 'access_denied'])->assertOk()->assertSee('var token = null', false);
    }

    public function test_los_tokens_del_panel_vencen_a_las_8_horas(): void
    {
        $user = User::create(['name' => 'Rec', 'email' => 'rec@hidroobras.com.co', 'password' => 'x', 'role_id' => 2]);
        $token = $user->createToken('hr-panel')->plainTextToken;

        $this->travel(7)->hours();
        $this->withToken($token)->getJson('/api/me')->assertOk();

        $this->app['auth']->forgetGuards();

        $this->travel(2)->hours();
        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_el_login_con_contrasena_sigue_funcionando(): void
    {
        User::create(['name' => 'Rec', 'email' => 'rec@hidroobras.com.co', 'password' => 'clave-segura', 'role_id' => 2]);

        $this->postJson('/api/login', ['email' => 'rec@hidroobras.com.co', 'password' => 'clave-segura'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user']);
    }
}
