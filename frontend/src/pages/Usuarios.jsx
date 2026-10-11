import { useEffect, useState } from 'react'
import api from '../services/api'

// Custom Modal Component for User CRUD operations
function UserFormModal({ user, onClose, onSaved }) {
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState(user?.role_id || 2)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      name,
      email,
      role_id: Number(roleId),
      ...(password ? { password } : {})
    }

    try {
      if (user) {
        await api.put(`/usuarios/${user.id}`, payload)
      } else {
        // For new users, password is required
        if (!password) {
          setError('La contraseña es obligatoria para nuevos usuarios.')
          setSaving(false)
          return
        }
        await api.post('/usuarios', payload)
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.message || 'Ocurrió un error al procesar el usuario. Por favor verifica los datos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-surface-200 rounded-2xl w-full max-w-md shadow-2xl animate-scale-up my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-200">
          <h3 className="font-bold text-lg text-surface-900">
            {user ? 'Editar Colaborador' : 'Nuevo Colaborador'}
          </h3>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-900 transition-colors p-1 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold animate-fade-in">
              {error}
            </div>
          )}

          <div>
            <label className="label">Nombre completo *</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Laura Castro"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Correo Electrónico *</label>
            <input
              type="email"
              className="input"
              placeholder="correo@hidroobras.com.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Rol / Permisos *</label>
            <select
              className="select"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              required
            >
              <option value={2}>Usuario Normal (Reclutador)</option>
              <option value={1}>Administrador (Acceso Completo)</option>
            </select>
          </div>

          <div>
            <label className="label">
              {user ? 'Contraseña (Dejar en blanco para no cambiar)' : 'Contraseña *'}
            </label>
            <input
              type="password"
              className="input"
              placeholder={user ? '••••••••' : 'Mínimo 8 caracteres'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!user}
              minLength={8}
            />
            {!user && (
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Debe contener al menos 8 caracteres para mantener la seguridad.
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-surface-200 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary py-2"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary py-2"
              disabled={saving}
            >
              {saving ? 'Guardando...' : user ? 'Actualizar Datos' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Custom Premium Confirmation Modal instead of native confirm()
function ConfirmDeleteModal({ userName, onClose, onConfirm, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white border border-surface-200 rounded-2xl w-full max-w-sm shadow-2xl animate-scale-up p-6">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4 text-red-600">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h3 className="text-lg font-bold text-surface-900 mb-2">¿Eliminar Colaborador?</h3>
        <p className="text-sm text-slate-650 mb-6 leading-relaxed">
          ¿Estás seguro de que deseas eliminar a <strong className="text-surface-850 font-bold">{userName}</strong>? Esta acción no se puede deshacer y el usuario perderá el acceso inmediato al sistema.
        </p>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            className="btn-secondary py-2 flex-1"
            onClick={onClose}
            disabled={deleting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-danger py-2 flex-1 justify-center bg-red-600 hover:bg-red-700 text-white font-semibold border-none"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? 'Eliminando...' : 'Sí, Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Usuarios() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  
  // Custom confirmation modal states
  const [deletingUser, setDeletingUser] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Notification Toast alert
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      const res = await api.get('/usuarios')
      setUsers(res.data)
    } catch (err) {
      showToast('No se pudieron cargar los usuarios del sistema.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleDelete = async () => {
    if (!deletingUser) return
    setIsDeleting(true)
    try {
      const res = await api.delete(`/usuarios/${deletingUser.id}`)
      showToast(res.data.message || 'Usuario eliminado con éxito.', 'success')
      setDeletingUser(null)
      loadUsers()
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Error al intentar eliminar el usuario.'
      showToast(errMsg, 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  // Filter users by search input
  const filteredUsers = users.filter((u) => {
    const term = search.toLowerCase()
    return (
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    )
  })

  // Get active session user from localStorage
  const currentSessionUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}')
    } catch {
      return {}
    }
  })()

  return (
    <div className="space-y-6 animate-fade-in text-surface-600 relative">
      {/* Premium Dynamic Toast Alert Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[250] flex items-center gap-3 bg-white border rounded-2xl shadow-2xl px-5 py-3.5 animate-slide-up border-surface-200">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            toast.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
          }`}>
            {toast.type === 'success' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-surface-900 leading-none">
              {toast.type === 'success' ? 'Operación Exitosa' : 'Atención'}
            </p>
            <p className="text-xs text-slate-750 font-semibold mt-1">
              {toast.message}
            </p>
          </div>
        </div>
      )}

      {/* Title Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="section-title">Colaboradores & Usuarios</h1>
          <p className="section-sub">Gestiona las credenciales de acceso y roles de reclutamiento de Hidroobras</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="relative">
            <input
              className="input w-64 pl-10"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingUser(null)
              setModalOpen(true)
            }}
            className="btn-primary"
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Colaborador
          </button>
        </div>
      </div>

      {/* Top Stat Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card flex items-center gap-5 hover:border-surface-300 transition-all duration-200 hover:shadow-card-hover">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-650 flex items-center justify-center shadow-sm">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">
              Colaboradores Activos
            </p>
            <h3 className="text-2xl font-extrabold text-surface-900 leading-tight">
              {users.length}
            </h3>
          </div>
        </div>

        <div className="card flex items-center gap-5 hover:border-surface-300 transition-all duration-200 hover:shadow-card-hover">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">
              Tu Sesión Actual
            </p>
            <h3 className="text-sm font-extrabold text-surface-900 truncate max-w-xs leading-tight">
              {currentSessionUser.email || 'Conectado'}
            </h3>
          </div>
        </div>
      </div>

      {/* Main Grid/Table Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-surface-200 shadow-sm animate-pulse-slow">
          <div className="w-9 h-9 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-slate-500 font-semibold">Cargando la lista de colaboradores...</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden border-surface-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Colaborador</th>
                  <th className="py-4 px-6">Correo Electrónico</th>
                  <th className="py-4 px-6">Rol</th>
                  <th className="py-4 px-6">Fecha de Registro</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {filteredUsers.map((u) => {
                  const initials = u.name ? u.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'U'
                  const isSelf = u.id === currentSessionUser.id

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          {/* Rich Premium initial bubble with colorful gradient */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-sm flex-shrink-0 bg-gradient-to-br ${
                            isSelf
                              ? 'from-brand-500 to-blue-600 border border-brand-300'
                              : 'from-slate-400 to-slate-500 border border-slate-300'
                          }`}>
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-surface-850 text-sm group-hover:text-surface-900 transition-colors">
                                {u.name}
                              </span>
                              {isSelf && (
                                <span className="badge bg-brand-50 text-brand-700 border border-brand-200 text-[10px] py-0 px-2 rounded-full font-bold">
                                  Tú
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-750 font-semibold">
                        {u.email}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`badge ${
                          u.role_id === 1
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-50 text-slate-650 border border-slate-200'
                        }`}>
                          {u.role_id === 1 ? 'Administrador' : 'Reclutador'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-650 font-medium">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('es-CO', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        }) : 'N/A'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-3.5">
                          <button
                            onClick={() => {
                              setEditingUser(u)
                              setModalOpen(true)
                            }}
                            className="text-xs text-brand-650 hover:text-brand-800 transition-colors font-bold"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              // If trying to delete self, show alert immediately
                              if (isSelf) {
                                showToast('No está permitido eliminar tu propio usuario de sesión.', 'error')
                                return
                              }
                              setDeletingUser(u)
                            }}
                            className={`text-xs font-bold transition-colors ${
                              isSelf
                                ? 'text-slate-350 cursor-not-allowed'
                                : 'text-red-500 hover:text-red-700'
                            }`}
                            title={isSelf ? 'No puedes eliminarte a ti mismo' : 'Eliminar usuario'}
                            disabled={isSelf}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {!filteredUsers.length && (
                  <tr>
                    <td colSpan="4" className="py-12 px-6 text-center text-slate-500 font-semibold">
                      No se encontraron colaboradores con los criterios de búsqueda especificados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Form Modal */}
      {modalOpen && (
        <UserFormModal
          user={editingUser}
          onClose={() => {
            setModalOpen(false)
            setEditingUser(null)
          }}
          onSaved={() => {
            setModalOpen(false)
            setEditingUser(null)
            showToast(editingUser ? 'Colaborador actualizado exitosamente' : 'Colaborador registrado exitosamente', 'success')
            loadUsers()
          }}
        />
      )}

      {/* Premium Confirm Delete Modal */}
      {deletingUser && (
        <ConfirmDeleteModal
          userName={deletingUser.name}
          deleting={isDeleting}
          onClose={() => setDeletingUser(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
