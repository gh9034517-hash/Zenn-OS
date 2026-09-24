import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import Welcome from '@/pages/Welcome'
import Login from '@/pages/Login'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const FindLeads = lazy(() => import('@/pages/FindLeads'))
const Leads = lazy(() => import('@/pages/Leads'))
const Clients = lazy(() => import('@/pages/Clients'))
const ClientDetail = lazy(() => import('@/pages/ClientDetail'))
const Projects = lazy(() => import('@/pages/Projects'))
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'))
const Tasks = lazy(() => import('@/pages/Tasks'))
const Finance = lazy(() => import('@/pages/Finance'))
const Analytics = lazy(() => import('@/pages/Analytics'))
const Settings = lazy(() => import('@/pages/Settings'))

export default function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="prospeccao" element={<FindLeads />} />
        <Route path="leads" element={<Leads />} />
        <Route path="clientes" element={<Clients />} />
        <Route path="clientes/:id" element={<ClientDetail />} />
        <Route path="projetos" element={<Projects />} />
        <Route path="projetos/:id" element={<ProjectDetail />} />
        <Route path="tarefas" element={<Tasks />} />
        <Route path="financeiro" element={<Finance />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="configuracoes" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
