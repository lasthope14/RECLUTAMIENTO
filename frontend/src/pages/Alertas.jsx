import { useEffect, useState } from 'react'
import api from '../services/api'

/* Alertas por correo del proceso de selección: qué está vencido hoy, a quién
   le llega el resumen, los plazos (en días hábiles) y el historial de envíos. */

const esAdmin = () => {
  try { return JSON.parse(localStorage.getItem('user') || '{}').role_id === 1 } catch { return false }
}

const errorDe = (e) => {
  const d = e?.response?.data
  if (d?.errors) return Object.values(d.errors).flat().join(' ')
  return d?.message || 'Ocurrió un error.'
}

const fechaHora = (iso) => {
  try { return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

const pesos = (v) => (v === null || v === undefined ? '—' : `$${Math.round(v).toLocaleString('es-CO')}`)

const ESTADO_ARL = {
  no_continuo: 'Se afilió y no continuó',
  sin_vincular: 'Pasó la fecha de ingreso sin vincular',
  sin_marcacion: 'Vinculado sin marcar asistencia',
}

const aTexto = (lista) => (lista || []).join(', ')
const aLista = (texto) => texto.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)

function Seccion({ titulo, sub, tono = 'text-slate-800', filas, columnas }) {
  return (
    <div className="card space-y-3">
      <div>
        <h3 className={`text-sm font-extrabold ${tono}`}>{titulo} <span className="ml-1 badge bg-slate-100 text-slate-600">{filas.length}</span></h3>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
      {filas.length === 0 ? (
        <p className="text-xs text-emerald-700">✓ Nada vencido.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400">
                {columnas.map(c => <th key={c.label} className="py-2 pr-4 font-bold">{c.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.slice(0, 50).map(f => (
                <tr key={f.id} className="align-top">
                  {columnas.map(c => <td key={c.label} className="py-2.5 pr-4 text-slate-700">{c.render(f)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {filas.length > 50 && <p className="text-xs text-slate-500 mt-2">… y {filas.length - 50} más.</p>}
        </div>
      )}
    </div>
  )
}

export default function Alertas() {
  const admin = esAdmin()
  const [data, setData] = useState(null)
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState(null)
  const [ocupado, setOcupado] = useState('')

  const aplicar = (d) => {
    setData(d)
    setForm({
      ...d.config,
      destinatariosTexto: aTexto(d.config.destinatarios),
      destinatariosArlTexto: aTexto(d.config.destinatarios_arl),
    })
  }

  useEffect(() => {
    api.get('/alertas').then(r => aplicar(r.data)).catch(e => setError(errorDe(e)))
  }, [])

  const guardar = async () => {
    setOcupado('guardar'); setAviso(null)
    try {
      const { destinatariosTexto, destinatariosArlTexto, ...resto } = form
      const res = await api.put('/alertas/config', {
        ...resto,
        destinatarios: aLista(destinatariosTexto),
        destinatarios_arl: aLista(destinatariosArlTexto),
      })
      aplicar(res.data)
      setAviso({ tipo: 'ok', texto: 'Configuración guardada.' })
    } catch (e) { setAviso({ tipo: 'error', texto: errorDe(e) }) }
    finally { setOcupado('') }
  }

  const enviarAhora = async () => {
    if (!window.confirm('¿Enviar ahora el resumen de pendientes a los destinatarios?')) return
    setOcupado('enviar'); setAviso(null)
    try {
      const res = await api.post('/alertas/enviar-ahora')
      setAviso({ tipo: 'ok', texto: `Enviado a ${res.data.destinatarios}.` })
      const r = await api.get('/alertas'); aplicar(r.data)
    } catch (e) { setAviso({ tipo: 'error', texto: e?.response?.data?.error || errorDe(e) }) }
    finally { setOcupado('') }
  }

  if (error) return <div className="card text-sm text-red-600">{error}</div>
  if (!data || !form) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-xs font-semibold gap-3">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /> Cargando…
      </div>
    )
  }

  const p = data.pendientes
  const num = (clave) => (
    <input type="number" min={0} max={60} className="input py-2 w-24" disabled={!admin}
      value={form[clave]} onChange={e => setForm(f => ({ ...f, [clave]: Number(e.target.value) }))} />
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="section-title">Alertas</h1>
          <p className="section-sub">Resumen diario por correo, días hábiles a las 7:00 a. m., y aviso inmediato al cargar una afiliación a la ARL.</p>
        </div>
        {admin && (
          <button className="btn-secondary" onClick={enviarAhora} disabled={!!ocupado}>
            {ocupado === 'enviar' ? 'Enviando…' : 'Enviar resumen ahora'}
          </button>
        )}
      </div>

      {aviso && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${aviso.tipo === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>{aviso.texto}</div>
      )}

      {/* Pendientes vencidos hoy: lo mismo que llevará el próximo resumen */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Seccion
          titulo="Afiliados a la ARL sin ingreso" tono="text-red-700"
          sub="La ARL se paga por día. Reporte el retiro ante la ARL o confirme el ingreso desde el expediente (pestaña Proceso)."
          filas={p.arl}
          columnas={[
            { label: 'Aspirante', render: f => <><b>{f.nombre}</b><div className="text-[11px] text-slate-500">{f.cargo}</div></> },
            { label: 'Situación', render: f => <span className="text-red-700">{ESTADO_ARL[f.estado]}</span> },
            { label: 'Afiliación', render: f => <>{f.fecha_afiliacion}<div className="text-[11px] text-slate-500">ingreso {f.fecha_ingreso}</div></> },
            { label: 'Días / costo', render: f => <><b>{f.dias_sin_trabajo} d</b><div className="text-[11px] text-slate-500">{pesos(f.costo_estimado)}</div></> },
          ]}
        />
        <Seccion
          titulo="Detenidos en una fase" tono="text-amber-700"
          sub="No responden, falta documentación o falta avanzarlos."
          filas={p.fases_estancadas}
          columnas={[
            { label: 'Aspirante', render: f => <><b>{f.nombre}</b><div className="text-[11px] text-slate-500">{f.cargo}</div></> },
            { label: 'Fase', render: f => f.fase },
            { label: 'Días hábiles', render: f => <><b>{f.dias}</b> <span className="text-slate-400">/ {f.plazo}</span></> },
            { label: 'Pendiente', render: f => f.documentos_faltantes.length ? `Faltan ${f.documentos_faltantes.length} doc.` : '—' },
          ]}
        />
        <Seccion
          titulo="Descartados sin respuesta"
          sub={`Más de ${data.config.dias_respuesta_descartado} días hábiles sin ningún correo enviado.`}
          filas={p.sin_respuesta}
          columnas={[
            { label: 'Aspirante', render: f => <><b>{f.nombre}</b><div className="text-[11px] text-slate-500">{f.email || 'sin correo'}</div></> },
            { label: 'Dónde salió', render: f => f.fase },
            { label: 'Días hábiles', render: f => f.dias },
          ]}
        />
        <Seccion
          titulo="Hojas de vida sin revisar"
          sub={`Recibidas hace más de ${data.config.dias_hv_sin_revisar} días hábiles.`}
          filas={p.hv_sin_revisar}
          columnas={[
            { label: 'Aspirante', render: f => <b>{f.nombre}</b> },
            { label: 'Cargo', render: f => f.cargo || '—' },
            { label: 'Recibida', render: f => f.desde },
            { label: 'Días hábiles', render: f => f.dias },
          ]}
        />
      </div>

      {/* Configuración */}
      <section className="card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Configuración {admin ? '' : '(solo administradores pueden cambiarla)'}</h3>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" disabled={!admin} checked={!!form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
            Resumen diario activo
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <label className="label">Destinatarios del resumen</label>
            <textarea className="input min-h-[70px]" disabled={!admin} value={form.destinatariosTexto}
              placeholder="Vacío = administradores de la app"
              onChange={e => setForm(f => ({ ...f, destinatariosTexto: e.target.value }))} />
            <p className="text-[11px] text-slate-500 mt-1">Hoy le llega a: {aTexto(data.destinatarios_efectivos) || 'nadie'}</p>
          </div>
          <div>
            <label className="label">Además, para los avisos de ARL (gerencia, contabilidad)</label>
            <textarea className="input min-h-[70px]" disabled={!admin} value={form.destinatariosArlTexto}
              placeholder="correo@hidroobras.com.co, otro@hidroobras.com.co"
              onChange={e => setForm(f => ({ ...f, destinatariosArlTexto: e.target.value }))} />
            <p className="text-[11px] text-slate-500 mt-1">Avisos de ARL a: {aTexto(data.destinatarios_arl_efectivos) || 'nadie'}</p>
          </div>
        </div>

        <div>
          <div className="label">Plazos en días hábiles (sin fines de semana ni festivos)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center justify-between gap-3 text-sm text-slate-700">Hoja de vida sin revisar {num('dias_hv_sin_revisar')}</div>
            <div className="flex items-center justify-between gap-3 text-sm text-slate-700">Responder a un descartado {num('dias_respuesta_descartado')}</div>
            <div className="flex items-center justify-between gap-3 text-sm text-slate-700">ARL: tras la fecha de ingreso {num('dias_arl_sin_ingreso')}</div>
            {data.fases.map(f => (
              <div key={f.id} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                Fase: {f.label}
                <input type="number" min={1} max={60} className="input py-2 w-24" disabled={!admin}
                  value={form.dias_fase[f.id] ?? ''}
                  onChange={e => setForm(x => ({ ...x, dias_fase: { ...x.dias_fase, [f.id]: Number(e.target.value) } }))} />
              </div>
            ))}
          </div>
        </div>

        {admin && (
          <button className="btn-primary" onClick={guardar} disabled={!!ocupado}>
            {ocupado === 'guardar' ? 'Guardando…' : 'Guardar configuración'}
          </button>
        )}
      </section>

      {/* Historial */}
      <section className="card">
        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3">Últimos correos enviados</h3>
        {data.historial.length === 0 ? (
          <p className="text-xs text-slate-500">Todavía no se ha enviado ninguna alerta.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {data.historial.map(h => (
              <li key={h.id} className="py-2.5 flex flex-wrap items-start gap-x-4 gap-y-1">
                <span className="text-xs text-slate-500 w-28 shrink-0">{fechaHora(h.created_at)}</span>
                <span className={`badge text-[10px] ${h.estado === 'enviado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{h.estado}</span>
                <span className="flex-1 min-w-[12rem] text-slate-800">{h.asunto}
                  <div className="text-[11px] text-slate-500">{h.destinatarios}{h.error ? ` · ${h.error}` : ''}</div>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
