import { useEffect, useState, useRef } from 'react'
import api from '../services/api'
import DetailModal from '../components/DetailModal'

export default function Candidatos() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ search: '', ciudad: '', marcada: false, page: 1, per_page: 12 })
  const [ciudades, setCiudades] = useState([])
  const [selected, setSelected] = useState(null)
  const debounce = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = {
        estado_parseo: 'procesado',
        page: filters.page,
        per_page: filters.per_page,
      }
      if (filters.search) {
        params.search = filters.search
      }
      if (filters.ciudad) {
        params.ciudad = filters.ciudad
      }
      if (filters.marcada) {
        params.marcada = 1
      }
      const res = await api.get('/postulaciones', { params })
      setData(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    clearTimeout(debounce.current)
    debounce.current = setTimeout(load, 300)
  }, [filters])

  useEffect(() => {
    api.get('/postulaciones/ciudades')
      .then(res => setCiudades(res.data || []))
      .catch(err => console.error(err))
  }, [])

  const openDetail = async (id) => {
    const res = await api.get(`/postulaciones/${id}`)
    setSelected(res.data)
  }

  const nivelColor = (n) => {
    const m = {
      universitario: 'bg-blue-50 text-blue-700 border border-blue-200',
      maestria: 'bg-purple-50 text-purple-700 border border-purple-200',
      especializacion: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
      tecnologo: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
      tecnico: 'bg-teal-50 text-teal-700 border border-teal-200',
      bachillerato: 'bg-slate-50 text-slate-700 border border-slate-200'
    }
    return m[n?.toLowerCase()] || 'bg-slate-50 text-slate-600 border border-slate-200'
  }

  const candidatos = data?.data || []

  return (
    <div className="space-y-5 animate-fade-in text-surface-600">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="section-title">Candidatos Evaluados</h1>
          <p className="section-sub">{data?.total ?? 0} perfiles procesados por IA</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFilters(f => ({ ...f, marcada: !f.marcada, page: 1 }))}
            className={`text-sm font-bold rounded-lg px-3 py-2 border transition-colors flex items-center gap-1.5 ${filters.marcada ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            title="Mostrar solo hojas de vida marcadas"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            Marcadas
          </button>
          <select
            className="select w-52"
            value={filters.ciudad}
            onChange={e => setFilters(f => ({ ...f, ciudad: e.target.value, page: 1 }))}
          >
            <option value="">Todas las ciudades</option>
            {ciudades.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            className="input w-64"
            placeholder="Buscar candidato..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {candidatos.map(p => {
              const d = p.candidato?.datos_extraidos || {}
              const edu = d.educacion?.[0]
              const ev = p.candidato?.evaluaciones?.[0]
              return (
                <div
                  key={p.id}
                  onClick={() => openDetail(p.id)}
                  className={`card cursor-pointer hover:border-brand-500/40 hover:bg-slate-50/50 hover:shadow-card-hover transition-all duration-200 group flex flex-col justify-between h-full relative overflow-hidden ${p.marcada ? 'ring-1 ring-amber-300' : ''}`}
                >
                  {/* Badge de Score si existe */}
                  {ev && (
                    <div className="absolute top-3 right-3 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-lg text-[11px] font-bold text-brand-700 flex items-center gap-1">
                      <svg className="w-3 h-3 text-brand-500 fill-current" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span>{Number(ev.puntaje_total).toFixed(0)}/100</span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-start gap-3 mb-3 pr-20">
                      <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {p.nombre_completo?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 group-hover:text-brand-600 transition-colors truncate flex items-center gap-1.5">
                          {p.marcada && (
                            <svg className="w-3.5 h-3.5 text-amber-500 fill-current flex-shrink-0" viewBox="0 0 20 20" title="Marcada"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                          )}
                          <span className="truncate">{p.nombre_completo}</span>
                        </p>
                        <p className="text-xs text-slate-700 font-semibold truncate">{p.email}</p>
                        {(p.ciudad || d.ciudad) && (
                          <p className="text-xs text-slate-600 font-semibold truncate flex items-center gap-1 mt-0.5">
                            <svg className="w-3 h-3 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {p.ciudad || d.ciudad}
                          </p>
                        )}
                      </div>
                    </div>

                    {p.candidato?.resumen_ia && (
                      <p className="text-sm text-slate-800 line-clamp-2 mb-3 leading-relaxed font-normal">
                        {p.candidato.resumen_ia}
                      </p>
                    )}

                    {edu && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`badge text-xs font-bold ${nivelColor(edu.nivel)}`}>
                          {edu.nivel || 'Educación'}
                        </span>
                        <span className="text-xs text-slate-800 font-bold truncate">{edu.titulo}</span>
                      </div>
                    )}

                    {d.habilidades_tecnicas?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {d.habilidades_tecnicas.slice(0, 4).map((h, i) => (
                          <span key={i} className="badge bg-slate-100 text-slate-850 border border-slate-250 text-sm font-bold">
                            {h}
                          </span>
                        ))}
                        {d.habilidades_tecnicas.length > 4 && (
                          <span className="badge bg-slate-150 text-slate-700 text-sm font-bold">
                            +{d.habilidades_tecnicas.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                    <span className="text-sm text-slate-700 font-semibold">
                      {d.años_experiencia_total ? `${d.años_experiencia_total} años exp.` : 'Exp. no definida'}
                    </span>
                    <span className="text-sm text-brand-600 group-hover:text-brand-700 font-bold">Ver perfil →</span>
                  </div>
                </div>
              )
            })}
            {!candidatos.length && (
              <div className="col-span-1 md:col-span-2 xl:col-span-3 text-center py-16 text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl font-semibold">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p>No se encontraron candidatos procesados con los filtros de búsqueda.</p>
              </div>
            )}
          </div>

          {/* Footer de Paginación */}
          {data && data.total > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-3 sm:px-6 rounded-xl mt-4">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))}
                  disabled={filters.page === 1}
                  className="btn-secondary text-sm font-bold"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setFilters(f => ({ ...f, page: Math.min(data.last_page, f.page + 1) }))}
                  disabled={filters.page === data.last_page}
                  className="btn-secondary text-sm font-bold"
                >
                  Siguiente
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-800 font-semibold">
                    Mostrando <span className="font-medium text-slate-800">{data.from || 0}</span> a <span className="font-medium text-slate-800">{data.to || 0}</span> de <span className="font-medium text-slate-800">{data.total || 0}</span> candidatos
                  </p>
                  <span className="text-slate-250">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-slate-700 font-semibold">Mostrar</span>
                    <select
                      className="select !py-1 !px-2 text-sm font-bold w-16"
                      value={filters.per_page}
                      onChange={e => setFilters(f => ({ ...f, per_page: Number(e.target.value), page: 1 }))}
                    >
                      {[9, 12, 24, 48].map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                      onClick={() => setFilters(f => ({ ...f, page: 1 }))}
                      disabled={filters.page === 1}
                      className="relative inline-flex items-center rounded-l-md px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-bold text-slate-800"
                    >
                      « Primero
                    </button>
                    <button
                      onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))}
                      disabled={filters.page === 1}
                      className="relative inline-flex items-center px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-bold text-slate-800"
                    >
                      ‹ Ant
                    </button>
                    
                    {Array.from({ length: data.last_page }, (_, i) => {
                      const p = i + 1
                      if (data.last_page > 5 && Math.abs(filters.page - p) > 2 && p !== 1 && p !== data.last_page) {
                        return null
                      }
                      return (
                        <button
                          key={p}
                          onClick={() => setFilters(f => ({ ...f, page: p }))}
                          className={`relative inline-flex items-center px-3 py-1 text-sm font-bold border ${
                            filters.page === p
                              ? 'z-10 bg-brand-500 text-white border-brand-500 shadow-sm'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                          } transition-colors`}
                        >
                          {p}
                        </button>
                      )
                    })}

                    <button
                      onClick={() => setFilters(f => ({ ...f, page: Math.min(data.last_page, f.page + 1) }))}
                      disabled={filters.page === data.last_page}
                      className="relative inline-flex items-center px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-bold text-slate-800"
                    >
                      Sig ›
                    </button>
                    <button
                      onClick={() => setFilters(f => ({ ...f, page: data.last_page }))}
                      disabled={filters.page === data.last_page}
                      className="relative inline-flex items-center rounded-r-md px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-bold text-slate-800"
                    >
                      Último »
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {selected && (
        <DetailModal
          postulacion={selected}
          onClose={() => setSelected(null)}
          onUpdated={load}
        />
      )}
    </div>
  )
}
