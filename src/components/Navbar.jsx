import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import './Navbar.css'

function Navbar({ onMenuClick }) {
    const [walletConnected, setWalletConnected] = useState(false)

    return (
        <nav className="navbar">
            <div className="navbar-left">
                <button className="menu-btn" onClick={onMenuClick}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12h18M3 6h18M3 18h18" />
                    </svg>
                </button>
                <div className="logo">
                    <span className="logo-icon">◈</span>
                    <span className="logo-text">likeli</span>
                </div>
            </div>

            <div className="navbar-center">
                <NavLink to="/portfolio" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    Portfolio
                </NavLink>
                <NavLink to="/vaults" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    Vaults
                </NavLink>
                <NavLink to="/leaderboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    Leaderboard
                </NavLink>
                <span className="nav-link disabled">Rivals</span>
                <span className="nav-link disabled">Parlay</span>
            </div>

            <div className="navbar-right">
                <button
                    className={`wallet-btn ${walletConnected ? 'connected' : ''}`}
                    onClick={() => setWalletConnected(!walletConnected)}
                >
                    {walletConnected ? (
                        <>
                            <span className="wallet-dot"></span>
                            0x8F7d...c9E2
                        </>
                    ) : (
                        'Connect Wallet'
                    )}
                </button>
            </div>
        </nav>
    )
}

export default Navbar
