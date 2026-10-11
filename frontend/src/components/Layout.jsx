import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import api from '../services/api'

const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
}

/* ── Indicador de progreso IA flotante ────────────────────────────── */
function IaProgressIndicator() {
  const [pendientes, setPendientes] = useState(null)   // null = cargando
  const [procesando, setProcesando] = useState(0)
  const [inicial, setInicial]       = useState(null)   // referencia para el %
  const [showDone, setShowDone]     = useState(false)
  const doneTimer                   = useRef(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const { data } = await api.get('/evaluaciones/pendientes-count')
        const p = data.pendientes
        const q = data.procesando

        setProcesando(q)
        setPendientes(prev => {
          // Registrar el máximo visto como referencia para el %
          setInicial(i => (i == null && p > 0) ? p : (p > (i ?? 0) ? p : i))

          // Si pasó de >0 a 0 → mostrar éxito
          if (prev !== null && prev > 0 && p === 0 && q === 0) {
            clearTimeout(doneTimer.current)
            setShowDone(true)
            doneTimer.current = setTimeout(() => setShowDone(false), 5000)
          }
          return p
        })
      } catch {}
    }
    poll()
    const id = setInterval(poll, 7000)
    return () => { clearInterval(id); clearTimeout(doneTimer.current) }
  }, [])

  const total   = pendientes ?? 0
  const visible = showDone || total > 0 || procesando > 0
  if (!visible) return null

  /* Progreso: cuánto se ha completado desde el máximo visto */
  const pct    = inicial ? Math.round(((inicial - total) / inicial) * 100) : 0
  const radius = 16
  const circ   = 2 * Math.PI * radius
  const filled = (pct / 100) * circ

  if (showDone && total === 0 && procesando === 0) {
    return (
      <div className="fixed top-4 right-4 z-[200] flex items-center gap-2 bg-white text-emerald-900 border border-emerald-300 text-sm font-bold px-5 py-3 rounded-2xl shadow-lg animate-slide-up">
        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
        <span>Análisis IA completado</span>
      </div>
    )
  }

  return (
    <div className="fixed top-4 right-4 z-[200] flex items-center gap-3 bg-white border border-surface-200 rounded-2xl shadow-xl px-4 py-3 animate-slide-up">
      {/* Anillo de progreso circular */}
      <div className="relative w-10 h-10 flex-shrink-0">
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="3"/>
          <circle cx="20" cy="20" r={radius} fill="none" stroke="#2563eb" strokeWidth="3"
            strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
            className="transition-all duration-700 ease-out"/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-extrabold text-brand-700 leading-none tabular-nums">{pct}%</span>
        </div>
      </div>

      {/* Texto */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-base font-bold text-surface-900 leading-none tabular-nums">{total}</span>
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse flex-shrink-0"/>
        </div>
        <p className="text-xs text-slate-750 font-semibold mt-1 whitespace-nowrap">
          {procesando > 0 ? `${procesando} analizando · ` : ''}{total} pendientes IA
        </p>
      </div>
    </div>
  )
}

const navItems = [
  {
    to: '/dashboard', label: 'Dashboard',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    to: '/postulaciones', label: 'Candidatos',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    to: '/seleccion', label: 'Proceso de Selección',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M9 4h6m-6 0a1 1 0 00-1 1v1h8V5a1 1 0 00-1-1M8 6H6a2 2 0 00-2 2v11a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-2" /></svg>,
  },
  {
    to: '/alertas', label: 'Alertas',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  },
  {
    to: '/asistente-ia', label: 'Asistente Chat IA',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21m0 0l-.813-5.096M9 21h3.75m-6.75 0H3m16.5 0h-3.75m3.75 0l-.813-5.096M19.5 21H21M12 3v3.75m0-3.75a3.75 3.75 0 110 7.5 3.75 3.75 0 010-7.5zM9.75 8.25h4.5m-4.5 3.75h4.5M3 11.25a9 9 0 0118 0v3.75a9 9 0 01-18 0v-3.75z" /></svg>,
  },
  {
    to: '/perfiles-cargo', label: 'Perfiles de Cargo',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  },
  {
    to: '/usuarios', label: 'Usuarios',
    adminOnly: true,
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  },
  {
    to: '/plantilla-cortesia', label: 'Respuesta Cortesía',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-2.25-1.5a2 2 0 00-2.22 0l-2.25 1.5" /></svg>,
  },
]

export default function Layout() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState(getUser())

  useEffect(() => {
    // Refresh active user details from database to keep roles/permissions in sync
    api.get('/me')
      .then((res) => {
        if (res.data && JSON.stringify(res.data) !== JSON.stringify(user)) {
          localStorage.setItem('user', JSON.stringify(res.data))
          setUser(res.data)
        }
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    try { await api.post('/logout') } catch {}
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">

      {/* ── Sidebar ── */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-surface-200 flex flex-col transform transition-transform duration-200 lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-surface-200 flex-shrink-0">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center shadow-sm">
            <svg className="w-4.5 h-4.5 text-white w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-surface-900 leading-tight">Hidroobras</p>
            <p className="text-xs text-slate-650 font-bold">AI Recruiter</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <p className="px-3 pt-3 pb-1.5 text-xs font-extrabold text-slate-605 uppercase tracking-wider">Menú</p>
          {navItems
            .filter((item) => !item.adminOnly || user.role_id === 1)
            .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-surface-200 flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-50 border border-surface-200">
            <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-xs font-bold text-brand-700 flex-shrink-0">
              {user.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{user.name ?? 'Usuario'}</p>
              <p className="text-xs text-slate-700 font-medium truncate">{user.email ?? ''}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-600 hover:text-red-650 transition-colors p-1 rounded font-bold"
              title="Cerrar sesión"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 bg-white border-b border-surface-200 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-surface-500 hover:text-surface-800">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-bold text-surface-900">Hidroobras Recruiter</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* ── Indicador global de progreso IA ── */}
      <IaProgressIndicator />
    </div>
  )
}
