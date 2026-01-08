import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Vaults from './pages/Vaults'
import VaultDetail from './pages/VaultDetail'
import Leaderboard from './pages/Leaderboard'
import Markets from './pages/Markets'
import EventDetail from './pages/EventDetail'
import AIResearcher from './pages/AIResearcher'
import EtfBaskets from './pages/EtfBaskets'
import EtfBasketDetail from './pages/EtfBasketDetail'
import LandingPage from './pages/LandingPage'
import './App.css'

function AppContent() {
  const location = useLocation();
  const isLandingPage = location.pathname === '/landing';

  return (
    <div className="app">
      {!isLandingPage && <Navbar />}
      <div className="app-body" style={isLandingPage ? { padding: 0 } : {}}>
        <main className="main-content" style={isLandingPage ? { padding: 0 } : {}}>
          <Routes>
            <Route path="/" element={<Navigate to="/markets" replace />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/portfolio" element={<Dashboard />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/event/:id" element={<EventDetail />} />
            <Route path="/vaults" element={<Vaults />} />
            <Route path="/vault/:id" element={<VaultDetail />} />
            <Route path="/etf-baskets" element={<EtfBaskets />} />
            <Route path="/etf-basket/:id" element={<EtfBasketDetail />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/ai-researcher" element={<AIResearcher />} />
            <Route path="/ai-researcher/:marketId" element={<AIResearcher />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App

