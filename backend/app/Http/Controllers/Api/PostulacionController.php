<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessCvJob;
use App\Models\Candidato;
use App\Models\DocumentoAspirante;
use App\Models\EvaluacionIa;
use App\Models\PerfilCargo;
use App\Models\Postulacion;
use App\Services\GeminiService;
use App\Services\ProcesoSeleccionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class PostulacionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Postulacion::with([
                'perfilCargo:id,nombre,ciudad',
                'candidato:id,postulacion_id,estado_parseo,resumen_ia,datos_extraidos',
                'candidato.evaluaciones:id,candidato_id,perfil_cargo_id,puntaje_total,puntaje_educacion,puntaje_experiencia,puntaje_habilidades,puntaje_perfil_general,recomendacion',
            ])->latest('fecha_recepcion');

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }
        if ($request->filled('perfil_cargo_id')) {
            $query->where('perfil_cargo_id', $request->perfil_cargo_id);
        }
        if ($request->filled('fuente')) {
            $query->where('fuente', $request->fuente);
        }
        if ($request->filled('ciudad')) {
            $query->where('ciudad', $request->ciudad);
        }
        if ($request->boolean('marcada')) {
            $query->where('marcada', true);
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn($q) => $q
                ->where('nombre_completo', 'like', "%{$s}%")
                ->orWhere('email', 'like', "%{$s}%")
            );
        }
        if ($request->filled('estado_parseo')) {
            $query->whereHas('candidato', function($q) use ($request) {
                $q->where('estado_parseo', $request->estado_parseo);
            });
        }
        if ($request->has('tiene_cv')) {
            if ($request->boolean('tiene_cv')) {
                $query->whereNotNull('archivo_cv');
            } else {
                $query->whereNull('archivo_cv');
            }
        }

        if ($request->filled('recomendacion')) {
            if ($request->recomendacion === 'sin_evaluar') {
                $query->whereDoesntHave('candidato.evaluaciones');
            } else {
                $query->whereHas('candidato.evaluaciones', fn($q) =>
                    $q->where('recomendacion', $request->recomendacion)
                );
            }
        }

        $perPage = min((int) $request->input('per_page', 20), 500);

        return response()->json($query->paginate($perPage));
    }

    public function ciudades(): JsonResponse
    {
        $ciudades = Postulacion::whereNotNull('ciudad')
            ->where('ciudad', '!=', '')
            ->distinct()
            ->orderBy('ciudad')
            ->pluck('ciudad');

        return response()->json($ciudades);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre_completo' => 'required|string|max:255',
            'email'           => 'nullable|email',
            'telefono'        => 'nullable|string|max:30',
            'fuente'          => 'required|in:email,manual,linkedin,whatsapp,portal,otro',
            'perfil_cargo_id' => 'nullable|exists:perfiles_cargo,id',
            'notas_hr'        => 'nullable|string',
            'archivo_cv'      => 'nullable|file|mimes:pdf,doc,docx|max:15360',
        ]);

        $cvPath   = null;
        $cvNombre = null;
        $cvMime   = null;

        if ($request->hasFile('archivo_cv')) {
            $file     = $request->file('archivo_cv');
            $cvNombre = $file->getClientOriginalName();
            $cvMime   = $file->getMimeType();
            $cvPath   = $file->store('cvs/' . date('Y/m'), 'local');
        }

        $postulacion = Postulacion::create([
            ...$validated,
            'archivo_cv'      => $cvPath,
            'archivo_nombre'  => $cvNombre,
            'archivo_mime'    => $cvMime,
            'fecha_recepcion' => now(),
            'estado'          => 'recibida',
        ]);

        if ($cvPath) {
            ProcessCvJob::dispatchSync($postulacion->id);
        }

        return response()->json($postulacion->load('perfilCargo'), 201);
    }

    public function show(Postulacion $postulacion): JsonResponse
    {
        $postulacion->load([
            'perfilCargo',
            'candidato.evaluaciones.perfilCargo',
            'emailLogs',
            'comentarios.user:id,name',
        ]);
        return response()->json($postulacion);
    }

    public function toggleMarca(Request $request, Postulacion $postulacion): JsonResponse
    {
        $marcada = $request->has('marcada')
            ? $request->boolean('marcada')
            : !$postulacion->marcada;

        $postulacion->update(['marcada' => $marcada]);

        return response()->json(['marcada' => $postulacion->marcada]);
    }

    public function agregarComentario(Request $request, Postulacion $postulacion): JsonResponse
    {
        $validated = $request->validate([
            'comentario' => 'required|string|max:5000',
        ]);

        $user = $request->user();

        $comentario = $postulacion->comentarios()->create([
            'user_id'      => $user?->id,
            'autor_nombre' => $user?->name,
            'comentario'   => $validated['comentario'],
        ]);

        return response()->json($comentario->load('user:id,name'), 201);
    }

    public function eliminarComentario(Postulacion $postulacion, \App\Models\Comentario $comentario): JsonResponse
    {
        if ($comentario->postulacion_id !== $postulacion->id) {
            return response()->json(['message' => 'Comentario no pertenece a esta postulación'], 404);
        }

        $comentario->delete();
        return response()->json(['message' => 'Comentario eliminado']);
    }

    public function update(Request $request, Postulacion $postulacion): JsonResponse
    {
        $validated = $request->validate([
            'estado'          => 'sometimes|in:recibida,en_revision,preseleccionado,descartado,contratado',
            'perfil_cargo_id' => 'nullable|exists:perfiles_cargo,id',
            'notas_hr'        => 'nullable|string',
            'nombre_completo' => 'sometimes|string|max:255',
            'email'           => 'nullable|email',
            'telefono'        => 'nullable|string|max:30',
            'motivo_descarte' => 'nullable|string|max:2000',
        ]);

        // Descartar a alguien que ya va en el proceso de selección es una
        // caída en su fase: sin motivo, el indicador no dice nada.
        $motivo = trim((string) ($validated['motivo_descarte'] ?? ''));
        unset($validated['motivo_descarte']);
        if (($validated['estado'] ?? null) === 'descartado' && $postulacion->estado !== 'descartado'
            && ProcesoSeleccionService::enProceso($postulacion) && $motivo === '') {
            return response()->json([
                'message' => 'El aspirante va en el proceso de selección: indique el motivo por el que no continúa.',
                'errors' => ['motivo_descarte' => ['Indique el motivo del descarte.']],
            ], 422);
        }

        $anterior = $postulacion->estado;
        $postulacion->update($validated);

        app(ProcesoSeleccionService::class)->sincronizarConEstado($postulacion, $anterior, $request->user(), $motivo ?: null);

        return response()->json($postulacion->fresh(['perfilCargo']));
    }

    public function destroy(Postulacion $postulacion): JsonResponse
    {
        if ($postulacion->archivo_cv) {
            Storage::disk('local')->delete($postulacion->archivo_cv);
        }
        // Los documentos de ingreso se borran en cascada en la base; sus archivos, aquí.
        Storage::disk(DocumentoAspirante::DISCO)->deleteDirectory((string) $postulacion->id);
        $postulacion->delete();
        return response()->json(['message' => 'Postulación eliminada']);
    }

    public function descargarCv(Postulacion $postulacion)
    {
        if (!$postulacion->archivo_cv || !Storage::disk('local')->exists($postulacion->archivo_cv)) {
            return response()->json(['message' => 'Archivo no encontrado'], 404);
        }

        return Storage::disk('local')->download(
            $postulacion->archivo_cv,
            $postulacion->archivo_nombre ?? 'cv.pdf'
        );
    }

    public function reprocesarCv(Postulacion $postulacion): JsonResponse
    {
        if (!$postulacion->archivo_cv) {
            return response()->json(['message' => 'Esta postulación no tiene CV adjunto'], 422);
        }

        if ($postulacion->candidato) {
            $postulacion->candidato->update(['estado_parseo' => 'pendiente']);
        }

        ProcessCvJob::dispatchSync($postulacion->id);

        return response()->json(['message' => 'Reprocesamiento completado']);
    }

    public function procesarIaSync(Postulacion $postulacion, GeminiService $gemini): JsonResponse
    {
        set_time_limit(300);

        if (!$postulacion->archivo_cv) {
            return response()->json(['message' => 'Esta postulación no tiene CV adjunto'], 422);
        }

        $candidato = Candidato::firstOrCreate(
            ['postulacion_id' => $postulacion->id],
            ['estado_parseo' => 'pendiente']
        );
        $candidato->update(['estado_parseo' => 'procesando']);

        try {
            $archivoPath = Storage::disk('local')->path($postulacion->archivo_cv);
            if (!file_exists($archivoPath)) {
                throw new \Exception('Archivo CV no encontrado en el servidor');
            }

            $ext  = strtolower(pathinfo($postulacion->archivo_nombre ?? '', PATHINFO_EXTENSION));
            $mime = match ($ext) {
                'docx'  => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'doc'   => 'application/msword',
                default => 'application/pdf',
            };

            // Una sola llamada a Gemini: extrae datos, asigna cargo y evalúa
            $perfilesActivos = PerfilCargo::where('activo', true)->get()->toArray();
            $resultado       = $gemini->analizarCV($archivoPath, $mime, $perfilesActivos);
            $datos     = $resultado['datos'];

            // Completar datos básicos de la postulación desde el CV.
            // El nombre SIEMPRE se toma de la hoja de vida analizada, no del
            // remitente del correo (p. ej. la esposa envía el CV del esposo).
            $updates = [];
            if (!empty($datos['nombre_completo'])) {
                $updates['nombre_completo'] = $datos['nombre_completo'];
            }
            if (!empty($datos['email']) && empty($postulacion->email)) {
                $updates['email'] = $datos['email'];
            }
            if (!empty($datos['telefono']) && empty($postulacion->telefono)) {
                $updates['telefono'] = $datos['telefono'];
            }
            if (!empty($datos['ciudad'])) {
                $updates['ciudad'] = $datos['ciudad'];
            }
            if ($updates) {
                $postulacion->update($updates);
            }

            $candidato->update([
                'datos_extraidos' => $datos,
                'resumen_ia'      => $datos['resumen_profesional'] ?? null,
                'estado_parseo'   => 'procesado',
                'modelo_ia'       => config('services.gemini.model'),
                'tokens_usados'   => $resultado['tokens'],
            ]);

            // Auto-clasificar al cargo y guardar la evaluación
            $perfilAsignadoId = $resultado['perfil_id'];
            $ev               = $resultado['evaluacion'];

            if ($perfilAsignadoId) {
                $postulacion->update(['perfil_cargo_id' => $perfilAsignadoId]);
            }

            if ($perfilAsignadoId && $ev) {
                // Los tokens de la llamada quedan contados en el candidato
                EvaluacionIa::updateOrCreate(
                    ['candidato_id' => $candidato->id, 'perfil_cargo_id' => $perfilAsignadoId],
                    [
                        'puntaje_total'          => $ev['puntaje_total'],
                        'puntaje_educacion'      => $ev['puntaje_educacion'] ?? 0,
                        'puntaje_experiencia'    => $ev['puntaje_experiencia'] ?? 0,
                        'puntaje_habilidades'    => $ev['puntaje_habilidades'] ?? 0,
                        'puntaje_perfil_general' => $ev['puntaje_perfil_general'] ?? 0,
                        'fortalezas'             => $ev['fortalezas'] ?? [],
                        'brechas'                => $ev['brechas'] ?? [],
                        'justificacion'          => $ev['justificacion'],
                        'recomendacion'          => $ev['recomendacion'],
                        'modelo_ia'              => config('services.gemini.model'),
                        'tokens_usados'          => null,
                    ]
                );
            }

            $postulacion->refresh();
            $postulacion->load(['perfilCargo', 'candidato.evaluaciones.perfilCargo', 'emailLogs']);
            Log::info("IA sync completada para postulación #{$postulacion->id}");

            return response()->json([
                'message'     => 'Análisis IA completado',
                'postulacion' => $postulacion,
            ]);

        } catch (\Exception $e) {
            Log::error("procesarIaSync error postulación #{$postulacion->id}: " . $e->getMessage());
            $candidato->update(['estado_parseo' => 'error', 'error_parseo' => $e->getMessage()]);
            return response()->json(['message' => 'Error en análisis IA: ' . $e->getMessage()], 500);
        }
    }

    public function kanban(): JsonResponse
    {
        $estados = ['recibida', 'en_revision', 'preseleccionado', 'descartado', 'contratado'];
        $data = [];
        foreach ($estados as $estado) {
            $data[$estado] = Postulacion::where('estado', $estado)
                ->with('perfilCargo:id,nombre,ciudad')
                ->latest('fecha_recepcion')
                ->limit(50)
                ->get(['id', 'nombre_completo', 'email', 'estado', 'fuente', 'perfil_cargo_id', 'fecha_recepcion', 'created_at']);
        }
        return response()->json($data);
    }

    public function exportar(Request $request)
    {
        $postulaciones = Postulacion::with(['candidato.evaluaciones', 'perfilCargo'])->get();

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

        $writer = new Xlsx($spreadsheet);

        return response()->stream(
            function () use ($writer) {
                $writer->save('php://output');
            },
            200,
            [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="Reporte_Candidatos_Hidroobras.xlsx"',
                'Cache-Control' => 'max-age=0',
                'Pragma' => 'public',
            ]
        );
    }
}
