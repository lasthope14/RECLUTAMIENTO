import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import DetailDrawer from '../components/DetailDrawer'

/* ── CONSTANTES Y DICCIONARIOS RÁPIDOS ── */
const recomLabel = {
  altamente_recomendado: 'Altamente Rec.',
  recomendado:           'Recomendado',
  con_reservas:          'Con reservas',
  no_recomendado:        'No recomendado',
}

const recomCls = {
  altamente_recomendado: 'bg-emerald-50 text-emerald-700 border border-emerald-250',
  recomendado:           'bg-blue-50 text-blue-700 border border-blue-250',
  con_reservas:          'bg-amber-50 text-amber-700 border border-amber-250',
  no_recommended:        'bg-red-50 text-red-700 border border-red-250',
}

/* ── SUGERENCIAS PREDETERMINADAS ── */
const SUGGESTIONS = [
  {
    title: 'Instalaciones Hidrosanitarias',
    query: '¿Cuáles candidatos tienen experiencia específica en diseño o construcción de redes e instalaciones hidrosanitarias?',
    icon: '💧',
  },
  {
    title: 'Ingenieros de Infraestructura',
    query: 'Busca candidatos que sean Ingenieros Civiles, que tengan más de 3 años de experiencia y manejen software de diseño como AutoCAD o Civil 3D.',
    icon: '🏗️',
  },
  {
    title: 'Certificaciones y Alturas',
    query: '¿Qué candidatos tienen certificación de alturas vigente y conocimientos en SST o HSEQ para trabajar en obra?',
    icon: '🧗',
  },
  {
    title: 'Oficiales y Operadores',
    query: 'Muestra los perfiles operativos que tengan experiencia en obra civil y manejo de herramientas o maquinaria pesada.',
    icon: '🛠️',
  }
]

/* ── ICONOGRAFÍA PREMIUM SVG ── */
function IconAI({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21m0 0l-.813-5.096M9 21h3.75m-6.75 0H3m16.5 0h-3.75m3.75 0l-.813-5.096M19.5 21H21M12 3v3.75m0-3.75a3.75 3.75 0 110 7.5 3.75 3.75 0 010-7.5zM9.75 8.25h4.5m-4.5 3.75h4.5M3 11.25a9 9 0 0118 0v3.75a9 9 0 01-18 0v-3.75z" />
    </svg>
  )
}
function IconSend({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  )
}
function IconBriefcase({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 .621-.504 1.125-1.125 1.125H4.875A1.125 1.125 0 013.75 18.4V14.15m16.5 0a9 9 0 00-16.5 0m16.5 0zM12 10.5h.008v.008H12V10.5zm0-3.75h.008v.008H12V6.75zM15 6.75a3 3 0 11-6 0h6z" />
    </svg>
  )
}
function IconPhone({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.802-5.14-4.118-6.942-6.942l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  )
}
function IconMail({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}

/* ── SCORE RING MINI ── */
function MiniScoreRing({ score }) {
  if (score == null) return null
  const v = Math.round(score)
  const color = v >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : v >= 60 ? 'text-brand-600 bg-brand-50 border-brand-200' : v >= 40 ? 'text-amber-700 bg-amber-50 border-amber-250' : 'text-red-700 bg-red-50 border-red-200'
  return (
    <span className={`inline-flex items-center text-xs font-black px-2 py-0.5 rounded-lg border tracking-tight shrink-0 ${color}`}>
      ★ {v}/100 IA
    </span>
  )
}

/* ── HELPER FUNCTIONS PARA AUDIO ── */
function resample(inputBuffer, fromSampleRate, toSampleRate) {
  const compression = fromSampleRate / toSampleRate;
  const length = Math.round(inputBuffer.length / compression);
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  while (index < length) {
    result[index++] = inputBuffer[Math.round(inputIndex)];
    inputIndex += compression;
  }
  return result;
}

function floatTo16BitPCM(input) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output;
}

function base64EncodeChunk(int16Array) {
  const binary = String.fromCharCode.apply(null, new Uint8Array(int16Array.buffer));
  return btoa(binary);
}

