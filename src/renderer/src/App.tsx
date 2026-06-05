import { Routes, Route } from 'react-router-dom'
import { SetupGate } from './components/SetupGate'
import { Layout } from './components/Layout'
import { Overview } from './pages/Overview'
import { ServiceExplorer } from './pages/ServiceExplorer'
import { Cost } from './pages/Cost'
import { Logs } from './pages/Logs'

export default function App(): JSX.Element {
  return (
    <SetupGate>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/cost" element={<Cost />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/logs/:group" element={<Logs />} />
          <Route path="/s/:serviceId" element={<ServiceExplorer />} />
        </Routes>
      </Layout>
    </SetupGate>
  )
}
