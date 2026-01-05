import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemo } from '../lib/DemoContext'
import Button from './Button'
import './CreateVaultModal.css'

function CreateVaultModal({ isOpen, onClose }) {
    const navigate = useNavigate()
    const { walletBalance, createVault, PROTOCOL_CONFIG, VAULT_TYPE } = useDemo()
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [deposit, setDeposit] = useState('')
    const [depositFeeBps, setDepositFeeBps] = useState(100) // 1%
    const [perfFeeBps, setPerfFeeBps] = useState(1000) // 10%
    const [tradingDuration, setTradingDuration] = useState(5) // 5 minutes for demo
    const [vaultType, setVaultType] = useState('restricted')
    const [maxResolutionDays, setMaxResolutionDays] = useState(5)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    if (!isOpen) return null

    const handleSubmit = (e) => {
        e.preventDefault()
        setError('')

        const depositAmount = parseFloat(deposit)
        if (depositAmount < 100) {
            setError('Minimum deposit is 100 USDC')
            return
        }
        if (depositAmount > walletBalance) {
            setError('Insufficient balance')
            return
        }
        if (depositFeeBps > (PROTOCOL_CONFIG?.maxDepositFeeBps || 300)) {
            setError(`Deposit fee cannot exceed ${(PROTOCOL_CONFIG?.maxDepositFeeBps || 300) / 100}%`)
            return
        }
        if (perfFeeBps > (PROTOCOL_CONFIG?.maxPerfFeeBps || 3000)) {
            setError(`Performance fee cannot exceed ${(PROTOCOL_CONFIG?.maxPerfFeeBps || 3000) / 100}%`)
            return
        }

        const result = createVault(
            name,
            description,
            depositAmount,
            {
                depositFeeBps,
                perfFeeBps,
                tradingDurationMs: tradingDuration * 60000,
                vaultType,
                maxResolutionDays,
            }
        )

        if (result.success) {
            setSuccess(true)
            setTimeout(() => {
                onClose()
                setName('')
                setDescription('')
                setDeposit('')
                setDepositFeeBps(100)
                setPerfFeeBps(1000)
                setTradingDuration(5)
                setVaultType('restricted')
                setMaxResolutionDays(5)
                setSuccess(false)
                navigate(`/vault/${result.vault.id}`)
            }, 1500)
        } else {
            setError(result.error)
        }
    }

    const handleClose = () => {
        setName('')
        setDescription('')
        setDeposit('')
        setError('')
        setSuccess(false)
        onClose()
    }

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-container animate-scale-in" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={handleClose}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>

                <div className="create-vault-content">
                    <h2 className="create-vault-title">Create Your Own Vault</h2>

                    {success ? (
                        <div className="success-message">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <path d="M22 4L12 14.01l-3-3" />
                            </svg>
                            <h3>Vault Created Successfully!</h3>
                            <p>Redirecting to your new vault...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            {error && <div className="error-message">{error}</div>}

                            <div className="form-group">
                                <label className="form-label">Vault Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="My Prediction Fund"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Describe your trading strategy..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Deposit Fee (max 3%)</label>
                                    <div className="input-with-suffix">
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={depositFeeBps / 100}
                                            onChange={(e) => setDepositFeeBps(parseFloat(e.target.value) * 100)}
                                            min="0"
                                            max="3"
                                            step="0.1"
                                        />
                                        <span className="input-suffix">%</span>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Perf Fee (max 30%)</label>
                                    <div className="input-with-suffix">
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={perfFeeBps / 100}
                                            onChange={(e) => setPerfFeeBps(parseFloat(e.target.value) * 100)}
                                            min="0"
                                            max="30"
                                            step="1"
                                        />
                                        <span className="input-suffix">%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Trading Duration (demo)</label>
                                <div className="input-with-suffix">
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={tradingDuration}
                                        onChange={(e) => setTradingDuration(parseInt(e.target.value))}
                                        min="1"
                                        max="60"
                                    />
                                    <span className="input-suffix">minutes</span>
                                </div>
                                <p className="form-hint">Trading starts 1 minute after creation</p>
                            </div>

                            {/* Vault Type Selection */}
                            <div className="form-group">
                                <label className="form-label">Vault Type</label>
                                <div className="vault-type-selector">
                                    <button
                                        type="button"
                                        className={`vault-type-btn ${vaultType === 'restricted' ? 'active' : ''}`}
                                        onClick={() => setVaultType('restricted')}
                                    >
                                        <span className="type-icon">🔒</span>
                                        <span className="type-name">Restricted</span>
                                        <span className="type-desc">Only trade markets that resolve within set timeframe</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`vault-type-btn ${vaultType === 'unrestricted' ? 'active' : ''}`}
                                        onClick={() => setVaultType('unrestricted')}
                                    >
                                        <span className="type-icon">🌐</span>
                                        <span className="type-name">Unrestricted</span>
                                        <span className="type-desc">Trade any market, investors vote if positions extend</span>
                                    </button>
                                </div>
                            </div>

                            {vaultType === 'restricted' && (
                                <div className="form-group">
                                    <label className="form-label">Max Resolution Window</label>
                                    <div className="input-with-suffix">
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={maxResolutionDays}
                                            onChange={(e) => setMaxResolutionDays(parseInt(e.target.value) || 5)}
                                            min="1"
                                            max="90"
                                        />
                                        <span className="input-suffix">days after trading ends</span>
                                    </div>
                                    <p className="form-hint">Markets must resolve within this window</p>
                                </div>
                            )}

                            {vaultType === 'unrestricted' && (
                                <div className="unrestricted-notice">
                                    <span className="notice-icon">⚠️</span>
                                    <div>
                                        <strong>Unrestricted Vault Notice</strong>
                                        <p>If positions are open when trading ends, investors will vote on whether to wait for resolution or force market exit. Illiquid positions may require waiting.</p>
                                    </div>
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Initial Deposit (min 100 USDC)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="1000"
                                    value={deposit}
                                    onChange={(e) => setDeposit(e.target.value)}
                                    min="100"
                                    required
                                />
                                <div className="form-balance">
                                    <span>Available balance</span>
                                    <span className="balance-value">{walletBalance.toFixed(2)} USDC</span>
                                </div>
                            </div>

                            <div className="lifecycle-preview">
                                <h4>Lifecycle Preview</h4>
                                <div className="lifecycle-stages">
                                    <div className="stage-item">
                                        <span className="stage-dot open"></span>
                                        <span>Open (1 min)</span>
                                    </div>
                                    <div className="stage-arrow">→</div>
                                    <div className="stage-item">
                                        <span className="stage-dot trading"></span>
                                        <span>Trading ({tradingDuration} min)</span>
                                    </div>
                                    <div className="stage-arrow">→</div>
                                    <div className="stage-item">
                                        <span className="stage-dot settlement"></span>
                                        <span>Settlement</span>
                                    </div>
                                    <div className="stage-arrow">→</div>
                                    <div className="stage-item">
                                        <span className="stage-dot closed"></span>
                                        <span>Closed</span>
                                    </div>
                                </div>
                            </div>

                            <Button type="submit" variant="primary" fullWidth size="lg">
                                Create Vault
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}

export default CreateVaultModal
