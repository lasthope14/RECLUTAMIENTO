import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import api from '../services/api'
import { gsap } from 'gsap'

/* ── CONSTANTES Y DICCIONARIOS ── */
const ESTADOS = ['recibida', 'en_revision', 'preseleccionado', 'descartado', 'contratado']
const statusLabel = { recibida: 'Recibida', en_revision: 'En revisión', preseleccionado: 'Preseleccionado', descartado: 'Descartado', contratado: 'Contratado' }
const recomLabel = { altamente_recomendado: '★ Altamente recomendado', recomendado: '✓ Recomendado', con_reservas: '⚠ Con reservas', no_recomendado: '✗ No recomendado' }

const getFallbackDimensionTexts = (ev) => {
  const fallback = {
    justificacion_educacion: 'La formación académica cumple con los requisitos mínimos del perfil de Hidroobras para este cargo.',
    justificacion_experiencia: 'La trayectoria y experiencia laboral acumulada se ajustan a las necesidades operativas de Hidroobras.',
    justificacion_habilidades: 'Las competencias técnicas y conocimientos prácticos del candidato son adecuados para el cargo en Hidroobras.',
    justificacion_perfil_general: 'El ajuste general del candidato muestra una buena alineación con las expectativas de Hidroobras.'
  };

  if (!ev) return fallback;

  const scoreEdu = ev.puntaje_educacion ?? 0;
  const scoreExp = ev.puntaje_experiencia ?? 0;
  const scoreHab = ev.puntaje_habilidades ?? 0;
  const scoreGral = ev.puntaje_perfil_general ?? 0;

  const fortalezas = ev.fortalezas || [];
  const brechas = ev.brechas || [];

  const eduFort = [];
  const eduBrech = [];
  const expFort = [];
  const expBrech = [];
  const habFort = [];
  const habBrech = [];
  const gralFort = [];
  const gralBrech = [];

  // Refinar regex para evitar falsos positivos
  const eduKeywords = /educación|título|universidad|estudio|estudios|graduado|formación|\b(ingeniero|ingeniería|técnico|tecnólogo|especialización|maestría|posgrado|pregrado|sena)\b/i;
  const expKeywords = /experiencia|años|trayectoria|desempeño|cargo|puesto|labores|residencia|obra|director|coordinador|supervisor|ejecución/i;
  const habKeywords = /habilidad|habilidades|competencia|competencias|certificación|certificaciones|alturas|sst|licencia|conducción|maquinaria|software|autocad|excel|computo|herramientas|norma|rci|matrícula profesional|tarjeta profesional/i;

  fortalezas.forEach(f => {
    if (/matrícula profesional|tarjeta profesional|licencia|alturas|sst/i.test(f)) habFort.push(f);
    else if (eduKeywords.test(f)) eduFort.push(f);
    else if (expKeywords.test(f)) expFort.push(f);
    else if (habKeywords.test(f)) habFort.push(f);
    else gralFort.push(f);
  });

  brechas.forEach(b => {
    if (/matrícula profesional|tarjeta profesional|licencia|alturas|sst/i.test(b)) habBrech.push(b);
    else if (eduKeywords.test(b)) eduBrech.push(b);
    else if (expKeywords.test(b)) expBrech.push(b);
    else if (habKeywords.test(b)) habBrech.push(b);
    else gralBrech.push(b);
  });

  // 1. Educación
  if (scoreEdu >= 19) {
    let text = 'Evaluación de la formación académica: El candidato cuenta con una titulación profesional que se alinea de manera excepcional y sin brechas con los exigentes estándares de Hidroobras. Su formación teórica y bases de ingeniería son sumamente sólidas. ';
    if (eduFort.length > 0) text += `Se destaca positivamente que cuenta con ${eduFort.join(', ').toLowerCase()}.`;
    fallback.justificacion_educacion = text;
  } else if (eduFort.length > 0 || eduBrech.length > 0) {
    let text = 'Evaluación de la formación académica: ';
    if (eduFort.length > 0) text += `Se destaca positivamente que el candidato cuenta con ${eduFort.join(', ').toLowerCase()}. `;
    if (eduBrech.length > 0) text += `Como aspecto a considerar, se identifica que ${eduBrech.join(', ').toLowerCase()}.`;
    fallback.justificacion_educacion = text;
  }

  // 2. Experiencia
  if (scoreExp >= 33) {
    let text = 'Análisis de la trayectoria profesional: El perfil sobresale con una sólida trayectoria en obras y ejecución de proyectos específicos de alta complejidad. Su experiencia demuestra total idoneidad y el nivel de responsabilidad que Hidroobras requiere. ';
    if (expFort.length > 0) text += `Sobresale debido a que cuenta con ${expFort.join(', ').toLowerCase()}.`;
    fallback.justificacion_experiencia = text;
  } else if (expFort.length > 0 || expBrech.length > 0) {
    let text = 'Análisis de la trayectoria profesional: ';
    if (expFort.length > 0) text += `El perfil sobresale debido a que ${expFort.join(', ').toLowerCase()}. `;
    if (expBrech.length > 0) text += `Se debe tener en cuenta como brecha que ${expBrech.join(', ').toLowerCase()}.`;
    fallback.justificacion_experiencia = text;
  }

  // 3. Habilidades
  if (scoreHab >= 28) {
    let text = 'Evaluación de competencias técnicas y certificaciones: Demuestra un dominio sobresaliente y avanzado en las herramientas de software y normativas requeridas para el sector. Cuenta con todas las certificaciones críticas y seguridad exigidas. ';
    if (habFort.length > 0) text += `Demuestra dominio en ${habFort.join(', ').toLowerCase()}.`;
    fallback.justificacion_habilidades = text;
  } else if (habFort.length > 0 || habBrech.length > 0) {
    let text = 'Evaluación de competencias técnicas y certificaciones: ';
    if (habFort.length > 0) text += `Demuestra dominio y conocimiento en ${habFort.join(', ').toLowerCase()}. `;
    if (habBrech.length > 0) text += `Se recomienda verificar o fortalecer: ${habBrech.join(', ').toLowerCase()}.`;
    fallback.justificacion_habilidades = text;
  }

  // 4. Ajuste Perfil
  if (scoreGral >= 14) {
    let text = 'Ajuste integral del candidato al perfil buscado: El candidato se alinea de forma excepcional con la cultura y expectativas de Hidroobras. Su estabilidad laboral, soft skills y coherencia profesional garantizan un alto rendimiento y adaptación. ';
    if (gralFort.length > 0) text += `Se valora positivamente que ${gralFort.join(', ').toLowerCase()}.`;
    fallback.justificacion_perfil_general = text;
  } else if (gralFort.length > 0 || gralBrech.length > 0) {
    let text = 'Ajuste integral del candidato al perfil buscado: ';
    if (gralFort.length > 0) text += `Se valora positivamente que ${gralFort.join(', ').toLowerCase()}. `;
    if (gralBrech.length > 0) text += `Se identifican como observaciones que ${gralBrech.join(', ').toLowerCase()}.`;
    fallback.justificacion_perfil_general = text;
  }

  return fallback;
};

