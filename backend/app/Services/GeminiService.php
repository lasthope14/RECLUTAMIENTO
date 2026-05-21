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
     * Parsea un CV (base64 PDF/DOCX) y extrae datos estructurados.
     */
    public function parsearCV(string $archivoPath, string $mime = 'application/pdf'): array
    {
        $prompt = <<<PROMPT
Eres el Agente Reclutador IA de Hidroobras, empresa colombiana especializada en obras hidráulicas, construcción civil e infraestructura. Analiza este documento de hoja de vida con criterio de reclutador experto del sector construcción en Colombia.

Extrae ÚNICAMENTE la información presente en el documento y retorna un JSON VÁLIDO con esta estructura exacta:

{
  "nombre_completo": "nombre completo del candidato",
  "email": "correo electrónico o null",
  "telefono": "teléfono o null",
  "ciudad": "ciudad de residencia o null",
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

Retorna SOLO el JSON, sin texto adicional, sin markdown, sin explicaciones.
PROMPT;

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

        $response = Http::timeout(60)->post(
            "{$this->baseUrl}/models/{$this->model}:generateContent?key={$this->apiKey}",
            [
                'contents' => [
                    [
                        'parts' => $parts,
                    ],
                ],
                'generationConfig' => [
                    'temperature'     => 0.1,
                    'maxOutputTokens' => 4096,
                ],
            ]
        );

        if (!$response->successful()) {
            Log::error('Gemini parsearCV error', ['status' => $response->status(), 'body' => $response->body()]);
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

        return ['datos' => $parsed, 'tokens' => $tokens];
    }

    /**
     * Evalúa un candidato contra un perfil de cargo y retorna scoring detallado.
     */
    public function evaluarCandidato(array $datosCandidato, array $perfilRequisitos, string $nombreCargo): array
    {
        $candidatoJson = json_encode($datosCandidato, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        $perfilJson    = json_encode($perfilRequisitos, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        $prompt = <<<PROMPT
Eres el Agente Reclutador IA de Hidroobras, empresa colombiana del sector de obras hidráulicas y construcción. 
Evalúa objetivamente si este candidato es adecuado para el cargo indicado.

CARGO: {$nombreCargo}

REQUISITOS DEL CARGO:
{$perfilJson}

DATOS DEL CANDIDATO:
{$candidatoJson}

Evalúa en cada dimensión de forma estricta y objetiva. Retorna un JSON VÁLIDO con esta estructura exacta:

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

Criterios de puntaje:
- puntaje_educacion (0-20): ¿El nivel y área de educación cumple lo requerido?
- puntaje_experiencia (0-35): ¿Tiene los años de experiencia y en el área correcta?
- puntaje_habilidades (0-30): ¿Tiene las habilidades técnicas y certificaciones requeridas?
- puntaje_perfil_general (0-15): Soft skills, estabilidad laboral, coherencia del perfil.

Retorna SOLO el JSON, sin texto adicional, sin markdown.
PROMPT;

        $response = Http::timeout(60)->post(
            "{$this->baseUrl}/models/{$this->model}:generateContent?key={$this->apiKey}",
            [
                'contents' => [
                    ['parts' => [['text' => $prompt]]],
                ],
                'generationConfig' => [
                    'temperature'     => 0.2,
                    'maxOutputTokens' => 2048,
                ],
            ]
        );

        if (!$response->successful()) {
            Log::error('Gemini evaluarCandidato error', ['status' => $response->status(), 'body' => $response->body()]);
            throw new \Exception('Error al llamar Gemini API: ' . $response->status());
        }

        $data = $response->json();
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
        $tokens = $data['usageMetadata']['totalTokenCount'] ?? null;

        $text = preg_replace('/^```json\s*/i', '', trim($text));
        $text = preg_replace('/\s*```$/', '', $text);

        $parsed = json_decode($text, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('Respuesta de Gemini no es JSON válido: ' . $text);
        }

        // Calcular puntaje total si no viene correcto
        $parsed['puntaje_total'] = round(
            ($parsed['puntaje_educacion'] ?? 0) +
            ($parsed['puntaje_experiencia'] ?? 0) +
            ($parsed['puntaje_habilidades'] ?? 0) +
            ($parsed['puntaje_perfil_general'] ?? 0),
            2
        );

        // Empaquetar las justificaciones detalladas en formato JSON en el campo 'justificacion'
        $justificacionData = [
            'justificacion_resumen'        => $parsed['justificacion_resumen'] ?? $parsed['justificacion'] ?? '',
            'justificacion_educacion'      => $parsed['justificacion_educacion'] ?? '',
            'justificacion_experiencia'    => $parsed['justificacion_experiencia'] ?? '',
            'justificacion_habilidades'    => $parsed['justificacion_habilidades'] ?? '',
            'justificacion_perfil_general' => $parsed['justificacion_perfil_general'] ?? '',
        ];
        $parsed['justificacion'] = json_encode($justificacionData, JSON_UNESCAPED_UNICODE);

        return ['evaluacion' => $parsed, 'tokens' => $tokens];
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

        if (!$response->successful()) {
            Log::error('Gemini filtrarPostulaciones error', ['status' => $response->status(), 'body' => $response->body()]);
            return [];
        }

        $data = $response->json();
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
        $text = preg_replace('/^```json\s*/i', '', trim($text));
        $text = preg_replace('/\s*```$/', '', $text);

        $parsed = json_decode($text, true);

        if (json_last_error() !== JSON_ERROR_NONE || !isset($parsed['postulaciones'])) {
            Log::warning('Gemini filtrarPostulaciones: respuesta inválida', ['text' => $text]);
            return [];
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
}
