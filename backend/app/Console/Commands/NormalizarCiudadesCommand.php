<?php

namespace App\Console\Commands;

use App\Models\Postulacion;
use Illuminate\Console\Command;

class NormalizarCiudadesCommand extends Command
{
    protected $signature = 'ciudades:normalizar {--dry-run : Muestra los cambios sin guardarlos}';

    protected $description = 'Normaliza las ciudades de las postulaciones existentes (colapsa variantes como "Bogotá D.C." o "Medellín, Antioquia" a un único municipio).';

    /**
     * Municipios conocidos: clave sin tildes/minúscula => nombre canónico.
     * Se usa por coincidencia de prefijo, de modo que "medellin antioquia colombia"
     * o "bogota dc" se resuelven al municipio correcto.
     */
    protected array $ciudades = [
        'abrego' => 'Ábrego',
        'agustin codazzi' => 'Agustín Codazzi',
        'apartado' => 'Apartadó',
        'armenia' => 'Armenia',
        'barcelona' => 'Barcelona',
        'barrancabermeja' => 'Barrancabermeja',
        'barranquilla' => 'Barranquilla',
        'bello' => 'Bello',
        'bogota' => 'Bogotá',
        'bucaramanga' => 'Bucaramanga',
        'buenaventura' => 'Buenaventura',
        'cali' => 'Cali',
        'caracas' => 'Caracas',
        'cartagena' => 'Cartagena',
        'chia' => 'Chía',
        'cienaga' => 'Ciénaga',
        'copacabana' => 'Copacabana',
        'cucuta' => 'Cúcuta',
        'duitama' => 'Duitama',
        'envigado' => 'Envigado',
        'facatativa' => 'Facatativá',
        'floridablanca' => 'Floridablanca',
        'fonseca' => 'Fonseca',
        'fusagasuga' => 'Fusagasugá',
        'giron' => 'Girón',
        'guamo' => 'Guamo',
        'guaymaral' => 'Guaymaral',
        'ibague' => 'Ibagué',
        'ipiales' => 'Ipiales',
        'itagui' => 'Itagüí',
        'la estrella' => 'La Estrella',
        'linares' => 'Linares',
        'madrid' => 'Madrid',
        'manizales' => 'Manizales',
        'medellin' => 'Medellín',
        'monagas' => 'Monagas',
        'monteria' => 'Montería',
        'neiva' => 'Neiva',
        'neuquen' => 'Neuquén',
        'ocana' => 'Ocaña',
        'palmira' => 'Palmira',
        'pasto' => 'Pasto',
        'pereira' => 'Pereira',
        'planeta rica' => 'Planeta Rica',
        'popayan' => 'Popayán',
        'riohacha' => 'Riohacha',
        'sabaneta' => 'Sabaneta',
        'santa marta' => 'Santa Marta',
        'santuario' => 'Santuario',
        'sincelejo' => 'Sincelejo',
        'soacha' => 'Soacha',
        'sogamoso' => 'Sogamoso',
        'soledad' => 'Soledad',
        'tocancipa' => 'Tocancipá',
        'tulua' => 'Tuluá',
        'tunja' => 'Tunja',
        'turbo' => 'Turbo',
        'valledupar' => 'Valledupar',
        'villavicencio' => 'Villavicencio',
        'yopal' => 'Yopal',
        'zipaquira' => 'Zipaquirá',
    ];

    /**
     * Valores que NO son municipios (departamentos, países, regiones): se descartan.
     */
    protected array $noEsCiudad = [
        'colombia', 'venezuela', 'espana', 'argentina',
        'norte de santander', 'santander', 'cundinamarca', 'antioquia',
        'boyaca', 'narino', 'atlantico', 'magdalena', 'la guajira',
        'valle del cauca', 'risaralda', 'tolima', 'cauca', 'cesar',
        'cordoba', 'sucre', 'bolivar', 'caldas', 'quindio', 'huila',
        'meta', 'casanare', 'guajira',
    ];

    public function handle(): int
    {
        $dry = $this->option('dry-run');
        $keys = array_keys($this->ciudades);
        // Ordenar por longitud descendente para que gane el prefijo más específico.
        usort($keys, fn($a, $b) => strlen($b) - strlen($a));

        $actualizadas = 0;
        $anuladas = 0;
        $sinCambio = 0;

        Postulacion::whereNotNull('ciudad')->where('ciudad', '!=', '')
            ->orderBy('id')
            ->chunkById(200, function ($postulaciones) use ($keys, $dry, &$actualizadas, &$anuladas, &$sinCambio) {
                foreach ($postulaciones as $post) {
                    $original = $post->ciudad;
                    $norm = $this->normalizar($original, $keys);

                    if ($norm === $original) {
                        $sinCambio++;
                        continue;
                    }

                    if ($norm === null) {
                        $anuladas++;
                        $this->line("  <fg=red>✗</> \"{$original}\" → (descartada, no es municipio)");
                    } else {
                        $actualizadas++;
                        $this->line("  <fg=green>✓</> \"{$original}\" → \"{$norm}\"");
                    }

                    if (!$dry) {
                        $post->ciudad = $norm;
                        // Mantener sincronizado el JSON extraído para el detalle.
                        if ($post->candidato && is_array($post->candidato->datos_extraidos)) {
                            $datos = $post->candidato->datos_extraidos;
                            $datos['ciudad'] = $norm;
                            $post->candidato->update(['datos_extraidos' => $datos]);
                        }
                        $post->save();
                    }
                }
            });

        $this->newLine();
        $this->info(($dry ? '[DRY-RUN] ' : '') . "Normalizadas: {$actualizadas} · Descartadas: {$anuladas} · Sin cambio: {$sinCambio}");

        return self::SUCCESS;
    }

    protected function normalizar(string $raw, array $keys): ?string
    {
        // 1. Tomar solo la primera parte antes de un separador (coma, paréntesis,
        //    barra, guion largo, " - ", " y/o ").
        $parte = preg_split('/\s*(,|\(|\/|–|\s-\s|\sy\/o\s)\s*/u', trim($raw))[0] ?? '';

        // 2. Normalizar para comparar: minúscula, sin tildes, sin puntos, espacios colapsados.
        $key = $this->slug($parte);
        // Quitar sufijos "d c" (D.C.) sueltos.
        $key = trim(preg_replace('/\bd\s*c\b/', '', $key));
        $key = trim(preg_replace('/\s+/', ' ', $key));

        if ($key === '') {
            return null;
        }

        // 3. ¿Es un departamento/país? → descartar.
        if (in_array($key, $this->noEsCiudad, true)) {
            return null;
        }

        // 4. Coincidencia por prefijo con municipios conocidos.
        foreach ($keys as $ciudadKey) {
            if ($key === $ciudadKey || str_starts_with($key, $ciudadKey . ' ')) {
                return $this->ciudades[$ciudadKey];
            }
        }

        // 5. Desconocido: devolver la primera parte con formato Título.
        return $this->titulo($parte);
    }

    protected function slug(string $s): string
    {
        $s = mb_strtolower(trim($s), 'UTF-8');
        $s = str_replace(
            ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', 'à', 'è', 'ì', 'ò', 'ù'],
            ['a', 'e', 'i', 'o', 'u', 'u', 'n', 'a', 'e', 'i', 'o', 'u'],
            $s
        );
        $s = str_replace(['.', '-', '–'], [' ', ' ', ' '], $s);
        return trim(preg_replace('/\s+/', ' ', $s));
    }

    protected function titulo(string $s): string
    {
        return mb_convert_case(trim($s), MB_CASE_TITLE, 'UTF-8');
    }
}
