import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'

/* Pestaña "Proceso" del expediente: fases de selección, documentos de ingreso
   (catálogo FSI-44 de gestión), datos del empleado y el botón que lo vincula
   a la app de gestión, que a su vez archiva los documentos en el NAS. */

const EVENTO_LABEL = {
  entra: 'Entró a la fase',
  aprueba: 'Aprobó',
  no_aprueba: 'No aprobó',
  reabre: 'Proceso retomado',
  vinculado: 'Vinculado a gestión',
}
const EVENTO_COLOR = {
  entra: 'bg-slate-300',
  aprueba: 'bg-emerald-500',
  no_aprueba: 'bg-red-500',
  reabre: 'bg-amber-500',
  vinculado: 'bg-violet-600',
}

const errorDe = (e, porDefecto = 'Ocurrió un error.') => {
  const d = e?.response?.data
  if (d?.errors) return Object.values(d.errors).flat().join(' ')
  return d?.message || porDefecto
}

const fecha = (iso, conHora = false) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('es-CO', conHora
      ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

const fechaCorta = (ymd) => (ymd ? fecha(`${String(ymd).slice(0, 10)}T12:00:00`) : '')

const CAMPOS = [
  { grupo: 'Identificación', campos: [
    { id: 'cedula', label: 'Cédula', req: true },
    { id: 'nombres', label: 'Nombres', req: true },
    { id: 'apellidos', label: 'Apellidos', req: true },
    { id: 'fecha_nacimiento', label: 'Fecha de nacimiento', type: 'date' },
    { id: 'genero', label: 'Género', options: [['', '—'], ['M', 'Masculino'], ['F', 'Femenino'], ['otro', 'Otro']] },
  ] },
  { grupo: 'Contratación', campos: [
    { id: 'cargo', label: 'Cargo', req: true },
    { id: 'tipo_empleado', label: 'Tipo de empleado', req: true, options: [['', '—'], ['field', 'Campo (obra)'], ['administrative', 'Administrativo']] },
    { id: 'tipo_contrato', label: 'Tipo de contrato', options: [['', '—'], ['indefinido', 'Indefinido'], ['fijo', 'Término fijo'], ['obra_labor', 'Obra o labor'], ['prestacion_servicios', 'Prestación de servicios']] },
    { id: 'fecha_ingreso', label: 'Fecha de ingreso', type: 'date', req: true },
    { id: 'fecha_fin_contrato', label: 'Fin del contrato', type: 'date' },
    { id: 'salario', label: 'Salario', type: 'number' },
    { id: 'clase_riesgo_arl', label: 'Clase de riesgo ARL', options: [['', '—'], ['1', 'I · 0,522 %'], ['2', 'II · 1,044 %'], ['3', 'III · 2,436 %'], ['4', 'IV · 4,350 %'], ['5', 'V · 6,960 %']] },
    { id: 'company_id', label: 'Empresa', catalogo: 'companies' },
    { id: 'location_id', label: 'Sede / obra', catalogo: 'locations' },
    { id: 'schedule_id', label: 'Horario', catalogo: 'schedules' },
    { id: 'department_id', label: 'Área', catalogo: 'departments' },
  ] },
  { grupo: 'Contacto', campos: [
    { id: 'email', label: 'Correo', type: 'email' },
    { id: 'telefono', label: 'Teléfono' },
    { id: 'direccion', label: 'Dirección' },
    { id: 'contacto_emergencia', label: 'Contacto de emergencia' },
    { id: 'telefono_emergencia', label: 'Teléfono de emergencia' },
  ] },
  { grupo: 'Seguridad social y banco', campos: [
    { id: 'eps', label: 'EPS' },
    { id: 'arl', label: 'ARL' },
    { id: 'fondo_pension', label: 'Fondo de pensiones' },
    { id: 'banco', label: 'Banco' },
    { id: 'tipo_cuenta', label: 'Tipo de cuenta', options: [['', '—'], ['ahorros', 'Ahorros'], ['corriente', 'Corriente']] },
    { id: 'cuenta_bancaria', label: 'Número de cuenta' },
  ] },
]

const ARL_ESTADO = {
  en_espera: { texto: 'Esperando la fecha de ingreso', cls: 'bg-slate-50 border-slate-200 text-slate-700' },
  ingreso_confirmado: { texto: 'Ingresó a trabajar', cls: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  retiro_reportado: { texto: 'No ingresó · retiro reportado ante la ARL', cls: 'bg-slate-50 border-slate-200 text-slate-700' },
  no_continuo: { texto: 'Se afilió y NO continuó: reporte el retiro ante la ARL', cls: 'bg-red-50 border-red-300 text-red-800' },
  sin_vincular: { texto: 'Pasó la fecha de ingreso y no se ha vinculado', cls: 'bg-red-50 border-red-300 text-red-800' },
  sin_marcacion: { texto: 'Vinculado, pero sin ninguna marcación de asistencia', cls: 'bg-amber-50 border-amber-300 text-amber-800' },
}

const pesos = (v) => (v === null || v === undefined ? null : `$${Math.round(v).toLocaleString('es-CO')}`)

/* Seguimiento de la afiliación a la ARL: se paga por día desde la afiliación,
   así que hay que confirmar que la persona ingresó o reportar el retiro. */
function PanelArl({ arl, postulacionId, onCambio }) {
  const [accion, setAccion] = useState(null)
  const [fechaAccion, setFechaAccion] = useState(new Date().toISOString().slice(0, 10))
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const e = ARL_ESTADO[arl.estado] || ARL_ESTADO.en_espera
  const resuelto = ['ingreso_confirmado', 'retiro_reportado'].includes(arl.estado)

  const enviar = async (acc) => {
    setGuardando(true); setError('')
    try {
      const res = await api.post(`/postulaciones/${postulacionId}/arl-seguimiento`, { accion: acc, fecha: fechaAccion, nota })
      setAccion(null); setNota('')
      onCambio(res.data)
    } catch (err) { setError(errorDe(err)) }
    finally { setGuardando(false) }
  }

  return (
    <section className={`card space-y-3 border ${e.cls}`}>
      <h3 className="text-xs font-extrabold uppercase tracking-wider">Afiliación a la ARL</h3>
      <div className="text-sm font-bold">{e.texto}</div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="opacity-70">Afiliación</dt><dd>{fechaCorta(arl.fecha_afiliacion)}</dd>
        <dt className="opacity-70">Ingreso previsto</dt><dd>{fechaCorta(arl.fecha_ingreso)}</dd>
        {arl.primera_marcacion && <><dt className="opacity-70">Primera marcación</dt><dd>{fecha(arl.primera_marcacion, true)}</dd></>}
        {arl.dias_sin_trabajo > 0 && <><dt className="opacity-70">Días pagados sin trabajar</dt><dd className="font-bold">{arl.dias_sin_trabajo}</dd></>}
        {arl.costo_dia !== null
          ? <><dt className="opacity-70">Costo estimado</dt><dd>{pesos(arl.costo_dia)}/día{arl.costo_estimado ? ` · ${pesos(arl.costo_estimado)}` : ''}</dd></>
          : <><dt className="opacity-70">Costo</dt><dd className="opacity-70">registre salario y clase de riesgo</dd></>}
        {arl.seguimiento_por && <><dt className="opacity-70">Registró</dt><dd>{arl.seguimiento_por} · {fechaCorta(arl.seguimiento_fecha)}</dd></>}
        {arl.seguimiento_nota && <><dt className="opacity-70">Nota</dt><dd>{arl.seguimiento_nota}</dd></>}
      </dl>

      {!accion && (
        <div className="flex flex-wrap gap-2">
          {!resuelto && <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => setAccion('ingreso_confirmado')}>Confirmar que ingresó</button>}
          {!resuelto && <button className="btn-danger text-xs px-3 py-1.5" onClick={() => setAccion('retiro_reportado')}>Retiro reportado a la ARL</button>}
          {resuelto && arl.seguimiento_por && <button className="btn-ghost text-xs" disabled={guardando} onClick={() => enviar('limpiar')}>Deshacer</button>}
        </div>
      )}
      {accion && (
        <div className="space-y-2 rounded-lg bg-white/70 p-3 border border-slate-200">
          <label className="label">{accion === 'retiro_reportado' ? 'Fecha en que se reportó el retiro' : 'Fecha de ingreso real'}</label>
          <input type="date" className="input py-2" value={fechaAccion} max={new Date().toISOString().slice(0, 10)} onChange={ev => setFechaAccion(ev.target.value)} />
          <input className="input py-2" placeholder={accion === 'retiro_reportado' ? 'Nota (p. ej. número de radicado)' : 'Nota (opcional)'} value={nota} onChange={ev => setNota(ev.target.value)} />
          <div className="flex gap-2">
            <button className="btn-primary text-xs px-3 py-1.5" disabled={guardando || !fechaAccion} onClick={() => enviar(accion)}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            <button className="btn-ghost text-xs" onClick={() => setAccion(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
      {arl.error_gestion && <p className="text-[11px] opacity-70">No se pudo consultar la asistencia en gestión: {arl.error_gestion}</p>}
    </section>
  )
}

export default function ProcesoSeleccion({ postulacionId, onUpdated }) {
  const [data, setData] = useState(null)
  const [catalogo, setCatalogo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState(null)
  const [ocupado, setOcupado] = useState('')

  const [accion, setAccion] = useState(null) // 'aprobar' | 'no_aprueba' | 'reabrir'
  const [observacion, setObservacion] = useState('')

  const [datos, setDatos] = useState({})
  const [persona, setPersona] = useState(null)

  const [soloRequeridos, setSoloRequeridos] = useState(true)
  const [formDoc, setFormDoc] = useState(null) // { codigo, archivo, fecha_expedicion, fecha_vencimiento, detalle }

  const aplicar = (d) => {
    setData(d)
    setDatos(d.datos_vinculacion || {})
  }

  const cargar = () => {
    setLoading(true); setError('')
    Promise.allSettled([
      api.get(`/postulaciones/${postulacionId}/proceso`),
      api.get('/seleccion/catalogo'),
    ]).then(([p, c]) => {
      if (p.status === 'fulfilled') aplicar(p.value.data)
      else setError(errorDe(p.reason, 'No se pudo cargar el proceso.'))
      if (c.status === 'fulfilled') setCatalogo(c.value.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { if (postulacionId) cargar() }, [postulacionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const ejecutar = async (clave, fn, exito) => {
    setOcupado(clave); setAviso(null)
    try {
      const res = await fn()
      if (exito) setAviso({ tipo: 'ok', texto: typeof exito === 'function' ? exito(res) : exito })
      return res
    } catch (e) {
      setAviso({ tipo: 'error', texto: errorDe(e) })
      return null
    } finally {
      setOcupado('')
    }
  }

  const vinculado = data?.fase === 'vinculado'
  const cerrado = data?.estado === 'descartado' && data?.fase && !vinculado
  const faseIdx = data?.fases?.findIndex(f => f.id === data.fase) ?? -1

  const faltantesDocs = useMemo(
    () => (data?.checklist || []).filter(r => r.requerido && r.documentos.length === 0 && !r.cv_postulacion),
    [data],
  )

  const grupos = useMemo(() => {
    const items = (data?.checklist || []).filter(r => !soloRequeridos || r.requerido || r.documentos.length > 0 || r.cv_postulacion)
    return items.reduce((acc, r) => { (acc[r.categoria] ||= []).push(r); return acc }, {})
  }, [data, soloRequeridos])

  /* ── Acciones de fase ── */
  const confirmarAccion = async () => {
    const rutas = { aprobar: 'aprobar', no_aprueba: 'no-aprueba', reabrir: 'reabrir' }
    const body = accion === 'no_aprueba' ? { motivo: observacion } : { observacion }
    const res = await ejecutar(accion, () => api.post(`/postulaciones/${postulacionId}/proceso/${rutas[accion]}`, body))
    if (res) {
      aplicar(res.data); setAccion(null); setObservacion('')
      onUpdated?.()
    }
  }

  const iniciar = async () => {
    const res = await ejecutar('iniciar', () => api.post(`/postulaciones/${postulacionId}/proceso/iniciar`))
    if (res) { aplicar(res.data); onUpdated?.() }
  }

  /* ── Datos de vinculación ── */
  const guardarDatos = async () => {
    const limpio = Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v === '' ? null : v]))
    const res = await ejecutar('datos', () => api.put(`/postulaciones/${postulacionId}/vinculacion/datos`, limpio), 'Datos guardados.')
    if (res) aplicar(res.data)
  }

  const verificarCedula = async () => {
    setPersona(null)
    const res = await ejecutar('cedula', () => api.get(`/postulaciones/${postulacionId}/vinculacion/verificar-cedula`))
    if (res) setPersona(res.data)
  }

  /* ── Documentos ── */
  const subirDocumento = async () => {
    if (!formDoc?.archivo) return
    const fd = new FormData()
    Object.entries(formDoc).forEach(([k, v]) => { if (v) fd.append(k, v) })
    const res = await ejecutar('subir', () => api.post(`/postulaciones/${postulacionId}/documentos`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }), 'Documento cargado.')
    if (res) { setFormDoc(null); cargar() }
  }

  const verDocumento = async (doc) => {
    try {
      const res = await api.get(`/postulaciones/${postulacionId}/documentos/${doc.id}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e) {
      setAviso({ tipo: 'error', texto: 'No se pudo abrir el documento.' })
    }
  }

  // La hoja de vida con la que llegó la postulación (cumple ING-HV).
  const verCv = async () => {
    try {
      const res = await api.get(`/postulaciones/${postulacionId}/cv`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e) {
      setAviso({ tipo: 'error', texto: 'No se pudo abrir la hoja de vida.' })
    }
  }

  const eliminarDocumento = async (doc) => {
    if (!window.confirm(`¿Eliminar «${doc.archivo_nombre}»?`)) return
    const res = await ejecutar(`del-${doc.id}`, () => api.delete(`/postulaciones/${postulacionId}/documentos/${doc.id}`))
    if (res) cargar()
  }

  /* ── Vincular ── */
  const vincular = async () => {
    let aceptar = false
    if (faltantesDocs.length && !data.gestion_employee_id) {
      aceptar = window.confirm(
        `Faltan ${faltantesDocs.length} documento(s) requerido(s):\n\n• ${faltantesDocs.map(r => r.nombre).join('\n• ')}\n\n` +
        '¿Vincular de todas formas? Los que falten se cargan después directamente en gestión.'
      )
      if (!aceptar) return
    } else if (!window.confirm('Se creará el empleado en la app de gestión y se enviarán sus documentos al NAS. ¿Continuar?')) {
      return
    }

    // El servidor valida y deja la vinculación en cola; el avance lo sigue el efecto de abajo.
    const res = await ejecutar('vincular', () => api.post(`/postulaciones/${postulacionId}/vinculacion`, { aceptar_faltantes: aceptar }))
    if (res) aplicar(res.data)
  }

  /* Mientras la vinculación corre en la cola, se consulta el avance. */
  const enMarcha = !!data?.vinculacion?.en_marcha
  useEffect(() => {
    if (!enMarcha) return
    const id = setInterval(async () => {
      try {
        const res = await api.get(`/postulaciones/${postulacionId}/proceso`)
        aplicar(res.data)
        const v = res.data.vinculacion
        if (!v.en_marcha) {
          setAviso({ tipo: v.estado === 'completo' ? 'ok' : 'error', texto: v.mensaje || 'La vinculación terminó.' })
          onUpdated?.()
        }
      } catch { /* se reintenta en el siguiente ciclo */ }
    }, 2500)
    return () => clearInterval(id)
  }, [enMarcha, postulacionId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-xs font-semibold gap-3">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        Cargando proceso…
      </div>
    )
  }

  if (error) {
    return <div className="p-8"><div className="card text-sm text-red-600">{error}</div></div>
  }

  const puedeVincular = !vinculado && !cerrado && (data.fase === 'vinculacion' || data.gestion_employee_id)
  // Mientras corre la vinculación no se tocan documentos ni datos.
  const soloLectura = vinculado || enMarcha
  const v = data.vinculacion || {}

  return (
    <div className="p-4 md:p-8 lg:px-12 space-y-6">

      {aviso && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${aviso.tipo === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {aviso.texto}
        </div>
      )}

      {data.error_gestion && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <b>Sin conexión con gestión:</b> {data.error_gestion} El checklist de documentos no se puede mostrar hasta que se restablezca.
        </div>
      )}

      {/* ── 1. Fases ── */}
      <section className="card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Proceso de selección</h3>
          {data.fase_desde && !vinculado && !cerrado && (
            <span className="text-xs text-slate-500">En esta fase desde {fecha(data.fase_desde)}</span>
          )}
        </div>

        {!data.fase ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Este aspirante aún no ha entrado al proceso de selección. Arranca en «{data.fases[0]?.label}».</p>
            <button className="btn-primary" onClick={iniciar} disabled={ocupado === 'iniciar'}>
              {ocupado === 'iniciar' ? 'Iniciando…' : 'Iniciar proceso'}
            </button>
          </div>
        ) : (
          <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {data.fases.map((f, i) => {
              const hecho = vinculado || i < faseIdx
              const actual = !vinculado && i === faseIdx
              const cls = hecho
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : actual && cerrado
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : actual
                    ? 'bg-brand-50 border-brand-400 text-brand-800 ring-2 ring-brand-100'
                    : 'bg-white border-slate-200 text-slate-400'
              return (
                <li key={f.id} className={`rounded-xl border px-3 py-2.5 ${cls}`}>
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                    {hecho ? '✓ ' : ''}Fase {f.orden}
                  </div>
                  <div className="text-xs font-bold leading-snug mt-0.5">{f.label}</div>
                  {actual && cerrado && <div className="text-[10px] font-bold mt-1">No aprobó</div>}
                </li>
              )
            })}
          </ol>
        )}

        {vinculado && (
          <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 text-sm text-violet-800">
            <b>Vinculado a gestión</b> como empleado #{data.gestion_employee_id} el {fecha(data.vinculado_at, true)}
            {data.vinculado_por ? ` por ${data.vinculado_por}` : ''}. Desde ahora su documentación se administra en gestión.
          </div>
        )}

        {/* Acciones sobre la fase actual */}
        {data.fase && !vinculado && (
          <div className="flex flex-wrap gap-2">
            {cerrado ? (
              <button className="btn-secondary" onClick={() => { setAccion('reabrir'); setObservacion('') }}>Retomar proceso</button>
            ) : data.fase !== 'vinculacion' ? (
              <>
                <button className="btn-primary" onClick={() => { setAccion('aprobar'); setObservacion('') }}>
                  ✓ Aprobó «{data.fase_label}»
                </button>
                <button className="btn-danger" onClick={() => { setAccion('no_aprueba'); setObservacion('') }}>
                  ✗ No aprobó
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600 self-center mr-2">Aprobó todas las fases. Revise los datos y documentos y vincúlelo.</p>
                <button className="btn-danger" onClick={() => { setAccion('no_aprueba'); setObservacion('') }}>✗ No continúa</button>
              </>
            )}
          </div>
        )}

        {accion && (
          <div className={`rounded-xl border p-4 space-y-3 ${accion === 'no_aprueba' ? 'bg-red-50/50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
            <label className="label">
              {accion === 'no_aprueba' ? `Motivo por el que no aprobó «${data.fase_label}» (obligatorio)` : 'Observación (opcional)'}
            </label>
            <textarea className="input min-h-[80px]" value={observacion} onChange={e => setObservacion(e.target.value)}
              placeholder={accion === 'no_aprueba' ? 'Ej.: el examen médico lo declaró no apto para trabajo en alturas.' : ''} />
            {accion === 'no_aprueba' && (
              <p className="text-xs text-red-700">El proceso termina en esta fase y la postulación queda como descartada. Se puede retomar después si hace falta.</p>
            )}
            <div className="flex gap-2">
              <button
                className={accion === 'no_aprueba' ? 'btn-danger' : 'btn-primary'}
                disabled={!!ocupado || (accion === 'no_aprueba' && !observacion.trim())}
                onClick={confirmarAccion}
              >
                {ocupado ? 'Guardando…' : accion === 'aprobar' ? 'Confirmar aprobación' : accion === 'reabrir' ? 'Retomar' : 'Cerrar proceso'}
              </button>
              <button className="btn-ghost" onClick={() => setAccion(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">

        {/* ── 2. Documentos ── */}
        <section className="xl:col-span-3 card space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Documentos de ingreso</h3>
              <p className="text-xs text-slate-500 mt-1">
                Lista FSI-44 de gestión{datos.tipo_empleado ? '' : ' · elija el tipo de empleado para ver los requisitos de campo o administrativos'}.
                {faltantesDocs.length > 0 && <> Faltan <b>{faltantesDocs.length}</b> requeridos.</>}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={soloRequeridos} onChange={e => setSoloRequeridos(e.target.checked)} />
              Solo requeridos
            </label>
          </div>

          {Object.entries(grupos).map(([categoria, items]) => (
            <div key={categoria}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{categoria}</div>
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {items.map(r => (
                  <li key={r.codigo} className="p-3 space-y-2">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        r.documentos.length || r.cv_postulacion ? 'bg-emerald-500 text-white' : r.requerido ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-slate-100 text-slate-400'
                      }`}>{r.documentos.length || r.cv_postulacion ? '✓' : r.requerido ? '!' : '·'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800">
                          {r.nombre}
                          <span className="ml-2 text-[10px] font-mono text-slate-400">{r.codigo}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {r.requerido && <span className="badge bg-amber-50 text-amber-700 border border-amber-200 text-[10px]">Requerido</span>}
                          {r.bloquea_ingreso && <span className="badge bg-slate-100 text-slate-600 text-[10px]">Bloquea ingreso a obra</span>}
                          {r.vigencia_meses && <span className="badge bg-slate-100 text-slate-600 text-[10px]">Vigencia {r.vigencia_meses} meses</span>}
                          {r.sensible && <span className="badge bg-rose-50 text-rose-700 border border-rose-200 text-[10px]">Dato de salud</span>}
                        </div>
                      </div>
                      {!soloLectura && (
                        <button className="btn-ghost text-xs shrink-0"
                          onClick={() => setFormDoc(formDoc?.codigo === r.codigo ? null : { codigo: r.codigo })}>
                          {formDoc?.codigo === r.codigo ? 'Cancelar' : '+ Cargar'}
                        </button>
                      )}
                    </div>

                    {r.documentos.map(d => (
                      <div key={d.id} className="ml-8 flex flex-wrap items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
                        <button className="font-semibold text-brand-600 hover:underline truncate max-w-[16rem]" onClick={() => verDocumento(d)} title={d.archivo_nombre}>
                          {d.archivo_nombre}
                        </button>
                        {d.fecha_expedicion && <span className="text-slate-500">Expedido {fechaCorta(d.fecha_expedicion)}</span>}
                        {d.fecha_vencimiento && <span className="text-slate-500">· Vence {fechaCorta(d.fecha_vencimiento)}</span>}
                        {d.detalle && <span className="text-slate-500">· {d.detalle}</span>}
                        <span className="flex-1" />
                        {d.gestion_document_id
                          ? <span className="badge bg-violet-50 text-violet-700 border border-violet-200 text-[10px]" title={d.ruta_nas || ''}>En gestión / NAS</span>
                          : d.error_envio
                            ? <span className="badge bg-red-50 text-red-700 border border-red-200 text-[10px]" title={d.error_envio}>Error al enviar</span>
                            : null}
                        {!d.gestion_document_id && !soloLectura && (
                          <button className="text-red-500 hover:text-red-700 font-semibold" disabled={ocupado === `del-${d.id}`} onClick={() => eliminarDocumento(d)}>Eliminar</button>
                        )}
                      </div>
                    ))}

                    {r.cv_postulacion && (
                      <div className="ml-8 flex flex-wrap items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
                        <button className="font-semibold text-brand-600 hover:underline truncate max-w-[16rem]" onClick={verCv} title={r.cv_postulacion.archivo_nombre}>
                          {r.cv_postulacion.archivo_nombre}
                        </button>
                        <span className="text-slate-500">· Recibida con la postulación; se envía a gestión al vincular</span>
                      </div>
                    )}

                    {formDoc?.codigo === r.codigo && (
                      <div className="ml-8 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
                        <div className="sm:col-span-2">
                          <label className="label">Archivo (PDF, imagen u Office · máx. 25 MB)</label>
                          <input type="file" className="text-sm" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
                            onChange={e => setFormDoc(f => ({ ...f, archivo: e.target.files?.[0] || null }))} />
                        </div>
                        <div>
                          <label className="label">{r.codigo === 'SS-ARL' ? 'Fecha de afiliación a la ARL' : 'Fecha de expedición'}</label>
                          <input type="date" className="input" value={formDoc.fecha_expedicion || ''}
                            onChange={e => setFormDoc(f => ({ ...f, fecha_expedicion: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">Vence {r.vigencia_meses ? '(se calcula solo)' : ''}</label>
                          <input type="date" className="input" value={formDoc.fecha_vencimiento || ''}
                            onChange={e => setFormDoc(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="label">Detalle (opcional)</label>
                          <input className="input" maxLength={100} value={formDoc.detalle || ''} placeholder="Ej.: Procuraduría, Ingreso y alturas…"
                            onChange={e => setFormDoc(f => ({ ...f, detalle: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2">
                          <button className="btn-primary" disabled={!formDoc.archivo || ocupado === 'subir'} onClick={subirDocumento}>
                            {ocupado === 'subir' ? 'Subiendo…' : 'Subir documento'}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {!data.checklist?.length && data.documentos_sin_catalogo?.length > 0 && (
            <ul className="text-sm text-slate-600 list-disc ml-5">
              {data.documentos_sin_catalogo.map(d => <li key={d.id}>{d.codigo} · {d.archivo_nombre}</li>)}
            </ul>
          )}
        </section>

        {/* ── 3. Datos, vinculación e historial ── */}
        <div className="xl:col-span-2 space-y-6">

          {data.arl && <PanelArl arl={data.arl} postulacionId={postulacionId} onCambio={aplicar} />}

          <section className="card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Datos para el registro del empleado</h3>
              {!soloLectura && (
                <button className="btn-secondary text-xs px-3 py-1.5" onClick={verificarCedula} disabled={ocupado === 'cedula' || !data.datos_vinculacion?.cedula}>
                  {ocupado === 'cedula' ? 'Consultando…' : 'Verificar cédula en gestión'}
                </button>
              )}
            </div>

            {persona && (
              <div className={`rounded-xl border px-3 py-2.5 text-xs ${persona.vetado ? 'bg-red-50 border-red-300 text-red-800' : persona.existe ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                {persona.vetado && <div className="font-bold">⚠ Esta cédula aparece en la carpeta de VETADOS del NAS.</div>}
                {persona.existe
                  ? <div>Ya existe en gestión: <b>{persona.empleado.nombre}</b> · {persona.empleado.cargo || 'sin cargo'} · {persona.empleado.activo ? 'ACTIVO' : `retirado${persona.empleado.fecha_retiro ? ` el ${fechaCorta(persona.empleado.fecha_retiro)}` : ''}`}. {!persona.empleado.desde_reclutamiento && 'Para recontratarlo, reactívelo en gestión.'}</div>
                  : !persona.vetado && <div>La cédula {persona.cedula} no tiene historial en gestión. Se puede vincular.</div>}
              </div>
            )}

            {CAMPOS.map(g => (
              <fieldset key={g.grupo} disabled={soloLectura} className="space-y-3">
                <legend className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{g.grupo}</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {g.campos.map(c => (
                    <div key={c.id}>
                      <label className="label">{c.label}{c.req && <span className="text-red-500"> *</span>}</label>
                      {c.options || c.catalogo ? (
                        <select className="select" value={datos[c.id] ?? ''} onChange={e => setDatos(d => ({ ...d, [c.id]: e.target.value }))}>
                          {c.options
                            ? c.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)
                            : [<option key="" value="">—</option>, ...(catalogo?.[c.catalogo] || []).map(o => (
                                <option key={o.id} value={o.id}>{o.name}{o.city ? ` · ${o.city}` : ''}</option>
                              ))]}
                        </select>
                      ) : (
                        <input className="input" type={c.type || 'text'} value={datos[c.id] ?? ''}
                          onChange={e => setDatos(d => ({ ...d, [c.id]: e.target.value }))} />
                      )}
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}

            {!soloLectura && (
              <button className="btn-secondary w-full" onClick={guardarDatos} disabled={ocupado === 'datos'}>
                {ocupado === 'datos' ? 'Guardando…' : 'Guardar datos'}
              </button>
            )}
          </section>

          {!vinculado && (
            <section className={`card space-y-3 ${puedeVincular ? 'border-violet-300' : ''}`}>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Vincular a gestión</h3>
              <ul className="text-xs space-y-1.5">
                <li className={data.fase === 'vinculacion' || data.gestion_employee_id ? 'text-emerald-700' : 'text-slate-500'}>
                  {data.fase === 'vinculacion' || data.gestion_employee_id ? '✓' : '○'} Aprobó todas las fases
                </li>
                <li className={data.datos_faltantes.length ? 'text-slate-500' : 'text-emerald-700'}>
                  {data.datos_faltantes.length ? `○ Faltan datos: ${data.datos_faltantes.join(', ')}` : '✓ Datos del empleado completos'}
                </li>
                <li className={faltantesDocs.length ? 'text-amber-700' : 'text-emerald-700'}>
                  {faltantesDocs.length ? `! Faltan ${faltantesDocs.length} documento(s) requerido(s)` : '✓ Documentos requeridos cargados'}
                </li>
              </ul>
              {enMarcha && (
                <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs text-violet-800 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="w-3.5 h-3.5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    {v.estado === 'en_cola' ? 'En cola, arranca en unos segundos…' : 'Creando el empleado y subiendo documentos al NAS…'}
                  </div>
                  {v.documentos_total > 0 && (
                    <>
                      <div className="h-1.5 rounded-full bg-violet-100 overflow-hidden">
                        <div className="h-full bg-violet-500 transition-all" style={{ width: `${(v.documentos_enviados / v.documentos_total) * 100}%` }} />
                      </div>
                      <div>{v.documentos_enviados} de {v.documentos_total} documento(s) en el NAS. Puede cerrar esta ventana: sigue en segundo plano.</div>
                    </>
                  )}
                </div>
              )}
              {!enMarcha && v.estado === 'error' && v.mensaje && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{v.mensaje}</p>
              )}
              <button
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                disabled={!puedeVincular || enMarcha || ocupado === 'vincular' || (!data.gestion_employee_id && data.datos_faltantes.length > 0)}
                onClick={vincular}
              >
                {enMarcha || ocupado === 'vincular' ? 'Vinculando…' : data.gestion_employee_id ? 'Reintentar envío de documentos' : 'Vincular a gestión'}
              </button>
              <p className="text-[11px] text-slate-500">Crea el empleado y su usuario en gestión y archiva los documentos en su carpeta del NAS.</p>
            </section>
          )}

          <section className="card">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-4">Historial</h3>
            {data.historial.length === 0 ? (
              <p className="text-xs text-slate-500">Sin movimientos todavía.</p>
            ) : (
              <ol className="relative border-l border-slate-200 ml-2 space-y-4">
                {[...data.historial].reverse().map(h => (
                  <li key={h.id} className="ml-4">
                    <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ${EVENTO_COLOR[h.evento] || 'bg-slate-300'}`} />
                    <div className="text-xs font-bold text-slate-800">{EVENTO_LABEL[h.evento] || h.evento} · {h.fase_label}</div>
                    <div className="text-[11px] text-slate-500">{fecha(h.created_at, true)}{h.autor_nombre ? ` · ${h.autor_nombre}` : ''}</div>
                    {h.observacion && <div className="text-xs text-slate-600 mt-1 whitespace-pre-line">{h.observacion}</div>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
