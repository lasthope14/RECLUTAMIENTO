<?php

// Incluir autoload y arrancar la aplicación Laravel
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Postulacion;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Font;

echo "🚀 Iniciando la exportación profesional a Excel...\n";

// Obtener todas las postulaciones con sus candidatos y perfiles
$postulaciones = Postulacion::with(['candidato.evaluaciones', 'perfilCargo'])->get();

echo "📊 Se encontraron " . $postulaciones->count() . " registros de postulación.\n";

$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();
$sheet->setTitle('Candidatos Hidroobras');

// Habilitar visualización de líneas de cuadrícula (Gridlines)
$sheet->setShowGridlines(true);

// ── ESTILOS CORPORATIVOS ──
$colorPrincipal = '1E3A8A'; // Navy Blue Hidroobras
$colorSecundario = '3B82F6'; // Azul Claro
$colorZebra = 'F8FAFC'; // Gris muy claro para filas pares
$colorBorde = 'CBD5E1'; // Gris para bordes

// Estilo del título principal
$styleTitulo = [
    'font' => [
        'name' => 'Segoe UI',
        'bold' => true,
        'size' => 16,
        'color' => ['rgb' => 'FFFFFF'],
    ],
    'fill' => [
        'fillType' => Fill::FILL_SOLID,
        'startColor' => ['rgb' => $colorPrincipal],
    ],
    'alignment' => [
        'horizontal' => Alignment::HORIZONTAL_CENTER,
        'vertical' => Alignment::VERTICAL_CENTER,
    ],
];

// Estilo del subtítulo / metadatos
$styleSubtitulo = [
    'font' => [
        'name' => 'Segoe UI',
        'italic' => true,
        'size' => 10,
        'color' => ['rgb' => '475569'],
    ],
    'alignment' => [
        'horizontal' => Alignment::HORIZONTAL_LEFT,
        'vertical' => Alignment::VERTICAL_CENTER,
    ],
];

// Estilo de la cabecera de la tabla
$styleCabecera = [
    'font' => [
        'name' => 'Segoe UI',
        'bold' => true,
        'size' => 11,
        'color' => ['rgb' => 'FFFFFF'],
    ],
    'fill' => [
        'fillType' => Fill::FILL_SOLID,
        'startColor' => ['rgb' => $colorPrincipal],
    ],
    'alignment' => [
        'horizontal' => Alignment::HORIZONTAL_CENTER,
        'vertical' => Alignment::VERTICAL_CENTER,
        'wrapText' => true,
    ],
    'borders' => [
        'allBorders' => [
            'borderStyle' => Border::BORDER_THIN,
            'color' => ['rgb' => 'FFFFFF'],
        ],
    ],
];

// Estilo para datos generales
$styleDatosBase = [
    'font' => [
        'name' => 'Segoe UI',
        'size' => 10,
    ],
    'alignment' => [
        'vertical' => Alignment::VERTICAL_TOP,
    ],
    'borders' => [
        'allBorders' => [
            'borderStyle' => Border::BORDER_THIN,
            'color' => ['rgb' => $colorBorde],
        ],
    ],
];

// Estilo para alineación centrada (p. ej., Teléfono, Puntaje, Estado, Experiencia)
$styleCentrado = [
    'alignment' => [
        'horizontal' => Alignment::HORIZONTAL_CENTER,
        'vertical' => Alignment::VERTICAL_TOP,
    ],
];

// ── DISEÑO DE LA CABECERA EN EXCEL ──

// Fila 1 y 2: Banner corporativo
$sheet->mergeCells('A1:M2');
$sheet->setCellValue('A1', 'HIDROOBRAS S.A.S. - INFORME ESTRATÉGICO DE POSTULANTES (RECLUTADOR IA)');
$sheet->getStyle('A1:M2')->applyFromArray($styleTitulo);
$sheet->getRowDimension(1)->setRowHeight(25);
$sheet->getRowDimension(2)->setRowHeight(25);

// Fila 4: Metadatos
$fechaActual = date('Y-m-d H:i:s');
$sheet->setCellValue('A4', "Fecha de generación: {$fechaActual}  |  Total postulantes consolidados: " . $postulaciones->count());
$sheet->getStyle('A4')->applyFromArray($styleSubtitulo);
$sheet->getRowDimension(4)->setRowHeight(20);

// Fila 6: Nombres de columnas
$headers = [
    'Nombre Completo',
    'Teléfono',
    'Correo Electrónico',
    'Ciudad',
    'Cargo al que Postula',
    'Estado del Proceso',
    'Calificación IA (%)',
    'Estudios (Educación)',
    'Años Experiencia',
    'Experiencia Laboral Detallada',
    'Habilidades Técnicas',
    'Certificaciones',
    'Resumen Profesional IA'
];

