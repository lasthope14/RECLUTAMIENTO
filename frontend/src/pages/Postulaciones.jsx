import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../services/api'
import DetailDrawer from '../components/DetailDrawer'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

/* ─── CONSTANTES Y DICCIONARIOS ── */
const ESTADOS = ['recibida', 'en_revision', 'preseleccionado', 'descartado', 'contratado']

const statusLabel = {
  recibida: 'Recibida', en_revision: 'En revisión',
  preseleccionado: 'Preseleccionado', descartado: 'Descartado', contratado: 'Contratado',
}
const statusCls = {
  recibida:        'status-recibida',
  en_revision:     'status-en_revision',
  preseleccionado: 'status-preseleccionado',
  descartado:      'status-descartado',
  contratado:      'status-contratado',
}
const recomLabel = {
  altamente_recomendado: 'Altamente Rec.',
  recomendado:           'Recomendado',
  con_reservas:          'Con reservas',
  no_recomendado:        'No recomendado',
}
const recomCls = {
  altamente_recomendado: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  recomendado:           'bg-blue-50 text-blue-700 border border-blue-200',
  con_reservas:          'bg-amber-50 text-amber-700 border border-amber-200',
  no_recomendado:        'bg-red-50 text-red-700 border border-red-200',
}

const KANBAN_COLS = [
  { id: 'recibida',        label: 'Recibidas',       dot: 'bg-blue-500' },
  { id: 'en_revision',     label: 'En revisión',      dot: 'bg-amber-500' },
  { id: 'preseleccionado', label: 'Preseleccionados', dot: 'bg-emerald-500' },
  { id: 'descartado',      label: 'Descartados',      dot: 'bg-red-500' },
  { id: 'contratado',      label: 'Contratados',      dot: 'bg-violet-500' },
]

