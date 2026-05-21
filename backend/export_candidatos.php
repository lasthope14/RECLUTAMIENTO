<?php

// Incluir autoload y arrancar la aplicación Laravel
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Postulacion;
use App\Models\Candidato;

echo "🚀 Iniciando la exportación de candidatos...\n";

// Obtener todas las postulaciones con sus candidatos y perfiles
$postulaciones = Postulacion::with(['candidato.evaluaciones', 'perfilCargo'])->get();

echo "📊 Se encontraron " . $postulaciones->count() . " registros de postulación en la base de datos.\n";

$outputPath = dirname(__DIR__) . '/Reporte_Candidatos_Hidroobras.csv';
$file = fopen($outputPath, 'w');

if (!$file) {
    echo "❌ Error: No se pudo crear el archivo de reporte en {$outputPath}\n";
    exit(1);
}

// Escribir el BOM de UTF-8 para asegurar que Excel en Windows abra correctamente los acentos y la Ñ
fwrite($file, "\xEF\xBB\xBF");

// Definir cabecera de columnas del reporte (Matriz separada por punto y coma para Excel en español)
$headers = [
    'Nombre Completo',
    'Teléfono',
    'Correo Electrónico',
    'Ciudad',
    'Cargo al que Postula',
    'Estado del Proceso',
    'Calificación General IA (%)',
    'Estudios (Educación)',
    'Años de Experiencia',
    'Experiencia Laboral Detallada',
    'Habilidades Técnicas',
    'Certificaciones',
    'Resumen Profesional IA'
];

fputcsv($file, $headers, ';');

$count = 0;

foreach ($postulaciones as $post) {
    $candidato = $post->candidato;
    $datos = null;
    $puntuacionIa = 'Pendiente';
    
    if ($candidato && $candidato->estado_parseo === 'procesado') {
        $datos = $candidato->datos_extraidos;
        
        // Obtener puntaje de la evaluación si existe
        $evaluacion = $candidato->evaluaciones()->first();
        if ($evaluacion) {
            $puntuacionIa = ($evaluacion->puntaje_total ?? 'N/A') . '%';
        }
    }
    
    // 1. Nombre Completo
    $nombre = $datos['nombre_completo'] ?? $post->nombre_completo ?? 'Sin Nombre';
    
    // 2. Teléfono
    $telefono = $datos['telefono'] ?? $post->telefono ?? 'Sin Teléfono';
    
    // 3. Correo
    $email = $datos['email'] ?? $post->email ?? 'Sin Correo';
    
    // 4. Ciudad
    $ciudad = $datos['ciudad'] ?? 'No especificada';
    
    // 5. Cargo al que postula
    $cargoPostula = $post->perfilCargo->nombre ?? 'Sin Asignar';
    
    // 6. Estado en el sistema
    $estado = ucwords(str_replace('_', ' ', $post->estado ?? 'recibida'));
    
    // 7. Calificación IA se define arriba en $puntuacionIa
    
    // 8. Formatear Estudios (Educación)
    $estudiosArray = [];
    if (!empty($datos['educacion']) && is_array($datos['educacion'])) {
        foreach ($datos['educacion'] as $edu) {
            $inst = !empty($edu['institucion']) ? " en " . $edu['institucion'] : "";
            $nivel = !empty($edu['nivel']) ? " [" . $edu['nivel'] . "]" : "";
            $año = !empty($edu['año_grado']) ? " (" . $edu['año_grado'] . ")" : "";
            $estudiosArray[] = ($edu['titulo'] ?? 'Título') . $inst . $nivel . $año;
        }
    }
    $estudios = !empty($estudiosArray) ? implode(" | ", $estudiosArray) : ($candidato ? 'Sin datos de educación' : 'Pendiente de análisis IA');
    
    // 9. Años de Experiencia
    $aniosExp = isset($datos['años_experiencia_total']) ? $datos['años_experiencia_total'] . ' años' : ($candidato ? 'No calculado' : 'Pendiente');
    
    // 10. Formatear Experiencia Laboral
    $experienciaArray = [];
    if (!empty($datos['experiencia']) && is_array($datos['experiencia'])) {
        foreach ($datos['experiencia'] as $exp) {
            $empresa = !empty($exp['empresa']) ? " en " . $exp['empresa'] : "";
            $rango = (!empty($exp['fecha_inicio']) || !empty($exp['fecha_fin'])) ? " (" . ($exp['fecha_inicio'] ?? '?') . " - " . ($exp['fecha_fin'] ?? '?') . ")" : "";
            $duracion = !empty($exp['duracion_meses']) ? " [" . $exp['duracion_meses'] . " meses]" : "";
            $experienciaArray[] = ($exp['cargo'] ?? 'Cargo') . $empresa . $rango . $duracion;
        }
    }
    $experiencia = !empty($experienciaArray) ? implode(" | ", $experienciaArray) : ($candidato ? 'Sin experiencia registrada' : 'Pendiente de análisis IA');
    
    // 11. Habilidades Técnicas
    $habilidades = !empty($datos['habilidades_tecnicas']) && is_array($datos['habilidades_tecnicas']) 
        ? implode(", ", $datos['habilidades_tecnicas']) 
        : ($candidato ? 'No especificadas' : 'Pendiente');
        
    // 12. Certificaciones
    $certificaciones = !empty($datos['certificaciones']) && is_array($datos['certificaciones']) 
        ? implode(", ", $datos['certificaciones']) 
        : ($candidato ? 'Ninguna' : 'Pendiente');
        
    // 13. Resumen Profesional
    $resumen = $candidato->resumen_ia ?? $datos['resumen_profesional'] ?? ($candidato ? 'Sin resumen generado' : 'Pendiente de análisis IA');

    // Construir fila sanitizando saltos de línea para evitar romper la celda en Excel
    $row = [
        trim(str_replace(["\r", "\n", ";"], [" ", " ", ","], $nombre)),
        trim(str_replace(["\r", "\n", ";"], [" ", " ", ","], $telefono)),
        trim(str_replace(["\r", "\n", ";"], [" ", " ", ","], $email)),
        trim(str_replace(["\r", "\n", ";"], [" ", " ", ","], $ciudad)),
        trim(str_replace(["\r", "\n", ";"], [" ", " ", ","], $cargoPostula)),
        trim(str_replace(["\r", "\n", ";"], [" ", " ", ","], $estado)),
        $puntuacionIa,
        trim(str_replace(["\r", "\n", ";"], [" ", " ", ","], $estudios)),
        $aniosExp,
        trim(str_replace(["\r", "\n", ";"], [" ", " ", ","], $experiencia)),
        trim(str_replace(["\r", "\n", ";"], [" ", " ", ","], $habilidades)),
        trim(str_replace(["\r", "\n", ";"], [" ", " ", ","], $certificaciones)),
        trim(str_replace(["\r", "\n", ";"], [" ", " ", ","], $resumen))
    ];

    fputcsv($file, $row, ';');
    $count++;
}

fclose($file);

echo "🎉 Exportación completada con éxito. Se exportaron {$count} candidatos.\n";
echo "📂 Reporte guardado en: {$outputPath}\n";
?>
