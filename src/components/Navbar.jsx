import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { polymarketTrader } from '../lib/polymarket'
import WalletModal from './WalletModal'
import './Navbar.css'

function Navbar() {
    const location = useLocation()
    const [isConnected, setIsConnected] = useState(false)
    const [showWalletModal, setShowWalletModal] = useState(false)
    const [walletAddress, setWalletAddress] = useState(null)

    // Check wallet connection on mount
    useEffect(() => {
        setIsConnected(polymarketTrader.isConnected())
        if (polymarketTrader.funder) {
            setWalletAddress(polymarketTrader.funder)
        }
    }, [])

    const handleConnectWallet = () => {
        if (isConnected) {
            // Already connected - could add disconnect logic here
            return
        }
        setShowWalletModal(true)
    }

    const handleWalletSelect = async (walletType) => {
        try {
            const walletName = walletType === 'metamask' ? 'MetaMask' : walletType === 'phantom' ? 'Phantom' : 'wallet'
            console.log(`Connecting ${walletName}...`)

            if (walletType === 'metamask' || walletType === 'phantom') {
                await polymarketTrader.connectWallet(walletType)
                await polymarketTrader.initialize()
                setIsConnected(true)
                setWalletAddress(polymarketTrader.funder)
                console.log(`${walletName} connected!`)
            } else if (walletType === 'walletconnect') {
                throw new Error('WalletConnect not implemented yet')
            }
        } catch (err) {
            console.error('Wallet connection failed:', err)
            throw err
        }
    }

    // Format address for display (0x1234...5678)
    const formatAddress = (addr) => {
        if (!addr) return ''
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`
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
                    <button
                        className={`wallet-btn ${isConnected ? 'connected' : ''}`}
                        onClick={handleConnectWallet}
                    >
                        {isConnected ? (
                            <>
                                <span className="wallet-dot"></span>
                                {formatAddress(walletAddress)}
                            </>
                        ) : (
                            'Connect Wallet'
                        )}
                    </button>
                </div>
            </nav>

            <WalletModal
                isOpen={showWalletModal}
                onClose={() => setShowWalletModal(false)}
                onSelect={handleWalletSelect}
            />
        </>
    )
}

export default Navbar