/* ─── ICONOGRAFÍA VECTORIAL SVG PREMIUM ── */
function IconTime({ className = "w-3 h-3" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M12 21a9 9 0 100-18 9 9 0 000 18z" />
    </svg>
  )
}
function IconMapPin({ className = "w-3 h-3" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z" />
    </svg>
  )
}
function IconEducation({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.62 48.62 0 0112 20.9c2.785 0 5.5-.37 8.231-.108a60.43 60.43 0 00-.49-6.32M3.75 10.5l8.25-4.5 8.25 4.5M12 5.25L3.75 10.5 12 15.75l8.25-5.25L12 5.25z" />
    </svg>
  )
}
function IconBriefcase({ className = "w-3 h-3" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 .621-.504 1.125-1.125 1.125H4.875A1.125 1.125 0 013.75 18.4V14.15m16.5 0a9 9 0 00-16.5 0m16.5 0zM12 10.5h.008v.008H12V10.5zm0-3.75h.008v.008H12V6.75zM15 6.75a3 3 0 11-6 0h6z" />
    </svg>
  )
}
function IconCert({ className = "w-3 h-3" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
    </svg>
  )
}
function IconStar({ className = "w-3 h-3" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499c.195-.39.743-.39.938 0l2.25 4.563a1 1 0 00.758.552l5.031.73a.975.975 0 01.54 1.66l-3.64 3.548a1 1 0 00-.287.882l.86 5.011a.975.975 0 01-1.414 1.028l-4.5-2.366a1 1 0 00-.94 0l-4.5 2.366a.975.975 0 01-1.414-1.028l.86-5.011a1 1 0 00-.287-.882L5.29 10.98a.975.975 0 01.54-1.66l5.03-.73a1 1 0 00.758-.552l2.25-4.563z" />
    </svg>
  )
}
function IconCheck({ className = "w-3 h-3" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}
function IconAlert({ className = "w-3 h-3" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  )
}
function IconCross({ className = "w-3 h-3" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
function IconSearch({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}
function IconDoc({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}
function IconPhone({ className = "w-3 h-3" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.802-5.14-4.118-6.942-6.942l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  )
}
function IconMail({ className = "w-3 h-3" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}
function IconAI({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21m0 0l-.813-5.096M9 21h3.75m-6.75 0H3m16.5 0h-3.75m3.75 0l-.813-5.096M19.5 21H21M12 3v3.75m0-3.75a3.75 3.75 0 110 7.5 3.75 3.75 0 010-7.5zM9.75 8.25h4.5m-4.5 3.75h4.5M3 11.25a9 9 0 0118 0v3.75a9 9 0 01-18 0v-3.75z" />
    </svg>
  )
}
function IconProcessCV({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 13H8m3 4H8" />
      <circle cx="16" cy="16" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 18.5L22 22" />
    </svg>
  )
}

/* ─── Recommendation Badge Helper ─── */
function RecommendationBadge({ recommendation }) {
  if (!recommendation) return null
  const icons = {
    altamente_recomendado: <IconStar className="w-3 h-3 text-emerald-400" />,
    recomendado:           <IconCheck className="w-3 h-3 text-blue-400" />,
    con_reservas:          <IconAlert className="w-3 h-3 text-amber-400" />,
    no_recomendado:        <IconCross className="w-3 h-3 text-red-400" />,
  }
  return (
    <span className={`badge text-xs font-bold gap-1.5 px-3 py-1 border ${recomCls[recommendation] || ''}`}>
      {icons[recommendation]}
      <span>{recomLabel[recommendation]}</span>
    </span>
  )
}

/* ─── Score Ring SVG ────────────────────────────────────────────── */
function ScoreRing({ score, size = 52 }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  if (score == null) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="w-full h-full rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
          <span className="text-slate-700 text-sm font-bold">—</span>
        </div>
      </div>
    )
  }
  const v = Math.round(score)
  const pct = Math.min(v / 100, 1)
  
  const color = v >= 80 ? '#059669' : v >= 60 ? '#2563eb' : v >= 40 ? '#d97706' : '#dc2626'
  const bg    = v >= 80 ? '#d1fae5' : v >= 60 ? '#dbeafe' : v >= 40 ? '#fef3c7' : '#fee2e2'
  
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={3} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round" className="transition-all duration-700 ease-out" />
      </svg>
      <span className="absolute font-black tracking-tight" style={{ color, fontSize: size >= 64 ? '1.15rem' : size >= 52 ? '0.9rem' : '0.75rem' }}>{v}</span>
    </div>
  )
}

/* ─── Skills Polygon (Radar Chart SVG) ──────────────────────────── */
function RadarChart({ ev, size = 135 }) {
  if (!ev) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-2 h-[135px] w-[135px]">
        <IconAI className="w-6 h-6 text-slate-400 animate-pulse mb-1 shrink-0" />
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
          Sin Evaluar
        </span>
      </div>
    )
  }

  const eduVal = Number(ev.puntaje_educacion || 0)
  const expVal = Number(ev.puntaje_experiencia || 0)
  const habVal = Number(ev.puntaje_habilidades || 0)
  const gralVal = Number(ev.puntaje_perfil_general || 0)

  // Normalización según escalas máximas reales:
  // Educación: max 20
  // Experiencia: max 35
  // Habilidades: max 30
  // Perfil General: max 15
  const eduPct = Math.max(0, Math.min(100, (eduVal / 20) * 100))
  const expPct = Math.max(0, Math.min(100, (expVal / 35) * 100))
  const habPct = Math.max(0, Math.min(100, (habVal / 30) * 100))
  const gralPct = Math.max(0, Math.min(100, (gralVal / 15) * 100))

  const cx = size / 2
  const cy = size / 2
  const R = 42

  // Coordenadas basadas en cx, cy y radio R en porcentaje normalizado
  const p0 = { x: cx, y: cy - R * (eduPct / 100) }
  const p1 = { x: cx + R * (expPct / 100), y: cy }
  const p2 = { x: cx, y: cy + R * (habPct / 100) }
  const p3 = { x: cx - R * (gralPct / 100), y: cy }

  const pointsStr = `${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`

  return (
    <div className="relative radar-container flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="overflow-visible select-none">
        {/* Grids concéntricos (Rombos con fondo sutil) */}
        {[0.25, 0.5, 0.75, 1.0].map((scale, i) => {
          const r = R * scale
          return (
            <polygon
              key={i}
              points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="0.75"
              strokeDasharray={scale < 1.0 ? "2 2" : "none"}
            />
          )
        })}

        {/* Líneas de los ejes cardinales */}
        <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke="#cbd5e1" strokeWidth="0.75" strokeDasharray="1 1" />
        <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="#cbd5e1" strokeWidth="0.75" strokeDasharray="1 1" />

        {/* Polígono de puntuación de la IA relleno y vistoso */}
        <polygon
          points={pointsStr}
          fill="rgba(99, 102, 241, 0.22)"
          stroke="#4f46e5"
          strokeWidth="2.5"
          strokeLinejoin="round"
          className="radar-score-polygon origin-center"
        />

        {/* Vértices circulares resaltados */}
        <circle cx={p0.x} cy={p0.y} r="3.5" fill="#4f46e5" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx={p1.x} cy={p1.y} r="3.5" fill="#4f46e5" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx={p2.x} cy={p2.y} r="3.5" fill="#4f46e5" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx={p3.x} cy={p3.y} r="3.5" fill="#4f46e5" stroke="#ffffff" strokeWidth="1.5" />

        {/* Etiquetas de ejes bien legibles con puntajes reales */}
        <text x={cx} y={cy - R - 10} textAnchor="middle" dominantBaseline="central" className="text-[9.5px] font-black fill-slate-850 uppercase tracking-tight">
          EDU <tspan fill="#4f46e5" fontWeight="900">{eduVal}</tspan>
        </text>
        <text x={cx + R + 10} y={cy} textAnchor="start" dominantBaseline="central" className="text-[9.5px] font-black fill-slate-850 uppercase tracking-tight">
          EXP <tspan fill="#4f46e5" fontWeight="900">{expVal}</tspan>
        </text>
        <text x={cx} y={cy + R + 11} textAnchor="middle" dominantBaseline="central" className="text-[9.5px] font-black fill-slate-850 uppercase tracking-tight">
          HAB <tspan fill="#4f46e5" fontWeight="900">{habVal}</tspan>
        </text>
        <text x={cx - R - 10} y={cy} textAnchor="end" dominantBaseline="central" className="text-[9.5px] font-black fill-slate-850 uppercase tracking-tight">
          GRAL <tspan fill="#4f46e5" fontWeight="900">{gralVal}</tspan>
        </text>
      </svg>
    </div>
  )
}

function GridCard({ p, onOpen }) {
  const ev       = p.candidato?.evaluaciones?.[0]
  const parseo   = p.candidato?.estado_parseo
  const educacion = p.candidato?.datos_extraidos?.educacion || []
  const ultimoTitulo = educacion[0]?.titulo

  const scoreBorder = (ev?.puntaje_total ?? 0) >= 80 
    ? 'border-emerald-250 hover:border-emerald-400' 
    : (ev?.puntaje_total ?? 0) >= 60 
    ? 'border-brand-200 hover:border-brand-400' 
    : (ev?.puntaje_total ?? 0) >= 40 
    ? 'border-amber-250 hover:border-amber-400' 
    : ev 
    ? 'border-red-200 hover:border-red-400' 
    : 'border-slate-200 hover:border-slate-350'

  return (
    <div
      onClick={() => onOpen(p.id)}
      className={`group relative bg-white rounded-3xl border-2 ${scoreBorder} p-5 cursor-pointer
        shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 ease-out
        flex flex-row gap-4 min-h-[220px] candidate-card overflow-hidden`}
    >
      {/* Left Column: Candidate Main Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
        <div className="space-y-3">
          {/* Nombre y Profesión */}
          <div className="space-y-1">
            <h3 className="font-black text-slate-950 text-[20px] leading-snug tracking-tight group-hover:text-brand-650 transition-colors uppercase truncate" title={p.nombre_completo}>
              {p.nombre_completo}
            </h3>
            <div className="flex items-center gap-1.5 text-slate-900 font-extrabold tracking-wide">
              <IconBriefcase className="w-4 h-4 text-brand-600 shrink-0" />
              <span className="text-[14px] truncate">
                {p.perfil_cargo ? p.perfil_cargo.nombre : 'Sin cargo postulado'}
              </span>
            </div>
          </div>

          {/* Contacto: Email & Teléfono */}
          <div className="space-y-1 text-[13.5px] text-slate-900 font-bold">
            <div className="flex items-center gap-1.5 truncate">
              <IconMail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate" title={p.email}>{p.email || 'Sin correo'}</span>
            </div>
            {p.telefono && (
              <div className="flex items-center gap-1.5 truncate">
                <IconPhone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">{p.telefono}</span>
              </div>
            )}
          </div>
        </div>

        {/* Estudios Principales */}
        <div className="space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
            Estudios principales
          </span>
          {ultimoTitulo ? (
            <div className="inline-flex items-center gap-1.5 text-[13.5px] text-purple-950 font-extrabold bg-purple-50/50 px-2 py-1 rounded-lg border border-purple-100 max-w-full">
              <IconEducation className="w-4 h-4 text-purple-650 shrink-0 mt-0.5" />
              <span className="truncate leading-tight" title={ultimoTitulo}>{ultimoTitulo}</span>
            </div>
          ) : (
            <span className="text-[13px] font-semibold text-slate-400 italic">No especificado</span>
          )}
        </div>

        {/* Badges de estado en el pie del bloque */}
        <div className="flex flex-wrap items-center gap-1 pt-2 border-t border-slate-100">
          <span className={`badge text-[10px] font-black px-2 py-0.5 rounded-md ${statusCls[p.estado] || ''} uppercase`}>
            {statusLabel[p.estado] || p.estado}
          </span>
          {ev && <RecommendationBadge recommendation={ev.recomendacion} />}
          {!ev && parseo === 'procesado' && (
            <span className="badge bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-black gap-1 px-2 py-0.5 rounded-md uppercase">
              <IconTime className="w-3 h-3 text-amber-800" />
              <span>Pendiente evaluar</span>
            </span>
          )}
          {!ev && parseo === 'procesando' && (
            <span className="badge bg-purple-50 text-purple-900 border border-purple-200 text-[10px] font-black gap-1 px-2 py-0.5 rounded-md uppercase">
              <svg className="animate-spin w-3 h-3 text-purple-650" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              <span>Analizando...</span>
            </span>
          )}
          {(!parseo || parseo === 'pendiente') && p.archivo_cv && (
            <span className="badge bg-slate-50 border border-slate-200 text-slate-800 text-[10px] font-black gap-1 px-2 py-0.5 rounded-md uppercase">
              <IconDoc className="w-3 h-3 text-slate-500" />
              <span>Sin analizar</span>
            </span>
          )}
        </div>
      </div>

      {/* Right Column: AI ScoreRing and Skills Polygon */}
      <div className="w-[156px] shrink-0 flex flex-col items-center justify-center pl-3 border-l border-slate-100/80 gap-2 select-none">
        {/* Prominent Score Ring */}
        <div className="flex flex-col items-center bg-slate-50/50 p-1.5 rounded-2xl border border-slate-100">
          <ScoreRing score={ev?.puntaje_total} size={50} />
          {ev && (
            <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Puntaje IA
            </span>
          )}
        </div>

        {/* Dynamic skills polygon */}
        <RadarChart ev={ev} size={135} />
      </div>

      {/* Hover visual shine */}
      <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
           style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.03), rgba(16,185,129,0.03))' }} />
    </div>
  )
}

