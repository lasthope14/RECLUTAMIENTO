<?php

namespace Tests\Feature;

use App\Jobs\VincularPostulacionJob;
use App\Models\Postulacion;
use App\Models\User;
use App\Services\VinculacionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProcesoSeleccionTest extends TestCase
{
    use RefreshDatabase;

    private const GESTION = 'https://gestion.test/api/integration/recruitment';

    protected function setUp(): void
    {
        parent::setUp();

        // En pruebas la cola de vinculación corre en el acto.
        config(['services.gestion.url' => self::GESTION, 'services.gestion.key' => 'llave-de-prueba', 'services.gestion.cola' => 'sync']);
        Storage::fake('local');
        Storage::fake('documentos');
        Sanctum::actingAs(User::factory()->create(['name' => 'Analista RH', 'role_id' => 1]));
    }

    private function catalogo(): array
    {
        return [
            'document_types' => [
                ['code' => 'ING-CED', 'name' => 'Cédula de ciudadanía', 'category' => 1, 'category_name' => '01 INGRESO Y CONTRATACION', 'fsi44_item' => 8, 'applies_to' => 'all', 'validity_months' => null, 'single_current' => true, 'blocks_site_entry' => true, 'sensitive' => false],
                ['code' => 'SO-EMO', 'name' => 'Examen médico ocupacional', 'category' => 3, 'category_name' => '03 SALUD OCUPACIONAL', 'fsi44_item' => 4, 'applies_to' => 'all', 'validity_months' => 12, 'single_current' => true, 'blocks_site_entry' => true, 'sensitive' => true],
                ['code' => 'FOR-ALT', 'name' => 'Curso de alturas', 'category' => 4, 'category_name' => '04 FORMACION Y COMPETENCIAS', 'fsi44_item' => 6, 'applies_to' => 'field', 'validity_months' => 12, 'single_current' => true, 'blocks_site_entry' => true, 'sensitive' => false],
            ],
            'companies' => [], 'locations' => [], 'schedules' => [], 'departments' => [],
        ];
    }

    private function fakeGestion(array $extra = []): void
    {
        Http::fake($extra + [
            self::GESTION . '/catalog' => Http::response($this->catalogo()),
            self::GESTION . '/hires' => Http::response(['data' => ['id' => 77]], 201),
            self::GESTION . '/hires/77/documents' => Http::sequence()
                ->push(['data' => ['id' => 501, 'path' => '/NAS/02 ACTIVOS/123 - PEREZ JUAN/01 INGRESO Y CONTRATACION/x.pdf']], 201)
                ->push(['data' => ['id' => 502, 'path' => '/NAS/02 ACTIVOS/123 - PEREZ JUAN/03 SALUD OCUPACIONAL/y.pdf']], 201),
        ]);
    }

    private function postulacion(): Postulacion
    {
        return Postulacion::create(['nombre_completo' => 'Juan Pérez', 'email' => 'juan@test.com', 'estado' => 'en_revision']);
    }

    private function avanzarHastaVinculacion(Postulacion $p): void
    {
        foreach (range(1, 5) as $_) {
            $this->postJson("/api/postulaciones/{$p->id}/proceso/aprobar")->assertOk();
        }
    }

    public function test_preseleccionar_inicia_el_proceso_y_aprobar_avanza_las_fases(): void
    {
        $this->fakeGestion();
        $p = $this->postulacion();

        $this->patchJson("/api/postulaciones/{$p->id}", ['estado' => 'preseleccionado'])->assertOk();
        $this->assertSame('entrevista', $p->fresh()->fase);

        $this->postJson("/api/postulaciones/{$p->id}/proceso/aprobar", ['observacion' => 'Buena entrevista'])
            ->assertOk()
            ->assertJsonPath('fase', 'pruebas');

        $this->assertDatabaseHas('postulacion_fases', ['postulacion_id' => $p->id, 'fase' => 'entrevista', 'evento' => 'aprueba', 'observacion' => 'Buena entrevista', 'autor_nombre' => 'Analista RH']);
        $this->assertDatabaseHas('postulacion_fases', ['postulacion_id' => $p->id, 'fase' => 'pruebas', 'evento' => 'entra']);
    }

    public function test_si_no_aprueba_el_examen_medico_el_proceso_termina_ahi(): void
    {
        $this->fakeGestion();
        $p = $this->postulacion();
        $this->postJson("/api/postulaciones/{$p->id}/proceso/iniciar")->assertOk();
        $this->postJson("/api/postulaciones/{$p->id}/proceso/aprobar")->assertOk();
        $this->postJson("/api/postulaciones/{$p->id}/proceso/aprobar")->assertOk();
        $this->postJson("/api/postulaciones/{$p->id}/proceso/aprobar")->assertOk(); // → examen_medico

        $this->postJson("/api/postulaciones/{$p->id}/proceso/no-aprueba", [])->assertStatus(422);
        $this->postJson("/api/postulaciones/{$p->id}/proceso/no-aprueba", ['motivo' => 'No apto para alturas'])
            ->assertOk()
            ->assertJsonPath('fase', 'examen_medico')
            ->assertJsonPath('estado', 'descartado')
            ->assertJsonPath('en_proceso', false);

        // Ya cerrado: no se puede seguir aprobando.
        $this->postJson("/api/postulaciones/{$p->id}/proceso/aprobar")->assertStatus(422);

        $tablero = $this->getJson('/api/seleccion/tablero')->assertOk();
        $medico = collect($tablero->json('indicadores'))->firstWhere('fase', 'examen_medico');
        $this->assertSame(1, $medico['entraron']);
        $this->assertSame(1, $medico['no_aprobaron']);
        $this->assertSame(['No apto para alturas'], $medico['motivos']);
        $this->assertSame(1, $tablero->json('resumen.no_continuaron'));
        $this->assertSame('examen_medico', $tablero->json('no_continuaron.0.fase'));
        $this->assertSame('No apto para alturas', $tablero->json('no_continuaron.0.motivo'));
        $this->assertSame('Analista RH', $tablero->json('no_continuaron.0.autor'));

        // Si se retoma, deja de aparecer como caído.
        $this->postJson("/api/postulaciones/{$p->id}/proceso/reabrir")->assertOk();
        $this->assertCount(0, $this->getJson('/api/seleccion/tablero')->json('no_continuaron'));
    }

    public function test_descartar_desde_gestion_a_alguien_en_proceso_exige_motivo(): void
    {
        $this->fakeGestion();
        $p = $this->postulacion();
        $this->postJson("/api/postulaciones/{$p->id}/proceso/iniciar");
        $this->postJson("/api/postulaciones/{$p->id}/proceso/aprobar"); // → pruebas

        $this->patchJson("/api/postulaciones/{$p->id}", ['estado' => 'descartado'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('motivo_descarte');
        $this->assertSame('preseleccionado', $p->fresh()->estado);

        $this->patchJson("/api/postulaciones/{$p->id}", ['estado' => 'descartado', 'motivo_descarte' => 'Aceptó otra oferta'])->assertOk();

        $caida = $this->getJson('/api/seleccion/tablero')->json('no_continuaron.0');
        $this->assertSame('pruebas', $caida['fase']);
        $this->assertSame('Aceptó otra oferta', $caida['motivo']);
    }

    public function test_el_tablero_muestra_preseleccionados_sin_iniciar_y_descartados_en_revision(): void
    {
        $this->fakeGestion();
        $antiguo = Postulacion::create(['nombre_completo' => 'Preseleccionado Antiguo', 'estado' => 'preseleccionado']);
        Postulacion::create(['nombre_completo' => 'Descartado En Revisión', 'estado' => 'descartado', 'notas_hr' => 'No cumple experiencia']);

        // Un descarte en la revisión de hojas de vida no pide motivo.
        $otro = $this->postulacion();
        $this->patchJson("/api/postulaciones/{$otro->id}", ['estado' => 'descartado'])->assertOk();

        $t = $this->getJson('/api/seleccion/tablero')->assertOk();
        $this->assertSame([$antiguo->id], collect($t->json('por_iniciar'))->pluck('id')->all());
        $revision = collect($t->json('descartados_revision'))->keyBy('nombre_completo');
        $this->assertCount(2, $revision);
        $this->assertSame('No cumple experiencia', $revision['Descartado En Revisión']['motivo']);
        $this->assertCount(0, $t->json('no_continuaron'));
    }

    public function test_checklist_exige_segun_el_tipo_de_empleado_y_calcula_el_vencimiento(): void
    {
        $this->fakeGestion();
        $p = $this->postulacion();

        $checklist = collect($this->getJson("/api/postulaciones/{$p->id}/proceso")->json('checklist'))->keyBy('codigo');
        $this->assertTrue($checklist['ING-CED']['requerido']);
        $this->assertFalse($checklist['FOR-ALT']['requerido']);

        $this->putJson("/api/postulaciones/{$p->id}/vinculacion/datos", ['tipo_empleado' => 'field', 'cedula' => '1.023.456'])->assertOk();
        $this->assertSame('1023456', $p->fresh()->cedula);

        $checklist = collect($this->getJson("/api/postulaciones/{$p->id}/proceso")->json('checklist'))->keyBy('codigo');
        $this->assertTrue($checklist['FOR-ALT']['requerido']);

        $this->post("/api/postulaciones/{$p->id}/documentos", [
            'codigo' => 'SO-EMO',
            'archivo' => UploadedFile::fake()->createWithContent('examen.pdf', '%PDF-1.4 prueba'),
            'fecha_expedicion' => '2026-09-01',
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('fecha_vencimiento', '2027-09-01');

        $this->post("/api/postulaciones/{$p->id}/documentos", [
            'codigo' => 'NO-EXISTE',
            'archivo' => UploadedFile::fake()->createWithContent('x.pdf', '%PDF-1.4 prueba'),
        ], ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_vincular_crea_el_empleado_envia_los_documentos_y_cierra_el_proceso(): void
    {
        $this->fakeGestion();
        $p = $this->postulacion();
        $this->postJson("/api/postulaciones/{$p->id}/proceso/iniciar")->assertOk();

        // Sin haber aprobado las fases no se puede vincular.
        $this->postJson("/api/postulaciones/{$p->id}/vinculacion")->assertStatus(422);

        $this->avanzarHastaVinculacion($p);
        $this->postJson("/api/postulaciones/{$p->id}/proceso/aprobar")->assertStatus(422); // la última se cierra vinculando

        $this->putJson("/api/postulaciones/{$p->id}/vinculacion/datos", [
            'cedula' => '123', 'nombres' => 'Juan', 'apellidos' => 'Pérez', 'cargo' => 'Oficial',
            'fecha_ingreso' => '2026-10-01', 'tipo_empleado' => 'administrative', 'eps' => 'Sura',
        ])->assertOk();

        foreach (['ING-CED' => 'cedula.pdf', 'SO-EMO' => 'examen.pdf'] as $codigo => $nombre) {
            $this->post("/api/postulaciones/{$p->id}/documentos", [
                'codigo' => $codigo,
                'archivo' => UploadedFile::fake()->createWithContent($nombre, '%PDF-1.4 prueba'),
            ], ['Accept' => 'application/json'])->assertCreated();
        }

        $this->postJson("/api/postulaciones/{$p->id}/vinculacion")
            ->assertStatus(202)
            ->assertJsonPath('gestion_employee_id', 77)
            ->assertJsonPath('fase', 'vinculado')
            ->assertJsonPath('vinculacion.estado', 'completo')
            ->assertJsonPath('vinculacion.documentos_enviados', 2)
            ->assertJsonPath('vinculacion.en_marcha', false);

        $p->refresh();
        $this->assertSame('contratado', $p->estado);
        $this->assertSame(77, (int) $p->gestion_employee_id);
        $this->assertSame('Analista RH', $p->vinculado_por);
        $this->assertSame(0, $p->documentos()->whereNull('gestion_document_id')->count());

        Http::assertSent(fn (HttpRequest $r) => $r->url() === self::GESTION . '/hires'
            && $r->hasHeader('X-Integration-Key', 'llave-de-prueba')
            && $r['recruitment_ref'] === "postulacion:{$p->id}"
            && $r['first_name'] === 'Juan'
            && $r['employee_type'] === 'administrative'
            && $r['eps'] === 'Sura');

        // Ya vinculado: no se vuelve a vincular ni se cargan más documentos aquí.
        $this->postJson("/api/postulaciones/{$p->id}/vinculacion")->assertStatus(422);

        $tablero = $this->getJson('/api/seleccion/tablero')->assertOk();
        $this->assertSame(1, $tablero->json('resumen.vinculados'));
        $this->assertSame(77, $tablero->json('vinculados.0.empleado_id'));
    }

    public function test_la_hoja_de_vida_de_la_postulacion_cumple_el_requisito_y_se_envia_al_vincular(): void
    {
        $catalogo = $this->catalogo();
        array_unshift($catalogo['document_types'], ['code' => 'ING-HV', 'name' => 'Hoja de vida', 'category' => 1, 'category_name' => '01 INGRESO Y CONTRATACION', 'fsi44_item' => 1, 'applies_to' => 'all', 'validity_months' => null, 'single_current' => true, 'blocks_site_entry' => false, 'sensitive' => false]);
        Http::fake([
            self::GESTION . '/catalog' => Http::response($catalogo),
            self::GESTION . '/hires' => Http::response(['data' => ['id' => 77]], 201),
            self::GESTION . '/hires/77/documents' => Http::response(['data' => ['id' => 501, 'path' => '/NAS/x.pdf']], 201),
        ]);

        // Sin CV la hoja de vida se sigue pidiendo.
        $sinCv = $this->postulacion();
        $hv = collect($this->getJson("/api/postulaciones/{$sinCv->id}/proceso")->json('checklist'))->firstWhere('codigo', 'ING-HV');
        $this->assertTrue($hv['requerido']);
        $this->assertNull($hv['cv_postulacion']);

        Storage::disk('local')->put('cvs/2026/09/abc_CV JUAN.pdf', '%PDF-1.4 hoja de vida');
        $p = Postulacion::create([
            'nombre_completo' => 'Juan Pérez', 'estado' => 'en_revision',
            'archivo_cv' => 'cvs/2026/09/abc_CV JUAN.pdf', 'archivo_nombre' => 'CV JUAN.pdf', 'archivo_mime' => 'application/pdf',
        ]);

        $hv = collect($this->getJson("/api/postulaciones/{$p->id}/proceso")->json('checklist'))->firstWhere('codigo', 'ING-HV');
        $this->assertSame(['archivo_nombre' => 'CV JUAN.pdf'], $hv['cv_postulacion']);

        $this->postJson("/api/postulaciones/{$p->id}/proceso/iniciar");
        $this->avanzarHastaVinculacion($p);
        $this->putJson("/api/postulaciones/{$p->id}/vinculacion/datos", [
            'cedula' => '123', 'nombres' => 'Juan', 'apellidos' => 'Pérez', 'cargo' => 'Oficial',
            'fecha_ingreso' => '2026-10-01', 'tipo_empleado' => 'administrative',
        ]);
        foreach (['ING-CED' => 'cedula.pdf', 'SO-EMO' => 'examen.pdf'] as $codigo => $nombre) {
            $this->post("/api/postulaciones/{$p->id}/documentos", [
                'codigo' => $codigo,
                'archivo' => UploadedFile::fake()->createWithContent($nombre, '%PDF-1.4 prueba'),
            ], ['Accept' => 'application/json'])->assertCreated();
        }

        // La hoja de vida no cuenta como faltante: vincula sin aceptar faltantes.
        $this->postJson("/api/postulaciones/{$p->id}/vinculacion")
            ->assertStatus(202)
            ->assertJsonPath('vinculacion.estado', 'completo')
            ->assertJsonPath('vinculacion.documentos_enviados', 3);

        $doc = $p->documentos()->where('codigo', 'ING-HV')->sole();
        $this->assertSame('CV JUAN.pdf', $doc->archivo_nombre);
        $this->assertSame('%PDF-1.4 hoja de vida', Storage::disk('documentos')->get($doc->archivo));
        $this->assertNotNull($doc->gestion_document_id);
        Http::assertSent(fn (HttpRequest $r) => $r->url() === self::GESTION . '/hires/77/documents' && collect($r->data())->firstWhere('name', 'code')['contents'] === 'ING-HV');
    }

    public function test_si_falla_un_documento_se_reintenta_sin_duplicar_el_empleado(): void
    {
        Http::fake([
            self::GESTION . '/catalog' => Http::response($this->catalogo()),
            self::GESTION . '/hires' => Http::response(['data' => ['id' => 77]], 201),
            self::GESTION . '/hires/77/documents' => Http::sequence()
                ->push(['message' => 'NAS caído'], 502)
                ->push(['data' => ['id' => 501, 'path' => '/NAS/x.pdf']], 201),
        ]);

        $p = $this->postulacion();
        $this->postJson("/api/postulaciones/{$p->id}/proceso/iniciar");
        $this->avanzarHastaVinculacion($p);
        $this->putJson("/api/postulaciones/{$p->id}/vinculacion/datos", [
            'cedula' => '123', 'nombres' => 'Juan', 'apellidos' => 'Pérez', 'cargo' => 'Oficial',
            'fecha_ingreso' => '2026-10-01', 'tipo_empleado' => 'administrative',
        ]);
        $this->post("/api/postulaciones/{$p->id}/documentos", [
            'codigo' => 'ING-CED',
            'archivo' => UploadedFile::fake()->createWithContent('cedula.pdf', '%PDF-1.4 prueba'),
        ], ['Accept' => 'application/json'])->assertCreated();

        // Falta el examen médico: sin aceptarlo explícitamente no vincula.
        $this->postJson("/api/postulaciones/{$p->id}/vinculacion")->assertStatus(422);

        $this->postJson("/api/postulaciones/{$p->id}/vinculacion", ['aceptar_faltantes' => true])
            ->assertStatus(202)
            ->assertJsonPath('vinculacion.estado', 'error')
            ->assertJsonPath('fase', 'vinculacion');
        $this->assertStringContainsString('NAS caído', $p->fresh()->vinculacion_mensaje);
        $this->assertSame(77, (int) $p->fresh()->gestion_employee_id);

        $this->postJson("/api/postulaciones/{$p->id}/vinculacion")
            ->assertStatus(202)
            ->assertJsonPath('vinculacion.estado', 'completo')
            ->assertJsonPath('fase', 'vinculado');

        // El empleado se creó una sola vez; el documento se intentó dos.
        $enviadas = collect(Http::recorded())->map(fn ($pair) => $pair[0]->url());
        $this->assertSame(1, $enviadas->filter(fn ($u) => $u === self::GESTION . '/hires')->count());
        $this->assertSame(2, $enviadas->filter(fn ($u) => $u === self::GESTION . '/hires/77/documents')->count());
    }

    public function test_la_cedula_de_otro_empleado_en_gestion_bloquea_la_vinculacion(): void
    {
        $this->fakeGestion([
            self::GESTION . '/hires' => Http::response(['message' => 'Esa cédula es de un empleado retirado: reactívelo en gestión antes de vincular.'], 409),
        ]);

        $p = $this->postulacion();
        $this->postJson("/api/postulaciones/{$p->id}/proceso/iniciar");
        $this->avanzarHastaVinculacion($p);
        $this->putJson("/api/postulaciones/{$p->id}/vinculacion/datos", [
            'cedula' => '123', 'nombres' => 'Juan', 'apellidos' => 'Pérez', 'cargo' => 'Oficial',
            'fecha_ingreso' => '2026-10-01', 'tipo_empleado' => 'administrative',
        ]);

        $this->postJson("/api/postulaciones/{$p->id}/vinculacion", ['aceptar_faltantes' => true])
            ->assertStatus(202)
            ->assertJsonPath('vinculacion.estado', 'error')
            ->assertJsonPath('vinculacion.mensaje', 'Esa cédula es de un empleado retirado: reactívelo en gestión antes de vincular.')
            ->assertJsonPath('fase', 'vinculacion');

        $this->assertNull($p->fresh()->gestion_employee_id);
    }

    public function test_en_produccion_la_vinculacion_va_a_la_cola_y_un_doble_clic_no_lanza_dos(): void
    {
        $this->fakeGestion();
        config(['services.gestion.cola' => 'database']);
        Queue::fake();

        $p = $this->postulacion();
        $this->postJson("/api/postulaciones/{$p->id}/proceso/iniciar");
        $this->avanzarHastaVinculacion($p);
        $this->putJson("/api/postulaciones/{$p->id}/vinculacion/datos", [
            'cedula' => '123', 'nombres' => 'Juan', 'apellidos' => 'Pérez', 'cargo' => 'Oficial',
            'fecha_ingreso' => '2026-10-01', 'tipo_empleado' => 'administrative',
        ]);

        $this->postJson("/api/postulaciones/{$p->id}/vinculacion", ['aceptar_faltantes' => true])
            ->assertStatus(202)
            ->assertJsonPath('vinculacion.estado', 'en_cola')
            ->assertJsonPath('vinculacion.en_marcha', true);

        $this->postJson("/api/postulaciones/{$p->id}/vinculacion", ['aceptar_faltantes' => true])->assertStatus(422);

        // Mientras está en marcha no se tocan los documentos ni los datos.
        $this->putJson("/api/postulaciones/{$p->id}/vinculacion/datos", ['eps' => 'Sura'])->assertStatus(409);

        Queue::assertPushedOn('vinculacion', VincularPostulacionJob::class);
        Queue::assertPushed(VincularPostulacionJob::class, 1);
        Queue::assertPushed(VincularPostulacionJob::class, fn ($job) => $job->connection === 'database' && $job->postulacionId === $p->id);

        // Si se atasca (el worker estaba caído), pasado el margen se puede relanzar.
        $p->update(['vinculacion_solicitada_at' => now()->subMinutes(VinculacionService::MINUTOS_ATASCADA + 1)]);
        $this->postJson("/api/postulaciones/{$p->id}/vinculacion", ['aceptar_faltantes' => true])->assertStatus(202);
        Queue::assertPushed(VincularPostulacionJob::class, 2);
    }
}
