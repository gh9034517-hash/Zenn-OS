import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import Welcome from '@/pages/Welcome'
import Login from '@/pages/Login'
import { SpaceLayout } from '@/layouts/SpaceLayout'
import { HomeRedirect } from '@/layouts/HomeRedirect'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Leads = lazy(() => import('@/pages/Leads'))
const Clients = lazy(() => import('@/pages/Clients'))
const ClientDetail = lazy(() => import('@/pages/ClientDetail'))
const Projects = lazy(() => import('@/pages/Projects'))
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'))
const Tasks = lazy(() => import('@/pages/Tasks'))
const Finance = lazy(() => import('@/pages/Finance'))
const Analytics = lazy(() => import('@/pages/Analytics'))
const Settings = lazy(() => import('@/pages/Settings'))
const Overview = lazy(() => import('@/pages/Overview'))
const SpaceHome = lazy(() => import('@/pages/space/SpaceHome'))
const SpaceEntries = lazy(() => import('@/pages/space/SpaceEntries'))
const SpaceBills = lazy(() => import('@/pages/space/SpaceBills'))
const SpaceRecurring = lazy(() => import('@/pages/space/SpaceRecurring'))
const SpaceWallets = lazy(() => import('@/pages/space/SpaceWallets'))
const SpacePlanning = lazy(() => import('@/pages/space/SpacePlanning'))
const SpaceReport = lazy(() => import('@/pages/space/SpaceReport'))
const SpaceReminders = lazy(() => import('@/pages/space/SpaceReminders'))
const SpaceJobs = lazy(() => import('@/pages/space/SpaceJobs'))
const Calculators = lazy(() => import('@/pages/Calculators'))
const Customize = lazy(() => import('@/pages/Customize'))

export default function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="clientes" element={<Clients />} />
        <Route path="clientes/:id" element={<ClientDetail />} />
        <Route path="projetos" element={<Projects />} />
        <Route path="projetos/:id" element={<ProjectDetail />} />
        <Route path="tarefas" element={<Tasks />} />
        <Route path="financeiro" element={<Finance />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="configuracoes" element={<Settings />} />
        <Route path="inicio" element={<HomeRedirect />} />
        <Route path="geral" element={<Overview />} />
        <Route path="calculadoras" element={<Calculators />} />
        <Route path="personalizar" element={<Customize />} />
        <Route path="e/:spaceId" element={<SpaceLayout />}>
          <Route index element={<SpaceHome />} />
          <Route path="servicos" element={<SpaceJobs />} />
          <Route path="movimentacoes" element={<SpaceEntries />} />
          <Route path="contas" element={<SpaceBills />} />
          <Route path="fixas" element={<SpaceRecurring />} />
          <Route path="carteiras" element={<SpaceWallets />} />
          <Route path="planejamento" element={<SpacePlanning />} />
          <Route path="relatorio" element={<SpaceReport />} />
          <Route path="lembretes" element={<SpaceReminders />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
