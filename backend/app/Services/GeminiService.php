<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeminiService
{
    protected string $apiKey;
    protected string $model;
    protected string $baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    public function __construct()
    {
        $this->apiKey = config('services.gemini.key');
        $this->model  = config('services.gemini.model', 'gemini-1.5-pro');
    }

    /**
     * Analiza un CV en UNA sola llamada a Gemini: extrae los datos y, si hay
     * perfiles activos, además asigna el cargo y evalúa al candidato contra él.
     * Antes eran tres llamadas (parsear, clasificar, evaluar) que reenviaban
     * los mismos datos; ahora se paga una sola vez la lectura del CV.
     *
     * @param array $perfilesActivos Perfiles con id, nombre, area y requisitos
     * @return array ['datos' => array, 'perfil_id' => ?int, 'evaluacion' => ?array, 'tokens' => ?int]
     */
    public function analizarCV(string $archivoPath, string $mime = 'application/pdf', array $perfilesActivos = []): array
    {
        $esquemaCandidato = $this->esquemaCandidato();

        if (empty($perfilesActivos)) {
            $prompt = <<<PROMPT
Eres el Agente Reclutador IA de Hidroobras, empresa colombiana especializada en obras hidráulicas, construcción civil e infraestructura. Analiza este documento de hoja de vida con criterio de reclutador experto del sector construcción en Colombia.

Extrae ÚNICAMENTE la información presente en el documento y retorna un JSON VÁLIDO con esta estructura exacta:

{"candidato": {$esquemaCandidato}}

Retorna SOLO el JSON, sin texto adicional, sin markdown, sin explicaciones.
PROMPT;
        } else {
            $perfilesJson = json_encode(array_map(fn ($p) => [
                'id'         => $p['id'],
                'nombre'     => $p['nombre'],
                'area'       => $p['area'] ?? '',
                'requisitos' => $p['requisitos'] ?? [],
            ], $perfilesActivos), JSON_UNESCAPED_UNICODE);
            $esquemaEvaluacion = $this->esquemaEvaluacion();
            $criterios         = $this->criteriosEvaluacion();

            $prompt = <<<PROMPT
Eres el Agente Reclutador IA de Hidroobras, empresa colombiana especializada en obras hidráulicas, construcción civil e infraestructura. Analiza este documento de hoja de vida con criterio de reclutador experto del sector construcción en Colombia y haz tres tareas:

1. EXTRAER: toma ÚNICAMENTE la información presente en el documento.
2. CLASIFICAR: asigna al candidato al perfil de cargo que MEJOR se ajuste de la lista de abajo.
   REGLA OBLIGATORIA: SIEMPRE debes asignar al candidato al perfil que más se acerque, incluso si la coincidencia es parcial. NO puedes retornar null. Si la persona tiene experiencia operativa o de campo, clasifícala en "Oficial o Ayudante de Plomería". Si tiene formación profesional o de ingeniería, clasifícala en "Ingeniero Residente". Si tiene formación o experiencia en seguridad, salud ocupacional o prevención, clasifícala en "SST". Ante duda entre varios perfiles, elige el que tenga más puntos de coincidencia.
3. EVALUAR: evalúa objetivamente y de forma estricta al candidato SOLO contra los requisitos del perfil asignado.

PERFILES DE CARGO DISPONIBLES:
{$perfilesJson}

{$criterios}

Retorna un JSON VÁLIDO con esta estructura exacta:

{
  "candidato": {$esquemaCandidato},
  "perfil_asignado_id": número (OBLIGATORIO, uno de los id de la lista, nunca null),
  "evaluacion": {$esquemaEvaluacion}
}

Retorna SOLO el JSON, sin texto adicional, sin markdown, sin explicaciones.
PROMPT;
        }

        $isWord = ($mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                   $mime === 'application/msword' || 
                   str_ends_with(strtolower($archivoPath), '.docx') || 
                   str_ends_with(strtolower($archivoPath), '.doc'));

        if ($isWord) {
            $ext = strtolower(pathinfo($archivoPath, PATHINFO_EXTENSION));
            if ($ext === 'doc' || $mime === 'application/msword') {
                $textoExtraido = $this->extractTextFromDoc($archivoPath);
            } else {
                $textoExtraido = $this->extractTextFromDocx($archivoPath);
            }
            
            $parts = [
                ['text' => $prompt . "\n\nTEXTO EXTRAÍDO DE LA HOJA DE VIDA:\n" . $textoExtraido]
            ];
        } else {
            $contenido = base64_encode(file_get_contents($archivoPath));
            $parts = [
                ['text' => $prompt],
                [
                    'inline_data' => [
                        'mime_type' => $mime,
                        'data'      => $contenido,
                    ],
                ],
            ];
        }

        $resultado = $this->generarJson(
            'analizarCV',
            $parts,
            0.1,
            empty($perfilesActivos) ? 4096 : 8192,
            empty($perfilesActivos) ? 60 : 90
        );
        $parsed = $resultado['json'];

        if (!is_array($parsed['candidato'] ?? null)) {
            throw new \Exception('Respuesta de Gemini sin datos del candidato');
        }

        // Solo se acepta un perfil que exista en la lista enviada
        $perfilId   = (int) ($parsed['perfil_asignado_id'] ?? 0);
        $idsValidos = array_map(fn ($p) => (int) $p['id'], $perfilesActivos);
        if (!in_array($perfilId, $idsValidos, true)) {
            if (!empty($perfilesActivos)) {
                Log::warning('Gemini analizarCV: perfil asignado inválido', ['perfil_asignado_id' => $parsed['perfil_asignado_id'] ?? null]);
            }
            $perfilId = null;
        }

        $evaluacion = ($perfilId && is_array($parsed['evaluacion'] ?? null))
            ? $this->normalizarEvaluacion($parsed['evaluacion'])
            : null;

        return [
            'datos'      => $parsed['candidato'],
            'perfil_id'  => $perfilId,
            'evaluacion' => $evaluacion,
            'tokens'     => $resultado['tokens'],
        ];
    }

    /**
     * Estructura JSON de los datos extraídos de la hoja de vida.
     */
    protected function esquemaCandidato(): string
    {
        return <<<'ESQUEMA'
{
  "nombre_completo": "nombre completo del candidato",
  "email": "correo electrónico o null",
  "telefono": "teléfono o null",
  "ciudad": "SOLO el nombre del municipio/ciudad de residencia, normalizado y con tildes, SIN departamento ni país (ej: 'Bogotá', 'Medellín', 'Cúcuta'). Nunca pongas un departamento (ej: 'Norte de Santander') ni un país (ej: 'Colombia') como ciudad. null si no se indica.",
  "educacion": [
    {
      "titulo": "nombre del título o carrera",
      "institucion": "nombre de la institución",
      "año_grado": "año de graduación o null",
      "nivel": "bachillerato|tecnico|tecnologo|universitario|especializacion|maestria|doctorado"
    }
  ],
  "experiencia": [
    {
      "cargo": "nombre del cargo",
      "empresa": "nombre de la empresa",
      "fecha_inicio": "mes/año o null",
      "fecha_fin": "mes/año o 'Actual'",
      "duracion_meses": número estimado o null,
      "descripcion": "descripción de funciones enfocada en obras, construcción, maquinaria o área relevante"
    }
  ], // NOTA CRÍTICA: Para evitar que el JSON se trunque, incluye como MÁXIMO las 10 experiencias laborales más recientes o más relevantes para el sector de la construcción y obras de infraestructura, omitiendo cargos muy antiguos o irrelevantes.
  "habilidades_tecnicas": ["lista de habilidades técnicas, software, herramientas, normas técnicas"],
  "habilidades_blandas": ["lista de competencias blandas"],
  "idiomas": [{"idioma": "nombre", "nivel": "basico|intermedio|avanzado|nativo"}],
  "certificaciones": ["lista de certificaciones, cursos SENA, ISO, ICONTEC, SST, alturas, etc."],
  "licencias_conduccion": ["categorías de licencia de conducción presentes, ej: A2, B1, C1, C2, etc. — array vacío si no aplica"],
  "maquinaria_equipos": ["maquinaria pesada u equipos que el candidato sabe operar, ej: retroexcavadora, motoniveladora, vibrocompactadora, bulldozer, grúa, etc. — array vacío si no aplica"],
  "disponibilidad_viaje": true o false según indique el candidato,
  "salario_aspirado": "salario aspirado si lo menciona o null",
  "años_experiencia_total": número estimado de años totales de experiencia laboral,
  "resumen_profesional": "párrafo de 3-4 oraciones que resumen el perfil del candidato desde la perspectiva de un reclutador de Hidroobras: destaca experiencia en obras, certificaciones relevantes para construcción e infraestructura, y aptitud general para el sector"
}
ESQUEMA;
    }

    /**
     * Estructura JSON de la evaluación contra un perfil de cargo.
     */
    protected function esquemaEvaluacion(): string
    {
        return <<<'ESQUEMA'
{
  "puntaje_educacion": número entre 0 y 20,
  "puntaje_experiencia": número entre 0 y 35,
  "puntaje_habilidades": número entre 0 y 30,
  "puntaje_perfil_general": número entre 0 y 15,
  "puntaje_total": suma de los anteriores (0-100),
  "fortalezas": ["máximo 4 fortalezas concretas del candidato para este cargo"],
  "brechas": ["máximo 4 brechas o debilidades concretas respecto al perfil requerido"],
  "justificacion_resumen": "párrafo de 4-5 oraciones explicando de forma muy detallada, profesional y objetiva la evaluación global y por qué el candidato se recomienda (o no) para el cargo en Hidroobras.",
  "justificacion_educacion": "explicación detallada y profunda (3-4 oraciones) de por qué se asignó este puntaje en educación en referencia a lo que busca el perfil de Hidroobras, analizando títulos y formación. Regla crítica: si el puntaje es perfecto (20/20) o excelente (>=18), NO menciones brechas o advertencias; en su lugar, justifica con fuerza la excelencia académica del candidato.",
  "justificacion_experiencia": "explicación detallada y profunda (3-4 oraciones) de por qué se asignó este puntaje en experiencia en referencia a lo que busca el perfil de Hidroobras, detallando años en el sector y obras específicas. Regla crítica: si el puntaje es perfecto (35/35) o excelente (>=32), NO menciones brechas o limitaciones; en su lugar, justifica con fuerza su idoneidad absoluta.",
  "justificacion_habilidades": "explicación detallada y profunda (3-4 oraciones) de por qué se asignó este puntaje en habilidades técnicas y certificaciones en referencia a lo que busca el perfil de Hidroobras, analizando software y certificaciones críticas (ej. alturas, SST, RCI). Regla crítica: si el puntaje es perfecto (30/30) o excelente (>=27), NO menciones brechas o debilidades; en su lugar, justifica con fuerza su completo dominio técnico.",
  "justificacion_perfil_general": "explicación detallada y profunda (3-4 oraciones) de por qué se asignó este puntaje en el ajuste del perfil general en referencia a lo que busca el perfil de Hidroobras, evaluando estabilidad, coherencia y soft skills. Regla crítica: si el puntaje es perfecto (15/15) o excelente (>=14), NO menciones aspectos a mejorar; en su lugar, justifica por qué su encaje con Hidroobras es excepcional.",
  "recomendacion": "altamente_recomendado" (85-100) | "recomendado" (65-84) | "con_reservas" (45-64) | "no_recomendado" (0-44)
}
ESQUEMA;
    }

    /**
     * Criterios de puntaje de la evaluación.
     */
    protected function criteriosEvaluacion(): string
    {
        return <<<'CRITERIOS'
Criterios de puntaje:
- puntaje_educacion (0-20): ¿El nivel y área de educación cumple lo requerido?
- puntaje_experiencia (0-35): ¿Tiene los años de experiencia y en el área correcta?
- puntaje_habilidades (0-30): ¿Tiene las habilidades técnicas y certificaciones requeridas?
- puntaje_perfil_general (0-15): Soft skills, estabilidad laboral, coherencia del perfil.
CRITERIOS;
    }

    /**
     * Llama a Gemini y decodifica la respuesta JSON.
     *
     * @return array ['json' => array, 'tokens' => ?int]
     */
    protected function generarJson(string $contexto, array $parts, float $temperature, int $maxTokens, int $timeout): array
    {
        $response = Http::timeout($timeout)->post(
            "{$this->baseUrl}/models/{$this->model}:generateContent?key={$this->apiKey}",
            [
                'contents' => [
                    ['parts' => $parts],
                ],
                'generationConfig' => [
                    'temperature'      => $temperature,
                    'maxOutputTokens'  => $maxTokens,
                    'responseMimeType' => 'application/json',
                ],
            ]
        );

        if (!$response->successful()) {
            Log::error("Gemini {$contexto} error", ['status' => $response->status(), 'body' => $response->body()]);
            throw new \Exception('Error al llamar Gemini API: ' . $response->status());
        }

        $data = $response->json();
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
        $tokens = $data['usageMetadata']['totalTokenCount'] ?? null;

        // Limpiar posible markdown
        $text = preg_replace('/^```json\s*/i', '', trim($text));
        $text = preg_replace('/\s*```$/', '', $text);

        $parsed = json_decode($text, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('Respuesta de Gemini no es JSON válido: ' . $text);
        }

        return ['json' => $parsed, 'tokens' => $tokens];
    }

    /**
     * Evalúa un candidato contra un perfil de cargo y retorna scoring detallado.
     */
    public function evaluarCandidato(array $datosCandidato, array $perfilRequisitos, string $nombreCargo): array
    {
        $candidatoJson = json_encode($datosCandidato, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        $perfilJson    = json_encode($perfilRequisitos, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        $esquemaEvaluacion = $this->esquemaEvaluacion();
        $criterios         = $this->criteriosEvaluacion();

        $prompt = <<<PROMPT
Eres el Agente Reclutador IA de Hidroobras, empresa colombiana del sector de obras hidráulicas y construcción. 
Evalúa objetivamente si este candidato es adecuado para el cargo indicado.

CARGO: {$nombreCargo}

REQUISITOS DEL CARGO:
{$perfilJson}

DATOS DEL CANDIDATO:
{$candidatoJson}

Evalúa en cada dimensión de forma estricta y objetiva. Retorna un JSON VÁLIDO con esta estructura exacta:

{$esquemaEvaluacion}

{$criterios}

Retorna SOLO el JSON, sin texto adicional, sin markdown.
PROMPT;

        $resultado = $this->generarJson('evaluarCandidato', [['text' => $prompt]], 0.2, 2048, 60);

        return ['evaluacion' => $this->normalizarEvaluacion($resultado['json']), 'tokens' => $resultado['tokens']];
    }

    /**
     * Recalcula el puntaje total, garantiza una recomendación válida y
     * empaqueta las justificaciones en el campo 'justificacion'.
     */
    protected function normalizarEvaluacion(array $parsed): array
    {
        // Calcular puntaje total si no viene correcto
        $parsed['puntaje_total'] = round(
            ($parsed['puntaje_educacion'] ?? 0) +
            ($parsed['puntaje_experiencia'] ?? 0) +
            ($parsed['puntaje_habilidades'] ?? 0) +
            ($parsed['puntaje_perfil_general'] ?? 0),
            2
        );

        // Garantizar recomendación válida (enum: altamente_recomendado, recomendado, con_reservas, no_recomendado)
        $rec = $parsed['recomendacion'] ?? null;
        if ($rec) {
            $rec = strtolower(trim($rec));
            $rec = str_replace(' ', '_', $rec);
        }
        $validRecomendaciones = ['altamente_recomendado', 'recomendado', 'con_reservas', 'no_recomendado'];
        if (!in_array($rec, $validRecomendaciones)) {
            $score = $parsed['puntaje_total'] ?? 0;
            if ($score >= 85) {
                $rec = 'altamente_recomendado';
            } elseif ($score >= 65) {
                $rec = 'recomendado';
            } elseif ($score >= 45) {
                $rec = 'con_reservas';
            } else {
                $rec = 'no_recomendado';
            }
        }
        $parsed['recomendacion'] = $rec;

        // Empaquetar las justificaciones detalladas en formato JSON en el campo 'justificacion'
        $justificacionData = [
            'justificacion_resumen'        => $parsed['justificacion_resumen'] ?? $parsed['justificacion'] ?? '',
            'justificacion_educacion'      => $parsed['justificacion_educacion'] ?? '',
            'justificacion_experiencia'    => $parsed['justificacion_experiencia'] ?? '',
            'justificacion_habilidades'    => $parsed['justificacion_habilidades'] ?? '',
            'justificacion_perfil_general' => $parsed['justificacion_perfil_general'] ?? '',
        ];
        $parsed['justificacion'] = json_encode($justificacionData, JSON_UNESCAPED_UNICODE);

        return $parsed;
    }

    /**
     * Evalúa a qué perfil de cargo aplica mejor un candidato basándose en su hoja de vida.
     * 
     * @param array $datosCandidato El JSON extraído del CV
     * @param array $perfilesActivos Lista de perfiles con id, nombre y requisitos
     * @return int|null El ID del perfil seleccionado, o null si no aplica a ninguno
     */
    public function clasificarCandidato(array $datosCandidato, array $perfilesActivos): ?int
    {
        if (empty($perfilesActivos)) {
            return null;
        }

        $candidatoJson = json_encode([
            'educacion' => $datosCandidato['educacion'] ?? [],
            'experiencia' => $datosCandidato['experiencia'] ?? [],
            'habilidades' => array_merge($datosCandidato['habilidades_tecnicas'] ?? [], $datosCandidato['habilidades_blandas'] ?? []),
            'resumen' => $datosCandidato['resumen_profesional'] ?? ''
        ], JSON_UNESCAPED_UNICODE);

        $perfilesJson = json_encode(array_map(function($p) {
            return [
                'id' => $p['id'],
                'nombre' => $p['nombre'],
                'area' => $p['area'] ?? '',
                'requisitos_clave' => $p['requisitos'] ?? ''
            ];
        }, $perfilesActivos), JSON_UNESCAPED_UNICODE);

        $prompt = <<<PROMPT
Eres el Agente Reclutador IA de Hidroobras, empresa colombiana de obras hidráulicas y construcción civil. Tu tarea es asignar automáticamente una hoja de vida al cargo que MEJOR se ajuste.

PERFILES DE CARGO DISPONIBLES:
{$perfilesJson}

RESUMEN DE LA HOJA DE VIDA DEL CANDIDATO:
{$candidatoJson}

REGLA OBLIGATORIA: SIEMPRE debes asignar al candidato al perfil que más se acerque, incluso si la coincidencia es parcial. NO puedes retornar null. Todos los candidatos deben quedar clasificados. Si la persona tiene experiencia operativa o de campo, clasifícala en "Oficial o Ayudante de Plomería". Si tiene formación profesional o de ingeniería, clasifícala en "Ingeniero Residente". Si tiene formación o experiencia en seguridad, salud ocupacional o prevención, clasifícala en "SST". Ante duda entre varios perfiles, elige el que tenga más puntos de coincidencia.

Retorna ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{
  "perfil_asignado_id": número (OBLIGATORIO, nunca null),
  "justificacion": "Breve explicación de por qué se asignó a este cargo"
}
PROMPT;

        $response = Http::timeout(45)->post(
            "{$this->baseUrl}/models/{$this->model}:generateContent?key={$this->apiKey}",
            [
                'contents' => [['parts' => [['text' => $prompt]]]],
                'generationConfig' => ['temperature' => 0.1, 'maxOutputTokens' => 500]
            ]
        );

        if (!$response->successful()) {
            Log::error('Gemini clasificarCandidato error', ['status' => $response->status(), 'body' => $response->body()]);
            return null;
        }

        $data = $response->json();
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
        $text = preg_replace('/^```json\s*/i', '', trim($text));
        $text = preg_replace('/\s*```$/', '', $text);

        $parsed = json_decode($text, true);

        return $parsed['perfil_asignado_id'] ?? null;
    }

    /**
     * Recibe una lista de emails (solo asunto + remitente) y decide cuáles son postulaciones.
     * No descarga cuerpos ni adjuntos — solo lee metadatos de texto.
     *
     * @param array $emails  [['idx' => int, 'from' => string, 'nombre' => string, 'asunto' => string, 'fecha' => string], ...]
     * @return array         Índices (idx) de los emails que son postulaciones
     */
    public function filtrarPostulaciones(array $emails): array
    {
        if (empty($emails)) {
            return [];
        }

        $lista = json_encode($emails, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        $prompt = <<<PROMPT
Eres el agente de Recursos Humanos de Hidroobras, empresa colombiana de obras hidráulicas y construcción civil.

Tu tarea es revisar la siguiente lista de correos electrónicos recibidos y determinar cuáles son POSTULACIONES DE EMPLEO (hojas de vida, CVs, solicitudes de trabajo, candidaturas, etc.) y cuáles NO lo son.

Son postulaciones: correos donde alguien envía su hoja de vida, curriculum, solicita trabajo, aplica a un cargo, menciona ser candidato, etc.
NO son postulaciones: facturas, notificaciones internas, spam, propuestas comerciales de empresas, correos de citas médicas, permisos, conciliaciones, invitaciones, cadenas, etc.

LISTA DE CORREOS:
{$lista}

Analiza cada correo por su remitente y asunto. Retorna ÚNICAMENTE un JSON válido con los índices (campo "idx") de los correos que SÍ son postulaciones de empleo:

{"postulaciones": [idx1, idx2, idx3, ...]}

Si ninguno es postulación, retorna: {"postulaciones": []}
Retorna SOLO el JSON, sin texto adicional, sin markdown.
PROMPT;

        $response = Http::timeout(30)->post(
            "{$this->baseUrl}/models/{$this->model}:generateContent?key={$this->apiKey}",
            [
                'contents'         => [['parts' => [['text' => $prompt]]]],
                'generationConfig' => ['temperature' => 0.1, 'maxOutputTokens' => 1024],
            ]
        );

        // Un fallo debe notarse. Antes devolvia [] y era indistinguible de
        // "ningun correo es postulacion": la revision terminaba "bien" sin
        // importar nada, y los correos quedaban marcados como revisados.
        if (!$response->successful()) {
            Log::error('Gemini filtrarPostulaciones error', ['status' => $response->status(), 'body' => $response->body()]);
            throw new \RuntimeException("Gemini no pudo clasificar los correos (HTTP {$response->status()}).");
        }

        $data = $response->json();
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
        $text = preg_replace('/^```json\s*/i', '', trim($text));
        $text = preg_replace('/\s*```$/', '', $text);

        $parsed = json_decode($text, true);

        if (json_last_error() !== JSON_ERROR_NONE || !isset($parsed['postulaciones'])) {
            Log::warning('Gemini filtrarPostulaciones: respuesta inválida', ['text' => $text]);
            throw new \RuntimeException('Gemini devolvió una respuesta inválida al clasificar los correos.');
        }

        return array_map('intval', $parsed['postulaciones']);
    }

    /**
     * Extrae texto de un archivo .docx usando ZipArchive y SimpleXML.
     */
    protected function extractTextFromDocx(string $filePath): string
    {
        $text = '';
        if (!file_exists($filePath)) {
            return $text;
        }

        $zip = new \ZipArchive();
        if ($zip->open($filePath) === true) {
            if (($index = $zip->locateName('word/document.xml')) !== false) {
                $data = $zip->getFromIndex($index);
                try {
                    $xml = new \SimpleXMLElement($data);
                    $xml->registerXPathNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main');
                    $texts = $xml->xpath('//w:t');
                    foreach ($texts as $t) {
                        $text .= (string)$t . ' ';
                    }
                } catch (\Exception $e) {
                    Log::error("Error parsing XML from docx: " . $e->getMessage());
                    // Fallback a regex simple si falla SimpleXMLElement
                    preg_match_all('/<w:t[^>]*>(.*?)<\/w:t>/is', $data, $matches);
                    if (!empty($matches[1])) {
                        $text = implode(' ', $matches[1]);
                    }
                }
            }
            $zip->close();
        }
        return trim(html_entity_decode(strip_tags($text)));
    }

    /**
     * Extrae texto legible de un archivo .doc (binario antiguo) filtrando caracteres especiales.
     */
    protected function extractTextFromDoc(string $filePath): string
    {
        if (!file_exists($filePath)) {
            return '';
        }
        $file_content = file_get_contents($filePath);
        $lines = explode(chr(0x0d), $file_content);
        $outtext = '';
        foreach ($lines as $line) {
            $pos = strpos($line, chr(0x00));
            if (($pos !== false) || (strlen($line) == 0)) {
                // Saltar binario
            } else {
                $outtext .= preg_replace("/[^a-zA-Z0-9\s\,\.\-\n\r\t@\/\_]/", "", $line) . " ";
            }
        }
        return trim($outtext);
    }

    /**
     * Realiza una búsqueda conversacional inteligente (Chat de Reclutamiento IA)
     */
    public function chatSearch(string $query, array $candidatos, int $pendientesAnalisis, ?array $historial = []): array
    {
        $candidatosJson = json_encode($candidatos, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        $candidatosCount = count($candidatos);

        $historyStr = "";
        if (!empty($historial)) {
            foreach ($historial as $msg) {
                $role = (isset($msg['sender']) && $msg['sender'] === 'user') ? 'Usuario (Reclutador)' : 'Tú (Asistente IA)';
                $text = $msg['text'] ?? '';
                $historyStr .= "{$role}: {$text}\n";
            }
        }

        $prompt = <<<PROMPT
Eres el Asistente de Reclutamiento IA de Hidroobras, empresa colombiana especializada en obras hidráulicas, construcción civil e infraestructura. Tu objetivo es ayudar a los reclutadores y directores técnicos a encontrar y analizar los perfiles que mejor encajen con sus necesidades mediante lenguaje natural.

=== ESTADO DE LA BASE DE DATOS ===
- Candidatos analizados por IA disponibles: {$candidatosCount}
- Candidatos en el sistema PENDIENTES de analizar por IA: {$pendientesAnalisis}
==================================

A continuación tienes la lista de candidatos que ya han sido analizados por la IA (con su historial laboral de 'experiencia_detallada' y su 'educacion' completa):

=== LISTA DE CANDIDATOS ANALIZADOS DISPONIBLES ===
{$candidatosJson}
=================================================

HISTORIAL DE CONVERSACIÓN RECIENTE:
{$historyStr}

NUEVA CONSULTA DEL USUARIO:
Usuario: {$query}

Instrucciones para responder:
1. Actúa como un reclutador experto, profesional, directo, asertivo y con excelente ortografía en español.
2. Analiza exhaustivamente no solo los resúmenes, sino las funciones específicas dentro del array de 'experiencia_detallada' y los títulos en 'educacion' de cada candidato analizado para encontrar coincidencias muy precisas (como experiencia en instalaciones hidrosanitarias, plomería, diseño de redes, etc.).
3. REGLA CRÍTICA DE CONCISIÓN: Responde de forma sumamente CONCRETA, DIRECTA y PUNTUAL. Evita introducciones largas, rodeos o prosa innecesaria. Cuando listes candidatos recomendados, justifica la selección en un máximo de 2 oraciones breves y contundentes enfocadas en sus datos técnicos más relevantes. Toda tu respuesta debe poder leerse de un vistazo.
4. REGLA CRÍTICA DE PROACTIVIDAD: Si no encuentras ningún candidato que coincida con la consulta del usuario, O si el usuario pregunta algo y ves que la base de datos de candidatos analizados es pequeña/vacía, PERO tienes candidatos pendientes de analizar con IA (el valor de 'Candidatos en el sistema PENDIENTES de analizar por IA' es mayor a 0, actualmente: {$pendientesAnalisis}), DEBES advertirle al usuario de forma muy atenta que tienes {$pendientesAnalisis} hojas de vida registradas que aún no han sido procesadas con IA. Sugiérele explícitamente que vaya a la sección de "Candidatos" en el menú principal y haga clic en el botón "Procesar CVs pendientes" para que la IA extraiga su información y tú puedas incluirlos en la búsqueda conversacional.
5. Tu respuesta final DEBE ser un objeto JSON válido con la estructura exacta indicada abajo. No agregues markdown fuera del JSON, no des explicaciones previas ni posteriores.

ESTRUCTURA DE RESPUESTA REQUERIDA (JSON):
{
  "response": "Tu respuesta explicativa en español estructurada con Markdown (usa viñetas, negritas, subtítulos para que sea muy legible y atractiva en la interfaz de chat).",
  "postulacion_ids": [lista de números representando el campo 'postulacion_id' de los candidatos que coinciden con la consulta o búsqueda del usuario]
}
PROMPT;

        $response = \Illuminate\Support\Facades\Http::timeout(60)->post(
            "{$this->baseUrl}/models/{$this->model}:generateContent?key={$this->apiKey}",
            [
                'contents' => [
                    ['parts' => [['text' => $prompt]]],
                ],
                'generationConfig' => [
                    'temperature'     => 0.2,
                    'maxOutputTokens' => 3000,
                ],
            ]
        );

        if (!$response->successful()) {
            Log::error('Gemini chatSearch error', ['status' => $response->status(), 'body' => $response->body()]);
            throw new \Exception('Error al llamar Gemini API para búsqueda de chat: ' . $response->status());
        }

        $data = $response->json();
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';

        $text = preg_replace('/^```json\s*/i', '', trim($text));
        $text = preg_replace('/\s*```$/', '', $text);

        $parsed = json_decode($text, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::error('Gemini chatSearch JSON parsing error', ['text' => $text]);
            return [
                'response' => "Error al procesar la respuesta del asistente. Inténtalo de nuevo.",
                'postulacion_ids' => []
            ];
        }

        return [
            'response' => $parsed['response'] ?? '',
            'postulacion_ids' => array_map('intval', $parsed['postulacion_ids'] ?? [])
        ];
    }
}