export default function AsistenteIa() {
  const [messages, setMessages] = useState(() => {
    const saved = sessionStorage.getItem('asistente_ia_messages')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (err) {
        console.error('Error parsing saved chat messages:', err)
      }
    }
    return [
      {
        sender: 'ia',
        text: '¡Hola! Soy tu **Asistente de Reclutamiento IA de Hidroobras**. Estoy aquí para ayudarte a analizar, filtrar y encontrar de forma semántica e inteligente a los candidatos perfectos para nuestro equipo de infraestructura hidráulica y construcción.\n\n¿De quiénes te gustaría saber hoy? Puedes probar alguna de las sugerencias rápidas abajo o escribirme tu propia consulta.',
        postulaciones: [],
      }
    ]
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [selectedPostulacionId, setSelectedPostulacionId] = useState(null)

  // Estados y Refs de Voz
  const [voiceModeActive, setVoiceModeActive] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('disconnected') // 'disconnected', 'connecting', 'ready', 'listening', 'thinking', 'speaking', 'error'
  const [selectedVoice, setSelectedVoice] = useState('aoede')

  const wsRef = useRef(null)
  const audioCtxRef = useRef(null)
  const micStreamRef = useRef(null)
  const micProcessorRef = useRef(null)
  const scheduledSourcesRef = useRef([])
  const nextPlayTimeRef = useRef(0)
  const userSpeechAccumulatedRef = useRef('')
  const aiSpeechAccumulatedRef = useRef('')
  const textInputActiveQueryRef = useRef('')
  
  const chatEndRef = useRef(null)

  // Cargar todos los candidatos una sola vez al montar el componente
  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const res = await api.get('/postulaciones', { params: { per_page: 500 } })
        const list = Array.isArray(res.data) ? res.data : (res.data.data ?? [])
        setCandidates(list)
      } catch (err) {
        console.error('Error al precargar candidatos:', err)
      }
    }
    fetchCandidates()
  }, [])

  // Auto-scroll al final del chat cuando hay nuevos mensajes o cambia el estado de carga
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Persistir mensajes en sessionStorage cuando cambien
  useEffect(() => {
    sessionStorage.setItem('asistente_ia_messages', JSON.stringify(messages))
  }, [messages])

  // Limpieza al desmontar el componente
  useEffect(() => {
    return () => {
      if (micProcessorRef.current) {
        try { micProcessorRef.current.disconnect() } catch(e){}
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close() } catch(e){}
      }
    }
  }, [])

  const handleClearChat = () => {
    const defaultMsg = [
      {
        sender: 'ia',
        text: '¡Hola! Soy tu **Asistente de Reclutamiento IA de Hidroobras**. Estoy aquí para ayudarte a analizar, filtrar y encontrar de forma semántica e inteligente a los candidatos perfectos para nuestro equipo de infraestructura hidráulica y construcción.\n\n¿De quiénes te gustaría saber hoy? Puedes probar alguna de las sugerencias rápidas abajo o escribirme tu propia consulta.',
        postulaciones: [],
      }
    ]
    setMessages(defaultMsg)
    sessionStorage.setItem('asistente_ia_messages', JSON.stringify(defaultMsg))
  }

  const stopVoiceMode = () => {
    setVoiceModeActive(false)
    setVoiceStatus('disconnected')
    
    if (micProcessorRef.current) {
      try { micProcessorRef.current.disconnect() } catch(e){}
      micProcessorRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop())
      micStreamRef.current = null;
    }

    stopAllActivePlayback()

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null;
    }

    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch(e){}
      audioCtxRef.current = null;
    }

    userSpeechAccumulatedRef.current = ''
    aiSpeechAccumulatedRef.current = ''
  }

  const stopAllActivePlayback = () => {
    scheduledSourcesRef.current.forEach(source => {
      try {
        source.stop()
      } catch (err) {
        // Ignorar
      }
    })
    scheduledSourcesRef.current = []
    if (audioCtxRef.current) {
      nextPlayTimeRef.current = audioCtxRef.current.currentTime
    }
  }

  const playAudioPCMChunk = (base64Str) => {
    if (!audioCtxRef.current) return;
    const audioCtx = audioCtxRef.current;
    
    try {
      const float32 = base64ToFloat32PCM(base64Str);
      
      // Gemini Live API transmite audio de salida a 24000Hz
      const sampleRate = 24000;
      const buffer = audioCtx.createBuffer(1, float32.length, sampleRate);
      buffer.copyToChannel(float32, 0);
      
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      
      let playTime = nextPlayTimeRef.current;
      if (playTime < audioCtx.currentTime) {
        playTime = audioCtx.currentTime + 0.05; // Buffer para evitar clicks
      }
      
      source.start(playTime);
      scheduledSourcesRef.current.push(source);
      
      source.onended = () => {
        scheduledSourcesRef.current = scheduledSourcesRef.current.filter(s => s !== source);
      };
      
      nextPlayTimeRef.current = playTime + buffer.duration;
    } catch (err) {
      console.error('Error al reproducir fragmento de audio:', err);
    }
  }

  const base64ToFloat32PCM = (base64Str) => {
    const binary = atob(base64Str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }
    return float32;
  }

  const startVoiceMode = async () => {
    setVoiceModeActive(true)
    setVoiceStatus('connecting')
    userSpeechAccumulatedRef.current = ''
    aiSpeechAccumulatedRef.current = ''

    try {
      // 1. Obtener credenciales dinámicas de seguridad en Laravel
      const res = await api.get('/ia/live-config')
      const { apiKey, model, systemInstruction } = res.data

      // 2. Inicializar contexto Web Audio
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;
      nextPlayTimeRef.current = audioCtx.currentTime;

      // 3. Crear WebSocket seguro con Gemini Live API
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Enviar la configuración setup obligatoria de la sesión
        const setupFrame = {
          setup: {
            model: `models/${model}`,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: selectedVoice
                  }
                }
              }
            },
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            }
          }
        };
        ws.send(JSON.stringify(setupFrame));
        
        // Iniciar la captura del micrófono (se configurará como ready o ready_no_mic de acuerdo al resultado)
        startMicRecording(ws, audioCtx);
      };

      ws.onmessage = async (event) => {
        try {
          let rawData = event.data;
          if (rawData instanceof Blob) {
            rawData = await rawData.text();
          } else if (typeof rawData !== 'string') {
            const decoder = new TextDecoder("utf-8");
            rawData = decoder.decode(rawData);
          }

          const msg = JSON.parse(rawData);
          const content = msg.serverContent;

          if (content) {
            // Si el usuario interrumpe a la IA, silenciar la voz
            if (content.interrupted) {
              stopAllActivePlayback();
              setVoiceStatus(micStreamRef.current ? 'listening' : 'ready_no_mic');
            }

            // Reproducir fragmentos de audio
            if (content.modelTurn?.parts) {
              for (const part of content.modelTurn.parts) {
                if (part.inlineData && part.inlineData.data) {
                  playAudioPCMChunk(part.inlineData.data);
                  setVoiceStatus('speaking');
                }
              }
            }

            // Capturar la transcripción de entrada (Usuario)
            if (content.inputTranscription && content.inputTranscription.text) {
              userSpeechAccumulatedRef.current += content.inputTranscription.text + ' ';
            }

            // Capturar la transcripción de salida (Gemini IA)
            if (content.outputTranscription && content.outputTranscription.text) {
              aiSpeechAccumulatedRef.current += content.outputTranscription.text + ' ';
            }

            // Turno completado, finalizar e insertar mensaje
            if (content.turnComplete) {
              const uText = userSpeechAccumulatedRef.current.trim();
              const aText = aiSpeechAccumulatedRef.current.trim();
              
              if (uText || aText || textInputActiveQueryRef.current) {
                await finalizeLiveVoiceTurn(uText, aText);
              }
              
              setVoiceStatus(micStreamRef.current ? 'ready' : 'ready_no_mic');
            }
          }
        } catch (err) {
          console.error('Error procesando mensaje WebSocket:', err);
          // Si ocurre un error, aseguramos no congelar la UI y restaurar el estado correcto
          setVoiceStatus(micStreamRef.current ? 'ready' : 'ready_no_mic');
        }
      };

      ws.onerror = (err) => {
        console.error('Error WebSocket Live:', err);
        setVoiceStatus('error');
      };

      ws.onclose = () => {
        console.log('WebSocket Live Cerrado');
      };

    } catch (err) {
      console.error('Error al iniciar el asistente de voz:', err);
      setVoiceStatus('error');
    }
  }

  const startMicRecording = async (ws, audioCtx) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      micProcessorRef.current = processor;

      const originalSampleRate = audioCtx.sampleRate;

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Remuestrear a 16000Hz (16kHz)
          const resampled = resample(inputData, originalSampleRate, 16000);
          const int16PCM = floatTo16BitPCM(resampled);
          const base64Audio = base64EncodeChunk(int16PCM);

          const audioFrame = {
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: "audio/pcm;rate=16000",
                  data: base64Audio
                }
              ]
            }
          };
          ws.send(JSON.stringify(audioFrame));
          
          // Actualizar estado de voz
          setVoiceStatus(prev => prev === 'speaking' ? 'speaking' : 'listening');
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      
      setVoiceStatus('ready');
    } catch (err) {
      console.warn('El micrófono no está disponible o el permiso fue denegado. Iniciando en modo voz con entrada de texto.', err);
      setVoiceStatus('ready_no_mic');
    }
  }

  const finalizeLiveVoiceTurn = async (userSpokenQuery, aiTranscript) => {
    userSpeechAccumulatedRef.current = '';
    aiSpeechAccumulatedRef.current = '';

    const textQuery = textInputActiveQueryRef.current;
    textInputActiveQueryRef.current = ''; // Limpiar el ref

    const finalUserQuery = textQuery || userSpokenQuery || 'Consulta por Voz';

    // Solo agregar el mensaje del usuario si NO fue enviado por texto (ya que handleSend lo agrega al instante)
    if (!textQuery) {
      setMessages(prev => [...prev, { sender: 'user', text: finalUserQuery }]);
    }

    // Consultar candidatos vinculados de forma silenciosa al backend
    try {
      const response = await api.post('/ia/chat-search', {
        query: finalUserQuery,
        history: []
      });
      const data = response.data;
      const matchedIds = Array.isArray(data.postulacion_ids) ? data.postulacion_ids : [];
      const matchedCandidates = candidates.filter(c => matchedIds.includes(c.id));

      setMessages(prev => [...prev, {
        sender: 'ia',
        text: aiTranscript || data.response,
        postulaciones: matchedCandidates
      }]);
    } catch (err) {
      console.error('Error vinculando candidatos en consulta de voz:', err);
      setMessages(prev => [...prev, {
        sender: 'ia',
        text: aiTranscript || 'Respuesta de voz procesada.',
        postulaciones: []
      }]);
    }
  }

  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim()
    if (!query) return
    if (loading && !voiceModeActive) return

    setInput('')

    if (voiceModeActive) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        stopAllActivePlayback();
        
        // Agregar mensaje en la UI inmediatamente
        setMessages(prev => [...prev, { sender: 'user', text: query }]);
        
        // Registrar que este turno es una consulta por texto
        textInputActiveQueryRef.current = query;
        
        // Enviar consulta por WebSocket
        const textFrame = {
          clientContent: {
            turns: [
              {
                role: "user",
                parts: [{ text: query }]
              }
            ],
            turnComplete: true
          }
        };
        wsRef.current.send(JSON.stringify(textFrame));
        setVoiceStatus('thinking');
      } else {
        console.warn("La conexión de voz no está abierta. Intentando recuperar...");
        setMessages(prev => [...prev, {
          sender: 'ia',
          text: '❌ La conexión de voz no está disponible en este momento. Por favor, reintenta.',
          postulaciones: []
        }]);
      }
      return;
    }

    setLoading(true)

    // Agregar mensaje del usuario en el chat
    setMessages(prev => [...prev, { sender: 'user', text: query }])

    // Construir el historial para enviarlo a Gemini
    const historyPayload = messages.map(m => ({
      sender: m.sender,
      text: m.text
    }))

    try {
      const response = await api.post('/ia/chat-search', {
        query: query,
        history: historyPayload
      })

      const data = response.data
      
      // Mapear los IDs devueltos a los objetos de candidato reales que ya tenemos precargados
      const matchedIds = Array.isArray(data.postulacion_ids) ? data.postulacion_ids : []
      const matchedCandidates = candidates.filter(c => matchedIds.includes(c.id))

      setMessages(prev => [...prev, {
        sender: 'ia',
        text: data.response || 'No encontré una respuesta adecuada a tu consulta.',
        postulaciones: matchedCandidates
      }])

    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, {
        sender: 'ia',
        text: '❌ Ocurrió un error al comunicarme con el motor de Inteligencia Artificial. Por favor reintenta la consulta.',
        postulaciones: []
      }])
    } finally {
      setLoading(false)
    }
  }

  // Parsear texto con un markdown ultra-simplificado para renderizado seguro en JSX
  const renderFormattedText = (text) => {
    if (!text) return ''
    
    // Convertir saltos de línea a <br/>
    const lines = text.split('\n')
    
    return lines.map((line, lIdx) => {
      // Reemplazar negrita (**texto**)
      const parts = line.split('**')
      const formattedLine = parts.map((part, pIdx) => {
        if (pIdx % 2 === 1) {
          return <strong key={pIdx} className="font-extrabold text-slate-900 bg-brand-50/30 px-1 py-0.5 rounded">{part}</strong>
        }
        return part
      })

      // Identificar si la línea es una viñeta/lista
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const cleanedLine = line.trim().replace(/^[-*]\s+/, '')
        return (
          <li key={lIdx} className="list-disc ml-5 mt-1 text-[14.5px] leading-relaxed text-slate-800 font-medium">
            {formattedLine}
          </li>
        )
      }

      // Identificar si es un título principal (ej: # Título)
      if (line.trim().startsWith('###')) {
        return (
          <h3 key={lIdx} className="text-base font-black text-slate-950 mt-4 mb-2 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <span className="w-1.5 h-3.5 rounded bg-brand-500 block"></span>
            {line.trim().replace(/^###\s+/, '')}
          </h3>
        )
      }

      if (line.trim().startsWith('##')) {
        return (
          <h2 key={lIdx} className="text-lg font-black text-slate-950 mt-5 mb-2.5 tracking-tight border-l-3 border-brand-500 pl-2">
            {line.trim().replace(/^##\s+/, '')}
          </h2>
        )
      }

      return (
        <p key={lIdx} className="text-[14.5px] leading-relaxed text-slate-800 font-medium mt-2">
          {formattedLine}
        </p>
      )
    })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-h-[calc(100vh-80px)] text-surface-700 animate-fade-in">
      
      {/* ── HEADER DEL ASISTENTE ── */}
      <div className="flex items-center justify-between pb-4 border-b border-surface-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-md relative overflow-hidden select-none animate-pulse-slow">
            <IconAI className="w-5 h-5" />
            <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none uppercase">Asistente Conversacional IA</h1>
            <p className="text-xs text-slate-650 font-bold mt-1">Búsqueda y análisis semántico de postulantes de Hidroobras</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Selector de Voces */}
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            disabled={voiceModeActive}
            className="text-[11px] font-black text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full uppercase cursor-pointer focus:outline-none hover:bg-slate-100 transition-all select-none animate-fade-in"
          >
            <option value="aoede">🗣️ Aoede (Fem)</option>
            <option value="charon">🗣️ Charon (Masc)</option>
            <option value="kore">🗣️ Kore (Fem)</option>
            <option value="puck">🗣️ Puck (Masc)</option>
            <option value="fenrir">🗣️ Fenrir (Masc)</option>
          </select>

          {/* Botón de Hablar por Voz */}
          <button
            type="button"
            onClick={() => voiceModeActive ? stopVoiceMode() : startVoiceMode()}
            className={`flex items-center gap-1.5 text-[11px] font-black border px-3 py-1.5 rounded-full uppercase tracking-wider transition-all cursor-pointer select-none ${
              voiceModeActive 
                ? 'bg-red-500 border-red-500 text-white hover:bg-red-650 shadow-md animate-pulse-slow' 
                : 'bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100'
            }`}
          >
            {voiceModeActive ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                Salir Modo Voz
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
                Hablar por Voz
              </>
            )}
          </button>

          {messages.length > 1 && (
            <button
              type="button"
              onClick={handleClearChat}
              className="flex items-center gap-1.5 text-[11px] font-black text-slate-600 hover:text-red-700 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-full uppercase tracking-wider transition-all cursor-pointer select-none"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Limpiar Chat
            </button>
          )}

          <span className="flex items-center gap-1.5 text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-250 px-2.5 py-1.5 rounded-full uppercase tracking-wider select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            Activo · Gemini 3.1
          </span>
        </div>
      </div>

      {/* ── ZONA PRINCIPAL DE CHAT ── */}
      <div className="flex-1 overflow-y-auto py-5 pr-2 space-y-6 scrollbar-thin">
        
        {messages.map((msg, idx) => {
          const isIA = msg.sender === 'ia'
          return (
            <div key={idx} className={`flex gap-4 ${isIA ? 'justify-start' : 'justify-end'} animate-slide-up`}>
              
              {/* Avatar IA */}
              {isIA && (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-100 to-indigo-100 border border-brand-200 text-brand-700 flex items-center justify-center shadow-inner shrink-0 select-none">
                  <IconAI className="w-4 h-4 text-brand-650" />
                </div>
              )}

              {/* Burbuja / Caja de Mensaje */}
              <div className={`max-w-[82%] rounded-3xl p-5 ${
                isIA 
                  ? 'bg-white border-2 border-slate-200 text-slate-800 shadow-sm rounded-tl-lg' 
                  : 'bg-gradient-to-br from-brand-600 to-indigo-600 text-white shadow-md rounded-tr-lg'
              }`}>
                {/* Texto Formateado */}
                <div className="space-y-1.5">
                  {isIA ? (
                    renderFormattedText(msg.text)
                  ) : (
                    <p className="text-[14.5px] leading-relaxed font-bold tracking-wide whitespace-pre-wrap">{msg.text}</p>
                  )}
                </div>

                {/* Candidatos Coincidentes Renders (Si existen y es respuesta de la IA) */}
                {isIA && msg.postulaciones && msg.postulaciones.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2.5">
                      Candidatos recomendados ({msg.postulaciones.length})
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {msg.postulaciones.map(post => {
                        const ev = post.candidato?.evaluaciones?.[0]
                        const expYears = post.candidato?.datos_extraidos?.años_experiencia_total
                        
                        return (
                          <div 
                            key={post.id}
                            onClick={() => setSelectedPostulacionId(post.id)}
                            className="bg-slate-50 border border-slate-200 hover:border-brand-350 hover:bg-brand-50/10 p-3.5 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col justify-between group shadow-sm"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-extrabold text-slate-900 text-sm group-hover:text-brand-650 transition-colors uppercase truncate" title={post.nombre_completo}>
                                  {post.nombre_completo}
                                </h4>
                                {ev && <MiniScoreRing score={ev.puntaje_total} />}
                              </div>

                              <div className="flex items-center gap-1 text-[12.5px] text-slate-900 font-extrabold mt-1.5">
                                <IconBriefcase className="w-3.5 h-3.5 text-brand-600" />
                                <span className="truncate">{post.perfil_cargo?.nombre || 'Sin cargo postulado'}</span>
                              </div>

                              <div className="space-y-0.5 text-[11.5px] text-slate-700 mt-2 font-semibold">
                                <div className="flex items-center gap-1.5 truncate">
                                  <IconMail className="w-3 h-3 text-slate-400" />
                                  <span className="truncate">{post.email}</span>
                                </div>
                                {post.telefono && (
                                  <div className="flex items-center gap-1.5 truncate">
                                    <IconPhone className="w-3 h-3 text-slate-400" />
                                    <span>{post.telefono}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-200/60 text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                              <span>{expYears != null ? `${expYears} Años Exp.` : 'Exp. N/A'}</span>
                              <span className="text-brand-600 group-hover:text-brand-700 flex items-center gap-0.5">
                                Expediente →
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Avatar Usuario */}
              {!isIA && (
                <div className="w-9 h-9 rounded-xl bg-slate-200 border border-slate-300 text-slate-700 flex items-center justify-center shadow-inner shrink-0 select-none font-bold text-sm">
                  HR
                </div>
              )}
            </div>
          )
        })}

        {/* Indicador de carga de la IA */}
        {loading && (
          <div className="flex gap-4 justify-start animate-slide-up">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-100 to-indigo-100 border border-brand-200 text-brand-700 flex items-center justify-center shadow-inner shrink-0 select-none">
              <IconAI className="w-4 h-4 text-brand-650" />
            </div>

            <div className="bg-white border border-slate-200 shadow-sm rounded-3xl rounded-tl-lg p-5 flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-widest animate-pulse">Analizando Hojas de Vida...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── CENTRAL VOICE MODE VISUALIZER ── */}
      {voiceModeActive && (
        <div className="bg-slate-900 border border-slate-800 text-white p-6 rounded-3xl shadow-xl flex flex-col items-center justify-center gap-4 py-8 select-none my-4 animate-fade-in relative overflow-hidden flex-shrink-0 mx-1">
          {/* Fondo gradiente brillante */}
          <div className="absolute inset-0 bg-gradient-to-tr from-brand-600/10 to-indigo-600/10 opacity-60 pointer-events-none" />

          <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest relative z-10">
            Asistente de Voz Activo
          </span>

          {/* Esfera pulsante central */}
          <div className="relative flex items-center justify-center w-24 h-24 my-3 z-10">
            {/* Ondas pulsantes basadas en el estado */}
            {voiceStatus === 'listening' && (
              <>
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 border-2 border-emerald-500/30 scale-150 animate-ping" />
                <div className="absolute inset-0 rounded-full bg-emerald-500/15 border border-emerald-500/20 scale-125 animate-pulse" />
              </>
            )}
            {voiceStatus === 'speaking' && (
              <>
                <div className="absolute inset-0 rounded-full bg-brand-500/25 border-2 border-brand-500/40 scale-150 animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="absolute inset-0 rounded-full bg-indigo-500/20 border border-indigo-500/30 scale-125 animate-pulse" />
              </>
            )}
            {voiceStatus === 'thinking' && (
              <div className="absolute inset-0 rounded-full bg-indigo-500/10 border-2 border-dashed border-indigo-500/40 animate-spin" style={{ animationDuration: '4s' }} />
            )}

            {/* Núcleo de la esfera */}
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br flex items-center justify-center shadow-lg transition-all duration-300 ${
              voiceStatus === 'speaking'
                ? 'from-brand-500 to-indigo-600 animate-pulse'
                : voiceStatus === 'listening'
                ? 'from-emerald-500 to-teal-600'
                : voiceStatus === 'thinking'
                ? 'from-indigo-600 to-purple-600 animate-pulse'
                : voiceStatus === 'ready_no_mic'
                ? 'from-brand-650 to-indigo-600'
                : 'from-slate-700 to-slate-800'
            }`}>
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </div>
          </div>

          <div className="text-center relative z-10">
            <p className="text-sm font-black uppercase tracking-wider text-slate-100">
              {voiceStatus === 'connecting' && 'Iniciando Conexión...'}
              {voiceStatus === 'ready' && 'Conexión Establecida'}
              {voiceStatus === 'ready_no_mic' && 'Listo (Sin Micrófono)'}
              {voiceStatus === 'listening' && 'Te escucho, háblame...'}
              {voiceStatus === 'thinking' && 'Analizando perfiles...'}
              {voiceStatus === 'speaking' && 'Hablando...'}
              {voiceStatus === 'error' && 'Error de Conexión'}
            </p>
            <p className="text-xs font-bold text-slate-400 mt-1 max-w-[85%] mx-auto leading-relaxed">
              {voiceStatus === 'listening' && 'Gemini está capturando tu voz en tiempo real.'}
              {voiceStatus === 'speaking' && 'Reproduciendo respuesta en audio de baja latencia.'}
              {voiceStatus === 'ready' && 'Di tu consulta en voz alta.'}
              {voiceStatus === 'ready_no_mic' && 'Escribe tu consulta abajo y la IA te responderá por voz.'}
              {voiceStatus === 'thinking' && 'Procesando coincidencia con candidatos.'}
              {voiceStatus === 'connecting' && 'Negociando clave de seguridad en Laravel...'}
              {voiceStatus === 'error' && 'Verifica los permisos del micrófono o reintenta.'}
            </p>
          </div>

          {/* Barras de ondas micro */}
          {voiceStatus === 'speaking' && (
            <div className="flex items-center gap-1 mt-1.5 h-4 z-10">
              <div className="w-1 h-3 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-4 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              <div className="w-1 h-4 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '450ms' }} />
              <div className="w-1 h-1 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '600ms' }} />
            </div>
          )}
        </div>
      )}

      {/* ── CHIPS DE SUGERENCIA PREDETERMINADOS (Solo visibles cuando hay pocos mensajes y el modo voz está inactivo) ── */}
      {messages.length === 1 && !loading && !voiceModeActive && (
        <div className="px-1 py-2 flex-shrink-0 animate-fade-in">
          <p className="text-[10px] font-black text-slate-450 uppercase tracking-widest mb-2.5">
            Sugerencias de búsqueda rápida
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(s.query)}
                className="bg-white border border-slate-200 hover:border-brand-400 hover:bg-brand-50/5 p-3 rounded-2xl text-left transition-all shadow-sm flex flex-col gap-2 group cursor-pointer"
              >
                <span className="text-lg leading-none p-1.5 rounded-xl bg-slate-50 border border-slate-100 w-fit group-hover:bg-brand-50 transition-colors">{s.icon}</span>
                <div>
                  <p className="text-xs font-black text-slate-900 group-hover:text-brand-650 transition-colors uppercase leading-none tracking-tight">{s.title}</p>
                  <p className="text-[11px] text-slate-650 leading-relaxed font-bold mt-1 line-clamp-2">{s.query}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── FORMULARIO DE ENTRADA / INPUT ── */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSend() }}
        className="pt-4 pb-2 flex-shrink-0 flex items-center gap-3"
      >
        <div className={`flex-1 relative bg-white border-2 rounded-3xl shadow-sm transition-all overflow-hidden flex items-center pr-1.5 pl-4 ${
          voiceModeActive
            ? 'border-emerald-300 bg-emerald-50/5 hover:border-emerald-300'
            : 'border-slate-200 hover:border-brand-400 focus-within:border-brand-500'
        }`}>
          <input
            type="text"
            className="w-full py-4 text-[14.5px] font-bold text-slate-800 placeholder-slate-400 focus:outline-none bg-transparent"
            placeholder={
              voiceModeActive
                ? (voiceStatus === 'ready_no_mic'
                    ? "🎙️ Modo Voz activo (sin micrófono). Escribe aquí tu consulta y la IA te responderá con voz..."
                    : "🎙️ Transmisión de voz activa. Habla o escribe tu consulta aquí...")
                : "Pregúntame sobre habilidades, experiencia, certificaciones o estudios de los candidatos..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || voiceStatus === 'connecting'}
          />
          
          <button
            type="submit"
            disabled={!input.trim() || loading || voiceStatus === 'connecting'}
            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 text-white flex items-center justify-center shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
          >
            <IconSend className="w-4.5 h-4.5" />
          </button>
        </div>
      </form>

      {/* ── EXPEDIENTE COMPLETO DRAWER ── */}
      {selectedPostulacionId && (
        <DetailDrawer
          postulacionId={selectedPostulacionId}
          onClose={() => setSelectedPostulacionId(null)}
          onUpdated={async () => {
            // Actualizar la lista interna de candidatos si se guardó algún cambio
            try {
              const res = await api.get('/postulaciones', { params: { per_page: 500 } })
              const list = Array.isArray(res.data) ? res.data : (res.data.data ?? [])
              setCandidates(list)
            } catch (err) {
              console.error(err)
            }
          }}
        />
      )}

    </div>
  )
}