/* ─── Vista Cuadrícula ─────────────────────────────────────────── */
function GridView({ items, onOpen }) {
  if (items.length === 0) {
    return (
      <div className="card text-center py-16 text-surface-550">
        <svg className="w-12 h-12 mx-auto mb-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="font-semibold text-surface-700">Sin candidatos que coincidan</p>
        <p className="text-xs text-surface-500 mt-1">Ajusta los filtros para ver más resultados.</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 animate-slide-up">
      {items.map(p => <GridCard key={p.id} p={p} onOpen={onOpen} />)}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   Página principal — Candidatos (unificada)
   ══════════════════════════════════════════════════════════════════ */
export default function Postulaciones() {
  const location = useLocation()
  const navigate = useNavigate()

  const [postulaciones, setPostulaciones] = useState([])
  const containerRef = useRef(null)
  const [perfiles, setPerfiles]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [selectedId, setSelectedId]       = useState(null)
  const [evaluando, setEvaluando]         = useState(false)
  const [evalMsg, setEvalMsg]             = useState('')
  const [exportando, setExportando]       = useState(false)

  // Modal de progreso de evaluación por IA
  const [evalModalOpen, setEvalModalOpen] = useState(false)
  const [evalTotal, setEvalTotal] = useState(0)
  const [evalCurrent, setEvalCurrent] = useState(0)
  const [evalActiveName, setEvalActiveName] = useState('')
  const [evalList, setEvalList] = useState([])
  const [evalFinishing, setEvalFinishing] = useState(false)
  const [evalErrorGeneral, setEvalErrorGeneral] = useState('')

  const exportarExcel = async () => {
    setExportando(true)
    try {
      const response = await api.get('/postulaciones/exportar', {
        responseType: 'blob'
      })
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'Reporte_Candidatos_Hidroobras.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error al exportar reporte:', err)
      alert('Error al exportar reporte')
    } finally {
      setExportando(false)
    }
  }

  /* Filtros */
  const [search, setSearch]           = useState('')
  const [filterCargo, setFilterCargo] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterRecom, setFilterRecom] = useState('')
  const [filterExp, setFilterExp]     = useState('')
  const [sortBy, setSortBy]           = useState('score_desc')

  // Obtener únicamente los cargos que actualmente tienen postulaciones para el filtro de cargos
  const cargosConPostulaciones = useMemo(() => {
    const idsConPostulacion = new Set(postulaciones.map(p => p.perfil_cargo_id).filter(Boolean))
    return perfiles.filter(p => idsConPostulacion.has(p.id))
  }, [postulaciones, perfiles])

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    try {
      const [pRes, prRes] = await Promise.all([
        api.get('/postulaciones', { params: { per_page: 500 } }),
        api.get('/perfiles-cargo'),
      ])
      const lista = Array.isArray(pRes.data) ? pRes.data : (pRes.data.data ?? [])
      setPostulaciones(lista)
      setPerfiles(prRes.data)
    } finally {
      if (!isSilent) setLoading(false)
    }
  }, [])

  /* Estadísticas globales */
  const stats = useMemo(() => {
    const total      = postulaciones.length
    const conCv      = postulaciones.filter(p => p.archivo_cv).length
    const analizados = postulaciones.filter(p => p.candidato?.estado_parseo === 'procesado').length
    const evaluados  = postulaciones.filter(p => (p.candidato?.evaluaciones?.length ?? 0) > 0).length
    
    const pendientes = postulaciones.filter(p => 
      p.archivo_cv && 
      p.candidato?.estado_parseo === 'procesado' && 
      !(p.candidato?.evaluaciones?.length > 0)
    ).length

    const sinCargo = postulaciones.filter(p =>
      p.archivo_cv &&
      p.candidato?.estado_parseo === 'procesado' &&
      !p.perfil_cargo_id &&
      !(p.candidato?.evaluaciones?.length > 0)
    ).length

    const pendientesAnalisis = postulaciones.filter(p =>
      p.archivo_cv &&
      (!p.candidato || p.candidato.estado_parseo !== 'procesado')
    ).length

    const scores     = postulaciones
      .map(p => p.candidato?.evaluaciones?.[0]?.puntaje_total)
      .filter(v => v != null)
      .map(v => Number(v))
      .filter(v => !isNaN(v))
    const avgScore   = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
    return { total, conCv, analizados, evaluados, pendientes, sinCargo, pendientesAnalisis, avgScore }
  }, [postulaciones])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Polling automático silencioso en segundo plano si hay análisis de CV en proceso
  useEffect(() => {
    const hayAnalisis = postulaciones.some(p => p.candidato?.estado_parseo === 'procesando')
    if (!hayAnalisis) return

    const timer = setInterval(() => {
      fetchData(true)
    }, 6000)

    return () => clearInterval(timer)
  }, [fetchData, postulaciones])

  const evaluarPendientes = async () => {
    setEvaluando(true)
    setEvalModalOpen(true)
    setEvalFinishing(false)
    setEvalErrorGeneral('')
    setEvalList([])
    setEvalCurrent(0)
    setEvalTotal(0)
    setEvalActiveName('')
    setEvalMsg('')

    try {
      const { data: listaPendientes } = await api.get('/evaluaciones/pendientes')
      
      if (listaPendientes.length === 0) {
        setEvalModalOpen(false)
        setEvaluando(false)
        setEvalMsg('✅ No hay candidatos pendientes con cargo asignado para evaluar.')
        return
      }

      setEvalTotal(listaPendientes.length)

      for (let i = 0; i < listaPendientes.length; i++) {
        const item = listaPendientes[i]
        setEvalCurrent(i + 1)
        setEvalActiveName(item.nombre_completo)
        
        try {
          await api.post('/evaluaciones/evaluar-uno', {
            candidato_id: item.candidato_id,
            perfil_cargo_id: item.perfil_cargo_id
          })
          
          const cargoNombre = perfiles.find(p => p.id === item.perfil_cargo_id)?.nombre || 'Cargo Asignado'
          
          setEvalList(prev => [...prev, {
            nombre_completo: item.nombre_completo,
            cargo: cargoNombre,
            status: 'success'
          }])
          
          await fetchData(true)
        } catch (err) {
          console.error(`Error evaluando a ${item.nombre_completo}:`, err)
          const cargoNombre = perfiles.find(p => p.id === item.perfil_cargo_id)?.nombre || 'Cargo Asignado'
          
          setEvalList(prev => [...prev, {
            nombre_completo: item.nombre_completo,
            cargo: cargoNombre,
            status: 'error',
            error: err.response?.data?.message || err.message || 'Error en servidor'
          }])
        }
      }

      setEvalFinishing(true)
    } catch (err) {
      console.error(err)
      setEvalErrorGeneral(err.response?.data?.message || err.message || 'Error al procesar el lote de evaluaciones')
      setEvalFinishing(true)
    } finally {
      setEvaluando(false)
    }
  }

  const analizarCvsPendientes = async () => {
    setEvaluando(true)
    setEvalModalOpen(true)
    setEvalFinishing(false)
    setEvalErrorGeneral('')
    setEvalList([])
    setEvalCurrent(0)
    setEvalTotal(0)
    setEvalActiveName('')
    setEvalMsg('')

    const listaPendientes = postulaciones.filter(p =>
      p.archivo_cv &&
      (!p.candidato || p.candidato.estado_parseo !== 'procesado')
    )

    if (listaPendientes.length === 0) {
      setEvalModalOpen(false)
      setEvaluando(false)
      setEvalMsg('✅ No hay hojas de vida pendientes para analizar con IA.')
      return
    }

    setEvalTotal(listaPendientes.length)

    try {
      for (let i = 0; i < listaPendientes.length; i++) {
        const item = listaPendientes[i]
        setEvalCurrent(i + 1)
        setEvalActiveName(item.nombre_completo || 'Candidato sin nombre')

        try {
          const response = await api.post(`/postulaciones/${item.id}/ia-sync`)
          const cargoNombre = response.data?.postulacion?.perfil_cargo?.nombre || 'Sin asignar / No operativo'

          setEvalList(prev => [...prev, {
            nombre_completo: item.nombre_completo || 'Sin nombre',
            cargo: cargoNombre,
            status: 'success'
          }])

          await fetchData(true)
        } catch (err) {
          console.error(`Error analizando CV de ${item.nombre_completo}:`, err)
          setEvalList(prev => [...prev, {
            nombre_completo: item.nombre_completo || 'Sin nombre',
            cargo: 'Error al analizar',
            status: 'error',
            error: err.response?.data?.message || err.message || 'Error en servidor'
          }])
        }
      }

      setEvalFinishing(true)
    } catch (err) {
      console.error(err)
      setEvalErrorGeneral(err.response?.data?.message || err.message || 'Error al procesar el lote de análisis')
      setEvalFinishing(true)
    } finally {
      setEvaluando(false)
    }
  }

  useEffect(() => {
    let stateChanged = false
    let newState = { ...location.state }

    if (location.state?.filterEstado !== undefined) {
      setFilterEstado(location.state.filterEstado)
      delete newState.filterEstado
      stateChanged = true
    }
    if (location.state?.filterCargo !== undefined) {
      setFilterCargo(String(location.state.filterCargo))
      delete newState.filterCargo
      stateChanged = true
    }
    if (location.state?.filterRecom !== undefined) {
      setFilterRecom(location.state.filterRecom)
      delete newState.filterRecom
      stateChanged = true
    }
    if (location.state?.autoStartEvaluation) {
      evaluarPendientes()
      delete newState.autoStartEvaluation
      stateChanged = true
    }

    if (stateChanged) {
      navigate('/postulaciones', { replace: true, state: newState })
    }
  }, [location.state, navigate])

  /* Filtrado + ordenamiento (client-side) */
  const filtered = useMemo(() => {
    let list = postulaciones

    if (search) {
      const s = search.toLowerCase().trim()
      list = list.filter(p => {
        const nombre = p.nombre_completo?.toLowerCase() || ''
        const email = p.email?.toLowerCase() || ''
        
        const datos = p.candidato?.datos_extraidos || {}
        const habTecnicas = Array.isArray(datos.habilidades_tecnicas) 
          ? datos.habilidades_tecnicas.some(h => h.toLowerCase().includes(s)) 
          : false
        const habBlandas = Array.isArray(datos.habilidades_blandas) 
          ? datos.habilidades_blandas.some(h => h.toLowerCase().includes(s)) 
          : false
        const certs = Array.isArray(datos.certificaciones) 
          ? datos.certificaciones.some(c => c.toLowerCase().includes(s)) 
          : false
        
        const resumen = (p.candidato?.resumen_ia || datos.resumen_profesional || '').toLowerCase()
        const matchResumen = resumen.includes(s)

        return nombre.includes(s) || 
               email.includes(s) || 
               habTecnicas || 
               habBlandas || 
               certs || 
               matchResumen
      })
    }
    if (filterCargo)  list = list.filter(p => String(p.perfil_cargo_id) === filterCargo)
    if (filterEstado) list = list.filter(p => p.estado === filterEstado)
    if (filterRecom) {
      if (filterRecom === 'sin_evaluar') {
        list = list.filter(p => !(p.candidato?.evaluaciones?.length))
      } else {
        list = list.filter(p => p.candidato?.evaluaciones?.[0]?.recomendacion === filterRecom)
      }
    }
    if (filterExp) {
      list = list.filter(p => {
        const anios = p.candidato?.datos_extraidos?.años_experiencia_total
        if (anios == null || anios === undefined) return false
        const val = Number(anios)
        switch (filterExp) {
          case 'sin_experiencia':
            return val < 1
          case '1_2_anos':
            return val >= 1 && val <= 2
          case '3_5_anos':
            return val >= 3 && val <= 5
          case 'mas_5_anos':
            return val > 5
          default:
            return true
        }
      })
    }

    return [...list].sort((a, b) => {
      const aScore = a.candidato?.evaluaciones?.[0]?.puntaje_total ?? -1
      const bScore = b.candidato?.evaluaciones?.[0]?.puntaje_total ?? -1
      const aDate  = new Date(a.fecha_recepcion || a.created_at)
      const bDate  = new Date(b.fecha_recepcion || b.created_at)
      switch (sortBy) {
        case 'score_desc': return bScore - aScore
        case 'score_asc':  return aScore - bScore
        case 'fecha_desc': return bDate - aDate
        case 'fecha_asc':  return aDate - bDate
        case 'nombre':     return (a.nombre_completo || '').localeCompare(b.nombre_completo || '')
        default:           return 0
      }
    })
  }, [postulaciones, search, filterCargo, filterEstado, filterRecom, filterExp, sortBy])



  // --- ANIMACIONES GSAP PREMIUM ---
  useGSAP(() => {
    // 1. Animación de conteo ascendente (count-up) para los valores numéricos de estadísticas
    gsap.fromTo('.stat-val-num',
      { textContent: 0 },
      {
        textContent: (i, el) => {
          const val = el.getAttribute('data-target')
          return val === '—' ? 0 : val
        },
        duration: 1.2,
        ease: 'power2.out',
        snap: { textContent: 1 },
        stagger: 0.08,
        onUpdate: function() {
          this.targets().forEach(el => {
            const target = el.getAttribute('data-target')
            if (target === '—' && el.textContent == '0') {
              el.textContent = '—'
            }
          })
        }
      }
    )
  }, { scope: containerRef, dependencies: [loading] })

  useGSAP(() => {
    if (!loading && filtered.length > 0) {
      // 2. Animación de entrada con stagger para las tarjetas de candidatos
      gsap.fromTo('.candidate-card',
        { opacity: 0, y: 35 },
        { 
          opacity: 1, 
          y: 0, 
          duration: 0.6, 
          ease: 'power3.out', 
          stagger: 0.04 
        }
      )

      // 3. Animación de rebote (bounce-in) para los polígonos de habilidades IA
      gsap.fromTo('.radar-score-polygon',
        { scale: 0, transformOrigin: 'center center' },
        { 
          scale: 1, 
          duration: 0.8, 
          ease: 'back.out(1.6)', 
          delay: 0.15,
          stagger: 0.04 
        }
      )
    }
  }, { scope: containerRef, dependencies: [loading, filtered] })

  const hasFilters = search || filterCargo || filterEstado || filterRecom || filterExp
  const clearFilters = () => { setSearch(''); setFilterCargo(''); setFilterEstado(''); setFilterRecom(''); setFilterExp('') }

  return (
    <div ref={containerRef} className="space-y-6 animate-fade-in text-surface-700">

      {/* ── Encabezado ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="section-title">Candidatos</h1>
          <p className="section-sub">
            {stats.total} postulaciones · {stats.analizados} analidadas · {stats.evaluadas ?? stats.evaluados} evaluadas por IA
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {stats.pendientesAnalisis > 0 && (
            <button onClick={analizarCvsPendientes} disabled={evaluando} className="btn-primary text-sm font-bold gap-1.5 bg-brand-500 hover:bg-brand-600 text-white shadow-sm !py-2.5 !px-5">
              {evaluando
                ? <><svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Procesando...</>
                : <><IconProcessCV className="w-3.5 h-3.5 text-white animate-pulse-slow" /><span>Procesar CVs pendientes</span></>
              }
              <span className="bg-white/10 text-white text-xs font-extrabold px-2.5 py-0.5 rounded-full leading-none">
                {stats.pendientesAnalisis}
              </span>
            </button>
          )}

          {stats.pendientes - stats.sinCargo > 0 && (
            <button onClick={evaluarPendientes} disabled={evaluando} className="btn-secondary text-sm font-extrabold gap-1.5 bg-brand-50 hover:bg-brand-100 text-brand-750 border border-brand-300 !py-2.5 !px-5">
              {evaluando
                ? <><svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Evaluando...</>
                : <><IconAI className="w-3.5 h-3.5 text-brand-700 animate-pulse-slow" /><span>Evaluar pendientes</span></>
              }
              <span className="bg-brand-600 text-white text-xs font-extrabold px-2.5 py-0.5 rounded-full leading-none">
                {stats.pendientes - stats.sinCargo}
              </span>
            </button>
          )}

          {/* Botón exportar Excel */}
          <button
            onClick={exportarExcel}
            disabled={exportando}
            className="px-4 py-2 flex items-center gap-1.5 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-sm border border-emerald-300 shadow-sm disabled:opacity-50 transition-all duration-150 cursor-pointer"
          >
            {exportando ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span>Exportando...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <span>Exportar Excel</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mensaje de evaluación */}
      {evalMsg && (
        <div className={`text-sm font-bold px-5 py-3.5 rounded-2xl border ${evalMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-800 border border-emerald-250' : 'bg-red-50 text-red-800 border border-red-250'}`}>
          {evalMsg}
          {evalMsg.startsWith('✅') && <span className="ml-2 text-emerald-700 font-medium">Los resultados aparecerán en unos minutos — recarga para ver los cambios.</span>}
        </div>
      )}

      {/* ── Strip de estadísticas ── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { l: 'Total',        v: stats.total,      c: 'text-surface-900',     border: 'border-surface-200 bg-white' },
          { l: 'Con CV',       v: stats.conCv,      c: 'text-brand-600',       border: 'border-brand-100 bg-brand-50/20' },
          { l: 'Analizados',   v: stats.analizados, c: 'text-violet-600',      border: 'border-violet-100 bg-violet-50/20' },
          { l: 'Evaluados IA', v: stats.evaluados,  c: 'text-emerald-600',     border: 'border-emerald-100 bg-emerald-50/20' },
          { l: 'Sin evaluar',  v: stats.pendientes, c: stats.pendientes > 0 ? 'text-amber-800' : 'text-surface-400', border: stats.pendientes > 0 ? 'border-amber-100 bg-amber-50/20' : 'border-surface-200 bg-white' },
          { l: 'Score prom.',  v: stats.avgScore != null ? stats.avgScore : '—', c: (stats.avgScore ?? 0) >= 70 ? 'text-emerald-600' : (stats.avgScore ?? 0) >= 50 ? 'text-brand-600' : 'text-amber-800', border: 'border-surface-200 bg-white' },
        ].map((s, i) => (
          <div key={i} className={`border ${s.border} rounded-2xl p-4 text-center transition-all hover:-translate-y-0.5 duration-200 shadow-sm stat-box`}>
            <p className={`text-2xl font-bold ${s.c} tabular-nums stat-val-num`} data-target={s.v}>{s.v}</p>
            <p className="text-xs text-slate-800 font-bold mt-1 uppercase tracking-wider">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Banner de advertencia si hay candidatos analizados sin perfil de cargo asignado */}
      {stats.sinCargo > 0 && (
        <div className="bg-amber-50 border border-amber-250 text-amber-900 rounded-2xl p-4 flex items-start gap-3 shadow-sm animate-fade-in font-bold text-sm">
          <span className="text-xl leading-none mt-0.5">⚠️</span>
          <div>
            <p className="font-extrabold text-amber-950">Tienes {stats.sinCargo} candidato{stats.sinCargo > 1 ? 's' : ''} analizado{stats.sinCargo > 1 ? 's' : ''} sin perfil de cargo asignado</p>
            <p className="font-semibold text-xs text-amber-800 mt-1 leading-relaxed">
              La Inteligencia Artificial requiere que un candidato tenga un perfil de cargo asignado para poder evaluar su nivel de coincidencia. Puedes hacer clic en un candidato y asignarle un cargo para iniciar su evaluación.
            </p>
          </div>
        </div>
      )}

      {/* ── Barra de filtros ── */}
      <div className="bg-white border border-surface-200 rounded-2xl p-3 flex items-center gap-3 flex-wrap shadow-sm">
        {/* Búsqueda */}
        <div className="flex-1 min-w-40 relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            className="input !pl-9 !py-2.5 text-sm font-bold"
            placeholder="Buscar por nombre, email, habilidades, certificaciones..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="select !py-2 text-sm font-semibold" style={{ width: 'auto' }} value={filterCargo} onChange={e => setFilterCargo(e.target.value)}>
          <option value="">Todos los cargos</option>
          {cargosConPostulaciones.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>

        <select className="select !py-2 text-sm font-semibold" style={{ width: 'auto' }} value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{statusLabel[e]}</option>)}
        </select>

        <select className="select !py-2 text-sm font-semibold" style={{ width: 'auto' }} value={filterRecom} onChange={e => setFilterRecom(e.target.value)}>
          <option value="">Todas las recom.</option>
          <option value="altamente_recomendado">★ Altamente recom.</option>
          <option value="recomendado">✓ Recomendado</option>
          <option value="con_reservas">⚠ Con reservas</option>
          <option value="no_recomendado">✗ No recomendado</option>
          <option value="sin_evaluar">○ Sin evaluar</option>
        </select>

        <select className="select !py-2 text-sm font-semibold" style={{ width: 'auto' }} value={filterExp} onChange={e => setFilterExp(e.target.value)}>
          <option value="">Cualquier experiencia</option>
          <option value="sin_experiencia">Sin experiencia / &lt; 1 año</option>
          <option value="1_2_anos">1 a 2 años</option>
          <option value="3_5_anos">3 a 5 años</option>
          <option value="mas_5_anos">Más de 5 años</option>
        </select>

        <select className="select !py-2 text-sm font-semibold" style={{ width: 'auto' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="score_desc">↓ Mayor score</option>
          <option value="score_asc">↑ Menor score</option>
          <option value="fecha_desc">📅 Más reciente</option>
          <option value="fecha_asc">📅 Más antiguo</option>
          <option value="nombre">A–Z Nombre</option>
        </select>

        {hasFilters && (
          <button onClick={clearFilters} className="btn-secondary !py-2 text-sm font-bold !px-3.5 hover:bg-slate-50 transition-colors">
            ✕ Limpiar
          </button>
        )}

        <span className="text-sm text-slate-800 ml-auto font-bold tabular-nums">
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Contenido principal ── */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3 text-slate-750 font-bold">
            <svg className="animate-spin w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-medium">Cargando candidatos...</p>
          </div>
        </div>
      ) : (
        <GridView items={filtered} onOpen={setSelectedId} />
      )}

      {selectedId && (
        <DetailDrawer
          postulacionId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={fetchData}
        />
      )}

      <EvaluationProgressModal
        isOpen={evalModalOpen}
        total={evalTotal}
        current={evalCurrent}
        activeName={evalActiveName}
        list={evalList}
        isFinishing={evalFinishing}
        errorGeneral={evalErrorGeneral}
        onClose={() => {
          setEvalModalOpen(false)
          fetchData()
        }}
      />
    </div>
  )
}

