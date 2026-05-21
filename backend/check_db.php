<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Candidato;
use App\Models\Postulacion;

echo "--- CANDIDATOS CON ESTADO PARSEO = 'error' ---\n";
$errors = Candidato::where('estado_parseo', 'error')->get();
foreach ($errors as $c) {
    echo "Candidato ID: {$c->id} | Postulacion ID: {$c->postulacion_id} | Nombre: {$c->postulacion->nombre_completo} | Error: {$c->error_parseo}\n";
}

echo "\n--- POSTULACIONES CON CV PERO SIN CANDIDATO ---\n";
$no_candidato = Postulacion::whereNotNull('archivo_cv')->whereDoesntHave('candidato')->get();
foreach ($no_candidato as $p) {
    echo "Postulacion ID: {$p->id} | Nombre: {$p->nombre_completo} | Archivo: {$p->archivo_nombre}\n";
}

echo "\n--- POSTULACIONES CON CV Y CANDIDATO PENDIENTE ---\n";
$pendientes = Postulacion::whereNotNull('archivo_cv')->whereHas('candidato', function($q) {
    $q->where('estado_parseo', 'pendiente');
})->get();
foreach ($pendientes as $p) {
    echo "Postulacion ID: {$p->id} | Nombre: {$p->nombre_completo} | Archivo: {$p->archivo_nombre}\n";
}
