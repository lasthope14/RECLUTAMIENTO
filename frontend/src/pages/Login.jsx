import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'

// Ventana emergente, como "Iniciar sesion con Google". Si el navegador la
// bloquea, el enlace sigue su curso normal y el ingreso se hace con redireccion.
function abrirHidroobrasId(evento) {
  const ancho = 480
  const alto = 640
  const izquierda = window.screenX + (window.outerWidth - ancho) / 2
  const arriba = window.screenY + (window.outerHeight - alto) / 2

  const ventana = window.open(
    '/auth/hidroobras?popup=1',
    'hidroobras_id',
    `width=${ancho},height=${alto},left=${izquierda},top=${arriba}`
  )

  if (ventana) {
    evento.preventDefault()
    ventana.focus()
  }
}

export default function Login() {
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(searchParams.get('sso_error') || '')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/login', { email, password })
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl mb-4 shadow-md">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-surface-900">Hidroobras Recruiter</h1>
          <p className="text-surface-500 text-sm mt-1">Sistema de Gestión de Talento Humano</p>
        </div>

        {/* Card */}
        <div className="card border-surface-200 shadow-xl">
          <h2 className="text-lg font-semibold text-surface-900 mb-6">Iniciar sesión</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <a
            href="/auth/hidroobras"
            id="btn-hidroobras-id"
            onClick={abrirHidroobrasId}
            className="btn-primary w-full justify-center py-2.5"
          >
            Entrar con Hidroobras ID
          </a>
          <p className="text-center text-xs text-surface-400 mt-2">
            Con el mismo usuario y contraseña de tu correo
          </p>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 border-t border-surface-200" />
            <span className="text-xs text-surface-400">o con tu contraseña de esta aplicación</span>
            <div className="flex-1 border-t border-surface-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="usuario@hidroobras.com.co"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              id="btn-login"
              className="btn-primary w-full justify-center py-2.5 mt-2"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Ingresando...
                </span>
              ) : 'Ingresar al sistema'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-surface-400 mt-6">
          © 2025 Hidroobras S.A.S · Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}
