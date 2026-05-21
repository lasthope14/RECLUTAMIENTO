import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Postulaciones from './pages/Postulaciones'
import PerfilesCargo from './pages/PerfilesCargo'

const queryClient = new QueryClient()

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="postulaciones" element={<Postulaciones />} />
            {/* Alias legados */}
            <Route path="candidatos" element={<Navigate to="/postulaciones" replace />} />
            <Route path="evaluacion-ia" element={<Navigate to="/postulaciones" replace />} />
            <Route path="perfiles-cargo" element={<PerfilesCargo />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
