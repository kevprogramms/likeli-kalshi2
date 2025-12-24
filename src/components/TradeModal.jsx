import { useState } from 'react'
import { useDemo } from '../lib/DemoContext'
import Button from './Button'
import './TradeModal.css'

function TradeModal({ isOpen, onClose, event, initialSide = 'YES', vaultId }) {
    const { userVaults, executeTrade, getVault } = useDemo()
    const [side, setSide] = useState(initialSide)
    const [amount, setAmount] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)

    if (!isOpen || !event) return null

    const vault = getVault(vaultId)
    const vaultBalance = vault?.vaultUsdc || vault?.tvl || 0
    const market = event.markets?.[0]
    const outcomes = market?.outcomes || []

    // Get price for selected side
    const selectedOutcome = outcomes.find(o =>
        o.name?.toUpperCase().includes(side) || o.abbr === side
    ) || outcomes[0]
    const price = selectedOutcome?.price || 0.5

    const handleSubmit = async () => {
        setError('')
        setLoading(true)

        const tradeAmount = parseFloat(amount)
        if (!tradeAmount || tradeAmount <= 0) {
            setError('Enter a valid amount')
            setLoading(false)
            return
        }
        if (tradeAmount > vaultBalance) {
            setError('Amount exceeds vault balance')
            setLoading(false)
            return
        }

        try {
            const result = executeTrade(vaultId, event.id, event.title, side, tradeAmount)

            if (result.success) {
                const pnlText = result.pnl >= 0 ? `+$${result.pnl.toFixed(2)}` : `-$${Math.abs(result.pnl).toFixed(2)}`
                setSuccess(`Trade executed! ${side} on "${event.title}"\nP&L: ${pnlText}`)
                setAmount('')
                setTimeout(() => {
                    onClose()
                    setSuccess('')
                }, 2500)
            } else {
                setError(result.error)
            }
        } catch (err) {
            setError('Trade failed: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        setError('')
        setSuccess('')
        setAmount('')
        onClose()
    }

    // Calculate potential payout
    const potentialPayout = amount ? (parseFloat(amount) / price).toFixed(2) : '0.00'

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-container trade-modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={handleClose}>×</button>

                <h2>Execute Trade</h2>

                {success ? (
                    <div className="success-message">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <path d="M22 4L12 14.01l-3-3" />
                        </svg>
                        <p>{success}</p>
                    </div>
                ) : (
                    <>
                        <div className="trade-header">
                            <span className="trade-vault">From: {vault?.name}</span>
                        </div>

                        <div className="trade-market-info">
                            <span className="market-category">{event.category}</span>
                            <h3 className="market-title">{event.title}</h3>
                        </div>

                        {error && <div className="error-message">{error}</div>}

                        <div className="form-group">
                            <label>Side</label>
                            <div className="trade-sides">
                                <button
                                    className={`side-btn yes ${side === 'YES' ? 'active' : ''}`}
                                    onClick={() => setSide('YES')}
                                >
                                    YES
                                </button>
                                <button
                                    className={`side-btn no ${side === 'NO' ? 'active' : ''}`}
                                    onClick={() => setSide('NO')}
                                >
                                    NO
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Amount (USDC)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Enter amount"
                                min="1"
                            />
                            <div className="form-balance">
                                <span>Vault balance:</span>
                                <span className="balance-value">${vaultBalance.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="trade-preview glass">
                            <div className="preview-row">
                                <span>Price:</span>
                                <span>{Math.round(price * 100)}¢</span>
                            </div>
                            <div className="preview-row">
                                <span>Potential Payout:</span>
                                <span className="payout-value">${potentialPayout}</span>
                            </div>
                            <div className="preview-row">
                                <span>Max Return:</span>
                                <span className="return-value">+{amount ? ((parseFloat(potentialPayout) - parseFloat(amount)) || 0).toFixed(2) : '0.00'} USDC</span>
                            </div>
                        </div>

                        <Button
                            variant="primary"
                            fullWidth
                            size="lg"
                            onClick={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? 'Executing...' : `Buy ${side} for $${amount || '0'}`}
                        </Button>

                        <p className="trade-disclaimer">
                            This is a demo trade. In production, this would execute via DFlow swap.
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}

export default TradeModal
