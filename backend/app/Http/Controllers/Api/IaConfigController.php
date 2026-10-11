<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class IaConfigController extends Controller
{
    /**
     * Obtiene la configuración de seguridad y system prompt para Gemini Live API.
     */
    public function getLiveConfig(Request $request): JsonResponse
    {
        try {
            $apiKey = config('services.gemini.key');
            $liveModel = config('services.gemini.live_model', 'gemini-3.1-flash-live-preview');
            
            if (empty($apiKey)) {
                return response()->json(['message' => 'API Key de Gemini no configurada en el servidor'], 500);
            }

            // Prompt unificado del sistema para el asistente de reclutamiento de Hidroobras
            $systemInstruction = "Eres el Asistente de Reclutamiento IA de Hidroobras, empresa colombiana especializada en obras hidráulicas, construcción civil e infraestructura. Tu objetivo es ayudar a los reclutadores y directores técnicos a encontrar y analizar los perfiles que mejor encajen con sus necesidades mediante lenguaje natural o voz hablada. Actúa de forma profesional, atenta, directa, asertiva y con excelente ortografía. REGLA DE ORO DE CONCISIÓN: Tus respuestas deben ser sumamente concretas y concisas. Si el usuario te hace una pregunta, responde directamente en máximo 2 oraciones breves apoyadas estrictamente en la base de datos de candidatos. Evita introducciones decorativas o rodeos innecesarios.";

            return response()->json([
                'apiKey'            => $apiKey,
                'model'             => $liveModel,
                'systemInstruction' => $systemInstruction,
            ]);

        } catch (\Exception $e) {
            Log::error('IaConfigController getLiveConfig error: ' . $e->getMessage());
            return response()->json(['message' => 'Error al obtener la configuración de IA'], 500);
        }
    }
}
