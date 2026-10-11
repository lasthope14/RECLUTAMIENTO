import { useEffect, useState, useRef } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import DetailDrawer from '../components/DetailDrawer'
import gsap from 'gsap'

const PIE_COLORS  = ['#2563eb', '#38bdf8', '#6366f1', '#1d4ed8', '#1e293b']
const BAR_COLORS  = ['#2563eb', '#38bdf8', '#6366f1', '#1d4ed8', '#1e293b']

const statusCls = {
  recibida:        'status-recibida',
  en_revision:     'status-en_revision',
  preseleccionado: 'status-preseleccionado',
  descartado:      'status-descartado',
  contratado:      'status-contratado',
}

function StatCard({ icon, label, value, sub, accent, onClick }) {
  const isClickable = !!onClick
  return (
    <div 
      onClick={onClick}
      className={`stat-card animate-slide-up hover:border-surface-350 transition-all duration-300 ${
        isClickable ? 'cursor-pointer hover:shadow-lg hover:scale-[1.03] active:scale-[0.98] hover:bg-slate-50/50 hover:border-brand-300/40' : ''
      }`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-750 font-bold">{label}</p>
        <p className="text-2xl font-bold text-surface-800">{value ?? '—'}</p>
        {sub && <p className="text-xs text-slate-650 font-semibold mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function LogIcon({ type, className }) {
  if (type === 'import') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )
  }
  if (type === 'omit') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    )
  }
  if (type === 'error') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  }
  if (type === 'ai') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    )
  }
  if (type === 'connection') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  }
  if (type === 'processing') {
    return (
      <svg className={`${className} animate-pulse`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  }
  if (type === 'summary') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

/* Helper para formatear logs de importación en objetos visuales */
function parseLogLine(log) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  
  if (log.includes('✅ ¡Importado!')) {
    const name = log.replace(/.*Candidato registrado:/, '').trim()
    return {
      type: 'import',
      title: 'Postulante Importado',
      subtitle: `Candidato registrado correctamente: ${name}`,
      badge: 'Importado',
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      time,
      iconType: 'import',
      iconClass: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    }
  }
  
  if (log.includes('ℹ️ Omitido')) {
    return {
      type: 'omit',
      title: 'Postulante Omitido',
      subtitle: 'La postulación ya existe en el sistema (correo/candidato duplicado).',
      badge: 'Omitido',
      badgeClass: 'bg-slate-50 text-slate-500 border border-slate-200',
      time,
      iconType: 'omit',
      iconClass: 'bg-slate-100 text-slate-700 border border-slate-200',
    }
  }
  
  if (log.includes('❌ Error') || log.includes('⚠️ Respuesta inesperada')) {
    const detail = log.replace(/.*Error al procesar UID \d+:/, '').replace(/.*Respuesta inesperada:/, '').trim()
    return {
      type: 'error',
      title: 'Error de Importación',
      subtitle: detail || 'Fallo al procesar o descargar los archivos adjuntos.',
      badge: 'Error',
      badgeClass: 'bg-red-50 text-red-700 border border-red-200',
      time,
      iconType: 'error',
      iconClass: 'bg-red-50 text-red-600 border border-red-100',
    }
  }
  
  if (log.includes('🤖') || log.includes('🧠') || log.includes('💡')) {
    const detail = log.replace(/^🤖|^🧠|^💡/, '').trim()
    return {
      type: 'ai',
      title: 'Inteligencia Artificial Gemini',
      subtitle: detail,
      badge: 'Gemini IA',
      badgeClass: 'bg-violet-50 text-violet-750 border border-violet-200',
      time,
      iconType: 'ai',
      iconClass: 'bg-violet-50 text-violet-600 border border-violet-100',
    }
  }
  
  if (log.includes('🚀') || log.includes('🔌') || log.includes('📥') || log.includes('📅')) {
    const detail = log.replace(/^🚀|^🔌|^📥|^📅/, '').trim()
    return {
      type: 'connection',
      title: 'Bandeja de Entrada',
      subtitle: detail,
      badge: 'Conexión IMAP',
      badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
      time,
      iconType: 'connection',
      iconClass: 'bg-blue-50 text-blue-600 border border-blue-100',
    }
  }

  if (log.includes('⚡')) {
    const detail = log.replace(/^⚡/, '').trim()
    return {
      type: 'processing',
      title: 'Procesando Candidatura',
      subtitle: detail,
      badge: 'Procesando',
      badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
      time,
      iconType: 'processing',
      iconClass: 'bg-amber-50 text-amber-600 border border-amber-100',
    }
  }

  if (log.includes('🎉') || log.includes('📊') || log.includes('🏁')) {
    const detail = log.replace(/^🎉|^📊|^🏁/, '').trim()
    return {
      type: 'summary',
      title: 'Resumen del Proceso',
      subtitle: detail,
      badge: 'Resumen',
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold',
      time,
      iconType: 'summary',
      iconClass: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    }
  }

  return {
    type: 'general',
    title: 'Información de Proceso',
    subtitle: log,
    badge: 'Info',
    badgeClass: 'bg-slate-50 text-slate-500 border border-slate-200',
    time,
    iconType: 'general',
    iconClass: 'bg-slate-100 text-slate-450 border border-slate-200',
  }
}

const EngineeringIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3C7.58 3 4 6.58 4 11V15H20V11C20 6.58 16.42 3 12 3Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M12 3V9" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M2 15.5C2 14.67 2.67 14 3.5 14H20.5C21.33 14 22 14.67 22 15.5C22 15.78 21.78 16 21.5 16H2.5C2.22 16 2 15.78 2 15.5Z" fill="#CBD5E1" stroke="#64748B" strokeWidth="1.2" />
    <rect x="9" y="10" width="6" height="2" rx="0.5" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.2" />
  </svg>
)

const SSTIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" fill="#D1FAE5" stroke="#10B981" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M12 7C9.5 7 8 9 8 11C8 14 12 17 12 17C12 17 16 14 16 11C16 9 14.5 7 12 7Z" fill="#10B981" stroke="#047857" strokeWidth="1.2" />
  </svg>
)

const PlomeriaIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 18L18 6" stroke="#0EA5E9" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M18 18L6 6" stroke="#0EA5E9" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="12" cy="12" r="5.5" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.5" />
    <path d="M12 12L14.5 9.5" stroke="#0284C7" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="12" r="1.2" fill="#0284C7" />
  </svg>
)

const DefaultIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="16" height="16" rx="3" fill="#E0E7FF" stroke="#6366F1" strokeWidth="1.5" />
    <circle cx="12" cy="9" r="2.5" fill="#6366F1" />
    <path d="M6 17C6 14.5 8.5 13.5 12 13.5C15.5 13.5 18 14.5 18 17" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const renderCargoIcon = (cargoName, className) => {
  const normalized = (cargoName || '').toLowerCase().trim()
  if (normalized.includes('ingeniero residente')) {
    return <EngineeringIcon className={className} />
  }
  if (normalized.includes('sst') || normalized.includes('seguridad y salud')) {
    return <SSTIcon className={className} />
  }
  if (normalized.includes('plomería') || normalized.includes('plomeria') || normalized.includes('oficial o ayudante')) {
    return <PlomeriaIcon className={className} />
  }
  return <DefaultIcon className={className} />
}

const getCargoChartColors = (cargoName) => {
  const normalized = (cargoName || '').toLowerCase().trim()
  if (normalized.includes('ingeniero residente')) {
    return {
      solid: '#2563eb',
      gradient: 'url(#grad_resident)',
      bgLight: 'bg-blue-50/60',
      borderLight: 'border-blue-100',
      textDark: 'text-blue-900',
      textMed: 'text-blue-600',
      priority: 'Prioridad Alta',
      priorityCls: 'bg-red-50 text-red-700 border-red-200',
      desc: 'Auditoría recomendada. Personal crítico de supervisión técnica en obras civiles de Hidroobras.'
    }
  }
  if (normalized.includes('sst') || normalized.includes('seguridad y salud')) {
    return {
      solid: '#10b981',
      gradient: 'url(#grad_sst)',
      bgLight: 'bg-emerald-50/60',
      borderLight: 'border-emerald-100',
      textDark: 'text-emerald-900',
      textMed: 'text-emerald-600',
      priority: 'Prioridad Media',
      priorityCls: 'bg-amber-50 text-amber-700 border-amber-200',
      desc: 'Auditoría recomendada. Gestión activa de talento, bienestar laboral y seguridad y salud humana.'
    }
  }
  if (normalized.includes('plomería') || normalized.includes('plomeria') || normalized.includes('oficial o ayudante')) {
    return {
      solid: '#0ea5e9',
      gradient: 'url(#grad_plomeria)',
      bgLight: 'bg-sky-50/60',
      borderLight: 'border-sky-100',
      textDark: 'text-sky-900',
      textMed: 'text-sky-600',
      priority: 'Prioridad Alta',
      priorityCls: 'bg-red-50 text-red-700 border-red-200',
      desc: 'Operación activa. Personal hidráulico de montaje, redes y canalizaciones hidrosanitarias.'
    }
  }
  return {
    solid: '#6366f1',
    gradient: 'url(#grad_default)',
    bgLight: 'bg-indigo-50/60',
    borderLight: 'border-indigo-100',
    textDark: 'text-indigo-900',
    textMed: 'text-indigo-600',
    priority: 'General',
    priorityCls: 'bg-slate-50 text-slate-700 border-slate-200',
    desc: 'Perfil operativo registrado en el sistema de reclutamiento.'
  }
}