$colIdx = 1;
foreach ($headers as $header) {
    $sheet->setCellValueByColumnAndRow($colIdx, 6, $header);
    $colIdx++;
}
$sheet->getStyle('A6:M6')->applyFromArray($styleCabecera);
$sheet->getRowDimension(6)->setRowHeight(35);

// ── CARGA DE DATOS ──
$rowIdx = 7;
foreach ($postulaciones as $post) {
    $candidato = $post->candidato;
    $datos = null;
    $puntuacionIa = 'Pendiente';
    
    if ($candidato && $candidato->estado_parseo === 'procesado') {
        $datos = $candidato->datos_extraidos;
        
        $evaluacion = $candidato->evaluaciones()->first();
        if ($evaluacion) {
            $puntuacionIa = ($evaluacion->puntaje_total ?? 'N/A') . '%';
        }
    }
    
    $nombre = $datos['nombre_completo'] ?? $post->nombre_completo ?? 'Sin Nombre';
    $telefono = $datos['telefono'] ?? $post->telefono ?? 'Sin Teléfono';
    $email = $datos['email'] ?? $post->email ?? 'Sin Correo';
    $ciudad = $datos['ciudad'] ?? 'No especificada';
    $cargoPostula = $post->perfilCargo->nombre ?? 'Sin Asignar';
    $estado = ucwords(str_replace('_', ' ', $post->estado ?? 'recibida'));
    
    // Estudios
    $estudiosArray = [];
    if (!empty($datos['educacion']) && is_array($datos['educacion'])) {
        foreach ($datos['educacion'] as $edu) {
            $inst = !empty($edu['institucion']) ? " en " . $edu['institucion'] : "";
            $nivel = !empty($edu['nivel']) ? " [" . $edu['nivel'] . "]" : "";
            $año = !empty($edu['año_grado']) ? " (" . $edu['año_grado'] . ")" : "";
            $estudiosArray[] = ($edu['titulo'] ?? 'Título') . $inst . $nivel . $año;
        }
    }
    $estudios = !empty($estudiosArray) ? implode("\n• ", $estudiosArray) : ($candidato ? 'Sin datos de educación' : 'Pendiente de análisis IA');
    if (!empty($estudiosArray)) {
        $estudios = "• " . $estudios;
    }
    
    // Experiencia
    $aniosExp = isset($datos['años_experiencia_total']) ? $datos['años_experiencia_total'] . ' años' : ($candidato ? 'No calculado' : 'Pendiente');
    
    $experienciaArray = [];
    if (!empty($datos['experiencia']) && is_array($datos['experiencia'])) {
        foreach ($datos['experiencia'] as $exp) {
            $empresa = !empty($exp['empresa']) ? " en " . $exp['empresa'] : "";
            $rango = (!empty($exp['fecha_inicio']) || !empty($exp['fecha_fin'])) ? " (" . ($exp['fecha_inicio'] ?? '?') . " - " . ($exp['fecha_fin'] ?? '?') . ")" : "";
            $duracion = !empty($exp['duracion_meses']) ? " [" . $exp['duracion_meses'] . " meses]" : "";
            $experienciaArray[] = ($exp['cargo'] ?? 'Cargo') . $empresa . $rango . $duracion;
        }
    }
    $experiencia = !empty($experienciaArray) ? implode("\n• ", $experienciaArray) : ($candidato ? 'Sin experiencia registrada' : 'Pendiente de análisis IA');
    if (!empty($experienciaArray)) {
        $experiencia = "• " . $experiencia;
    }
    
    // Habilidades
    $habilidades = !empty($datos['habilidades_tecnicas']) && is_array($datos['habilidades_tecnicas']) 
        ? implode(", ", $datos['habilidades_tecnicas']) 
        : ($candidato ? 'No especificadas' : 'Pendiente');
        
    // Certificaciones
    $certificaciones = !empty($datos['certificaciones']) && is_array($datos['certificaciones']) 
        ? implode(", ", $datos['certificaciones']) 
        : ($candidato ? 'Ninguna' : 'Pendiente');
        
    // Resumen
    $resumen = $candidato->resumen_ia ?? $datos['resumen_profesional'] ?? ($candidato ? 'Sin resumen generado' : 'Pendiente de análisis IA');

    // Escribir en las celdas
    $sheet->setCellValue('A' . $rowIdx, $nombre);
    $sheet->setCellValue('B' . $rowIdx, $telefono);
    $sheet->setCellValue('C' . $rowIdx, $email);
    $sheet->setCellValue('D' . $rowIdx, $ciudad);
    $sheet->setCellValue('E' . $rowIdx, $cargoPostula);
    $sheet->setCellValue('F' . $rowIdx, $estado);
    $sheet->setCellValue('G' . $rowIdx, $puntuacionIa);
    $sheet->setCellValue('H' . $rowIdx, $estudios);
    $sheet->setCellValue('I' . $rowIdx, $aniosExp);
    $sheet->setCellValue('J' . $rowIdx, $experiencia);
    $sheet->setCellValue('K' . $rowIdx, $habilidades);
    $sheet->setCellValue('L' . $rowIdx, $certificaciones);
    $sheet->setCellValue('M' . $rowIdx, $resumen);

    // Formatear la fila de datos
    $rangoFila = 'A' . $rowIdx . ':M' . $rowIdx;
    $sheet->getStyle($rangoFila)->applyFromArray($styleDatosBase);
    
    // Centrar ciertas columnas
    $sheet->getStyle('B' . $rowIdx)->applyFromArray($styleCentrado);
    $sheet->getStyle('F' . $rowIdx)->applyFromArray($styleCentrado);
    $sheet->getStyle('G' . $rowIdx)->applyFromArray($styleCentrado);
    $sheet->getStyle('I' . $rowIdx)->applyFromArray($styleCentrado);

    // Ajustar alineación con salto de línea para celdas largas
    $sheet->getStyle('H' . $rowIdx)->getAlignment()->setWrapText(true);
    $sheet->getStyle('J' . $rowIdx)->getAlignment()->setWrapText(true);
    $sheet->getStyle('K' . $rowIdx)->getAlignment()->setWrapText(true);
    $sheet->getStyle('L' . $rowIdx)->getAlignment()->setWrapText(true);
    $sheet->getStyle('M' . $rowIdx)->getAlignment()->setWrapText(true);

    // Zebra striping para filas pares
    if ($rowIdx % 2 === 0) {
        $sheet->getStyle($rangoFila)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($colorZebra);
    }

    // Colores especiales de estado
    $estadoColor = 'FFFFFF';
    $estadoText = '000000';
    switch (strtolower($post->estado)) {
        case 'recibida':        $estadoColor = 'EFF6FF'; $estadoText = '1E40AF'; break;
        case 'en_revision':     $estadoColor = 'FFFBEB'; $estadoText = '92400E'; break;
        case 'preseleccionado': $estadoColor = 'ECFDF5'; $estadoText = '065F46'; break;
        case 'descartado':      $estadoColor = 'FEF2F2'; $estadoText = '991B1B'; break;
        case 'contratado':      $estadoColor = 'F5F3FF'; $estadoText = '5B21B6'; break;
    }
    $sheet->getStyle('F' . $rowIdx)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($estadoColor);
    $sheet->getStyle('F' . $rowIdx)->getFont()->getColor()->setRGB($estadoText);
    $sheet->getStyle('F' . $rowIdx)->getFont()->setBold(true);

    // Color especial para el Score de IA si es recomendado
    if (is_numeric(str_replace('%', '', $puntuacionIa))) {
        $numScore = (float)str_replace('%', '', $puntuacionIa);
        if ($numScore >= 80) {
            $sheet->getStyle('G' . $rowIdx)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('D1FAE5'); // Verde suave
            $sheet->getStyle('G' . $rowIdx)->getFont()->getColor()->setRGB('065F46');
            $sheet->getStyle('G' . $rowIdx)->getFont()->setBold(true);
        } elseif ($numScore >= 60) {
            $sheet->getStyle('G' . $rowIdx)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('DBEAFE'); // Azul suave
            $sheet->getStyle('G' . $rowIdx)->getFont()->getColor()->setRGB('1E40AF');
            $sheet->getStyle('G' . $rowIdx)->getFont()->setBold(true);
        }
    }

    $rowIdx++;
}