function EvaluationProgressModal({ isOpen, total, current, activeName, list, isFinishing, errorGeneral, onClose }) {
  if (!isOpen) return null

  const pct = total > 0 ? Math.round((list.length / total) * 100) : 0
  const successCount = list.filter(item => item.status === 'success').length
  const errorCount = list.filter(item => item.status === 'error').length

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl border border-surface-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] animate-scale-up text-surface-700">
        {/* Accent Bar */}
        <div className={`h-1 w-full bg-gradient-to-r ${isFinishing ? 'from-emerald-500 to-teal-500' : 'from-brand-500 to-brand-600'}`} />

        {/* Header */}
        <div className="p-5 border-b border-surface-200 flex items-center gap-3 bg-slate-50/50">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center text-xl shadow-inner animate-pulse-slow">
            <IconAI className="w-5 h-5 text-purple-650" />
          </div>
          <div>
            <h3 className="font-bold text-sm md:text-base text-surface-900">Evaluación de Candidatos con Gemini IA</h3>
            <p className="text-xs text-surface-500 mt-0.5">
              {isFinishing ? 'Proceso completado' : 'Analizando hojas de vida de forma secuencial'}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          {errorGeneral && (
            <div className="p-4 bg-red-50 text-red-800 border border-red-250 rounded-xl text-sm flex items-start gap-2.5 font-medium">
              <IconCross className="w-4 h-4 text-red-650 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Ocurrió un error crítico</p>
                <p className="mt-0.5 text-slate-600">{errorGeneral}</p>
              </div>
            </div>
          )}

          {!isFinishing && !errorGeneral && (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              {/* Premium Rotating Spinner */}
              <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-purple-100" />
                <div className="absolute inset-0 rounded-full border-4 border-purple-600 border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-purple-600 tabular-nums">
                  {pct}%
                </div>
              </div>
              <p className="text-sm font-semibold text-surface-900">
                {activeName ? `Evaluando: ${activeName}` : 'Iniciando agente evaluador...'}
              </p>
              <p className="text-xs text-surface-500 mt-1">
                Procesando candidato {current} de {total}
              </p>
            </div>
          )}

          {isFinishing && (
            <div className="flex flex-col items-center justify-center py-5 text-center bg-emerald-50 rounded-2xl border border-emerald-250 p-4 animate-scale-up">
              <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center text-xl font-bold mb-3 shadow-inner">
                ✓
              </div>
              <p className="text-base font-bold text-emerald-800">¡Evaluación Finalizada!</p>
              <p className="text-xs text-surface-500 mt-1">
                Se han procesado correctamente todas las postulaciones pendientes.
              </p>
              <div className="flex items-center gap-4 mt-4 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-750 bg-emerald-100/55 px-2.5 py-0.5 rounded-lg border border-emerald-200 font-semibold">
                  <span>{successCount}</span> evaluados
                </span>
                {errorCount > 0 && (
                  <span className="flex items-center gap-1.5 text-red-750 bg-red-100/55 px-2.5 py-0.5 rounded-lg border border-red-200 font-semibold">
                    <span>{errorCount}</span> fallidos
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {!errorGeneral && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                <span>Progreso General</span>
                <span className="font-mono text-surface-900">{pct}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-purple-500 to-brand-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Checklist Area */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Historial de Evaluación</h4>
            <div className="border border-surface-200 rounded-xl max-h-48 overflow-y-auto p-2 bg-slate-50/50 divide-y divide-surface-200 scrollbar-thin">
              {list.length === 0 ? (
                <p className="text-sm text-slate-650 text-center py-8 font-semibold">Los candidatos evaluados aparecerán aquí...</p>
              ) : (
                list.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-3 px-2 text-sm font-semibold gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-surface-900 truncate">{item.nombre_completo}</p>
                      <p className="text-xs text-slate-800 font-bold truncate mt-0.5">Cargo: {item.cargo}</p>
                    </div>
                    {item.status === 'success' ? (
                      <span className="badge bg-emerald-50 text-emerald-800 border border-emerald-250 text-xs font-bold flex items-center gap-1.5 px-2.5 py-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Evaluado</span>
                      </span>
                    ) : (
                      <span
                        className="badge bg-red-50 text-red-800 border border-red-250 text-xs font-bold flex items-center gap-1.5 px-2.5 py-1 cursor-help"
                        title={item.error}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span>Error</span>
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-200 bg-slate-50/50 flex items-center justify-between">
          {!isFinishing && !errorGeneral ? (
            <p className="text-xs text-slate-850 font-bold flex items-center gap-1">
              <span className="animate-ping w-1.5 h-1.5 rounded-full bg-[#2563eb] mr-1" />
              Por favor, no recargue ni cierre esta pestaña.
            </p>
          ) : (
            <div className="w-full flex justify-end">
              <button
                onClick={onClose}
                className="btn-primary w-full sm:w-auto text-sm py-2.5 px-6 font-bold rounded-xl bg-brand-500 hover:bg-brand-600 text-white shadow-sm"
              >
                Cerrar y Ver Resultados
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
