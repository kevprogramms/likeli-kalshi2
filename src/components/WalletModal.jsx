import { useState } from 'react'
import './WalletModal.css'

function WalletModal({ isOpen, onClose, onSelect }) {
    const [connecting, setConnecting] = useState(null)

    if (!isOpen) return null

    const wallets = [
        {
            id: 'metamask',
            name: 'MetaMask',
            icon: (
                <svg viewBox="0 0 40 40" fill="none" style={{ width: 32, height: 32 }}>
                    <path d="M35.87 4.69L22.4 14.79l2.49-5.89L35.87 4.69z" fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4.11 4.69l13.32 10.21-2.37-5.99L4.11 4.69zM31 27.95l-3.58 5.48 7.66 2.11 2.2-7.45L31 27.95zM2.73 28.09l2.18 7.45 7.66-2.11-3.58-5.48-6.26.14z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12.13 17.27l-2.14 3.23 7.6.34-.27-8.17-5.19 4.6zM27.85 17.27l-5.26-4.7-.18 8.27 7.58-.34-2.14-3.23zM12.57 33.43l4.57-2.23-3.94-3.08-.63 5.31zM22.84 31.2l4.59 2.23-.65-5.31-3.94 3.08z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M27.43 33.43l-4.59-2.23.37 2.98-.04 1.26 4.26-2.01zM12.57 33.43l4.26 2.01-.03-1.26.35-2.98-4.58 2.23z" fill="#D7C1B3" stroke="#D7C1B3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M16.92 26.15l-3.8-1.12 2.68-1.23 1.12 2.35zM23.06 26.15l1.12-2.35 2.69 1.23-3.81 1.12z" fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12.57 33.43l.66-5.48-4.24.14 3.58 5.34zM26.77 27.95l.66 5.48 3.58-5.34-4.24-.14zM30 20.5l-7.59.34.7 3.91 1.12-2.35 2.69 1.23L30 20.5zM13.12 23.63l2.69-1.23 1.11 2.35.71-3.91-7.6-.34 3.09 3.13z" fill="#CD6116" stroke="#CD6116" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9.99 20.5l3.22 6.29-.12-3.16-3.1-3.13zM26.91 23.63l-.13 3.16L30 20.5l-3.09 3.13zM17.59 20.84l-.71 3.91 .89 4.59.2-6.05-.38-2.45zM22.41 20.84l-.36 2.43.18 6.07.9-4.59-.72-3.91z" fill="#E4751F" stroke="#E4751F" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M23.11 24.75l-.9 4.59.64.45 3.94-3.08.13-3.16-3.81 1.2zM13.12 23.55l.12 3.16 3.94 3.08.64-.45-.89-4.59-3.81-1.2z" fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M23.18 35.44l.04-1.26-.34-.3h-5.78l-.32.3.03 1.26-4.24-2.01 1.48 1.21 3.01 2.09h5.88l3.02-2.09 1.48-1.21-4.26 2.01z" fill="#C0AD9E" stroke="#C0AD9E" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M22.84 31.2l-.64-.45h-4.42l-.64.45-.35 2.98.32-.3h5.78l.34.3-.39-2.98z" fill="#161616" stroke="#161616" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M36.47 15.58l1.14-5.49-1.74-5.4-13.03 9.66 5.01 4.24 7.08 2.07 1.57-1.83-.68-.49 1.08-.99-.84-.65 1.08-.82-.71-.54zM2.39 10.09l1.15 5.49-.73.54 1.08.82-.83.65 1.08.99-.68.49 1.56 1.83 7.08-2.07 5.01-4.24L4.11 4.69l-1.72 5.4z" fill="#763D16" stroke="#763D16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M34.93 20.66l-7.08-2.07 2.15 3.23-3.23 6.29 4.25-.05h6.35l-2.44-7.4zM12.13 18.59l-7.08 2.07-2.36 7.4h6.32l4.25.05-3.22-6.29 2.09-3.23zM22.41 20.84l.45-7.79 2.05-5.54H15.06l2.03 5.54.46 7.79.17 2.47.02 6.03h4.42l.03-6.03.22-2.47z" fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ),
            description: 'Connect using MetaMask browser extension',
            color: '#f6851b'
        },
        {
            id: 'phantom',
            name: 'Phantom',
            icon: (
                <svg viewBox="0 0 40 40" fill="none" style={{ width: 32, height: 32 }}>
                    <rect width="40" height="40" rx="8" fill="url(#phantom-gradient)" />
                    <path d="M32.05 20.42c0 6.87-5.28 12.44-11.8 12.44-3.94 0-7.44-2.08-9.57-5.28-.35-.53-.66-1.09-.92-1.67h2.87c.17 0 .32-.1.4-.25.08-.15.07-.33-.02-.47a7.41 7.41 0 01-.75-3.27c0-4.08 3.17-7.39 7.08-7.39 1.49 0 2.87.48 4.02 1.29.14.1.32.12.48.04.16-.07.26-.24.26-.42v-4.7c0-.21-.12-.39-.31-.47a11.36 11.36 0 00-4.46-.9c-6.52 0-11.8 5.57-11.8 12.44 0 .77.06 1.53.18 2.26.02.11.02.23.04.34.03.23.08.46.12.69.03.14.05.28.08.42.05.22.11.44.17.66.04.14.08.28.12.42.07.21.14.42.22.63.05.13.1.27.16.4.09.21.18.41.28.61.06.12.11.25.18.37.11.2.22.4.34.6.06.1.12.21.19.31.13.21.27.41.41.61.05.08.11.16.17.24.17.22.34.44.52.65.04.05.08.1.13.15.19.22.4.43.6.64l.1.1c.22.21.44.42.67.62l.03.02c.23.2.48.39.73.58l.04.03c.24.18.48.35.73.51l.06.04c.25.16.5.31.76.45l.07.04c.26.14.52.27.79.39l.07.03c.27.12.55.24.83.34l.06.02c.29.11.58.2.88.29l.03.01c.31.09.62.17.93.24.04.01.08.02.12.02.29.06.58.11.88.15.08.01.16.02.24.03.27.04.54.06.82.08.12.01.24.02.37.02.24.01.48.02.72.02 6.52 0 11.8-5.57 11.8-12.44z" fill="white" />
                    <circle cx="22" cy="17.5" r="2" fill="#4B3B76" />
                    <circle cx="15" cy="17.5" r="2" fill="#4B3B76" />
                    <defs>
                        <linearGradient id="phantom-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#534BB1" />
                            <stop offset="1" stopColor="#551BF9" />
                        </linearGradient>
                    </defs>
                </svg>
            ),
            description: 'Connect using Phantom wallet',
            color: '#ab9ff2'
        },
        {
            id: 'walletconnect',
            name: 'WalletConnect',
            icon: (
                <svg viewBox="0 0 40 40" fill="none" style={{ width: 32, height: 32 }}>
                    <rect width="40" height="40" rx="8" fill="#3B99FC" />
                    <path d="M12.05 15.72c4.39-4.3 11.51-4.3 15.9 0l.53.52c.22.21.22.56 0 .78l-1.81 1.77c-.11.11-.29.11-.4 0l-.73-.71c-3.06-3-8.03-3-11.09 0l-.78.76c-.11.11-.29.11-.4 0l-1.81-1.77c-.22-.22-.22-.57 0-.78l.59-.57zm19.65 3.66l1.61 1.58c.22.21.22.56 0 .78l-7.27 7.12c-.22.21-.57.21-.79 0l-5.16-5.05c-.06-.05-.14-.05-.2 0l-5.16 5.05c-.22.21-.58.21-.79 0l-7.27-7.12c-.22-.22-.22-.57 0-.78l1.61-1.58c.22-.21.58-.21.79 0l5.16 5.05c.06.06.15.06.2 0l5.16-5.05c.22-.21.57-.21.79 0l5.16 5.05c.06.06.14.06.2 0l5.16-5.05c.22-.21.58-.21.8 0z" fill="white" />
                </svg>
            ),
            description: 'Scan QR code with mobile wallet',
            color: '#3b99fc'
        }
    ]

    const handleSelect = async (walletId) => {
        setConnecting(walletId)
        try {
            await onSelect(walletId)
            onClose()
        } catch (err) {
            console.error('Wallet connection failed:', err)
        } finally {
            setConnecting(null)
        }
    }

    return (
        <div className="wallet-modal-overlay" onClick={onClose}>
            <div className="wallet-modal" onClick={e => e.stopPropagation()}>
                <div className="wallet-modal-header">
                    <h2>Connect Wallet</h2>
                    <button className="wallet-modal-close" onClick={onClose}>×</button>
                </div>

                <p className="wallet-modal-subtitle">
                    Connect your wallet to trade on prediction markets with real assets
                </p>

                <div className="wallet-options">
                    {wallets.map(wallet => (
                        <button
                            key={wallet.id}
                            className={`wallet-option ${connecting === wallet.id ? 'connecting' : ''}`}
                            onClick={() => handleSelect(wallet.id)}
                            disabled={connecting !== null}
                            style={{ '--wallet-color': wallet.color }}
                        >
                            <span className="wallet-icon">{wallet.icon}</span>
                            <div className="wallet-info">
                                <span className="wallet-name">{wallet.name}</span>
                                <span className="wallet-desc">{wallet.description}</span>
                            </div>
                            {connecting === wallet.id && (
                                <span className="wallet-connecting">Connecting</span>
                            )}
                        </button>
                    ))}
                </div>

                <p className="wallet-modal-footer">
                    By connecting, you agree to the Terms of Service
                </p>
            </div>
        </div>
    )
}

export default WalletModal
