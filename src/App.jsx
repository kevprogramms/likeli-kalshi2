import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Vaults from './pages/Vaults'
import VaultDetail from './pages/VaultDetail'
import Leaderboard from './pages/Leaderboard'
import Markets from './pages/Markets'
import EventDetail from './pages/EventDetail'
import AIResearcher from './pages/AIResearcher'
import './App.css'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <Router>
      <div className="app">
        <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <div className="app-body">
          <Sidebar isOpen={sidebarOpen} />
          <main className={`main-content ${sidebarOpen ? '' : 'expanded'}`}>
            <Routes>
              <Route path="/" element={<Navigate to="/markets" replace />} />
              <Route path="/portfolio" element={<Dashboard />} />
              <Route path="/markets" element={<Markets />} />
              <Route path="/event/:id" element={<EventDetail />} />
              <Route path="/vaults" element={<Vaults />} />
              <Route path="/vault/:id" element={<VaultDetail />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/ai-researcher" element={<AIResearcher />} />
              <Route path="/ai-researcher/:marketId" element={<AIResearcher />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  )
}

export default App
