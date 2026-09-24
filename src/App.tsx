import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import Welcome from '@/pages/Welcome'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import FindLeads from '@/pages/FindLeads'
import Leads from '@/pages/Leads'

export default function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="prospeccao" element={<FindLeads />} />
        <Route path="leads" element={<Leads />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
