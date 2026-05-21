<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Postulacion;
$p = Postulacion::find(153);
if ($p) {
    echo "ID: " . $p->id . "\n";
    echo "Nombre: " . $p->nombre_completo . "\n";
    echo "Archivo CV: " . $p->archivo_cv . "\n";
    echo "Archivo Nombre: " . $p->archivo_nombre . "\n";
    echo "Archivo Mime: " . $p->archivo_mime . "\n";
    
    $fullPath = storage_path('app/private/' . $p->archivo_cv);
    echo "storage_path('app/private/...'): " . $fullPath . "\n";
    echo "Exists: " . (file_exists($fullPath) ? 'yes' : 'no') . "\n";
    if (file_exists($fullPath)) {
        echo "Size: " . filesize($fullPath) . " bytes\n";
    }
    
    // Check if candidate exists
    if ($p->candidato) {
        echo "Candidato ID: " . $p->candidato->id . "\n";
        echo "Estado Parseo: " . $p->candidato->estado_parseo . "\n";
        echo "Error Parseo: " . $p->candidato->error_parseo . "\n";
    } else {
        echo "No candidate record found.\n";
    }
} else {
    echo "Postulacion 153 not found.\n";
}
