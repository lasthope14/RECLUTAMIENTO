import { useEffect, useState } from 'react'
import api from '../services/api'

const REQ_DEFAULTS = { educacion_min: '', experiencia_min_años: '', habilidades_requeridas: '', certificaciones: '', tipo_contrato: '' }

function PerfilForm({ perfil, onClose, onSaved }) {
  const [form, setForm] = useState({
    nombre: perfil?.nombre || '',
    area: perfil?.area || '',
    descripcion: perfil?.descripcion || '',
    salario_rango: perfil?.salario_rango || '',
    activo: perfil?.activo ?? true,
    fecha_apertura: perfil?.fecha_apertura || '',
    fecha_cierre: perfil?.fecha_cierre || '',
  })
  const [req, setReq] = useState({
    educacion_min: perfil?.requisitos?.educacion_min || '',
    experiencia_min_años: perfil?.requisitos?.experiencia_min_años || '',
    habilidades_requeridas: (perfil?.requisitos?.habilidades_requeridas || []).join(', '),
    certificaciones: (perfil?.requisitos?.certificaciones || []).join(', '),
    tipo_contrato: perfil?.requisitos?.tipo_contrato || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    const payload = {
      ...form,
      requisitos: {
        educacion_min: req.educacion_min,
        experiencia_min_años: Number(req.experiencia_min_años) || 0,
        habilidades_requeridas: req.habilidades_requeridas.split(',').map(s => s.trim()).filter(Boolean),
        certificaciones: req.certificaciones.split(',').map(s => s.trim()).filter(Boolean),
        tipo_contrato: req.tipo_contrato,
      },
    }
    try {
      if (perfil) await api.put(`/perfiles-cargo/${perfil.id}`, payload)
      else await api.post('/perfiles-cargo', payload)
      onSaved()
    } catch (err) { setError(err.response?.data?.message || 'Error al guardar') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-surface-200 rounded-2xl w-full max-w-2xl shadow-2xl animate-slide-up my-4">
        <div className="flex items-center justify-between p-5 border-b border-surface-200">
          <h3 className="font-semibold text-surface-800">{perfil ? 'Editar perfil de cargo' : 'Nuevo perfil de cargo'}</h3>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-900 transition-colors font-bold">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}
          
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nombre del cargo *</label>
              <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Área</label>
              <input className="input" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} />
            </div>
            <div>
              <label className="label">Salario</label>
              <input className="input" placeholder="Ej: $4.000.000 - $5.000.000" value={form.salario_rango} onChange={e => setForm(f => ({ ...f, salario_rango: e.target.value }))} />
            </div>
            <div>
              <label className="label">Fecha apertura</label>
              <input type="date" className="input" value={form.fecha_apertura} onChange={e => setForm(f => ({ ...f, fecha_apertura: e.target.value }))} />
            </div>
            <div>
              <label className="label">Fecha cierre</label>
              <input type="date" className="input" value={form.fecha_cierre} onChange={e => setForm(f => ({ ...f, fecha_cierre: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Descripción</label>
              <textarea className="input" rows={3} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>
          </div>

          <div className="border-t border-surface-200 pt-4">
            <p className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3">Requisitos para la IA</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Educación mínima</label>
                <input className="input" placeholder="Ej: Ingeniería Civil" value={req.educacion_min} onChange={e => setReq(r => ({ ...r, educacion_min: e.target.value }))} />
              </div>
              <div>
                <label className="label">Experiencia mínima (años)</label>
                <input type="number" className="input" value={req.experiencia_min_años} onChange={e => setReq(r => ({ ...r, experiencia_min_años: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Habilidades requeridas (separadas por coma)</label>
                <input className="input" placeholder="AutoCAD, Civil 3D, SISO..." value={req.habilidades_requeridas} onChange={e => setReq(r => ({ ...r, habilidades_requeridas: e.target.value }))} />
              </div>
              <div>
                <label className="label">Certificaciones</label>
                <input className="input" placeholder="HSEQ, Alturas..." value={req.certificaciones} onChange={e => setReq(r => ({ ...r, certificaciones: e.target.value }))} />
              </div>
              <div>
                <label className="label">Tipo de contrato</label>
                <input className="input" placeholder="Obra y Labor" value={req.tipo_contrato} onChange={e => setReq(r => ({ ...r, tipo_contrato: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-surface-200 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="w-4 h-4 rounded accent-brand-500 bg-white border-surface-200" />
              <span className="text-sm text-slate-850 font-bold">Convocatoria activa</span>
            </label>
            <div className="flex gap-3 ml-auto">
              <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Guardando...' : perfil ? 'Actualizar' : 'Crear perfil'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PerfilesCargo() {
  const [perfiles, setPerfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')

  const load = async () => {
    const res = await api.get('/perfiles-cargo')
    setPerfiles(res.data); setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleActivo = async (p) => {
    await api.put(`/perfiles-cargo/${p.id}`, { ...p, activo: !p.activo })
    load()
  }

  const del = async (id) => {
    if (!confirm('¿Eliminar este perfil?')) return
    await api.delete(`/perfiles-cargo/${id}`)
    load()
  }

  const filtered = perfiles.filter(p => !search || p.nombre.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-5 animate-fade-in text-surface-600">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="section-title">Perfiles de Cargo</h1>
          <p className="section-sub">Gestión de vacantes y convocatorias</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <input className="input w-52" placeholder="Buscar cargo..." value={search} onChange={e => setSearch(e.target.value)} />
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo cargo
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="card hover:border-surface-300 transition-all duration-200 hover:shadow-card-hover flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-surface-800 truncate text-base">{p.nombre}</p>
                    <p className="text-xs text-slate-700 mt-0.5 font-bold">{p.area || 'General'}</p>
                  </div>
                  <span className={`badge flex-shrink-0 ${
                    p.activo 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-surface-50 text-slate-650 border border-slate-200'
                  }`}>
                    {p.activo ? 'Activo' : 'Cerrado'}
                  </span>
                </div>
                
                {p.descripcion && (
                  <p className="text-sm text-slate-750 line-clamp-2 mb-4 leading-relaxed font-normal">
                    {p.descripcion}
                  </p>
                )}
                
                {p.requisitos && (
                  <div className="space-y-2 mb-4 bg-slate-50/70 p-3 rounded-xl border border-surface-200/50">
                    {p.requisitos.educacion_min && (
                      <div className="flex items-center gap-2 text-sm text-slate-800 font-bold">
                        <svg className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                        </svg>
                        <span className="truncate">{p.requisitos.educacion_min}</span>
                      </div>
                    )}
                    
                    {p.requisitos.experiencia_min_años > 0 && (
                      <div className="flex items-center gap-2 text-sm text-slate-800 font-bold">
                        <svg className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{p.requisitos.experiencia_min_años} {p.requisitos.experiencia_min_años === 1 ? 'año' : 'años'} de experiencia</span>
                      </div>
                    )}
                    
                    {p.requisitos.habilidades_requeridas?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-surface-200/50">
                        {p.requisitos.habilidades_requeridas.slice(0, 3).map((h, i) => (
                          <span key={i} className="badge bg-white text-slate-850 border border-slate-250 text-xs font-bold py-1 px-2.5 rounded-lg">
                            {h}
                          </span>
                        ))}
                        {p.requisitos.habilidades_requeridas.length > 3 && (
                          <span className="badge bg-white text-slate-850 border border-slate-250 text-xs font-bold py-1 px-2 rounded-lg font-mono">
                            +{p.requisitos.habilidades_requeridas.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-surface-200 mt-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-750 font-bold">
                  <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {p.postulaciones_count ?? 0} {p.postulaciones_count === 1 ? 'postulación' : 'postulaciones'}
                </div>
                <div className="flex gap-2.5">
                  <button onClick={() => toggleActivo(p)} className="text-sm text-slate-800 hover:text-amber-700 transition-colors font-extrabold">{p.activo ? 'Cerrar' : 'Abrir'}</button>
                  <button onClick={() => { setEditing(p); setShowForm(true) }} className="text-sm text-slate-800 hover:text-brand-700 transition-colors font-extrabold">Editar</button>
                  <button onClick={() => del(p.id)} className="text-sm text-slate-800 hover:text-red-700 transition-colors font-extrabold">Eliminar</button>
                </div>
              </div>
            </div>
          ))}
          {!filtered.length && (
            <div className="col-span-1 md:col-span-2 xl:col-span-3 card text-center py-12 text-slate-600 font-semibold border-surface-200">
              No se encontraron perfiles de cargo. Crea el primero para comenzar.
            </div>
          )}
        </div>
      )}

      {showForm && <PerfilForm perfil={editing} onClose={() => { setShowForm(false); setEditing(null) }} onSaved={() => { setShowForm(false); setEditing(null); load() }} />}
    </div>
  )
}
