<?php

namespace App\Services;

use App\Models\DocumentoAspirante;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * Cliente de la API de integración de la app de gestión
 * (/api/integration/recruitment en gestion.hidroobras.com.co).
 */
class GestionClient
{
    private const CACHE_CATALOGO = 'gestion.catalogo';

    public function configurado(): bool
    {
        return (string) config('services.gestion.key') !== '';
    }

    /**
     * Tipos de documento (FSI-44), empresas, sedes, horarios y áreas. Se
     * guarda 10 minutos: cambia poco y el checklist lo pide a cada rato.
     */
    public function catalogo(bool $fresco = false): array
    {
        if ($fresco) {
            Cache::forget(self::CACHE_CATALOGO);
        }

        return Cache::remember(self::CACHE_CATALOGO, now()->addMinutes(10), fn () => $this->json($this->http()->get('/catalog')));
    }

    /** ¿La cédula ya existe en gestión (activo, retirado, vetado)? */
    public function persona(string $cedula): array
    {
        return $this->json($this->http()->get('/people/' . rawurlencode($cedula)));
    }

    /**
     * Crea el empleado. Devuelve [status, body]: 201 creado, 200 ya estaba
     * vinculado (reintento), 409 la cédula es de otro empleado.
     */
    public function contratar(array $datos): array
    {
        $response = $this->http()->post('/hires', $datos);

        if ($response->status() === 409) {
            return [409, $response->json()];
        }

        return [$response->status(), $this->json($response)];
    }

    /** Envía un documento; gestión lo sube al NAS. Devuelve data {id, path}. */
    public function enviarDocumento(int $employeeId, DocumentoAspirante $doc): array
    {
        $contenido = Storage::disk(DocumentoAspirante::DISCO)->get($doc->archivo);
        if ($contenido === null || $contenido === '') {
            throw new GestionException("El archivo «{$doc->archivo_nombre}» no se encontró o está vacío; cárguelo de nuevo.");
        }

        $response = $this->http()
            ->timeout(180)
            ->attach('file', $contenido, $doc->archivo_nombre)
            ->post("/hires/{$employeeId}/documents", array_filter([
                'ref' => "documento:{$doc->id}",
                'code' => $doc->codigo,
                'issued_at' => $doc->fecha_expedicion?->toDateString(),
                'expires_at' => $doc->fecha_vencimiento?->toDateString(),
                'detail' => $doc->detalle,
            ], fn ($v) => $v !== null && $v !== ''));

        return $this->json($response)['data'] ?? [];
    }

    /**
     * Primera y última marcación de asistencia de empleados vinculados desde
     * aquí: [employee_id => {activo, primera_marcacion, ultima_marcacion, dias_marcados}].
     */
    public function asistencia(array $employeeIds): array
    {
        if (!$employeeIds) {
            return [];
        }

        return $this->json($this->http()->post('/attendance', ['employee_ids' => array_values($employeeIds)]))['data'] ?? [];
    }

    private function http(): PendingRequest
    {
        if (!$this->configurado()) {
            throw new GestionException('Falta configurar GESTION_API_KEY para conectarse con la app de gestión.');
        }

        return Http::baseUrl(rtrim((string) config('services.gestion.url'), '/'))
            ->withHeaders(['X-Integration-Key' => (string) config('services.gestion.key')])
            ->acceptJson()
            ->connectTimeout(10)
            ->timeout(60);
    }

    private function json(Response $response): array
    {
        if ($response->failed()) {
            $errores = collect($response->json('errors') ?? [])->flatten()->implode(' ');
            $mensaje = $errores ?: ($response->json('message') ?: "HTTP {$response->status()}");

            throw new GestionException("Gestión respondió: {$mensaje}", $response->status());
        }

        return $response->json() ?? [];
    }
}
