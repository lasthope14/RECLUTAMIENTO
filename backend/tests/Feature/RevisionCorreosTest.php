<?php

namespace Tests\Feature;

use App\Console\Commands\CheckEmailCvsCommand;
use App\Models\User;
use App\Services\EmailImportService;
use App\Services\GeminiService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Revision automatica de correos: que no reclasifique lo ya revisado, que un
 * fallo de Gemini se note, y que el panel vea si la revision dejo de correr.
 *
 *   DB_CONNECTION=sqlite DB_DATABASE=:memory: CACHE_STORE=array php vendor/bin/phpunit --filter RevisionCorreosTest
 */
class RevisionCorreosTest extends TestCase
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
            $table->string('password');
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('postulaciones', function (Blueprint $table) {
            $table->id();
            $table->string('mensaje_id_email')->nullable()->unique();
            $table->timestamps();
        });

        (require database_path('migrations/2026_09_16_120000_create_correos_revisados_table.php'))->up();

        config(['services.gemini.key' => 'clave-prueba']);
    }

    private function encabezados(): array
    {
        return [
            ['uid' => 1, 'message_id' => '<cv@correo>', 'from' => 'ana@gmail.com', 'nombre' => 'Ana', 'asunto' => 'Hoja de vida', 'fecha' => '2026-09-16', 'cuenta_idx' => 0],
            ['uid' => 2, 'message_id' => '<factura@correo>', 'from' => 'proveedor@empresa.com', 'nombre' => 'Proveedor', 'asunto' => 'Factura 123', 'fecha' => '2026-09-16', 'cuenta_idx' => 0],
        ];
    }

    private function geminiResponde(string $texto, int $status = 200): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(
            $status === 200 ? ['candidates' => [['content' => ['parts' => [['text' => $texto]]]]]] : ['error' => 'quota'],
            $status
        )]);
    }

    public function test_un_fallo_de_gemini_ya_no_se_confunde_con_cero_postulaciones(): void
    {
        $this->geminiResponde('', 429);

        $this->expectException(\RuntimeException::class);

        app(GeminiService::class)->filtrarPostulaciones([['idx' => 0, 'from' => 'a', 'nombre' => 'b', 'asunto' => 'c', 'fecha' => 'd']]);
    }

    public function test_una_respuesta_invalida_de_gemini_tambien_es_error(): void
    {
        $this->geminiResponde('no es json');

        $this->expectException(\RuntimeException::class);

        app(GeminiService::class)->filtrarPostulaciones([['idx' => 0, 'from' => 'a', 'nombre' => 'b', 'asunto' => 'c', 'fecha' => 'd']]);
    }

    public function test_los_correos_que_no_son_postulacion_se_recuerdan(): void
    {
        $this->geminiResponde('{"postulaciones": [0]}');

        $servicio = app(EmailImportService::class);
        $seleccionados = $servicio->clasificarHeaders($this->encabezados());

        $this->assertCount(1, $seleccionados);
        $this->assertSame('<cv@correo>', $seleccionados[0]['message_id']);

        // La factura queda recordada; la hoja de vida no (se recuerda al importarse).
        $this->assertTrue($servicio->yaRevisado('<factura@correo>'));
        $this->assertFalse($servicio->yaRevisado('<cv@correo>'));
    }

    public function test_si_gemini_falla_no_se_marca_nada_como_revisado(): void
    {
        $this->geminiResponde('', 500);

        $servicio = app(EmailImportService::class);

        try {
            $servicio->clasificarHeaders($this->encabezados());
            $this->fail('Se esperaba excepcion');
        } catch (\RuntimeException) {
            // esperado
        }

        // Nada se pierde: la proxima revision los vuelve a intentar.
        $this->assertSame(0, DB::table('correos_revisados')->count());
    }

    public function test_una_postulacion_existente_cuenta_como_revisada(): void
    {
        DB::table('postulaciones')->insert(['mensaje_id_email' => '<ya@correo>']);

        $this->assertTrue(app(EmailImportService::class)->yaRevisado('<ya@correo>'));
        $this->assertFalse(app(EmailImportService::class)->yaRevisado('<nuevo@correo>'));
    }

    public function test_marcar_dos_veces_el_mismo_correo_no_falla(): void
    {
        $servicio = app(EmailImportService::class);
        $servicio->marcarRevisado('<x@correo>', 'no_postulacion');
        $servicio->marcarRevisado('<x@correo>', 'no_postulacion');

        $this->assertSame(1, DB::table('correos_revisados')->count());
    }

    public function test_el_comando_registra_una_ejecucion_exitosa(): void
    {
        $this->mock(EmailImportService::class)
            ->shouldReceive('importarDesdeCorreo')->once()
            ->andReturn(['importados' => 2, 'duplicados' => 5, 'ignorados' => 3, 'errores' => 0]);

        $this->artisan('email:check-cvs')->assertSuccessful();

        $ultima = Cache::get(CheckEmailCvsCommand::CLAVE_ULTIMA_REVISION);
        $this->assertTrue($ultima['ok']);
        $this->assertSame(2, $ultima['resultados']['importados']);
    }

    public function test_el_comando_registra_los_errores_para_que_se_vean(): void
    {
        $this->mock(EmailImportService::class)
            ->shouldReceive('importarDesdeCorreo')->once()
            ->andReturn(['importados' => 0, 'duplicados' => 0, 'ignorados' => 0, 'errores' => 1]);

        $this->artisan('email:check-cvs')->assertFailed();

        $this->assertFalse(Cache::get(CheckEmailCvsCommand::CLAVE_ULTIMA_REVISION)['ok']);
    }

    public function test_el_comando_registra_una_excepcion(): void
    {
        $this->mock(EmailImportService::class)
            ->shouldReceive('importarDesdeCorreo')->once()
            ->andThrow(new \RuntimeException('IMAP no responde'));

        $this->artisan('email:check-cvs')->assertFailed();

        $ultima = Cache::get(CheckEmailCvsCommand::CLAVE_ULTIMA_REVISION);
        $this->assertFalse($ultima['ok']);
        $this->assertSame('IMAP no responde', $ultima['mensaje']);
    }

    public function test_el_panel_ve_si_la_revision_nunca_corrio_o_se_atraso(): void
    {
        Sanctum::actingAs(User::create(['name' => 'R', 'email' => 'r@hidroobras.com.co', 'password' => 'x']));

        // Nunca ha corrido
        $this->getJson('/api/email/estado-automatico')->assertOk()->assertJsonPath('atrasada', true);

        // Corrio hace 10 minutos
        Cache::forever(CheckEmailCvsCommand::CLAVE_ULTIMA_REVISION, ['fecha' => now()->subMinutes(10)->toIso8601String(), 'ok' => true, 'resultados' => null, 'mensaje' => null]);
        $this->getJson('/api/email/estado-automatico')->assertOk()->assertJsonPath('atrasada', false);

        // Lleva una hora sin correr: el cron se detuvo
        Cache::forever(CheckEmailCvsCommand::CLAVE_ULTIMA_REVISION, ['fecha' => now()->subHour()->toIso8601String(), 'ok' => true, 'resultados' => null, 'mensaje' => null]);
        $this->getJson('/api/email/estado-automatico')->assertOk()->assertJsonPath('atrasada', true);
    }

    public function test_la_programacion_no_se_encima(): void
    {
        // La programacion se registra al usar la consola, como hace el cron.
        $this->artisan('schedule:list')->assertSuccessful();

        $evento = collect(app(\Illuminate\Console\Scheduling\Schedule::class)->events())
            ->first(fn ($e) => str_contains($e->command, 'email:check-cvs'));

        $this->assertNotNull($evento);
        $this->assertSame('*/15 * * * *', $evento->expression);
        $this->assertTrue($evento->withoutOverlapping);
    }
}
