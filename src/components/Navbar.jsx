import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useWallet } from '../lib/WalletContext'
import './Navbar.css'

function Navbar() {
    const {
        phantomConnected,
        phantomAddress,
        metamaskConnected,
        metamaskAddress,
        connectPhantom,
        connectMetamask,
        disconnectPhantom,
        disconnectMetamask,
        connecting,
        formatAddress,
        isAnyWalletConnected
    } = useWallet()

    const [showDropdown, setShowDropdown] = useState(false)

    const handleWalletClick = () => {
        setShowDropdown(!showDropdown)
    }

    const handleConnectPhantom = async () => {
        try {
            await connectPhantom()
            setShowDropdown(false)
        } catch (err) {
            console.error('Phantom connection failed:', err)
        }
    }

    const handleConnectMetamask = async () => {
        try {
            await connectMetamask()
            setShowDropdown(false)
        } catch (err) {
            console.error('MetaMask connection failed:', err)
        }
    }

    const getButtonLabel = () => {
        if (connecting) return 'Connecting...'

        if (phantomConnected && metamaskConnected) {
            return `🔗 Both Connected`
        } else if (phantomConnected) {
            return `👻 ${formatAddress(phantomAddress)}`
        } else if (metamaskConnected) {
            return `🦊 ${formatAddress(metamaskAddress)}`
        }
        return 'Connect Wallet'
    }

    return (
        <>
            <nav className="navbar">
                <div className="navbar-left">
                    <div className="logo">
                        <img src="/logo.png" alt="Likeli" className="logo-image" />
                        <span className="logo-text">Likeli</span>
                    </div>
                </div>

                <div className="navbar-center">
                    <NavLink
                        to="/markets"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        Markets
                    </NavLink>
                    <NavLink
                        to="/vaults"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        Vaults
                    </NavLink>
                    <NavLink
                        to="/etf-baskets"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        ETF Baskets
                    </NavLink>
                    <NavLink
                        to="/portfolio"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        Portfolio
                    </NavLink>
                    <NavLink
                        to="/leaderboard"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        Leaderboard
                    </NavLink>
                    <NavLink
                        to="/ai-researcher"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        AI Research
                    </NavLink>
                </div>

                <div className="navbar-right">
                    <div className="wallet-dropdown-container">
                        <button
                            className={`wallet-btn ${isAnyWalletConnected ? 'connected' : ''}`}
                            onClick={handleWalletClick}
                            disabled={connecting}
                        >
                            {isAnyWalletConnected && <span className="wallet-dot"></span>}
                            {getButtonLabel()}
                            <span className="dropdown-arrow">{showDropdown ? '▲' : '▼'}</span>
                        </button>

                        {showDropdown && (
                            <div className="wallet-dropdown">
                                {/* Phantom (Solana / DFlow) */}
                                <div className="wallet-dropdown-section">
                                    <div className="wallet-dropdown-header">
                                        <span>👻 Phantom</span>
                                        <span className="wallet-chain">Solana • Kalshi</span>
                                    </div>
                                    {phantomConnected ? (
                                        <div className="wallet-dropdown-connected">
                                            <span className="wallet-address">{formatAddress(phantomAddress)}</span>
                                            <button
                                                className="wallet-disconnect-btn"
                                                onClick={() => { disconnectPhantom(); setShowDropdown(false); }}
                                            >
                                                Disconnect
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="wallet-connect-btn phantom"
                                            onClick={handleConnectPhantom}
                                            disabled={connecting}
                                        >
                                            Connect Phantom
                                        </button>
                                    )}
                                </div>

                                {/* MetaMask (Polygon / Polymarket) */}
                                <div className="wallet-dropdown-section">
                                    <div className="wallet-dropdown-header">
                                        <span>🦊 MetaMask</span>
                                        <span className="wallet-chain">Polygon • Polymarket</span>
                                    </div>
                                    {metamaskConnected ? (
                                        <div className="wallet-dropdown-connected">
                                            <span className="wallet-address">{formatAddress(metamaskAddress)}</span>
                                            <button
                                                className="wallet-disconnect-btn"
                                                onClick={() => { disconnectMetamask(); setShowDropdown(false); }}
                                            >
                                                Disconnect
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="wallet-connect-btn metamask"
                                            onClick={handleConnectMetamask}
                                            disabled={connecting}
                                        >
                                            Connect MetaMask
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* Click outside to close dropdown */}
            {showDropdown && (
                <div
                    className="wallet-dropdown-backdrop"
                    onClick={() => setShowDropdown(false)}
                />
            )}
        </>
    )
}

export default Navbar
