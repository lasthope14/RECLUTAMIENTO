<?php

namespace App\Services;

use Carbon\Carbon;

/**
 * Festivos oficiales de Colombia: fijos, trasladables al lunes siguiente
 * (Ley 51 de 1983, "Ley Emiliani") y los que dependen de Semana Santa.
 */
class ColombianHolidays
{
    /** @var array<int, string[]> */
    private static array $cache = [];

    /**
     * Festivos decretados de forma extraordinaria (fecha exacta Y-m-d) que no
     * siguen las reglas ordinarias (fijos, Ley Emiliani ni Semana Santa).
     * Agrupados por año para no recalcularlos.
     *
     * @var array<int, string[]>
     */
    private static array $decreed = [
        2026 => [
            '2026-07-13', // Festivo decretado extraordinariamente
        ],
    ];

    /**
     * Fechas festivas (Y-m-d) de los años que cubre el rango, como set
     * (clave => true) para consultas rápidas.
     *
     * @return array<string, bool>
     */
    public static function betweenYears(int $startYear, int $endYear): array
    {
        $holidays = [];
        for ($year = $startYear; $year <= $endYear; $year++) {
            foreach (self::forYear($year) as $date) {
                $holidays[$date] = true;
            }
        }

        return $holidays;
    }

    /** ¿Esa fecha (Y-m-d) es festivo en Colombia? */
    public static function isHoliday(string $date): bool
    {
        $year = (int) substr($date, 0, 4);

        return in_array($date, self::forYear($year), true);
    }

    /** @return string[] fechas Y-m-d ordenadas */
    public static function forYear(int $year): array
    {
        if (isset(self::$cache[$year])) {
            return self::$cache[$year];
        }

        // Festivos de fecha fija (no se trasladan)
        $holidays = [
            "$year-01-01", // Año Nuevo
            "$year-05-01", // Día del Trabajo
            "$year-07-20", // Independencia
            "$year-08-07", // Batalla de Boyacá
            "$year-12-08", // Inmaculada Concepción
            "$year-12-25", // Navidad
        ];

        // Ley Emiliani: si no caen lunes, se corren al lunes siguiente
        $emiliani = [
            [1, 6],   // Reyes Magos
            [3, 19],  // San José
            [6, 29],  // San Pedro y San Pablo
            [8, 15],  // Asunción de la Virgen
            [10, 12], // Día de la Raza
            [11, 1],  // Todos los Santos
            [11, 11], // Independencia de Cartagena
        ];
        foreach ($emiliani as [$month, $day]) {
            $holidays[] = self::nextMonday(Carbon::create($year, $month, $day));
        }

        $easter = self::easterSunday($year);
        $holidays[] = $easter->copy()->subDays(3)->toDateString();       // Jueves Santo
        $holidays[] = $easter->copy()->subDays(2)->toDateString();       // Viernes Santo
        $holidays[] = self::nextMonday($easter->copy()->addDays(39));    // Ascensión del Señor
        $holidays[] = self::nextMonday($easter->copy()->addDays(60));    // Corpus Christi
        $holidays[] = self::nextMonday($easter->copy()->addDays(68));    // Sagrado Corazón

        // Festivos decretados de forma extraordinaria para este año
        foreach (self::$decreed[$year] ?? [] as $date) {
            $holidays[] = $date;
        }

        $holidays = array_values(array_unique($holidays));
        sort($holidays);

        return self::$cache[$year] = $holidays;
    }

    private static function nextMonday(Carbon $date): string
    {
        return ($date->isMonday() ? $date : $date->modify('next monday'))->toDateString();
    }

    /**
     * Domingo de Pascua por el algoritmo de computus (Meeus/Jones/Butcher).
     */
    private static function easterSunday(int $year): Carbon
    {
        $a = $year % 19;
        $b = intdiv($year, 100);
        $c = $year % 100;
        $d = intdiv($b, 4);
        $e = $b % 4;
        $f = intdiv($b + 8, 25);
        $g = intdiv($b - $f + 1, 3);
        $h = (19 * $a + $b - $d - $g + 15) % 30;
        $i = intdiv($c, 4);
        $k = $c % 4;
        $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
        $m = intdiv($a + 11 * $h + 22 * $l, 451);
        $month = intdiv($h + $l - 7 * $m + 114, 31);
        $day = (($h + $l - 7 * $m + 114) % 31) + 1;

        return Carbon::create($year, $month, $day);
    }
}