// Muestra si la revisión automática de correos está corriendo. Si se atrasa o
// falla, se pone en rojo: así se nota sin tener que revisar el servidor.
function IndicadorRevisionAutomatica({ estado }) {
  if (!estado) return null

  const { ultima, atrasada } = estado

  const hace = (fechaIso) => {
    const minutos = Math.round((Date.now() - new Date(fechaIso).getTime()) / 60000)
    if (minutos < 1) return 'hace un momento'
    if (minutos < 60) return `hace ${minutos} min`
    const horas = Math.round(minutos / 60)
    if (horas < 48) return `hace ${horas} h`
    return `hace ${Math.round(horas / 24)} días`
  }

  let color = 'text-emerald-700'
  let punto = 'bg-emerald-500'
  let texto

  if (!ultima) {
    color = 'text-red-700'
    punto = 'bg-red-500'
    texto = 'Revisión automática de correos: todavía no se ha ejecutado'
  } else if (atrasada) {
    color = 'text-red-700'
    punto = 'bg-red-500'
    texto = `Revisión automática de correos detenida: última ${hace(ultima.fecha)}. Usa "Revisar correos" y avisa a sistemas.`
  } else if (!ultima.ok) {
    color = 'text-amber-700'
    punto = 'bg-amber-500'
    texto = `Revisión automática ${hace(ultima.fecha)} con errores${ultima.mensaje ? `: ${ultima.mensaje}` : ''}`
  } else {
    const nuevas = ultima.resultados?.importados ?? 0
    texto = `Revisión automática de correos activa · ${hace(ultima.fecha)}${nuevas > 0 ? ` · ${nuevas} nuevas` : ''}`
  }

  return (
    <p className={`flex items-center gap-2 text-xs mt-1 ${color}`} title={ultima ? new Date(ultima.fecha).toLocaleString() : ''}>
      <span className={`inline-block w-2 h-2 rounded-full ${punto}`} />
      {texto}
    </p>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData]                 = useState(null)
  const [loading, setLoading]           = useState(true)
  const [selectedId, setSelectedId]     = useState(null)
  
  // Real-time email check states
  const [checking, setChecking]         = useState(false)
  const [checkingStep, setCheckingStep] = useState('idle') // 'idle', 'headers', 'classify', 'importing', 'cancelled', 'completed', 'failed'
  const [checkDias, setCheckDias]       = useState(30)
  const [progressPct, setProgressPct]   = useState(0)
  const [progressText, setProgressText] = useState('')
  const [progressLogs, setProgressLogs] = useState([])
  const [canCancel, setCanCancel]       = useState(false)
  const [checkResult, setCheckResult]   = useState(null)

  // Estado de la revisión automática (cada 15 min en el servidor)
  const [revisionAuto, setRevisionAuto] = useState(null)

  useEffect(() => {
    const cargar = () => api.get('/email/estado-automatico').then(res => setRevisionAuto(res.data)).catch(() => {})
    cargar()
    const intervalo = setInterval(cargar, 60000)
    return () => clearInterval(intervalo)
  }, [])

  const cancelledRef = useRef(false)
  const logsContainerRef = useRef(null)
  const chartRef = useRef(null)
  const orbsRef = useRef([])
  orbsRef.current = []
  const [hoveredCargo, setHoveredCargo] = useState(null)
  const [activeCargo, setActiveCargo] = useState(null)

  useEffect(() => {
    if (data?.por_cargo && data.por_cargo.length > 0 && !activeCargo) {
      const first = data.por_cargo[0]
      setActiveCargo({ id: first.id, name: first.nombre, total: first.total })
    }
  }, [data, activeCargo])

  const getStepStatus = (stepNum) => {
    if (checkingStep === 'cancelled') {
      if (stepNum === 1 && progressPct < 40) return 'cancelled'
      if (stepNum === 2 && progressPct >= 40 && progressPct < 60) return 'cancelled'
      if (stepNum === 3 && progressPct >= 60) return 'cancelled'
      if (stepNum === 1 && progressPct >= 40) return 'success'
      if (stepNum === 2 && progressPct >= 60) return 'success'
      return 'pending'
    }
    if (checkingStep === 'failed') {
      if (stepNum === 1 && progressPct < 40) return 'error'
      if (stepNum === 2 && progressPct >= 40 && progressPct < 60) return 'error'
      if (stepNum === 3 && progressPct >= 60) return 'error'
      if (stepNum === 1 && progressPct >= 40) return 'success'
      if (stepNum === 2 && progressPct >= 60) return 'success'
      return 'pending'
    }
    if (checkingStep === 'completed') return 'success'
    
    if (stepNum === 1) {
      if (checkingStep === 'headers') return 'active'
      return 'success'
    }
    if (stepNum === 2) {
      if (checkingStep === 'headers') return 'pending'
      if (checkingStep === 'classify') return 'active'
      return 'success'
    }
    if (stepNum === 3) {
      if (checkingStep === 'importing') return 'active'
      return 'pending'
    }
    return 'pending'
  }

  const load = async () => {
    try {
      const res = await api.get('/dashboard')
      setData(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // GSAP animation for the custom floating cargo orbs
  useEffect(() => {
    if (!loading && data && chartRef.current) {
      const orbs = orbsRef.current.filter(Boolean)
      if (orbs.length === 0) return

      // Kill any active animations on these elements to prevent overlapping or leaks
      gsap.killTweensOf(orbs)

      // Set initial values
      gsap.set(orbs, { scale: 0, opacity: 0, x: 0, y: 0 })

      // Entrance animation with springy scale-up
      gsap.to(orbs, {
        scale: 1,
        opacity: 1,
        duration: 1.2,
        ease: 'back.out(1.8)',
        stagger: 0.12,
        onComplete: () => {
          // Continuous floating animation with randomized offsets and times
          orbs.forEach((orb, i) => {
            gsap.to(orb, {
              x: () => gsap.utils.random(-12, 12),
              y: () => gsap.utils.random(-15, 15),
              duration: () => gsap.utils.random(3.5, 5.5),
              repeat: -1,
              yoyo: true,
              ease: 'sine.inOut',
              delay: i * 0.1
            })
          })
        }
      })
    }
  }, [loading, data])

  // Localized scroll container auto-scroll (prevents jarring viewport jumps)
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTo({
        top: logsContainerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [progressLogs])

  const handleCancel = () => {
    cancelledRef.current = true
    setCanCancel(false)
    setCheckingStep('cancelled')
    setProgressText('Cancelando proceso...')
    setProgressLogs(prev => [...prev, '🛑 Solicitud de cancelación recibida. Deteniendo tareas...'])
  }

  const checkEmail = async () => {
    setChecking(true)
    setCheckingStep('headers')
    setProgressPct(5)
    setProgressText('Conectando al servidor y buscando correos...')
    setProgressLogs([
      `🚀 Iniciando revisión de correos (últimos ${checkDias} días)...`,
      `📅 Fecha de búsqueda: desde ${new Date(Date.now() - checkDias * 24 * 60 * 60 * 1000).toLocaleDateString()}`,
      `🔌 Conectando al servidor IMAP...`
    ])
    setCheckResult(null)
    cancelledRef.current = false
    setCanCancel(true)

    try {
      // Paso 1: Obtener headers
      const resHeaders = await api.post('/email/check-headers', { dias: checkDias })
      if (cancelledRef.current) {
        setCheckingStep('cancelled')
        setProgressLogs(prev => [...prev, '🛑 Proceso cancelado por el usuario.'])
        setCanCancel(false)
        await load()
        setTimeout(() => setChecking(false), 4000)
        return
      }

      const headers = resHeaders.data.headers || []
      setProgressLogs(prev => [
        ...prev,
        `📥 Conexión exitosa. Se encontraron ${headers.length} correos nuevos (no registrados previamente).`
      ])
      setProgressPct(30)

      if (headers.length === 0) {
        setProgressLogs(prev => [
          ...prev,
          '✨ No se encontraron correos nuevos sin importar en la bandeja de entrada.',
          '🏁 Proceso completado con éxito.'
        ])
        setProgressPct(100)
        setCheckingStep('completed')
        setCanCancel(false)
        setCheckResult({ importados: 0, duplicados: 0, errores: 0 })
        await load()
        setTimeout(() => setChecking(false), 5000)
        return
      }

      // Paso 2: Clasificar con Gemini IA
      setCheckingStep('classify')
      setProgressText('Clasificando correos con IA Gemini...')
      setProgressLogs(prev => [
        ...prev,
        `🤖 Analizando la lista de ${headers.length} correos con Gemini...`,
        `🧠 Determinando cuáles corresponden a candidaturas de empleo con hoja de vida...`
      ])
      setProgressPct(40)

      const resClassify = await api.post('/email/classify', { headers })
      if (cancelledRef.current) {
        setCheckingStep('cancelled')
        setProgressLogs(prev => [...prev, '🛑 Proceso cancelado por el usuario.'])
        setCanCancel(false)
        await load()
        setTimeout(() => setChecking(false), 4000)
        return
      }

      const seleccionados = resClassify.data.seleccionados || []
      setProgressLogs(prev => [
        ...prev,
        `🤖 Clasificación completada por Gemini.`,
        `💡 De los ${headers.length} analizados, ${seleccionados.length} fueron clasificados como postulaciones con CV.`
      ])
      setProgressPct(60)

      if (seleccionados.length === 0) {
        setProgressLogs(prev => [
          ...prev,
          '✨ Ninguno de los correos recibidos coincide con un perfil de postulación laboral.',
          '🏁 Proceso completado.'
        ])
        setProgressPct(100)
        setCheckingStep('completed')
        setCanCancel(false)
        setCheckResult({ importados: 0, duplicados: 0, errores: 0 })
        await load()
        setTimeout(() => setChecking(false), 5000)
        return
      }

      // Paso 3: Descarga e importación granular secuencial
      setCheckingStep('importing')
      setProgressText(`Descargando e importando ${seleccionados.length} postulaciones...`)
      setProgressLogs(prev => [
        ...prev,
        `📦 Iniciando descarga individual para evitar bloqueos del servidor local...`
      ])

      let importados = 0
      let duplicados = 0
      let errores = 0

      for (let i = 0; i < seleccionados.length; i++) {
        if (cancelledRef.current) {
          setCheckingStep('cancelled')
          setProgressLogs(prev => [
            ...prev,
            `🛑 Proceso detenido por el usuario.`,
            `📊 Parcial: ${importados} importados, ${duplicados} duplicados, ${errores} errores.`
          ])
          setCanCancel(false)
          setCheckResult({ importados, duplicados, errores })
          await load()
          setTimeout(() => setChecking(false), 5000)
          return
        }

        const email = seleccionados[i]
        const displayLabel = `${email.nombre || email.from} ("${email.asunto.substring(0, 30)}${email.asunto.length > 30 ? '...' : ''}")`
        
        setProgressLogs(prev => [
          ...prev,
          `⚡ [${i + 1}/${seleccionados.length}] Procesando UID ${email.uid}: ${displayLabel}...`
        ])

        try {
          const resImport = await api.post('/email/import-single', { email })
          if (resImport.data.status === 'importado') {
            importados++
            setProgressLogs(prev => [
              ...prev,
              `  ✅ ¡Importado! Candidato registrado: ${resImport.data.nombre_completo}`
            ])
          } else if (resImport.data.status === 'duplicado') {
            duplicados++
            setProgressLogs(prev => [
              ...prev,
              `  ℹ️ Omitido: El correo ya existe en el sistema.`
            ])
          } else {
            errores++
            setProgressLogs(prev => [
              ...prev,
              `  ⚠️ Respuesta inesperada: ${resImport.data.status}`
            ])
          }
        } catch (e) {
          errores++
          setProgressLogs(prev => [
            ...prev,
            `  ❌ Error al procesar UID ${email.uid}: ${e.response?.data?.message || e.message || 'Error en servidor'}`
          ])
        }

        // Increment progress percentage between 60% and 95%
        const currentPct = Math.round(60 + ((i + 1) / seleccionados.length) * 35)
        setProgressPct(currentPct)
      }

      // Finalizado
      setProgressLogs(prev => [
        ...prev,
        `🎉 ¡Proceso de importación finalizado exitosamente!`,
        `📊 Resumen final: ${importados} importados, ${duplicados} duplicados, ${errores} errores.`
      ])
      setProgressPct(100)
      setCheckingStep('completed')
      setCanCancel(false)
      setCheckResult({ importados, duplicados, errores })
      await load()
      setTimeout(() => setChecking(false), 10000)

    } catch (err) {
      console.error(err)
      if (cancelledRef.current) {
        setCheckingStep('cancelled')
        setProgressLogs(prev => [...prev, '🛑 Proceso cancelado por el usuario.'])
        setCanCancel(false)
      } else {
        setCheckingStep('failed')
        setCanCancel(false)
        setProgressLogs(prev => [
          ...prev,
          `❌ Error crítico en el proceso de revisión: ${err.response?.data?.message || err.message || 'Error de red'}`
        ])
        setCheckResult({ error: true })
      }
      await load()
      setTimeout(() => setChecking(false), 10000)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const st           = data?.estadisticas ?? {}
  const porCargoData = (data?.por_cargo ?? []).map(c => ({ id: c.id, name: c.nombre, total: c.total }))
  const estadosData  = [
    { name: 'Recibidas',        value: st.recibidas       },
    { name: 'En revisión',      value: st.en_revision     },
    { name: 'Preseleccionados', value: st.preseleccionados },
    { name: 'Descartados',      value: st.descartados     },
    { name: 'Contratados',      value: st.contratados     },
  ].filter(d => d.value > 0)
  const totalEstados = estadosData.reduce((acc, curr) => acc + curr.value, 0)

  return (
    <div className="space-y-6 animate-fade-in text-surface-600">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="section-title">Dashboard</h1>
          <p className="section-sub">Resumen del sistema de reclutamiento Hidroobras</p>
          <IndicadorRevisionAutomatica estado={revisionAuto} />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={checkDias}
            onChange={e => setCheckDias(Number(e.target.value))}
            disabled={checking}
            className="select w-auto text-sm"
          >
            <option value={3}>Últimos 3 días</option>
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={60}>Últimos 60 días</option>
          </select>
          <button onClick={checkEmail} disabled={checking} className="btn-primary whitespace-nowrap">
            {checking ? (
              <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Revisando...</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>Revisar correos</>
            )}
          </button>
        </div>
      </div>

      {/* ── Progreso revisión ── */}
      {checking && (
        <div className="card border-slate-200 bg-white space-y-4 shadow-md animate-slide-up relative overflow-hidden">
          {/* Top colored accent line depending on the status */}
          <div className={`absolute top-0 left-0 right-0 h-1 transition-colors duration-500 ${
            checkingStep === 'cancelled' ? 'bg-amber-500' :
            checkingStep === 'failed' ? 'bg-red-500' :
            checkingStep === 'completed' ? 'bg-emerald-500' : 'bg-brand-500'
          }`} />

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {checkingStep !== 'completed' && checkingStep !== 'cancelled' && checkingStep !== 'failed' ? (
                <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              ) : checkingStep === 'completed' ? (
                <div className="w-5 h-5 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
              ) : checkingStep === 'cancelled' ? (
                <div className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636" /></svg>
                </div>
              ) : (
                <div className="w-5 h-5 flex items-center justify-center rounded-full bg-red-50 text-red-700 border border-red-200 flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-surface-800">
                  {progressText || 'Procesando correos...'}
                </p>
                <p className="text-sm text-slate-750 font-semibold mt-0.5">
                  {checkingStep === 'headers' && 'Estableciendo conexión segura e identificando nuevos mensajes...'}
                  {checkingStep === 'classify' && 'Gemini está filtrando los correos para quedarse solo con CVs relevantes...'}
                  {checkingStep === 'importing' && 'Descargando archivos adjuntos y registrando postulaciones...'}
                  {checkingStep === 'completed' && '¡Excelente! Todo el lote de correos ha sido procesado.'}
                  {checkingStep === 'cancelled' && 'El proceso se detuvo. Los correos ya importados se guardaron.'}
                  {checkingStep === 'failed' && 'Ocurrió un error. Se guardaron los cambios hasta el momento.'}
                </p>
              </div>
            </div>
            
            {canCancel && (
              <button 
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 border border-red-200 transition-all duration-150 active:scale-95 shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancelar
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm font-bold">
              <span className={
                checkingStep === 'cancelled' ? 'text-amber-700' :
                checkingStep === 'failed' ? 'text-red-700' :
                checkingStep === 'completed' ? 'text-emerald-700' : 'text-brand-600'
              }>
                {checkingStep === 'headers' && 'Fase 1: Extracción de Encabezados'}
                {checkingStep === 'classify' && 'Fase 2: Clasificación Inteligente (IA)'}
                {checkingStep === 'importing' && 'Fase 3: Importación Granular'}
                {checkingStep === 'completed' && 'Completado'}
                {checkingStep === 'cancelled' && 'Cancelado'}
                {checkingStep === 'failed' && 'Error'}
              </span>
              <span className="text-surface-550 font-mono">{progressPct}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  checkingStep === 'cancelled' ? 'bg-amber-500' :
                  checkingStep === 'failed' ? 'bg-red-500' :
                  checkingStep === 'completed' ? 'bg-emerald-500' : 'bg-brand-500'
                }`}
                style={{ width: `${progressPct}%` }} 
              />
            </div>
          </div>

          {/* Stepper Timeline Visual de 3 Fases */}
          <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200/60">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-4">Progreso de Fases</h4>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
              {/* Conexión IMAP */}
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm transition-all duration-300 ${
                  getStepStatus(1) === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse-slow' :
                  getStepStatus(1) === 'active' ? 'bg-brand-55 text-brand-700 ring-4 ring-brand-500/10 border border-brand-200 animate-pulse' :
                  getStepStatus(1) === 'error' ? 'bg-red-50 text-red-700 border border-red-200 animate-bounce' :
                  getStepStatus(1) === 'cancelled' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  'bg-slate-100 text-slate-650 border border-slate-200'
                }`}>
                  {getStepStatus(1) === 'success' ? '✓' : getStepStatus(1) === 'error' ? '✗' : getStepStatus(1) === 'cancelled' ? '-' : '1'}
                </div>
                <div>
                  <h5 className="font-bold text-sm text-slate-900 leading-none">1. Conexión IMAP</h5>
                  <p className="text-xs text-slate-650 mt-1 font-semibold">Extracción de encabezados</p>
                </div>
              </div>

              {/* Connector line 1 */}
              <div className="hidden md:block w-8 h-[2px] bg-slate-200 flex-shrink-0" />

              {/* Clasificación IA */}
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm transition-all duration-300 ${
                  getStepStatus(2) === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse-slow' :
                  getStepStatus(2) === 'active' ? 'bg-violet-50 text-violet-700 ring-4 ring-violet-500/10 border border-violet-200 animate-pulse' :
                  getStepStatus(2) === 'error' ? 'bg-red-50 text-red-700 border border-red-200 animate-bounce' :
                  getStepStatus(2) === 'cancelled' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  'bg-slate-100 text-slate-650 border border-slate-200'
                }`}>
                  {getStepStatus(2) === 'success' ? '✓' : getStepStatus(2) === 'error' ? '✗' : getStepStatus(2) === 'cancelled' ? '-' : '2'}
                </div>
                <div>
                  <h5 className="font-bold text-sm text-slate-900 leading-none">2. Filtro Gemini IA</h5>
                  <p className="text-xs text-slate-650 mt-1 font-semibold">Detección inteligente de CVs</p>
                </div>
              </div>

              {/* Connector line 2 */}
              <div className="hidden md:block w-8 h-[2px] bg-slate-200 flex-shrink-0" />

              {/* Importación */}
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm transition-all duration-300 ${
                  getStepStatus(3) === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse-slow' :
                  getStepStatus(3) === 'active' ? 'bg-brand-50 text-brand-700 ring-4 ring-brand-500/10 border border-brand-200 animate-pulse' :
                  getStepStatus(3) === 'error' ? 'bg-red-50 text-red-700 border border-red-200 animate-bounce' :
                  getStepStatus(3) === 'cancelled' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  'bg-slate-100 text-slate-650 border border-slate-200'
                }`}>
                  {getStepStatus(3) === 'success' ? '✓' : getStepStatus(3) === 'error' ? '✗' : getStepStatus(3) === 'cancelled' ? '-' : '3'}
                </div>
                <div>
                  <h5 className="font-bold text-sm text-slate-900 leading-none">3. Importación</h5>
                  <p className="text-xs text-slate-650 mt-1 font-semibold">Descarga y registro en BD</p>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Feed Premium */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Historial de Actividad</h4>
              </div>
              <span className="text-xs text-slate-700 font-mono font-bold">Revisión en vivo</span>
            </div>
            
            <div 
              ref={logsContainerRef}
              className="max-h-52 overflow-y-auto divide-y divide-slate-100 scrollbar-thin p-1 bg-white"
            >
              {progressLogs.length === 0 ? (
                <p className="text-sm text-slate-700 text-center py-10 font-semibold">Estableciendo comunicación con el servidor...</p>
              ) : (
                progressLogs.map((log, index) => {
                  const item = parseLogLine(log)
                  return (
                    <div key={index} className="flex items-start gap-3.5 p-3 hover:bg-surface-50/20 transition-colors animate-slide-up">
                      {/* Avatar / Icon */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold ${item.iconClass}`}>
                        <LogIcon type={item.iconType} className="w-4 h-4" />
                      </div>

                      {/* Title & Detail */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-extrabold text-slate-900 leading-none">{item.title}</p>
                          <span className={`badge text-xs font-bold px-2 py-0.5 rounded-md leading-none ${item.badgeClass}`}>
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-750 font-semibold mt-1 leading-relaxed break-words">{item.subtitle}</p>
                      </div>

                      {/* Time */}
                      <span className="text-xs text-slate-600 font-mono tabular-nums flex-shrink-0 pt-0.5">{item.time}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Resultado revisión ── */}
      {checkResult && !checking && (
        <div className={`card flex items-center justify-between gap-4 border shadow-sm animate-fade-in ${
          checkResult.error 
            ? 'border-red-200 bg-red-50 text-red-700' 
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}>
          {checkResult.error ? (
            <p className="text-sm text-red-750 font-medium flex items-center gap-2">
              <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Error al revisar los correos. Verifica la conexión IMAP.
            </p>
          ) : (
            <div className="flex items-center gap-5 text-sm flex-wrap">
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Revisión completada
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="font-semibold text-slate-800">{checkResult.importados}</span>
                <span className="text-slate-500 font-medium">importados</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-slate-300 rounded-full" />
                <span className="font-semibold text-slate-800">{checkResult.duplicados}</span>
                <span className="text-slate-500 font-medium">duplicados</span>
              </span>
              {checkResult.errores > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" />
                  <span className="text-red-650 font-semibold">{checkResult.errores} errores</span>
                </span>
              )}
            </div>
          )}
          <button onClick={() => setCheckResult(null)} className="text-slate-700 hover:text-slate-900 text-2xl leading-none flex-shrink-0 hover:scale-110 transition-transform duration-100 font-bold">×</button>
        </div>
      )}

      {/* ── CTA Banner de Análisis de Hojas de Vida con IA ── */}
      {st.cvs_pendientes_ia > 0 && (
        <div className="card relative overflow-hidden bg-gradient-to-r from-brand-500 to-indigo-700 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 animate-slide-up group">
          {/* Subtle animated background shapes */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
          <div className="absolute -bottom-10 left-1/3 w-40 h-40 bg-white/5 rounded-full blur-xl pointer-events-none" />
          
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 p-1">
            <div className="flex items-center gap-4 flex-col md:flex-row text-center md:text-left">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center flex-shrink-0 shadow-inner">
                <svg className="w-6 h-6 text-brand-300 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-base md:text-lg tracking-tight">¡Nuevas Hojas de Vida pendientes de análisis!</h4>
                <p className="text-xs md:text-sm text-indigo-100 font-medium mt-0.5">
                  Hay <span className="font-bold text-white bg-white/15 px-1.5 py-0.5 rounded mx-0.5">{st.cvs_pendientes_ia}</span> candidaturas importadas listas para ser evaluadas por el Agente de Inteligencia Artificial.
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => navigate('/postulaciones', { state: { autoStartEvaluation: true } })}
              className="bg-white hover:bg-indigo-50 text-indigo-700 text-sm font-bold py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all duration-150 whitespace-nowrap self-stretch md:self-auto"
            >
              <span>Iniciar análisis ahora</span>
              <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total postulaciones" value={st.total_postulaciones} sub={`+${st.este_mes ?? 0} este mes`}
          accent="bg-brand-500/10 text-brand-300 border border-brand-500/20"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          onClick={() => navigate('/postulaciones')}
        />
        <StatCard
          label="En revisión" value={st.en_revision} sub={`${st.recibidas ?? 0} sin revisar`}
          accent="bg-amber-500/10 text-amber-300 border border-amber-500/20"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          onClick={() => navigate('/postulaciones', { state: { filterEstado: 'en_revision' } })}
        />
        <StatCard
          label="Preseleccionados" value={st.preseleccionados}
          accent="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          onClick={() => navigate('/postulaciones', { state: { filterEstado: 'preseleccionado' } })}
        />
        <StatCard
          label="Evaluaciones IA" value={st.evaluaciones_ia} sub={`${st.cvs_pendientes_ia ?? 0} CVs pendientes`}
          accent="bg-violet-500/10 text-violet-300 border border-violet-500/20"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
          onClick={() => navigate('/postulaciones')}
        />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5" ref={chartRef}>
        <div className="card lg:col-span-3 flex flex-col justify-between bg-white border-slate-200 shadow-sm text-slate-800 min-h-[380px] p-6 rounded-2xl relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-surface-800">Postulaciones por cargo</h3>
                <p className="text-xs text-slate-750 font-semibold mt-0.5">Distribución y priorización de candidatos activos</p>
              </div>
              <span className="text-[10px] bg-brand-50 text-brand-700 font-extrabold px-2.5 py-0.5 rounded-full border border-brand-200/60 uppercase tracking-wider">
                Métricas de Obra
              </span>
            </div>

            {porCargoData.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
                {/* Visualizador de Cargos Interactivo Premium (3/5 width) */}
                <div className="md:col-span-3 space-y-3.5 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin">
                  {(() => {
                    const maxTotal = Math.max(...porCargoData.map(c => c.total), 1);
                    return porCargoData.map((entry, index) => {
                      const isSelected = activeCargo?.id === entry.id || hoveredCargo?.id === entry.id;
                      const percent = Math.min(100, Math.max(6, (entry.total / maxTotal) * 100));
                      
                      let solidBgClass = "bg-indigo-600";
                      
                      const nameLower = entry.name.toLowerCase();
                      if (nameLower.includes('residente')) {
                        solidBgClass = "bg-blue-600";
                      } else if (nameLower.includes('sst') || nameLower.includes('seguridad')) {
                        solidBgClass = "bg-emerald-600";
                      } else if (nameLower.includes('plomería') || nameLower.includes('plomeria')) {
                        solidBgClass = "bg-sky-600";
                      }

                      return (
                        <div
                          key={entry.id || index}
                          onMouseEnter={() => setHoveredCargo(entry)}
                          onMouseLeave={() => setHoveredCargo(null)}
                          onClick={() => setActiveCargo(entry)}
                          className={`group p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                            isSelected 
                              ? 'bg-slate-50 border-slate-350 shadow-sm translate-x-1' 
                              : 'bg-white border-slate-150 hover:bg-slate-50/40 hover:border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 mb-2.5">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-105 ${
                                isSelected ? 'bg-white border-slate-250 shadow-sm' : 'bg-slate-50 border-slate-100'
                              }`}>
                                {renderCargoIcon(entry.name, "w-5 h-5")}
                              </div>
                              <span className={`text-xs font-black truncate transition-colors duration-200 ${
                                isSelected ? 'text-slate-900 font-black' : 'text-slate-700'
                              }`}>
                                {entry.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-xs font-black text-slate-800">{entry.total}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Candidatos</span>
                            </div>
                          </div>
                          
                          <div className="relative h-3 bg-slate-100 rounded-full border border-slate-200/20 overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                            <div
                              className={`absolute top-0 bottom-0 left-0 rounded-full ${solidBgClass} transition-all duration-500 ease-out shadow-[0_1px_2px_rgba(0,0,0,0.1)]`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Auditor Detail Panel (2/5 width) */}
                <div className="md:col-span-2 flex flex-col justify-between min-h-[250px] bg-slate-50 border border-slate-200/60 rounded-2xl p-4 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)] transition-all duration-300">
                  {(() => {
                    const displayCargo = hoveredCargo || activeCargo || porCargoData[0];
                    if (!displayCargo) return null;
                    const config = getCargoChartColors(displayCargo.name);
                    return (
                      <>
                        <div className="space-y-3 flex-1 flex flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <span className={`badge text-[10px] font-bold px-2 py-0.5 rounded-md leading-none ${config.priorityCls}`}>
                              {config.priority}
                            </span>
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center flex-shrink-0">
                              {renderCargoIcon(displayCargo.name, "w-6 h-6")}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide leading-tight truncate" title={displayCargo.name}>
                              {displayCargo.name}
                            </h4>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-black text-slate-900 leading-none">{displayCargo.total}</span>
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Candidaturas</span>
                            </div>
                          </div>

                          <p className="text-xs text-slate-750 font-semibold mt-1 leading-relaxed flex-1">
                            {config.desc}
                          </p>
                        </div>

                        <button
                          onClick={() => navigate('/postulaciones', { state: { filterCargo: displayCargo.id } })}
                          className="w-full mt-3 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl text-white transition-all duration-200 hover:shadow-md active:scale-95 shadow-sm"
                          style={{ backgroundColor: config.solid }}
                        >
                          <span>Ver postulantes</span>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <p className="text-slate-650 text-sm font-semibold text-center py-12">Sin datos de postulaciones aún</p>
            )}
          </div>
        </div>

        <div className="card lg:col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-surface-800 mb-4 flex items-center justify-between">
              <span>Por estado</span>
              <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full border border-slate-200">
                Distribución
              </span>
            </h3>
            {estadosData.length > 0 ? (
              <div>
                <div className="relative flex justify-center items-center h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <linearGradient id="pieGrad_recibida" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#60a5fa" />
                          <stop offset="100%" stopColor="#2563eb" />
                        </linearGradient>
                        <linearGradient id="pieGrad_en_revision" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" />
                          <stop offset="100%" stopColor="#d97706" />
                        </linearGradient>
                        <linearGradient id="pieGrad_preseleccionado" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#34d399" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                        <linearGradient id="pieGrad_descartado" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#94a3b8" />
                          <stop offset="100%" stopColor="#475569" />
                        </linearGradient>
                        <linearGradient id="pieGrad_contratado" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#c084fc" />
                          <stop offset="100%" stopColor="#7c3aed" />
                        </linearGradient>
                      </defs>
                      <Pie 
                        data={estadosData} 
                        dataKey="value" 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={50} 
                        outerRadius={70}
                        paddingAngle={3}
                        cornerRadius={6}
                        style={{ cursor: 'pointer' }}
                        onClick={(entry) => {
                          const stateMap = {
                            'Recibidas': 'recibida',
                            'En revisión': 'en_revision',
                            'Preseleccionados': 'preseleccionado',
                            'Descartados': 'descartado',
                            'Contratados': 'contratado'
                          }
                          const mappedState = stateMap[entry.name]
                          if (mappedState) {
                            navigate('/postulaciones', { state: { filterEstado: mappedState } })
                          }
                        }}
                      >
                        {estadosData.map((d, i) => {
                          const stateKeys = {
                            'Recibidas': 'pieGrad_recibida',
                            'En revisión': 'pieGrad_en_revision',
                            'Preseleccionados': 'pieGrad_preseleccionado',
                            'Descartados': 'pieGrad_descartado',
                            'Contratados': 'pieGrad_contratado'
                          }
                          return <Cell key={i} fill={`url(#${stateKeys[d.name]})`} />
                        })}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#0f172a', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Central statistics value inside donut hole */}
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Total</span>
                    <span className="text-2xl font-black text-slate-900 leading-none">{totalEstados}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  {estadosData.map((d, i) => {
                    const stateMap = {
                      'Recibidas': 'recibida',
                      'En revisión': 'en_revision',
                      'Preseleccionados': 'preseleccionado',
                      'Descartados': 'descartado',
                      'Contratados': 'contratado'
                    }
                    const mappedState = stateMap[d.name]
                    const pct = totalEstados > 0 ? Math.round((d.value / totalEstados) * 100) : 0
                    
                    const badgeColors = {
                      'Recibidas': 'bg-blue-50/70 text-blue-700 hover:bg-blue-50 border border-blue-100 hover:border-blue-300',
                      'En revisión': 'bg-amber-50/70 text-amber-700 hover:bg-amber-50 border border-amber-100 hover:border-amber-300',
                      'Preseleccionados': 'bg-emerald-50/70 text-emerald-700 hover:bg-emerald-50 border border-emerald-100 hover:border-emerald-300',
                      'Descartados': 'bg-slate-50/70 text-slate-650 hover:bg-slate-50 border border-slate-150 hover:border-slate-300',
                      'Contratados': 'bg-violet-50/70 text-violet-750 hover:bg-violet-50 border border-violet-150 hover:border-violet-300'
                    }
                    
                    const dotColors = {
                      'Recibidas': '#2563eb',
                      'En revisión': '#d97706',
                      'Preseleccionados': '#059669',
                      'Descartados': '#475569',
                      'Contratados': '#7c3aed'
                    }
                    
                    return (
                      <div 
                        key={i} 
                        onClick={() => mappedState && navigate('/postulaciones', { state: { filterEstado: mappedState } })}
                        className={`flex flex-col justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] hover:shadow-md ${badgeColors[d.name] || 'bg-slate-50 text-slate-700 border border-slate-200'}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColors[d.name] }} />
                          <span className="font-extrabold text-[11px] truncate leading-none">{d.name}</span>
                        </div>
                        <div className="flex items-baseline justify-between mt-2.5">
                          <span className="text-base font-black leading-none">{d.value}</span>
                          <span className="text-[10px] font-bold opacity-80 leading-none">{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : <p className="text-slate-650 text-sm font-semibold text-center py-12">Sin datos</p>}
          </div>
        </div>
      </div>

      {/* ── Estado IA ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-slow" />
            <h3 className="text-sm font-semibold text-surface-800">Estado del Agente IA</h3>
          </div>
          <button onClick={() => navigate('/postulaciones')} className="btn-ghost text-sm font-extrabold text-brand-700">Ver candidatos →</button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'CVs pendientes', value: st.cvs_pendientes_ia, color: 'text-amber-700', bg: 'bg-amber-50 border border-amber-200 hover:border-amber-400/60 hover:bg-amber-100/30', onClick: () => navigate('/postulaciones', { state: { filterRecom: 'sin_evaluar' } }) },
            { label: 'CVs procesados', value: st.cvs_procesados,   color: 'text-emerald-700', bg: 'bg-emerald-50 border border-emerald-200 hover:border-emerald-400/60 hover:bg-emerald-100/30', onClick: () => navigate('/postulaciones') },
            { label: 'Evaluaciones',   value: st.evaluaciones_ia,  color: 'text-brand-700',   bg: 'bg-brand-55 border border-brand-200 hover:border-brand-400/60 hover:bg-brand-100/30', onClick: () => navigate('/postulaciones') },
          ].map((s, i) => (
            <div 
              key={i} 
              onClick={s.onClick}
              className={`${s.bg} rounded-xl p-4 text-center border cursor-pointer transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] hover:shadow-md`}
            >
              <p className={`text-2xl font-bold ${s.color}`}>{s.value ?? '—'}</p>
              <p className="text-xs text-slate-800 font-bold mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recientes ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-surface-800">Postulaciones recientes</h3>
          <button onClick={() => navigate('/postulaciones')} className="text-sm text-brand-600 hover:text-brand-700 font-bold">Ver todas →</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="text-left py-2 px-2 text-xs text-slate-750 font-bold uppercase tracking-wider">Candidato</th>
                <th className="text-left py-2 px-2 text-xs text-slate-750 font-bold uppercase tracking-wider">Cargo</th>
                <th className="text-left py-2 px-2 text-xs text-slate-750 font-bold uppercase tracking-wider">Estado</th>
                <th className="text-left py-2 px-2 text-xs text-slate-750 font-bold uppercase tracking-wider">Fuente</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recientes ?? []).map(p => (
                <tr 
                  key={p.id} 
                  onClick={() => setSelectedId(p.id)}
                  className="table-row cursor-pointer hover:bg-slate-50 transition-all duration-150 border-b border-surface-200"
                >
                  <td className="py-2.5 px-2">
                    <p className="font-medium text-surface-800">{p.nombre_completo}</p>
                    <p className="text-xs text-slate-700 font-semibold">{p.email}</p>
                  </td>
                  <td className="py-2.5 px-2 text-xs text-slate-850 font-semibold">
                    {p.perfil_cargo?.nombre ?? <span className="text-surface-450 italic">Sin asignar</span>}
                  </td>
                  <td className="py-2.5 px-2">
                    <span className={`badge ${statusCls[p.estado] || 'bg-slate-100 text-slate-750 border border-slate-200'}`}>
                      {(p.estado || '').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-2">
                    <span className="badge bg-slate-100 text-slate-750 border border-slate-200">{p.fuente}</span>
                  </td>
                </tr>
              ))}
              {!(data?.recientes ?? []).length && (
                <tr><td colSpan={4} className="py-8 text-center text-slate-600 font-semibold">No hay postulaciones aún</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedId && (
        <DetailDrawer
          postulacionId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={load}
        />
      )}
    </div>
  )
}
