<?php

namespace App\Services;

use App\Models\Postulacion;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Fases del proceso de selección, desde que el aspirante se preselecciona
 * hasta que se vincula como empleado en gestión.
 *
 * Cada movimiento queda en postulacion_fases:
 *   entra       → el aspirante llega a la fase
 *   aprueba     → pasa la fase (y "entra" a la siguiente)
 *   no_aprueba  → no la pasa: el proceso termina ahí y la postulación queda descartada
 *   reabre      → se retoma un proceso que se había cerrado
 *   vinculado   → se creó el empleado en gestión
 */
class ProcesoSeleccionService
{
    /** Orden de las fases. Para cambiarlas basta con editar esta lista. */
    public const FASES = [
        'entrevista'    => 'Entrevista',
        'pruebas'       => 'Pruebas técnicas y psicotécnicas',
        'referencias'   => 'Referencias y antecedentes',
        'examen_medico' => 'Exámenes médicos',
        'documentacion' => 'Documentación de ingreso',
        'vinculacion'   => 'Listo para vincular',
    ];

    /** Fase final: ya es empleado en gestión. */
    public const VINCULADO = 'vinculado';

    public static function etiqueta(?string $fase): ?string
    {
        if ($fase === null) {
            return null;
        }

        return $fase === self::VINCULADO ? 'Vinculado' : (self::FASES[$fase] ?? $fase);
    }

    /** Lista para el frontend: [{id, label, orden}]. */
    public static function fases(): array
    {
        return collect(self::FASES)
            ->map(fn ($label, $id) => ['id' => $id, 'label' => $label])
            ->values()
            ->map(fn ($f, $i) => $f + ['orden' => $i + 1])
            ->all();
    }

    public static function enProceso(Postulacion $p): bool
    {
        return $p->fase !== null && $p->fase !== self::VINCULADO && $p->estado !== 'descartado';
    }

    /** Arranca el proceso en la primera fase. No hace nada si ya arrancó. */
    public function iniciar(Postulacion $p, ?User $user, ?string $observacion = null): Postulacion
    {
        if ($p->fase !== null) {
            return $p;
        }

        return DB::transaction(function () use ($p, $user, $observacion) {
            $primera = array_key_first(self::FASES);
            $this->registrar($p, $primera, 'entra', $observacion, $user);

            $p->update([
                'fase' => $primera,
                'fase_desde' => now(),
                'estado' => 'preseleccionado',
            ]);

            return $p;
        });
    }

    /** Aprueba la fase actual y pasa a la siguiente. */
    public function aprobar(Postulacion $p, ?User $user, ?string $observacion = null): Postulacion
    {
        $this->exigirEnProceso($p);

        $siguiente = $this->siguiente($p->fase);
        if ($siguiente === null) {
            throw ValidationException::withMessages([
                'fase' => 'Esta es la última fase: se completa con el botón «Vincular a gestión».',
            ]);
        }

        return DB::transaction(function () use ($p, $user, $observacion, $siguiente) {
            $this->registrar($p, $p->fase, 'aprueba', $observacion, $user);
            $this->registrar($p, $siguiente, 'entra', null, $user);

            $p->update(['fase' => $siguiente, 'fase_desde' => now()]);

            return $p;
        });
    }

    /** No aprobó la fase actual: el proceso termina ahí. */
    public function noAprueba(Postulacion $p, ?User $user, string $motivo): Postulacion
    {
        $this->exigirEnProceso($p);

        return DB::transaction(function () use ($p, $user, $motivo) {
            $this->registrar($p, $p->fase, 'no_aprueba', $motivo, $user);
            $p->update(['estado' => 'descartado']);

            return $p;
        });
    }

    /** Retoma un proceso cerrado en la misma fase en la que se cayó. */
    public function reabrir(Postulacion $p, ?User $user, ?string $observacion = null): Postulacion
    {
        if ($p->fase === null || $p->fase === self::VINCULADO || $p->estado !== 'descartado') {
            throw ValidationException::withMessages(['fase' => 'Solo se puede retomar un proceso cerrado.']);
        }

        return DB::transaction(function () use ($p, $user, $observacion) {
            $this->registrar($p, $p->fase, 'reabre', $observacion, $user);
            $p->update(['estado' => 'preseleccionado', 'fase_desde' => now()]);

            return $p;
        });
    }

    /** Cierra el proceso: el aspirante ya es empleado en gestión. */
    public function marcarVinculado(Postulacion $p, ?User $user, int $employeeId): Postulacion
    {
        return DB::transaction(function () use ($p, $user, $employeeId) {
            $this->registrar($p, $p->fase ?? 'vinculacion', 'aprueba', null, $user);
            $this->registrar($p, self::VINCULADO, 'vinculado', "Empleado #{$employeeId} en gestión", $user);

            $p->update([
                'fase' => self::VINCULADO,
                'fase_desde' => now(),
                'estado' => 'contratado',
                'gestion_employee_id' => $employeeId,
                'vinculado_at' => now(),
                'vinculado_por' => $user?->name,
            ]);

            return $p;
        });
    }

    /**
     * El estado general de la postulación (pestaña Gestión, tablero) y el
     * proceso van de la mano: al preseleccionar arranca el proceso, un
     * descarte hecho desde el estado cuenta como caída en la fase en que iba
     * y sacarlo de descartado retoma el proceso.
     */
    public function sincronizarConEstado(Postulacion $p, ?string $estadoAnterior, ?User $user, ?string $motivo = null): void
    {
        $nuevo = $p->estado;
        $abierto = $p->fase !== null && $p->fase !== self::VINCULADO;

        if ($nuevo === $estadoAnterior) {
            return;
        }

        if ($nuevo === 'preseleccionado' && $p->fase === null) {
            $this->iniciar($p, $user);
        } elseif ($nuevo === 'descartado' && $abierto) {
            $this->registrar($p, $p->fase, 'no_aprueba', $motivo ?? 'Descartado desde el estado de la postulación.', $user);
        } elseif ($estadoAnterior === 'descartado' && $abierto) {
            $this->registrar($p, $p->fase, 'reabre', null, $user);
            $p->update(['fase_desde' => now()]);
        }
    }

    private function siguiente(string $fase): ?string
    {
        $orden = array_keys(self::FASES);
        $i = array_search($fase, $orden, true);

        return $i === false ? null : ($orden[$i + 1] ?? null);
    }

    private function exigirEnProceso(Postulacion $p): void
    {
        if (!self::enProceso($p)) {
            throw ValidationException::withMessages(['fase' => 'El aspirante no tiene un proceso de selección abierto.']);
        }
    }

    private function registrar(Postulacion $p, string $fase, string $evento, ?string $observacion, ?User $user): void
    {
        $p->fases()->create([
            'fase' => $fase,
            'evento' => $evento,
            'observacion' => $observacion,
            'user_id' => $user?->id,
            'autor_nombre' => $user?->name,
        ]);
    }
}
