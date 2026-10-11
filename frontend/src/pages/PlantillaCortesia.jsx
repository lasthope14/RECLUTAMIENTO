import { useEffect, useState } from 'react'
import api from '../services/api'

export default function PlantillaCortesia() {
  const [subjectAprobado, setSubjectAprobado] = useState('')
  const [bodyAprobado, setBodyAprobado] = useState('')
  const [subjectRechazo, setSubjectRechazo] = useState('')
  const [bodyRechazo, setBodyRechazo] = useState('')
  const [activeTab, setActiveTab] = useState('cortesia') // 'cortesia' or 'cortesia_rechazo'
  
  const [testEmail, setTestEmail] = useState('')
  const [candidates, setCandidates] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [sendingBulk, setSendingBulk] = useState(false)
  
  // Custom Toast Alert
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  // Load Templates and Candidates
  const loadData = async () => {
    try {
      setLoading(true)
      // 1. Fetch courtesy templates in parallel
      const [templateRes, templateRejRes] = await Promise.all([
        api.get('/email-templates/cortesia'),
        api.get('/email-templates/cortesia-rechazo')
      ])
      setSubjectAprobado(templateRes.data.subject)
      setBodyAprobado(templateRes.data.body)
      setSubjectRechazo(templateRejRes.data.subject)
      setBodyRechazo(templateRejRes.data.body)

      // 2. Fetch postulaciones (filter received ones in the front for accuracy)
      const postulationsRes = await api.get('/postulaciones?per_page=500')
      const dataList = Array.isArray(postulationsRes.data) 
        ? postulationsRes.data 
        : (postulationsRes.data.data || [])
      const received = dataList.filter(p => p.estado === 'recibida')
      setCandidates(received)
    } catch (err) {
      showToast('Error al cargar la información del servidor.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const subject = activeTab === 'cortesia' ? subjectAprobado : subjectRechazo
  const body = activeTab === 'cortesia' ? bodyAprobado : bodyRechazo

  const handleSubjectChange = (val) => {
    if (activeTab === 'cortesia') setSubjectAprobado(val)
    else setSubjectRechazo(val)
  }

  const handleBodyChange = (val) => {
    if (activeTab === 'cortesia') setBodyAprobado(val)
    else setBodyRechazo(val)
  }

  // Save Template
  const handleSave = async () => {
    if (!subject || !body) {
      showToast('El asunto y el cuerpo del correo son requeridos.', 'error')
      return
    }
    setSaving(true)
    try {
      await api.put(`/email-templates/${activeTab}`, { subject, body })
      showToast('Plantilla guardada con éxito.', 'success')
    } catch (err) {
      showToast(err.response?.data?.message || 'Error al guardar la plantilla.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Send Test Email
  const handleSendTest = async (e) => {
    e.preventDefault()
    if (!testEmail) {
      showToast('Por favor ingresa un correo de pruebas.', 'error')
      return
    }
    setSendingTest(true)
    try {
      const res = await api.post('/email-templates/enviar-prueba', {
        email: testEmail,
        subject,
        body
      })
      showToast(res.data.message || 'Correo de prueba enviado con éxito.', 'success')
    } catch (err) {
      showToast(err.response?.data?.message || 'Error al enviar el correo de prueba.', 'error')
    } finally {
      setSendingTest(false)
    }
  }

  // Send to Selected Candidates
  const handleSendToCandidates = async (sendAll = false) => {
    const idsToSend = sendAll 
      ? candidates.map(c => c.id)
      : Array.from(selectedIds)

    if (idsToSend.length === 0) {
      showToast('Por favor selecciona al menos un candidato.', 'error')
      return
    }

    setSendingBulk(true)
    try {
      const res = await api.post('/email-templates/enviar-candidatos', {
        postulacion_ids: idsToSend
      })
      
      const successCount = res.data.sent_count
      const failedCount = res.data.failed_count
      
      if (failedCount === 0) {
        showToast(`Respuestas enviadas con éxito a ${successCount} candidato(s).`, 'success')
      } else {
        showToast(`Envío finalizado: ${successCount} exitosos, ${failedCount} fallidos.`, 'warning')
      }

      setSelectedIds(new Set())
      loadData()
    } catch (err) {
      showToast(err.response?.data?.message || 'Error al realizar el envío masivo.', 'error')
    } finally {
      setSendingBulk(false)
    }
  }

  // Handle Select All Checkbox
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(candidates.map(c => c.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  // Handle Single Checkbox Select
  const handleSelectOne = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  // Compile real-time mockup preview of HTML template wrapping the plain text
  const getCompiledPreview = () => {
    if (!body) return ''
    
    // Replace placeholders first
    const compiledText = body
      .replace(/\{\{nombre\}\}/g, 'Alejandro Santamaría')
      .replace(/\{\{cargo\}\}/g, 'Ingeniero Residente')
      
    // Convert plain text double-newlines to formatted HTML paragraphs
    const paragraphs = compiledText
      .split('\n\n')
      .map(p => p.trim())
      .filter(p => p !== '')
      .map(p => `<p style="font-size: 14.5px; color: #475569; line-height: 1.6; margin-bottom: 20px;">${p.replace(/\n/g, '<br />')}</p>`)
      .join('')

    const previewTitle = activeTab === 'cortesia' ? '¡Hemos recibido tu postulación!' : 'Agradecemos tu postulación'

    return `
<div style="font-family: 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif; background-color: #f8fafc; padding: 40px 20px; text-align: center; margin: 0;">
    <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03); text-align: left; padding: 40px;">
        
        <!-- Logo -->
        <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://reclutamiento.hidroobras.com.co/assets/logo.png" alt="Hidroobras S.A.S" style="max-width: 220px; height: auto; display: inline-block;" />
        </div>

        <!-- Title -->
        <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 25px; text-align: center; text-transform: uppercase; letter-spacing: 0.02em;">${previewTitle}</h2>

        <!-- Paragraphs Content -->
        ${paragraphs}

        <!-- Accent Line -->
        <div style="height: 1px; background-color: #e2e8f0; margin-top: 25px; margin-bottom: 25px;"></div>

        <!-- Footer / Signature -->
        <div style="text-align: center;">
            <p style="margin: 0; font-size: 14px; font-weight: 700; color: #0f172a;">Atentamente,</p>
            <p style="margin: 4px 0 0 0; font-size: 13.5px; font-weight: 600; color: #64748b;">Equipo de Gestión Humana</p>
            <p style="margin: 2px 0 0 0; font-size: 13.5px; font-weight: 700; color: #0284c7;">Hidroobras S.A.S</p>
            
            <p style="margin-top: 30px; font-size: 11px; color: #94a3b8; line-height: 1.4; border-top: 1px dashed #e2e8f0; padding-top: 15px;">
                Este es un mensaje automático. Por favor, no respondas directamente a esta dirección de correo.
            </p>
        </div>

    </div>
</div>
    `
  }

  return (
    <div className="space-y-6 animate-fade-in text-surface-600 relative">
      
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-4 right-4 z-[250] flex items-center gap-3 bg-white border rounded-2xl shadow-2xl px-5 py-3.5 animate-slide-up border-surface-200">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            toast.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-650'
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

      {/* Header */}
      <div>
        <h1 className="section-title">Plantillas de Respuesta de Cortesía</h1>
        <p className="section-sub">Personaliza y gestiona las plantillas de correo de cortesía enviadas automáticamente según la evaluación del candidato.</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-surface-200 shadow-sm animate-pulse-slow">
          <div className="w-9 h-9 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-slate-500 font-semibold">Cargando el editor de plantillas...</p>
        </div>
      ) : (
        <>
          {/* Workspace split view */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Panel: Editor */}
            <div className="lg:col-span-6 space-y-6">
              <div className="card space-y-4 shadow-sm border-surface-200">
                <h3 className="font-bold text-base text-surface-900 border-b border-surface-150 pb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand-650" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Gestor de Plantillas
                </h3>

                {/* Tab Selector */}
                <div className="flex border-b border-surface-200">
                  <button
                    onClick={() => setActiveTab('cortesia')}
                    className={`flex-1 text-center pb-2.5 font-bold text-xs border-b-2 transition-all ${
                      activeTab === 'cortesia'
                        ? 'border-brand-500 text-brand-600'
                        : 'border-transparent text-slate-450 hover:text-slate-700'
                    }`}
                  >
                    Aprobados (Score ≥ 70%)
                  </button>
                  <button
                    onClick={() => setActiveTab('cortesia_rechazo')}
                    className={`flex-1 text-center pb-2.5 font-bold text-xs border-b-2 transition-all ${
                      activeTab === 'cortesia_rechazo'
                        ? 'border-brand-500 text-brand-600'
                        : 'border-transparent text-slate-450 hover:text-slate-700'
                    }`}
                  >
                    Rechazados (Score &lt; 70%)
                  </button>
                </div>

                <div>
                  <label className="label">Asunto del Correo *</label>
                  <input
                    type="text"
                    className="input font-semibold"
                    placeholder="Ej: Confirmación de Postulación Recibida"
                    value={subject}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    Puedes usar el tag <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold">{"{{cargo}}"}</code> para incluir dinámicamente el nombre de la vacante.
                  </p>
                </div>

                <div>
                  <label className="label">Mensaje del Correo *</label>
                  <textarea
                    className="input text-xs font-semibold p-4 rounded-xl focus:ring-1 focus:ring-brand-500"
                    style={{ minHeight: '260px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13.5px', lineHeight: '1.6' }}
                    value={body}
                    onChange={(e) => handleBodyChange(e.target.value)}
                    placeholder="Escribe el contenido del mensaje de correo..."
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1 font-medium leading-relaxed">
                    No se admiten etiquetas HTML. Simplemente escribe el mensaje del correo separando los párrafos con un doble salto de línea. Usa los tags obligatorios <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold">{"{{nombre}}"}</code> y <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold">{"{{cargo}}"}</code> para autocompletar la información del candidato.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary w-full justify-center py-2.5 rounded-xl font-bold"
                  >
                    {saving ? 'Guardando Plantilla...' : 'Guardar Cambios en esta Plantilla'}
                  </button>
                </div>
              </div>

              {/* Test Delivery Card */}
              <div className="card shadow-sm border-surface-200">
                <h3 className="font-bold text-base text-surface-900 border-b border-surface-150 pb-2 flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Enviar Correo de Prueba (Revisión Real)
                </h3>
                <p className="text-xs text-slate-650 mb-4 leading-relaxed font-semibold">
                  Recibe una simulación real de la plantilla actualmente activa en tu bandeja de entrada para verificar el diseño final.
                </p>
                <form onSubmit={handleSendTest} className="flex gap-2">
                  <input
                    type="email"
                    className="input flex-1 py-2"
                    placeholder="ejemplo@hidroobras.com.co"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="btn-secondary py-2 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold flex-shrink-0"
                    disabled={sendingTest}
                  >
                    {sendingTest ? 'Enviando...' : 'Enviar Prueba'}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Panel: Inbox preview */}
            <div className="lg:col-span-6 sticky top-6">
              <div className="card shadow-sm border-surface-200 p-0 overflow-hidden flex flex-col" style={{ minHeight: '580px' }}>
                
                {/* Inbox Window Title Bar */}
                <div className="bg-slate-100 border-b border-surface-200 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5 flex-shrink-0">
                    <span className="w-3 h-3 rounded-full bg-red-400 inline-block"></span>
                    <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span>
                    <span className="w-3 h-3 rounded-full bg-green-400 inline-block"></span>
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mx-auto pr-8">
                    Vista Previa ({activeTab === 'cortesia' ? 'Aprobados ≥ 70%' : 'Rechazados < 70%'})
                  </div>
                </div>

                {/* Sender/Receiver Pannel */}
                <div className="p-4 border-b border-surface-200 bg-white space-y-1.5">
                  <div className="text-xs text-slate-750 font-bold">
                    <span className="text-slate-450 mr-1.5">De:</span> Hidroobras Recruiter &lt;no-reply@hidroobras.com.co&gt;
                  </div>
                  <div className="text-xs text-slate-750 font-bold">
                    <span className="text-slate-450 mr-1.5">Para:</span> Alejandro Santamaría &lt;candidato@correo.com&gt;
                  </div>
                  <div className="text-sm font-bold text-surface-900 pt-1 flex items-center gap-1.5">
                    <span className="text-slate-450 text-xs font-bold mr-1.5">Asunto:</span>
                    {subject.replace(/\{\{cargo\}\}/g, 'Ingeniero Residente') || '(Sin Asunto)'}
                  </div>
                </div>

                {/* Email HTML Container */}
                <div className="flex-1 bg-slate-50 p-4 overflow-y-auto max-h-[500px]">
                  {body ? (
                    <div 
                      className="bg-white rounded-xl shadow-xs overflow-hidden border border-surface-200"
                      dangerouslySetInnerHTML={{ __html: getCompiledPreview() }}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs font-semibold py-20 italic">
                      Escribe contenido en el editor de la izquierda para ver la visualización de cortesía.
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>

          {/* Bottom Panel: Candidates dispatcher */}
          <div className="card shadow-sm border-surface-200">
            <div className="flex items-center justify-between border-b border-surface-150 pb-4 mb-4 flex-wrap gap-4">
              <div>
                <h3 className="font-bold text-base text-surface-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Candidatos Pendientes por Responder
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Listado de candidatos cuyas postulaciones están en estado <strong>Recibida</strong>. El sistema enviará la plantilla correspondiente según su calificación de Inteligencia Artificial.
                </p>
              </div>

              {candidates.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSendToCandidates(false)}
                    disabled={sendingBulk || selectedIds.size === 0}
                    className="btn-secondary text-xs py-2 bg-white text-slate-800 border border-surface-250 font-bold"
                  >
                    Enviar a Seleccionados ({selectedIds.size})
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`¿Estás seguro de que deseas enviar la respuesta de cortesía correspondiente a los ${candidates.length} candidatos pendientes?`)) {
                        handleSendToCandidates(true)
                      }
                    }}
                    disabled={sendingBulk}
                    className="btn-primary text-xs py-2 font-bold"
                  >
                    {sendingBulk ? 'Enviando Respuestas...' : `Enviar a Todos los Pendientes (${candidates.length})`}
                  </button>
                </div>
              )}
            </div>

            {candidates.length === 0 ? (
              <div className="py-12 text-center text-slate-500 font-semibold border-2 border-dashed border-slate-100 rounded-2xl">
                <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                No hay candidatos en estado "Recibida" pendientes por responder cortesía.
              </div>
            ) : (
              <div className="overflow-x-auto border border-surface-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-surface-200 bg-surface-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-5 w-12 text-center">
                        <input
                           type="checkbox"
                           onChange={handleSelectAll}
                           checked={selectedIds.size === candidates.length && candidates.length > 0}
                           className="w-4 h-4 rounded accent-brand-500 bg-white border-surface-200 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-5">Postulante</th>
                      <th className="py-3 px-5">Correo Electrónico</th>
                      <th className="py-3 px-5">Cargo Convocatoria</th>
                      <th className="py-3 px-5 text-center">Calificación IA</th>
                      <th className="py-3 px-5 text-center">Acción Estimada</th>
                      <th className="py-3 px-5">Fecha de Recepción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-200 text-sm">
                    {candidates.map((c) => {
                      const initials = c.nombre_completo ? c.nombre_completo.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'U'
                      
                      // Extract score corresponding to c.perfil_cargo_id
                      let score = null;
                      if (c.candidato && c.candidato.evaluaciones && c.candidato.evaluaciones.length > 0) {
                        const activeEval = c.candidato.evaluaciones.find(e => e.perfil_cargo_id === c.perfil_cargo_id);
                        if (activeEval) {
                          score = parseFloat(activeEval.puntaje_total);
                        }
                      }
                      
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-5 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(c.id)}
                              onChange={() => handleSelectOne(c.id)}
                              className="w-4 h-4 rounded accent-brand-500 bg-white border-surface-200 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-650 flex items-center justify-center font-bold text-xs">
                                {initials}
                              </div>
                              <span className="font-bold text-surface-850">{c.nombre_completo}</span>
                            </div>
                          </td>
                          <td className="py-3 px-5 font-semibold text-slate-750">
                            {c.email}
                          </td>
                          <td className="py-3 px-5">
                            <span className="badge bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold py-0.5">
                              {c.perfil_cargo ? c.perfil_cargo.nombre : 'Convocatoria General'}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-center">
                            {score !== null ? (
                              <span className={`badge text-xs font-bold py-0.5 px-2.5 rounded-full border ${
                                score >= 70 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-red-50 text-red-750 border-red-200'
                              }`}>
                                {score.toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-xs text-slate-450 font-semibold italic">Sin evaluar</span>
                            )}
                          </td>
                          <td className="py-3 px-5 text-center">
                            {score !== null && score < 70 ? (
                              <span className="badge bg-red-50 text-red-700 border border-red-150 text-[10px] font-extrabold py-0.5 px-2">
                                📩 Enviar Rechazo (Score &lt; 70%)
                              </span>
                            ) : (
                              <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-150 text-[10px] font-extrabold py-0.5 px-2">
                                ✉️ Enviar Recibido (Score ≥ 70%)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-5 font-medium text-slate-650">
                            {c.created_at ? new Date(c.created_at).toLocaleDateString('es-CO', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            }) : 'N/A'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  )
}
