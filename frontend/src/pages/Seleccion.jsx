import { useEffect, useState } from 'react'
import api from '../services/api'
import DetailDrawer from '../components/DetailDrawer'

/* Tablero del proceso de selección: quién va en cada fase y los indicadores
   del periodo (embudo, dónde se caen los aspirantes, cuánto tarda cada fase
   y el tiempo hasta la vinculación). */

const hoy = () => new Date().toISOString().slice(0, 10)
const haceDias = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

const diasDesde = (iso) => {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

const dias = (v) => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')} d`)

function Kpi({ label, value, sub, tone = 'text-slate-900' }) {
  return (
    <div className="card py-4">
      <div className="label mb-1">{label}</div>
      <div className={`text-2xl font-extrabold ${tone}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}

const fechaHora = (iso) => {
  try {
    return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

const ARL_BADGE = {
  en_espera: { texto: 'Esperando ingreso', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  ingreso_confirmado: { texto: 'Ingresó', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  retiro_reportado: { texto: 'Retiro reportado', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  no_continuo: { texto: 'No continuó · reportar retiro', cls: 'bg-red-50 text-red-700 border-red-200' },
  sin_vincular: { texto: 'Sin vincular tras el ingreso', cls: 'bg-red-50 text-red-700 border-red-200' },
  sin_marcacion: { texto: 'Sin marcación', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
}

/* Cómo terminó el proceso en el periodo: quién no continuó (y por qué), a
   quién se descartó en la revisión de hojas de vida y quién quedó vinculado. */
function Resultados({ data, onAbrir }) {
  const pestanas = [
    { id: 'no_continuaron', label: 'No continuaron en el proceso', filas: data.no_continuaron, tono: 'text-red-600' },
    { id: 'descartados_revision', label: 'Descartados en revisión de hojas de vida', filas: data.descartados_revision, tono: 'text-slate-600' },
    { id: 'vinculados', label: 'Vinculados', filas: data.vinculados, tono: 'text-violet-700' },
    { id: 'arl', label: 'Afiliaciones ARL', filas: data.arl, tono: 'text-red-600' },
  ]
  const [activa, setActiva] = useState('no_continuaron')
  const [limite, setLimite] = useState(25)
  const p = pestanas.find(t => t.id === activa)
  const filas = p.filas.slice(0, limite)

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 -mt-1">
        {pestanas.map(t => (
          <button key={t.id} onClick={() => { setActiva(t.id); setLimite(25) }}
            className={`px-3 py-2.5 text-xs font-bold border-b-2 -mb-px transition ${
              activa === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}>
            {t.label} <span className={`ml-1 ${t.tono}`}>{t.filas.length}</span>
          </button>
        ))}
      </div>

      {p.filas.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">No hay registros en el periodo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400">
                <th className="py-2 pr-4 font-bold">Aspirante</th>
                {activa === 'no_continuaron' && <th className="py-2 pr-4 font-bold">Fase en que salió</th>}
                {activa === 'arl' ? <>
                  <th className="py-2 pr-4 font-bold">Situación</th>
                  <th className="py-2 pr-4 font-bold">Días sin trabajo / costo</th>
                </> : activa !== 'vinculados'
                  ? <th className="py-2 pr-4 font-bold w-2/5">Motivo</th>
                  : <th className="py-2 pr-4 font-bold">Empleado en gestión</th>}
                <th className="py-2 font-bold">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map(f => (
                <tr key={`${activa}-${f.id}`} className="align-top hover:bg-slate-50 cursor-pointer" onClick={() => onAbrir(f.id)}>
                  <td className="py-3 pr-4">
                    <div className="font-semibold text-slate-800">{f.nombre_completo || f.nombre}</div>
                    <div className="text-[11px] text-slate-500">{f.cargo || 'Sin cargo'}{f.ciudad ? ` · ${f.ciudad}` : ''}</div>
                  </td>
                  {activa === 'no_continuaron' && (
                    <td className="py-3 pr-4">
                      <span className="badge bg-red-50 text-red-700 border border-red-200">{f.fase_label}</span>
                    </td>
                  )}
                  {activa === 'arl' ? <>
                    <td className="py-3 pr-4">
                      <span className={`badge border ${ARL_BADGE[f.estado]?.cls || ''}`}>{ARL_BADGE[f.estado]?.texto || f.estado}</span>
                      <div className="text-[11px] text-slate-500 mt-1">Ingreso previsto {f.fecha_ingreso}</div>
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
                      {f.dias_sin_trabajo ? <b>{f.dias_sin_trabajo} d</b> : '—'}
                      {f.costo_estimado ? <div className="text-[11px] text-slate-500">${Math.round(f.costo_estimado).toLocaleString('es-CO')}</div> : null}
                    </td>
                  </> : activa !== 'vinculados' ? (
                    <td className="py-3 pr-4 text-slate-700 whitespace-pre-line">
                      {f.motivo || <span className="text-slate-400 italic">Sin motivo registrado</span>}
                    </td>
                  ) : (
                    <td className="py-3 pr-4 text-slate-700">#{f.empleado_id}</td>
                  )}
                  <td className="py-3 text-xs text-slate-500 whitespace-nowrap">
                    {activa === 'arl' ? `Afiliación ${f.fecha_afiliacion}` : fechaHora(f.fecha)}
                    {f.autor && <div>{f.autor}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {p.filas.length > limite && (
            <button className="btn-ghost text-xs mt-3" onClick={() => setLimite(l => l + 25)}>
              Ver más ({p.filas.length - limite} restantes)
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export default function Seleccion() {
  const [desde, setDesde] = useState(haceDias(90))
  const [hasta, setHasta] = useState(hoy())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [abierta, setAbierta] = useState(null)

  const cargar = () => {
    setLoading(true); setError('')
    api.get('/seleccion/tablero', { params: { desde, hasta } })
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.message || 'No se pudo cargar el tablero.'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [desde, hasta]) // eslint-disable-line react-hooks/exhaustive-deps

  const maxEntraron = Math.max(1, ...(data?.indicadores || []).map(i => i.entraron))
  const r = data?.resumen

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="section-title">Proceso de selección</h1>
          <p className="section-sub">Desde la preselección hasta la vinculación en gestión.</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="label">Desde</label>
            <input type="date" className="input py-2" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" className="input py-2" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} />
          </div>
        </div>
      </div>

      {error && <div className="card text-sm text-red-600">{error}</div>}

      {loading && !data && (
        <div className="flex items-center justify-center py-24 text-slate-400 text-xs font-semibold gap-3">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /> Cargando…
        </div>
      )}

      {data && (
        <>
          {/* KPIs del periodo */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Kpi label="En proceso ahora" value={r.en_proceso} />
            <Kpi label="Iniciaron proceso" value={r.iniciados} sub="en el periodo" />
            <Kpi label="No continuaron" value={r.no_continuaron} sub="en el periodo" tone="text-red-600" />
            <Kpi label="Vinculados" value={r.vinculados} sub="en el periodo" tone="text-violet-700" />
            <Kpi label="Tiempo a vinculación" value={dias(r.dias_hasta_vinculacion)}
              sub={`desde la hoja de vida · proceso: ${dias(r.dias_proceso)}`} />
          </div>

          {/* ARL: lo que se paga por afiliados que no ingresaron */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Afiliaciones ARL" value={r.arl_afiliados} sub="en el periodo" />
            <Kpi label="ARL sin ingreso" value={r.arl_sin_ingreso}
              sub={r.arl_pendientes ? `${r.arl_pendientes} sin resolver` : 'todas resueltas'} tone={r.arl_pendientes ? 'text-red-600' : 'text-slate-900'} />
            <Kpi label="Días de ARL sin trabajo" value={r.arl_dias_sin_trabajo} sub="pagados por afiliados que no ingresaron" tone="text-red-600" />
            <Kpi label="Costo ARL estimado" value={`$${Math.round(r.arl_costo_estimado).toLocaleString('es-CO')}`}
              sub={r.arl_costo_incompleto ? 'faltan salario o clase de riesgo en algunos' : 'según salario y clase de riesgo'} tone="text-red-600" />
          </div>

          {/* Embudo por fase */}
          <section className="card">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-4">Embudo por fase</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400">
                    <th className="py-2 pr-4 font-bold">Fase</th>
                    <th className="py-2 pr-4 font-bold w-1/3">Entraron</th>
                    <th className="py-2 pr-4 font-bold text-right">Aprobaron</th>
                    <th className="py-2 pr-4 font-bold text-right">No aprobaron</th>
                    <th className="py-2 pr-4 font-bold text-right">Tasa de paso</th>
                    <th className="py-2 font-bold text-right">Días promedio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.indicadores.map(i => {
                    const cerradas = i.aprobaron + i.no_aprobaron
                    return (
                      <tr key={i.fase} className="align-top">
                        <td className="py-3 pr-4 font-semibold text-slate-800">
                          {i.label}
                          {i.motivos.length > 0 && (
                            <details className="mt-1">
                              <summary className="text-[11px] text-red-600 cursor-pointer font-medium">Motivos recientes</summary>
                              <ul className="mt-1 space-y-1 text-xs text-slate-600 font-normal list-disc ml-4">
                                {i.motivos.map((m, k) => <li key={k}>{m}</li>)}
                              </ul>
                            </details>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 rounded-full bg-brand-500" style={{ width: `${(i.entraron / maxEntraron) * 100}%`, minWidth: i.entraron ? 6 : 0 }} />
                            <span className="text-xs font-bold text-slate-700">{i.entraron}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right text-emerald-700 font-semibold">{i.aprobaron}</td>
                        <td className="py-3 pr-4 text-right text-red-600 font-semibold">{i.no_aprobaron}</td>
                        <td className="py-3 pr-4 text-right text-slate-700">{cerradas ? `${Math.round((i.aprobaron / cerradas) * 100)} %` : '—'}</td>
                        <td className="py-3 text-right text-slate-700">{dias(i.dias_promedio)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Tablero por fase */}
          <section>
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3">Aspirantes en proceso</h3>
            {data.por_iniciar.length > 0 && (
              <div className="rounded-2xl bg-amber-50/60 border border-amber-200 p-3 mb-4">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-bold text-amber-800">Preseleccionados · por iniciar el proceso</span>
                  <span className="badge bg-white text-amber-700 border border-amber-200">{data.por_iniciar.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {data.por_iniciar.map(p => (
                    <button key={p.id} onClick={() => setAbierta(p.id)}
                      className="text-left bg-white rounded-xl border border-amber-200 hover:border-amber-400 p-3 transition">
                      <div className="text-sm font-semibold text-slate-800 truncate">{p.nombre_completo}</div>
                      <div className="text-[11px] text-slate-500 truncate">{p.perfil_cargo?.nombre || 'Sin cargo'}{p.ciudad ? ` · ${p.ciudad}` : ''}</div>
                      <div className="text-[11px] text-amber-700 font-semibold mt-2">Abrir e iniciar proceso →</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
              {data.fases.map(f => {
                const items = data.en_proceso.filter(p => p.fase === f.id)
                return (
                  <div key={f.id} className="rounded-2xl bg-slate-100/70 border border-slate-200 p-3 min-h-[120px]">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <span className="text-xs font-bold text-slate-700">{f.orden}. {f.label}</span>
                      <span className="badge bg-white text-slate-600 border border-slate-200">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map(p => {
                        const d = diasDesde(p.fase_desde)
                        return (
                          <button key={p.id} onClick={() => setAbierta(p.id)}
                            className="w-full text-left bg-white rounded-xl border border-slate-200 hover:border-brand-300 p-3 transition">
                            <div className="text-sm font-semibold text-slate-800 truncate">{p.nombre_completo}</div>
                            <div className="text-[11px] text-slate-500 truncate">{p.perfil_cargo?.nombre || 'Sin cargo'}{p.ciudad ? ` · ${p.ciudad}` : ''}</div>
                            <div className="flex items-center justify-between mt-2 text-[11px]">
                              <span className={d > 7 ? 'text-amber-700 font-semibold' : 'text-slate-500'}>{d === null ? '' : `${d} d en la fase`}</span>
                              <span className="text-slate-500">{p.documentos_count} doc.</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <Resultados data={data} onAbrir={setAbierta} />
        </>
      )}

      {abierta && (
        <DetailDrawer
          postulacionId={abierta}
          initialTab="proceso"
          onClose={() => setAbierta(null)}
          onUpdated={cargar}
        />
      )}
    </div>
  )
}
