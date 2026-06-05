import { Routes, Route } from 'react-router-dom'
import { SetupGate } from './components/SetupGate'
import { Layout } from './components/Layout'
import { Overview } from './pages/Overview'
import { ServiceExplorer } from './pages/ServiceExplorer'
import { Cost } from './pages/Cost'

export default function App(): JSX.Element {
  return (
    <SetupGate>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/cost" element={<Cost />} />
          <Route path="/s/:serviceId" element={<ServiceExplorer />} />
        </Routes>
      </Layout>
    </SetupGate>
  )
}