// ── CONFIGURACIÓN DE ANCHOS Y AUTO-AJUSTE ──
$columnas = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'I'];
foreach ($columnas as $col) {
    $sheet->getColumnDimension($col)->setAutoSize(true);
}

// Para las columnas de contenido muy largo, definimos anchos fijos y forzamos WrapText
$sheet->getColumnDimension('H')->setWidth(35); // Estudios
$sheet->getColumnDimension('J')->setWidth(50); // Experiencia detallada
$sheet->getColumnDimension('K')->setWidth(30); // Habilidades
$sheet->getColumnDimension('L')->setWidth(30); // Certificaciones
$sheet->getColumnDimension('M')->setWidth(45); // Resumen Profesional IA

// Auto-ajustar alturas de fila de datos para dar aire al texto envuelto
for ($i = 7; $i < $rowIdx; $i++) {
    $sheet->getRowDimension($i)->setRowHeight(-1); // Auto-calcular altura de celda
}

$outputPath = dirname(__DIR__) . '/Reporte_Candidatos_Hidroobras.xlsx';
$writer = new Xlsx($spreadsheet);
$writer->save($outputPath);

echo "🎉 Exportación a Excel completada con éxito. Se exportaron " . ($rowIdx - 7) . " candidatos.\n";
echo "📂 Reporte profesional guardado en: {$outputPath}\n";

?>
