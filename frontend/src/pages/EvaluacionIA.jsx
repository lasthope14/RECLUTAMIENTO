import { useEffect, useState } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'
import api from '../services/api'
import DetailDrawer from '../components/DetailDrawer'

const recoColor = {
  altamente_recomendado: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300',
  recomendado:           'bg-blue-50 text-blue-700 ring-1 ring-blue-300',
  con_reservas:          'bg-amber-50 text-amber-700 ring-1 ring-amber-300',
  no_recomendado:        'bg-red-50 text-red-600 ring-1 ring-red-300',
}
const recoLabel = {
  altamente_recomendado: '★ Altamente recomendado',
  recomendado:           '✓ Recomendado',
  con_reservas:          '⚠ Con reservas',
  no_recomendado:        '✗ No recomendado',
}

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

function ScoreRing({ score }) {
  const r = 36, c = 2 * Math.PI * r
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#4f46e5' : score >= 40 ? '#f59e0b' : '#ef4444'
  const filled = (score / 100) * c
  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${c}`} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>{Math.round(score)}</span>
        <span className="text-xs text-slate-600 font-bold">/ 100</span>
      </div>
    </div>
  )
}

export default function EvaluacionIA() {
  const [perfiles, setPerfiles]             = useState([])
  const [selectedPerfil, setSelectedPerfil] = useState('')
  const [ranking, setRanking]               = useState([])
  const [stats, setStats]                   = useState(null)
  const [loading, setLoading]               = useState(false)
  const [evaluating, setEvaluating]         = useState(false)
  const [msg, setMsg]                       = useState(null)
  const [detail, setDetail]                 = useState(null)
  const [selectedPostulacionId, setSelectedPostulacionId] = useState(null)

  useEffect(() => { api.get('/perfiles-cargo').then(r => setPerfiles(r.data)) }, [])

  const loadRanking = async (pid) => {
    if (!pid) return
    setLoading(true)
    try {
      const [rRes, sRes] = await Promise.all([
        api.get('/evaluaciones/ranking', { params: { perfil_cargo_id: pid } }),
        api.get(`/evaluaciones/estadisticas/${pid}`),
      ])
      setRanking(rRes.data); setStats(sRes.data)
    } finally { setLoading(false) }
  }

  const evaluarTodos = async () => {
    if (!selectedPerfil) return
    setEvaluating(true); setMsg(null)
    try {
      const res = await api.post('/evaluaciones/evaluar-todos', { perfil_cargo_id: selectedPerfil })
      setMsg({ text: res.data.message, type: 'success' })
      setTimeout(() => loadRanking(selectedPerfil), 5000)
    } catch (e) {
      setMsg({ text: e.response?.data?.message || 'Error', type: 'error' })
    } finally {
      setEvaluating(false)
    }
  }

  const onPerfilChange = (pid) => {
    setSelectedPerfil(pid); setRanking([]); setStats(null); setMsg(null); setDetail(null)
    if (pid) loadRanking(pid)
  }

  const radarData = detail ? [
    { subject: 'Educación',   A: (detail.puntaje_educacion      / 20) * 100 },
    { subject: 'Experiencia', A: (detail.puntaje_experiencia    / 35) * 100 },
    { subject: 'Habilidades', A: (detail.puntaje_habilidades    / 30) * 100 },
    { subject: 'Perfil',      A: (detail.puntaje_perfil_general / 15) * 100 },
  ] : []

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="section-title">Agente Reclutador IA</h1>
        <p className="section-sub">Evaluación y ranking automático de candidatos por cargo</p>
      </div>

      {/* Selector + acción */}
      <div className="card flex items-end gap-4 flex-wrap">
        <div className="flex-1 min-w-48">
          <label className="label">Perfil de cargo a evaluar</label>
          <select className="select" value={selectedPerfil} onChange={e => onPerfilChange(e.target.value)}>
            <option value="">Seleccionar cargo...</option>
            {perfiles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <button onClick={evaluarTodos} disabled={!selectedPerfil || evaluating} className="btn-primary whitespace-nowrap">
          {evaluating
            ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Evaluando...</>
            : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>Evaluar todos</>
          }
        </button>
        {selectedPerfil && (
          <button onClick={() => loadRanking(selectedPerfil)} className="btn-secondary flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
            </svg>
            Actualizar
          </button>
        )}
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-sm font-medium border flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
          {msg.type === 'success' ? (
            <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Evaluados',      val: stats.total,                 color: 'text-surface-800', bg: 'bg-white' },
            { label: 'Score promedio', val: stats.promedio_puntaje,      color: 'text-brand-600',   bg: 'bg-brand-50' },
            { label: '★ Altamente',   val: stats.altamente_recomendado, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '✓ Recomendados',val: stats.recomendado,           color: 'text-blue-600',    bg: 'bg-blue-50' },
            { label: '✗ No recom.',   val: stats.no_recomendado,        color: 'text-red-500',     bg: 'bg-red-50' },
          ].map((s, i) => (
            <div key={i} className={`card text-center !py-3 ${s.bg}`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-sm text-slate-850 font-bold mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Ranking */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : ranking.length > 0 ? (
        <div className="space-y-2">
          {ranking.map((ev, idx) => {
            const cand = ev.candidato
            const p    = cand?.postulacion
            const isOpen = detail?.id === ev.id

            let parsedJustificacion = null;
            let isJsonJustificacion = false;
            if (ev.justificacion) {
              const trimmed = ev.justificacion.trim();
              if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                try {
                  parsedJustificacion = JSON.parse(trimmed);
                  if (parsedJustificacion && (parsedJustificacion.justificacion_resumen || parsedJustificacion.general)) {
                    isJsonJustificacion = true;
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
            const displayResumen = isJsonJustificacion ? parsedJustificacion.justificacion_resumen : (ev.justificacion || '');
            const displayEducacion = isJsonJustificacion ? parsedJustificacion.justificacion_educacion : fallbackTexts.justificacion_educacion;
            const displayExperiencia = isJsonJustificacion ? parsedJustificacion.justificacion_experiencia : fallbackTexts.justificacion_experiencia;
            const displayHabilidades = isJsonJustificacion ? parsedJustificacion.justificacion_habilidades : fallbackTexts.justificacion_habilidades;
            const displayPerfilGeneral = isJsonJustificacion ? parsedJustificacion.justificacion_perfil_general : fallbackTexts.justificacion_perfil_general;

            return (
              <div key={ev.id} onClick={() => setDetail(isOpen ? null : ev)}
                className="card card-hover cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{
                      background: idx === 0 ? '#fef3c7' : idx === 1 ? '#f1f5f9' : idx === 2 ? '#fff7ed' : '#f8fafc',
                      color: idx === 0 ? '#b45309' : idx === 1 ? '#64748b' : idx === 2 ? '#d97706' : '#94a3b8',
                    }}>
                    {idx + 1}
                  </div>
                  <ScoreRing score={ev.puntaje_total} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-surface-800">{p?.nombre_completo}</p>
                      <span className={`badge text-xs font-bold ${recoColor[ev.recomendacion] || 'bg-surface-100 text-slate-800'}`}>
                        {recoLabel[ev.recomendacion] || ev.recomendacion?.replace(/_/g,' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-semibold mt-0.5">{p?.email}</p>
                    <div className="flex gap-4 mt-2">
                      {[['Edu', ev.puntaje_educacion,20],['Exp',ev.puntaje_experiencia,35],['Skills',ev.puntaje_habilidades,30],['Perfil',ev.puntaje_perfil_general,15]].map(([l,v,max]) => (
                        <div key={l} className="text-center">
                          <p className="text-xs text-slate-800 font-bold">{l}</p>
                          <p className="text-xs font-semibold text-surface-700">{Number(v).toFixed(0)}<span className="text-surface-400 font-normal">/{max}</span></p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <svg className={`w-4 h-4 text-surface-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                </div>

                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-surface-100 grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up" onClick={e => e.stopPropagation()}>
                    <div>
                      <p className="text-xs font-extrabold text-slate-850 uppercase tracking-wider mb-2">Justificación IA</p>
                      <p className="text-sm text-surface-600 leading-relaxed">{displayResumen}</p>
                      
                      <div className="mt-4 space-y-3">
                        <p className="text-xs font-extrabold text-slate-850 uppercase tracking-wider">Análisis por Dimensión</p>
                        <div className="space-y-2">
                          {/* Educación */}
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-xs">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-slate-800">Educación</span>
                              <span className="text-[10px] font-extrabold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                                {Math.round(ev.puntaje_educacion)}/20 pts
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-900 font-semibold leading-relaxed">{displayEducacion}</p>
                          </div>

                          {/* Experiencia */}
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-xs">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-slate-800">Experiencia Profesional</span>
                              <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                {Math.round(ev.puntaje_experiencia)}/35 pts
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-900 font-semibold leading-relaxed">{displayExperiencia}</p>
                          </div>

                          {/* Habilidades */}
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-xs">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-slate-800">Habilidades Técnicas</span>
                              <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                                {Math.round(ev.puntaje_habilidades)}/30 pts
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-900 font-semibold leading-relaxed">{displayHabilidades}</p>
                          </div>

                          {/* Ajuste Perfil */}
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-xs">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-slate-800">Ajuste Perfil General</span>
                              <span className="text-[10px] font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-300">
                                {Math.round(ev.puntaje_perfil_general)}/15 pts
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-900 font-semibold leading-relaxed">{displayPerfilGeneral}</p>
                          </div>
                        </div>
                      </div>

                      {p && (
                        <button onClick={e => { e.stopPropagation(); setSelectedPostulacionId(p.id) }}
                          className="btn-primary text-sm font-bold mt-4 w-full py-2.5 flex items-center justify-center gap-2">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Ver expediente completo
                        </button>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-850 uppercase tracking-wider mb-2">Radar de competencias</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} />
                          <Radar dataKey="A" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.15} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a' }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : selectedPerfil ? (
        <div className="card text-center py-16 text-slate-700 font-semibold">
          <svg className="w-12 h-12 mx-auto mb-3 text-surface-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
          <p className="font-medium text-surface-600 mb-1">Sin evaluaciones para este cargo</p>
          <p className="text-sm">Haz clic en "Evaluar todos" para iniciar.</p>
        </div>
      ) : (
        <div className="card text-center py-16 text-slate-700 font-semibold">
          <p>Selecciona un perfil de cargo para ver el ranking</p>
        </div>
      )}

      {selectedPostulacionId && (
        <DetailDrawer
          postulacionId={selectedPostulacionId}
          onClose={() => setSelectedPostulacionId(null)}
          onUpdated={() => loadRanking(selectedPerfil)}
        />
      )}
    </div>
  )
}
