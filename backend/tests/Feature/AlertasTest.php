<?php

namespace Tests\Feature;

use App\Mail\AlertaMail;
use App\Models\AlertaEnviada;
use App\Models\EmailLog;
use App\Models\Postulacion;
use App\Models\User;
use App\Services\AlertasService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AlertasTest extends TestCase
{
    use RefreshDatabase;

    private const GESTION = 'https://gestion.test/api/integration/recruitment';

    private array $asistencia = [];

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.gestion.url' => self::GESTION, 'services.gestion.key' => 'llave', 'services.gestion.cola' => 'sync']);
        Storage::fake('local');
        Storage::fake('documentos');
        Mail::fake();

        Http::fake([
            self::GESTION . '/catalog' => Http::response(['document_types' => [
                ['code' => 'SS-ARL', 'name' => 'Afiliación ARL', 'category' => 2, 'category_name' => '02 SEGURIDAD SOCIAL', 'fsi44_item' => 3, 'applies_to' => 'all', 'validity_months' => null, 'single_current' => true, 'blocks_site_entry' => true, 'sensitive' => false],
            ], 'companies' => [], 'locations' => [], 'schedules' => [], 'departments' => []]),
            self::GESTION . '/attendance' => fn () => Http::response(['data' => $this->asistencia]),
        ]);

        // Miércoles 23 de septiembre de 2026, 9 a. m.
        $this->travelTo(Carbon::parse('2026-09-23 09:00:00'));

        Sanctum::actingAs(User::factory()->create(['name' => 'Analista', 'email' => 'rrhh@hidroobras.com.co', 'role_id' => 1]));
    }

    private function conArl(array $postulacion, string $afiliacion = '2026-09-10', array $datos = []): Postulacion
    {
        $p = Postulacion::create($postulacion + ['nombre_completo' => 'Ana Ruiz', 'cedula' => '123']);
        $p->update(['datos_vinculacion' => $datos + ['fecha_ingreso' => '2026-09-11', 'salario' => 3000000, 'clase_riesgo_arl' => 5]]);
        $p->documentos()->create([
            'codigo' => 'SS-ARL', 'archivo' => 'x.pdf', 'archivo_nombre' => 'arl.pdf', 'fecha_expedicion' => $afiliacion,
        ]);

        return $p;
    }

    public function test_los_dias_habiles_saltan_fines_de_semana_y_festivos(): void
    {
        // Viernes 10 de julio → martes 14: el lunes 13 fue festivo decretado.
        $this->assertSame(1, AlertasService::diasHabiles(Carbon::parse('2026-07-10'), Carbon::parse('2026-07-14')));
        // Lunes 21 → lunes 28 de septiembre: 5 días hábiles.
        $this->assertSame(5, AlertasService::diasHabiles(Carbon::parse('2026-09-21'), Carbon::parse('2026-09-28')));
    }

    public function test_cargar_la_afiliacion_a_la_arl_avisa_de_inmediato_y_una_sola_vez(): void
    {
        app(AlertasService::class)->guardarConfig(['destinatarios_arl' => ['gerencia@hidroobras.com.co']]);
        $p = Postulacion::create(['nombre_completo' => 'Ana Ruiz', 'estado' => 'preseleccionado', 'fase' => 'documentacion']);

        $this->post("/api/postulaciones/{$p->id}/documentos", [
            'codigo' => 'SS-ARL',
            'archivo' => UploadedFile::fake()->createWithContent('arl.pdf', '%PDF arl'),
            'fecha_expedicion' => '2026-09-22',
        ], ['Accept' => 'application/json'])->assertCreated();

        Mail::assertSent(AlertaMail::class, fn (AlertaMail $m) => $m->vista === 'emails.alerta-arl'
            && $m->hasTo('rrhh@hidroobras.com.co') && $m->hasTo('gerencia@hidroobras.com.co')
            && str_contains($m->asunto, 'Ana Ruiz'));

        $doc = $p->documentos()->first();
        $this->assertNull(app(AlertasService::class)->avisarAfiliacionArl($doc), 'no se repite el aviso');
        Mail::assertSent(AlertaMail::class, 1);
    }

    public function test_seguimiento_de_arl_detecta_quien_se_afilio_y_no_ingreso(): void
    {
        $noContinuo = $this->conArl(['estado' => 'descartado', 'fase' => 'examen_medico']);
        $sinVincular = $this->conArl(['estado' => 'preseleccionado', 'fase' => 'documentacion']);
        $sinMarcar = $this->conArl(['estado' => 'contratado', 'fase' => 'vinculado', 'gestion_employee_id' => 70]);
        $trabajando = $this->conArl(['estado' => 'contratado', 'fase' => 'vinculado', 'gestion_employee_id' => 71]);
        $retirado = $this->conArl(['estado' => 'descartado', 'fase' => 'documentacion', 'arl_seguimiento' => 'retiro_reportado', 'arl_seguimiento_fecha' => '2026-09-14']);
        $enEspera = $this->conArl(['estado' => 'preseleccionado', 'fase' => 'documentacion'], '2026-09-22', ['fecha_ingreso' => '2026-09-28']);

        $this->asistencia = [
            70 => ['activo' => true, 'primera_marcacion' => null, 'ultima_marcacion' => null, 'dias_marcados' => 0],
            71 => ['activo' => true, 'primera_marcacion' => '2026-09-11 07:02:00', 'ultima_marcacion' => '2026-09-22 07:00:00', 'dias_marcados' => 8],
        ];

        $casos = app(AlertasService::class)->seguimientoArl()->keyBy('id');

        $this->assertSame('no_continuo', $casos[$noContinuo->id]['estado']);
        $this->assertSame('sin_vincular', $casos[$sinVincular->id]['estado']);
        $this->assertSame('sin_marcacion', $casos[$sinMarcar->id]['estado']);
        $this->assertSame('ingreso_confirmado', $casos[$trabajando->id]['estado']);
        $this->assertSame('retiro_reportado', $casos[$retirado->id]['estado']);
        $this->assertSame('en_espera', $casos[$enEspera->id]['estado']);

        // Del 10 al 23 de septiembre: 14 días de ARL pagados sin trabajar.
        $this->assertSame(14, $casos[$noContinuo->id]['dias_sin_trabajo']);
        // Clase V (6,96 %) sobre $3.000.000 → $6.960 por día.
        $this->assertEquals(6960, $casos[$noContinuo->id]['costo_dia']);
        $this->assertEquals(6960 * 14, $casos[$noContinuo->id]['costo_estimado']);
        // Retiro reportado el 14: del 10 al 14 = 5 días.
        $this->assertSame(5, $casos[$retirado->id]['dias_sin_trabajo']);
        $this->assertSame(0, $casos[$trabajando->id]['dias_sin_trabajo']);

        // Marcar el retiro lo saca de los pendientes.
        $this->postJson("/api/postulaciones/{$noContinuo->id}/arl-seguimiento", ['accion' => 'retiro_reportado'])->assertStatus(422);
        $this->postJson("/api/postulaciones/{$noContinuo->id}/arl-seguimiento", ['accion' => 'retiro_reportado', 'fecha' => '2026-09-23', 'nota' => 'Radicado ARL 555'])
            ->assertOk()
            ->assertJsonPath('arl.estado', 'retiro_reportado');

        $pendientes = app(AlertasService::class)->pendientes()['arl']->pluck('id')->all();
        $this->assertEqualsCanonicalizing([$sinVincular->id, $sinMarcar->id], $pendientes);

        $tablero = $this->getJson('/api/seleccion/tablero')->assertOk();
        $this->assertSame(6, $tablero->json('resumen.arl_afiliados'));
        $this->assertSame(4, $tablero->json('resumen.arl_sin_ingreso'));
        $this->assertSame(2, $tablero->json('resumen.arl_pendientes'));
    }

    public function test_resumen_diario_solo_si_hay_vencidos_y_una_vez_al_dia(): void
    {
        $servicio = app(AlertasService::class);

        $this->assertNull($servicio->enviarResumen(), 'sin pendientes no se manda nada');
        Mail::assertNothingSent();

        // Hoja de vida del lunes 14: 7 días hábiles sin revisar (plazo 5).
        Postulacion::create(['nombre_completo' => 'Sin Revisar', 'estado' => 'recibida', 'fecha_recepcion' => '2026-09-14 10:00:00']);
        // Recibida ayer: aún en plazo.
        Postulacion::create(['nombre_completo' => 'Reciente', 'estado' => 'recibida', 'fecha_recepcion' => '2026-09-22 10:00:00']);
        // Descartado hace una semana sin ningún correo.
        $sinCorreo = Postulacion::create(['nombre_completo' => 'Sin Respuesta', 'estado' => 'descartado']);
        Postulacion::whereKey($sinCorreo->id)->update(['updated_at' => '2026-09-15 10:00:00']);
        // Descartado con correo de cortesía: ya se le respondió.
        $respondido = Postulacion::create(['nombre_completo' => 'Respondido', 'estado' => 'descartado']);
        EmailLog::create(['postulacion_id' => $respondido->id, 'tipo' => 'otro', 'asunto' => 'Gracias', 'cuerpo' => '-', 'estado' => 'enviado']);
        Postulacion::whereKey($respondido->id)->update(['updated_at' => '2026-09-15 10:00:00']);
        // Detenido 6 días hábiles en entrevista (plazo 5).
        Postulacion::create(['nombre_completo' => 'Detenido', 'estado' => 'preseleccionado', 'fase' => 'entrevista', 'fase_desde' => '2026-09-15 08:00:00']);

        $p = $servicio->pendientes();
        $this->assertSame(['Sin Revisar'], $p['hv_sin_revisar']->pluck('nombre')->all());
        $this->assertSame(['Sin Respuesta'], $p['sin_respuesta']->pluck('nombre')->all());
        $this->assertSame(['Detenido'], $p['fases_estancadas']->pluck('nombre')->all());

        $envio = $servicio->enviarResumen();
        $this->assertSame('enviado', $envio->estado);
        $this->assertSame(3, $envio->items);
        Mail::assertSent(AlertaMail::class, fn (AlertaMail $m) => $m->vista === 'emails.alertas-resumen' && $m->hasTo('rrhh@hidroobras.com.co'));

        $this->assertNull($servicio->enviarResumen(), 'no se repite el mismo día');
        $this->assertNotNull($servicio->enviarResumen(forzar: true));
        Mail::assertSent(AlertaMail::class, 2);

        // El correo se arma sin errores.
        $html = (new AlertaMail('Prueba', 'emails.alertas-resumen', ['pendientes' => $p, 'config' => $servicio->config(), 'total' => 3, 'urlApp' => 'https://x']))->render();
        $this->assertStringContainsString('Sin Revisar', $html);
        $this->assertStringContainsString('Detenido', $html);
    }

    public function test_el_comando_no_envia_en_festivo(): void
    {
        $this->travelTo(Carbon::parse('2026-12-08 07:00:00')); // Inmaculada Concepción
        Postulacion::create(['nombre_completo' => 'Sin Revisar', 'estado' => 'recibida', 'fecha_recepcion' => '2026-11-01 10:00:00']);

        $this->artisan('alertas:resumen')->expectsOutputToContain('no es día hábil')->assertSuccessful();
        Mail::assertNothingSent();
    }

    public function test_solo_administradores_cambian_la_configuracion(): void
    {
        $datos = [
            'activo' => true, 'destinatarios' => ['a@hidroobras.com.co'], 'destinatarios_arl' => [],
            'dias_hv_sin_revisar' => 4, 'dias_respuesta_descartado' => 2, 'dias_arl_sin_ingreso' => 1,
            'dias_fase' => ['entrevista' => 3, 'inventada' => 9],
        ];

        $this->putJson('/api/alertas/config', $datos)
            ->assertOk()
            ->assertJsonPath('config.dias_hv_sin_revisar', 4)
            ->assertJsonPath('config.dias_fase.entrevista', 3)
            ->assertJsonPath('config.dias_fase.pruebas', 5)
            ->assertJsonPath('destinatarios_efectivos', ['a@hidroobras.com.co']);

        $this->assertArrayNotHasKey('inventada', app(AlertasService::class)->config()['dias_fase']);

        Sanctum::actingAs(User::factory()->create(['role_id' => 2]));
        $this->putJson('/api/alertas/config', $datos)->assertForbidden();
        $this->getJson('/api/alertas')->assertOk();
    }
}