/* ── ICONOGRAFÍA VECTORIAL SVG PREMIUM ── */
function IconAI({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21m0 0l-.813-5.096M9 21h3.75m-6.75 0H3m16.5 0h-3.75m3.75 0l-.813-5.096M19.5 21H21M12 3v3.75m0-3.75a3.75 3.75 0 110 7.5 3.75 3.75 0 010-7.5zM9.75 8.25h4.5m-4.5 3.75h4.5M3 11.25a9 9 0 0118 0v3.75a9 9 0 01-18 0v-3.75z" />
    </svg>
  )
}

function IconCV({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function IconProfile({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

function IconManagement({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconEmail({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}

function IconDownload({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

function IconRefresh({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  )
}

function IconCert({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
    </svg>
  )
}

function IconBriefcase({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 .621-.504 1.125-1.125 1.125H4.875A1.125 1.125 0 013.75 18.4V14.15m16.5 0a9 9 0 00-16.5 0m16.5 0zM12 10.5h.008v.008H12V10.5zm0-3.75h.008v.008H12V6.75zM15 6.75a3 3 0 11-6 0h6z" />
    </svg>
  )
}

function IconMapPin({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z" />
    </svg>
  )
}

function IconDollar({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 10.119 12.5 10 11 10s-2.536-.12-3.121-.559c-.586-.44-.586-1.152 0-1.591.586-.44 1.483-.44 2.653 0 .88.66.88 1.729.88 1.729M12 3v18" />
    </svg>
  )
}

function IconPlane({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  )
}

function IconCheck({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

function IconWarning({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  )
}

function IconClose({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function IconPhone({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.502-5.123-3.801-6.625-6.625l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  )
}

function IconEducation({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75" />
    </svg>
  )
}

function IconSave({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function IconTime({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}


/* ── SCORE BAR COMPONENT ── */
function ScoreBar({ label, value, max, color = '#2563eb' }) {
  const pct = Math.round(Math.min((value / max) * 100, 100))
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className="font-semibold text-slate-800">{Math.round(value ?? 0)}<span className="text-slate-400 font-normal">/{max}</span></span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

/* ── CV VIEWER ── */
function CvViewer({ postulacionId, mimeType, fileName }) {
  const [url, setUrl]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const blobRef               = useRef(null)

  useEffect(() => {
    setLoading(true); setError(false); setUrl(null)
    api.get(`/postulaciones/${postulacionId}/cv`, { responseType: 'blob' })
      .then(res => { blobRef.current = URL.createObjectURL(res.data); setUrl(blobRef.current) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
    return () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current) }
  }, [postulacionId])

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs">Cargando documento...</p>
    </div>
  )
  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8 bg-slate-50">
      <IconWarning className="w-10 h-10 text-red-400" />
      <p className="text-xs text-red-400 font-medium">No se pudo cargar el archivo de la hoja de vida</p>
      <button onClick={() => { setError(false); setLoading(true) }} className="btn-secondary text-[11px] px-3 py-1">Reintentar</button>
    </div>
  )

  const isPdf = mimeType?.toLowerCase().includes('pdf')
  if (!isPdf) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center bg-slate-50">
      <IconCV className="w-14 h-14 text-slate-400" />
      <p className="text-xs text-slate-400 font-medium">Vista previa en vivo no disponible para archivos Word/Imagen</p>
      <a href={url} download={fileName} className="btn-primary text-xs px-4 py-2">Descargar archivo completo</a>
    </div>
  )
  return (
    <iframe
      src={`${url}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
      title="Hoja de vida"
      className="w-full h-full border-0 rounded-b-2xl bg-slate-50"
      style={{ minHeight: 0 }}
    />
  )
}

/* ── WIDGET DE SCORE ANIMADO PRÉMIUM CON GSAP ── */
function AnimatedScoreWidget({ score, title }) {
  const containerRef = useRef(null)
  const numberRef = useRef(null)
  const circleRef = useRef(null)

  const r = 54
  const circ = 2 * Math.PI * r

  useEffect(() => {
    if (!circleRef.current || !numberRef.current) return;

    // Resetear estilos para la animación
    gsap.set(circleRef.current, { strokeDashoffset: circ })
    gsap.set(numberRef.current, { textContent: 0 })

    const targetScore = Math.round(score || 0)
    
    // Crear la línea de tiempo GSAP
    const tl = gsap.timeline({
      defaults: { ease: 'power2.out', duration: 1.5 }
    })

    // Animar el trazo del círculo
    tl.to(circleRef.current, {
      strokeDashoffset: circ - (targetScore / 100) * circ,
    }, 0)

    // Animar el contador numérico
    tl.to(numberRef.current, {
      textContent: targetScore,
      snap: { textContent: 1 },
      onUpdate: function() {
        if (numberRef.current) {
          numberRef.current.textContent = Math.round(Number(numberRef.current.textContent))
        }
      }
    }, 0)

    // Animación de escala elástica de entrada para todo el widget
    gsap.fromTo(containerRef.current, 
      { scale: 0.8, opacity: 0 }, 
      { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.5)' }
    )

    return () => {
      tl.kill()
    }
  }, [score, circ])

  const color = score >= 85 ? '#10b981' : score >= 65 ? '#2563eb' : score >= 45 ? '#f59e0b' : '#ef4444'

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center py-5">
      <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Halo de luz ambiental premium */}
        <div className="absolute inset-3 rounded-full blur-[12px] opacity-15" style={{ backgroundColor: color }} />
        
        {/* SVG del Anillo */}
        <svg className="w-full h-full -rotate-90 absolute top-0 left-0" viewBox="0 0 120 120">
          {/* Círculo de fondo */}
          <circle 
            cx="60" 
            cy="60" 
            r={r} 
            fill="none" 
            stroke="#f1f5f9" 
            strokeWidth="7" 
          />
          {/* Círculo de progreso animado */}
          <circle 
            ref={circleRef}
            cx="60" 
            cy="60" 
            r={r} 
            fill="none" 
            stroke={color} 
            strokeWidth="8.5"
            strokeDasharray={circ}
            strokeDashoffset={circ}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0px 2px 4px ${color}30)` }}
          />
        </svg>

        {/* Textos del Score */}
        <div className="z-10 text-center flex flex-col items-center select-none">
          <div className="flex items-baseline justify-center">
            <span ref={numberRef} className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-none">0</span>
            <span className="text-xs font-bold text-slate-400 ml-0.5">/100</span>
          </div>
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mt-1 block">SCORE IA</span>
        </div>
      </div>
      
      {title && (
        <p className="text-xs font-black text-slate-800 mt-3 text-center max-w-[200px] leading-tight">
          {title}
        </p>
      )}
    </div>
  )
}

/* ── DETAIL DRAWER COMPONENT ── */
export default function DetailDrawer({ postulacionId, onClose, onUpdated }) {
  const [postulacion, setPostulacion] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('ia')
  const [estado, setEstado]     = useState('')
  const [perfilId, setPerfilId] = useState('')
  const [notas, setNotas]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')
  const [perfiles, setPerfiles] = useState([])
  const [iaProcesando, setIaProcesando] = useState(false)
  const [iaMsg, setIaMsg]       = useState('')
  const [plantillas, setPlantillas] = useState([])
  const [showEmail, setShowEmail]   = useState(false)
  const [emailForm, setEmailForm]   = useState({ asunto: '', cuerpo: '', tipo: 'preseleccion' })
  const [sendingEmail, setSendingEmail] = useState(false)

  useEffect(() => {
    if (!postulacionId) return
    setLoading(true); setPostulacion(null)
    Promise.allSettled([
      api.get(`/postulaciones/${postulacionId}`),
      api.get('/perfiles-cargo'),
      api.get('/notificaciones/plantillas'),
    ]).then(([pRes, prRes, plRes]) => {
      if (pRes.status === 'rejected') return
      const p = pRes.value.data
      setPostulacion(p)
      setEstado(p.estado || 'recibida')
      setPerfilId(p.perfil_cargo_id || '')
      setNotas(p.notas_hr || '')
      if (prRes.status === 'fulfilled') setPerfiles(prRes.value.data)
      if (plRes.status === 'fulfilled') {
        const pls = plRes.value.data
        setPlantillas(pls)
        if (pls[0]) setEmailForm({ asunto: pls[0].asunto, cuerpo: pls[0].cuerpo.replace('{{nombre}}', p.nombre_completo), tipo: pls[0].tipo })
      }
      
      // Determinar pestaña por defecto
      if (p.candidato?.evaluaciones?.[0]) setTab('ia')
      else if (p.archivo_cv) setTab('cv')
      else setTab('ia')
    }).finally(() => setLoading(false))
  }, [postulacionId])

  const reload = () => api.get(`/postulaciones/${postulacionId}`).then(r => { setPostulacion(r.data); setEstado(r.data.estado || 'recibida') })

  const save = async () => {
    setSaving(true); setMsg('')
    try {
      await api.patch(`/postulaciones/${postulacion.id}`, { estado, perfil_cargo_id: perfilId || null, notas_hr: notas })
      setMsg('✅ Cambios guardados')
      if (onUpdated) onUpdated()
      setTimeout(() => setMsg(''), 3000)
    } catch { setMsg('❌ Error al guardar') }
    finally { setSaving(false) }
  }

  const procesarIa = async () => {
    setIaProcesando(true); setIaMsg('')
    try {
      const res = await api.post(`/postulaciones/${postulacion.id}/ia-sync`)
      setIaMsg('✅ Análisis completado')
      setPostulacion(res.data.postulacion)
      setTab('ia')
      if (onUpdated) onUpdated()
    } catch (e) { setIaMsg('❌ ' + (e.response?.data?.message || 'Error')) }
    finally { setIaProcesando(false) }
  }

  const sendEmail = async () => {
    setSendingEmail(true)
    try {
      await api.post('/notificaciones/enviar', { postulacion_id: postulacion.id, ...emailForm })
      setMsg('✅ Email enviado'); setShowEmail(false); reload()
      if (onUpdated) onUpdated()
    } catch (e) { setMsg('❌ ' + (e.response?.data?.message || 'Error al enviar')) }
    finally { setSendingEmail(false) }
  }

  const descargarCv = async () => {
    if (!postulacion?.archivo_cv) return
    try {
      const res = await api.get(`/postulaciones/${postulacion.id}/cv`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a'); a.href = url; a.download = postulacion.archivo_nombre || 'cv.pdf'
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch { alert('No se pudo descargar la hoja de vida.') }
  }

  const c  = postulacion?.candidato
  const d  = c?.datos_extraidos
  const ev = c?.evaluaciones?.[0]

  let parsedJustificacion = null;
  let isJsonJustificacion = false;
  if (ev && ev.justificacion) {
    const trimmed = ev.justificacion.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        parsedJustificacion = JSON.parse(trimmed);
        if (parsedJustificacion && (parsedJustificacion.justificacion_resumen || parsedJustificacion.general)) {
          isJsonJustificacion = true;
          // Normalizar llaves para que la interfaz siempre use justificacion_xxx
          if (parsedJustificacion.general && !parsedJustificacion.justificacion_resumen) {
            parsedJustificacion.justificacion_resumen = parsedJustificacion.general;
          }
          if (parsedJustificacion.educacion && !parsedJustificacion.justificacion_educacion) {
            parsedJustificacion.justificacion_educacion = parsedJustificacion.educacion;
          }
          if (parsedJustificacion.experiencia && !parsedJustificacion.justificacion_experiencia) {
            parsedJustificacion.justificacion_experiencia = parsedJustificacion.experiencia;
          }
          if (parsedJustificacion.habilidades && !parsedJustificacion.justificacion_habilidades) {
            parsedJustificacion.justificacion_habilidades = parsedJustificacion.habilidades;
          }
          if (parsedJustificacion.perfil_general && !parsedJustificacion.justificacion_perfil_general) {
            parsedJustificacion.justificacion_perfil_general = parsedJustificacion.perfil_general;
          }
        }
      } catch (e) {
        console.error("Error parsing justificacion JSON:", e);
      }
    }
  }

  const fallbackTexts = getFallbackDimensionTexts(ev);
  const displayResumen = isJsonJustificacion ? parsedJustificacion.justificacion_resumen : (ev?.justificacion || '');
  const displayEducacion = isJsonJustificacion ? parsedJustificacion.justificacion_educacion : fallbackTexts.justificacion_educacion;
  const displayExperiencia = isJsonJustificacion ? parsedJustificacion.justificacion_experiencia : fallbackTexts.justificacion_experiencia;
  const displayHabilidades = isJsonJustificacion ? parsedJustificacion.justificacion_habilidades : fallbackTexts.justificacion_habilidades;
  const displayPerfilGeneral = isJsonJustificacion ? parsedJustificacion.justificacion_perfil_general : fallbackTexts.justificacion_perfil_general;

  /* ── DEFINICIÓN DE PESTAÑAS ── */
  const tabs = [
    { id: 'ia',      icon: <IconAI className="w-4 h-4" />, label: 'Análisis IA' },
    { id: 'cv',      icon: <IconCV className="w-4 h-4" />, label: 'Hoja de Vida', hidden: !postulacion?.archivo_cv },
    { id: 'gestion', icon: <IconManagement className="w-4 h-4" />, label: 'Gestión' },
    { id: 'correo',  icon: <IconEmail className="w-4 h-4" />, label: 'Correo origen', hidden: !postulacion?.asunto_email },
  ]

  return createPortal(
    /* Overlay Fixed (Pantalla completa con blur) */
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-0 md:p-5 lg:p-6 animate-fade-in" onClick={onClose}>
      
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />

      {/* Contenedor del Modal Responsivo */}
      <div
        className="relative flex flex-col bg-white w-full h-full md:h-[94vh] md:w-[94vw] lg:w-[92vw] xl:w-[90vw] max-w-[1600px] md:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >

        {/* ── Carga en Proceso ── */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold">Cargando expediente...</p>
            </div>
          </div>
        )}

        {/* ── Fallo en la carga ── */}
        {!loading && !postulacion && (
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
            <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-sm">
              <IconWarning className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-slate-800 font-bold text-base mb-1">Error al cargar información</p>
              <p className="text-xs text-slate-400 mb-4">No pudimos obtener el expediente del candidato. Por favor, reintente.</p>
              <button onClick={onClose} className="btn-secondary text-xs px-4 py-2">Cerrar Ventana</button>
            </div>
          </div>
        )}

        {/* ── Expediente Disponible ── */}
        {!loading && postulacion && (
          <>
            {/* ══ HERO HEADER SÓBRIO Y PROFESIONAL ══ */}
            <div className="bg-slate-50 border-b border-slate-200 flex-shrink-0 relative overflow-hidden px-6 py-6 md:px-8">
              {/* Refinado brillo ambiental en azul profundo */}
              <div className="absolute -left-1/4 -top-1/2 w-1/2 h-full bg-brand-500/5 blur-[120px] rounded-full pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                
                {/* Lado Izquierdo: Info Candidato */}
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 md:w-18 md:h-18 bg-brand-50 border border-brand-200 rounded-full flex items-center justify-center text-brand-700 text-2xl font-extrabold flex-shrink-0 shadow-inner select-none">
                    {postulacion.nombre_completo?.charAt(0)?.toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight leading-none">{postulacion.nombre_completo}</h1>
                      {ev && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[9px] font-bold border ${ev.recomendacion === "altamente_recomendado" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ev.recomendacion === "recomendado" ? "bg-blue-50 text-blue-700 border-blue-200" : ev.recomendacion === "con_reservas" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                          {ev.recomendacion === 'altamente_recomendado' ? '★ Altamente recomendado' : ev.recomendacion === 'recomendado' ? '✓ Recomendado' : ev.recomendacion === 'con_reservas' ? '⚠ Con reservas' : '✗ No recomendado'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-xs text-slate-400">
                      {postulacion.email && (
                        <span className="flex items-center gap-1.5">
                          <IconEmail className="w-3.5 h-3.5 text-slate-400" />
                          {postulacion.email}
                        </span>
                      )}
                      {postulacion.telefono && (
                        <span className="flex items-center gap-1.5">
                          <IconPhone className="w-3.5 h-3.5 text-slate-400" />
                          {postulacion.telefono}
                        </span>
                      )}
                      {d?.ciudad && (
                        <span className="flex items-center gap-1.5">
                          <IconMapPin className="w-3.5 h-3.5 text-slate-400" />
                          {d.ciudad}
                        </span>
                      )}
                      {postulacion.perfil_cargo && (
                        <span className="inline-flex items-center gap-1.5 text-brand-600 font-bold bg-brand-500/10 px-2.5 py-0.5 rounded-md border border-brand-500/25">
                          {postulacion.perfil_cargo.nombre}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lado Derecho: Acciones Rápidas */}
                <div className="flex items-center gap-2 flex-wrap">
                  {postulacion.archivo_cv && (
                    <button onClick={descargarCv} className="btn-secondary !py-2 !px-3.5 text-xs shadow-md">
                      <IconDownload className="w-3.5 h-3.5" />
                      Descargar CV
                    </button>
                  )}
                  {postulacion.archivo_cv && (
                    <button onClick={procesarIa} disabled={iaProcesando} className="btn-primary !py-2 !px-3.5 text-xs shadow-md">
                      {iaProcesando ? (
                        <>
                          <div className="animate-spin w-3.5 h-3.5 border border-white border-t-transparent rounded-full" />
                          Analizando...
                        </>
                      ) : (
                        <>
                          <IconRefresh className="w-3.5 h-3.5" />
                          Re-evaluar IA
                        </>
                      )}
                    </button>
                  )}
                  <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-2xl bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-all border border-slate-200 shadow-sm">
                    <IconClose className="w-4 h-4" />
                  </button>
                </div>

              </div>

              {/* ── BARRA DE PESTAÑAS MINIMALISTA ── */}
              <div className="relative z-10 flex gap-2 mt-6 border-b border-slate-200">
                {tabs.filter(t => !t.hidden).map(t => {
                  const isActive = tab === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold transition-all border-b-2 relative -mb-[2px] ${
                        isActive
                          ? 'border-brand-600 text-brand-700 font-extrabold bg-brand-50/40 rounded-t-xl'
                          : 'border-transparent text-slate-700 hover:text-brand-600 hover:bg-slate-100/50 rounded-t-xl'
                      }`}
                    >
                      {t.icon}
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ══ CONTENIDO DE LAS PESTAÑAS ══ */}
            <div className="flex-1 overflow-y-auto bg-slate-50">

              {/* ── 1. ANÁLISIS IA ── */}
              {tab === 'ia' && (
                <div className="p-6 md:p-8 w-full max-w-full px-4 md:px-8 lg:px-12 mx-auto space-y-6">

                  {/* Sin análisis aún */}
                  {(!c?.estado_parseo || c.estado_parseo === 'pendiente') && (
                    <div className="flex flex-col items-center justify-center text-center gap-6 py-20 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 flex items-center justify-center text-2xl shadow-sm">
                        <IconAI className="w-8 h-8 text-brand-600" />
                      </div>
                      <div>
                        <p className="text-base font-extrabold text-slate-900">Análisis IA pendiente</p>
                        <p className="text-xs text-slate-700 font-semibold mt-2 max-w-sm mx-auto">
                          {postulacion.archivo_cv ? 'Inicia la extracción y evaluación automatizada mediante Gemini AI.' : 'Este candidato no tiene una hoja de vida adjunta para evaluar.'}
                        </p>
                      </div>
                      {postulacion.archivo_cv && (
                        <button onClick={procesarIa} disabled={iaProcesando} className="btn-primary text-xs px-6 py-2.5">
                          {iaProcesando ? 'Analizando...' : 'Comenzar Análisis IA'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Analizando en segundo plano */}
                  {(c?.estado_parseo === 'procesando' || iaProcesando) && (
                    <div className="flex flex-col items-center justify-center gap-4 py-20 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
                      <div className="w-10 h-10 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm font-extrabold text-slate-900">Gemini IA está evaluando al candidato...</p>
                      <p className="text-xs text-slate-700 font-semibold">Analizando experiencia, educación e idoneidad técnica. Puede tardar unos segundos.</p>
                    </div>
                  )}

                  {/* Error en procesamiento */}
                  {c?.estado_parseo === 'error' && !iaProcesando && (
                    <div className="flex flex-col items-center justify-center gap-4 py-16 bg-red-50 rounded-2xl border border-red-200 text-center p-6">
                      <IconWarning className="w-12 h-12 text-red-400" />
                      <p className="text-sm font-bold text-red-400">Error durante la extracción de datos</p>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">{c.error_parseo}</p>
                      <button onClick={procesarIa} className="btn-secondary text-xs px-4 py-2 mt-2">Reintentar Análisis</button>
                    </div>
                  )}

                  {/* Análisis Completado (Layout Dashboard de 3 Columnas) */}
                  {c?.estado_parseo === 'procesado' && !iaProcesando && (
                    <>
                      {ev ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                          
                          {/* Columna Principal Izquierda (2/3 de espacio): Info detallada */}
                          <div className="lg:col-span-2 space-y-6">
                            
                            {/* Resumen Profesional */}
                            {c.resumen_ia && (
                              <div className="card">
                                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-3.5 flex items-center gap-2">
                                  <IconProfile className="w-4 h-4 text-brand-600" />
                                  Resumen Profesional IA
                                </h3>
                                <p className="text-slate-900 leading-relaxed text-sm font-semibold">{c.resumen_ia}</p>
                              </div>
                            )}

                            {/* Justificación de Reclutamiento */}
                            <div className="card">
                              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-3.5 flex items-center gap-2">
                                <IconAI className="w-4 h-4 text-brand-600" />
                                {isJsonJustificacion ? 'Evaluación Consultora IA' : 'Justificación del Reclutador IA'}
                              </h3>
                              <div className="border-l-4 border-brand-500 bg-brand-50/40 p-5 rounded-r-2xl text-slate-900 leading-relaxed text-sm font-semibold">
                                {isJsonJustificacion ? parsedJustificacion.justificacion_resumen : ev.justificacion}
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <IconManagement className="w-4 h-4 text-brand-600" />
                                Análisis Técnico por Dimensión
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* 1. Educación */}
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                  <div>
                                    <div className="flex justify-between items-start mb-4">
                                      <div className="flex items-center">
                                        <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 flex items-center justify-center flex-shrink-0">
                                          <IconEducation className="w-5 h-5" />
                                        </div>
                                        <h4 className="text-slate-900 font-extrabold text-sm ml-3">Educación</h4>
                                      </div>
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                        {Math.round(ev.puntaje_educacion)}/20 pts
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-950 font-semibold leading-relaxed">
                                      {displayEducacion}
                                    </p>
                                  </div>
                                </div>

                                {/* 2. Experiencia */}
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                  <div>
                                    <div className="flex justify-between items-start mb-4">
                                      <div className="flex items-center">
                                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center flex-shrink-0">
                                          <IconBriefcase className="w-5 h-5" />
                                        </div>
                                        <h4 className="text-slate-900 font-extrabold text-sm ml-3">Experiencia Profesional</h4>
                                      </div>
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                        {Math.round(ev.puntaje_experiencia)}/35 pts
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-950 font-semibold leading-relaxed">
                                      {displayExperiencia}
                                    </p>
                                  </div>
                                </div>

                                {/* 3. Habilidades */}
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                  <div>
                                    <div className="flex justify-between items-start mb-4">
                                      <div className="flex items-center">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                          <IconCert className="w-5 h-5" />
                                        </div>
                                        <h4 className="text-slate-900 font-extrabold text-sm ml-3">Habilidades Técnicas</h4>
                                      </div>
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        {Math.round(ev.puntaje_habilidades)}/30 pts
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-950 font-semibold leading-relaxed">
                                      {displayHabilidades}
                                    </p>
                                  </div>
                                </div>

                                {/* 4. Ajuste Perfil */}
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                  <div>
                                    <div className="flex justify-between items-start mb-4">
                                      <div className="flex items-center">
                                        <div className="w-9 h-9 rounded-xl bg-slate-800/10 border border-slate-800/20 text-slate-800 flex items-center justify-center flex-shrink-0">
                                          <IconProfile className="w-5 h-5" />
                                        </div>
                                        <h4 className="text-slate-900 font-extrabold text-sm ml-3">Ajuste Perfil General</h4>
                                      </div>
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-850 border border-slate-300">
                                        {Math.round(ev.puntaje_perfil_general)}/15 pts
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-950 font-semibold leading-relaxed">
                                      {displayPerfilGeneral}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                          </div>

                          {/* Columna Derecha Lateral (1/3 de espacio): Compatibilidad y Ficha Técnica */}
                          <div className="space-y-6 lg:sticky lg:top-6">
                            
                            {/* Card de Compatibilidad con el ScoreWidget */}
                            <div className="card flex flex-col gap-6">
                              <div className="pb-4 border-b border-slate-200">
                                <AnimatedScoreWidget score={ev.puntaje_total} title={ev.perfil_cargo?.nombre || postulacion.perfil_cargo?.nombre} />
                              </div>

                              {/* Desglose de Puntajes en Barras Sóbrias */}
                              <div className="space-y-4">
                                {[
                                  { label: 'Educación', val: ev.puntaje_educacion, max: 20, color: '#38bdf8' },
                                  { label: 'Experiencia Profesional', val: ev.puntaje_experiencia, max: 35, color: '#2563eb' },
                                  { label: 'Habilidades Técnicas', val: ev.puntaje_habilidades, max: 30, color: '#1d4ed8' },
                                  { label: 'Ajuste Perfil General', val: ev.puntaje_perfil_general, max: 15, color: '#172554' },
                                ].map((s, i) => (
                                  <ScoreBar key={i} label={s.label} value={s.val} max={s.max} color={s.color} />
                                ))}
                              </div>
                            </div>

                          </div>

                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center space-y-4 shadow-sm">
                          <IconTime className="w-10 h-10 text-brand-600 mx-auto" />
                          <p className="text-sm font-extrabold text-slate-900">Candidato analizado · Pendiente de evaluación</p>
                          <p className="text-xs text-slate-700 font-semibold max-w-sm mx-auto">La extracción de la hoja de vida fue exitosa, pero no se ha podido generar el score. Asigne un perfil cargo válido al candidato.</p>
                          {postulacion.archivo_cv && (
                            <button onClick={procesarIa} className="btn-primary text-xs px-5 py-2 mx-auto">Evaluar Candidato</button>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {iaMsg && (
                    <div className={`text-xs text-center font-bold p-3.5 rounded-2xl border ${
                      iaMsg.startsWith('✅') 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                        : 'bg-red-50 text-red-850 border-red-200'
                    }`}>
                      {iaMsg}
                    </div>
                  )}

                </div>
              )}

              {/* ── 2. HOJA DE VIDA (Visor de PDF) ── */}
              {tab === 'cv' && (
                <div className="flex flex-col h-full bg-slate-50" style={{ height: 'calc(100vh - 200px)' }}>
                  {postulacion.archivo_cv ? (
                    <CvViewer postulacionId={postulacion.id} mimeType={postulacion.archivo_mime} fileName={postulacion.archivo_nombre} />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                      <IconCV className="w-12 h-12 text-slate-400" />
                      <p className="text-xs text-slate-400 font-medium">No se adjuntó hoja de vida en esta postulación</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── 4. GESTIÓN DEL PROCESO ── */}
              {tab === 'gestion' && (
                <div className="p-6 md:p-8 w-full max-w-full px-4 md:px-8 lg:px-12 mx-auto space-y-6">
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    
                    {/* Panel del formulario de gestión */}
                    <div className="lg:col-span-2 card space-y-6">
                      <h3 className="text-xs font-extrabold text-slate-850 uppercase tracking-wider border-b border-slate-200 pb-3.5">Estado y Observaciones de Selección</h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="label">Estado del Candidato</label>
                          <select className="select" value={estado} onChange={e => setEstado(e.target.value)}>
                            {ESTADOS.map(e => <option key={e} value={e} className="bg-white text-slate-700">{statusLabel[e] || e}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label">Cargo Operativo Asignado</label>
                          <select className="select" value={perfilId} onChange={e => setPerfilId(e.target.value)}>
                            <option value="" className="bg-white text-slate-700">Sin asignar</option>
                            {(perfiles || []).map(p => <option key={p.id} value={p.id} className="bg-white text-slate-700">{p.nombre}</option>)}
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="label">Notas y Observaciones Internas</label>
                          <textarea className="input min-h-[140px] text-xs font-normal" value={notas}
                            onChange={e => setNotas(e.target.value)}
                            placeholder="Resultados de entrevistas, pretensiones salariales, compromisos, aptitudes o valoraciones técnicas adicionales..." />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
                        {msg && <p className={`text-xs font-bold ${msg.startsWith('✅') ? 'text-brand-600' : 'text-red-400'}`}>{msg}</p>}
                        <div className="flex gap-2.5 ml-auto">
                          {postulacion.email && (
                            <button onClick={() => setShowEmail(v => !v)} className="btn-secondary text-xs font-semibold !py-2 !px-3.5">
                              <IconEmail className="w-3.5 h-3.5 inline mr-1" />
                              {showEmail ? 'Cerrar Correo' : 'Notificar por Correo'}
                            </button>
                          )}
                          <button onClick={save} disabled={saving} className="btn-primary text-xs font-bold shadow-md !py-2 !px-4">
                            <IconSave className="w-3.5 h-3.5 inline mr-1" />
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Ficha técnica rápida lateral */}
                    <div className="bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl p-6 flex flex-col justify-between min-h-[300px] shadow-sm">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2.5">Información del Expediente</h4>
                        <div className="space-y-3.5 text-xs">
                          <div className="flex justify-between border-b border-slate-200 pb-2.5">
                            <span className="text-slate-600 font-semibold">Fecha recepción</span>
                            <span className="font-extrabold text-slate-950">{new Date(postulacion.created_at).toLocaleDateString('es-CO')}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-200 pb-2.5">
                            <span className="text-slate-600 font-semibold">Modificado el</span>
                            <span className="font-extrabold text-slate-950">{new Date(postulacion.updated_at).toLocaleDateString('es-CO')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600 font-semibold">Canal ingreso</span>
                            <span className="font-extrabold text-slate-950">{postulacion.asunto_email ? 'Correo Electrónico' : 'Carga Manual'}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="pt-6 border-t border-slate-200 text-xs text-slate-800 leading-relaxed font-extrabold">
                        Las notas guardadas en este expediente son privadas y únicamente accesibles por el personal autorizado de recursos humanos de Hidroobras.
                      </div>
                    </div>

                  </div>

                  {/* Panel de Enviar Correo en Bloque Separado */}
                  {showEmail && (
                    <div className="card space-y-4 animate-slide-up mt-6 max-w-3xl">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-3 flex items-center gap-2">
                        <IconEmail className="w-4 h-4 text-brand-400" />
                        Enviar Notificación Formal al Candidato
                      </h4>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="label">Plantilla del Proceso</label>
                          <select className="select" onChange={e => { const p = plantillas.find(p => p.tipo === e.target.value); if (p) setEmailForm({ asunto: p.asunto, cuerpo: p.cuerpo.replace('{{nombre}}', postulacion.nombre_completo), tipo: p.tipo }) }}>
                            {plantillas.map(p => <option key={p.tipo} value={p.tipo} className="bg-white text-slate-700">{p.tipo.replace('_', ' ').toUpperCase()}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label">Asunto del Correo</label>
                          <input className="input" value={emailForm.asunto} onChange={e => setEmailForm(f => ({ ...f, asunto: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">Cuerpo de Mensaje (Editable)</label>
                          <textarea className="input font-mono text-xs min-h-[160px] leading-relaxed" value={emailForm.cuerpo} onChange={e => setEmailForm(f => ({ ...f, cuerpo: e.target.value }))} />
                        </div>
                      </div>
                      
                      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                        <button onClick={() => setShowEmail(false)} className="btn-secondary text-xs font-semibold !py-2 !px-4">Cancelar</button>
                        <button onClick={sendEmail} disabled={sendingEmail} className="btn-primary text-xs font-bold shadow-md !py-2 !px-4">
                          <IconEmail className="w-3.5 h-3.5 inline mr-1" />
                          {sendingEmail ? 'Enviando...' : 'Enviar Correo'}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* ── 5. DETALLES DEL CORREO DE ORIGEN ── */}
              {tab === 'correo' && (
                <div className="p-6 md:p-8 w-full max-w-full px-4 md:px-8 lg:px-12 mx-auto space-y-6">
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    
                    {/* Visualizador del Mensaje Completo */}
                    <div className="lg:col-span-2 card space-y-6">
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-3.5">Correo Electrónico Recibido</h3>

                      {postulacion.asunto_email ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-4 flex-wrap gap-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">
                                {postulacion.nombre_completo?.charAt(0)?.toUpperCase()}
                              </div>
                              <div>
                                <p className="font-extrabold text-slate-800 text-sm leading-none">{postulacion.asunto_email}</p>
                                <p className="text-xs text-slate-400 mt-2">De: {postulacion.email}</p>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-250 px-2.5 py-1.5 rounded-md">
                              {new Date(postulacion.fecha_recepcion || postulacion.created_at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                          </div>

                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-mono max-h-[350px] overflow-y-auto shadow-inner">
                            {postulacion.cuerpo_email || '(Mensaje sin contenido textual)'}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center py-20 text-center gap-3 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                          <IconEmail className="w-10 h-10 text-slate-400" />
                          <p className="text-xs font-semibold text-slate-400">Esta postulación no proviene de correo electrónico o la vinculación no fue registrada.</p>
                        </div>
                      )}
                    </div>

                    {/* Historial de notificaciones salientes */}
                    <div className="card space-y-4">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2.5">Historial de Notificaciones</h4>
                      
                      {postulacion.email_logs?.length > 0 ? (
                        <div className="divide-y divide-slate-200">
                          {postulacion.email_logs.map(log => (
                            <div key={log.id} className="py-3.5 flex items-center justify-between text-xs gap-3">
                              <div>
                                <p className="font-semibold text-slate-800 capitalize leading-snug">{log.tipo.replace('_', ' ')}</p>
                                <p className="text-xs text-slate-700 mt-1 font-semibold">{log.destinatario}</p>
                              </div>
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border ${
                                log.enviado 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                {log.enviado ? 'ENVIADO' : 'FALLIDO'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-10 text-center text-xs text-slate-400 italic">
                          Sin notificaciones salientes enviadas.
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
