import { useState, useEffect } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { dflowAPI } from '../lib/dflow'
import { useDemo } from '../lib/DemoContext'
import TradeModal from '../components/TradeModal'
import './EventDetail.css'

function formatPrice(price) {
    return `${Math.round(price * 100)}¢`
}

function EventDetail() {
    const { id } = useParams()
    const [searchParams] = useSearchParams()
    const { userVaults, executeTrade, STAGE } = useDemo()

    const [event, setEvent] = useState(null)
    const [selectedOutcome, setSelectedOutcome] = useState(null)
    const [side, setSide] = useState('YES')
    const [contracts, setContracts] = useState(100)
    const [loading, setLoading] = useState(true)
    const [selectedVaultId, setSelectedVaultId] = useState(searchParams.get('vault') || '')
    const [showTradeModal, setShowTradeModal] = useState(false)
    const [tradeSuccess, setTradeSuccess] = useState('')

    // Get vaults that are in Trading stage
    const tradingVaults = userVaults.filter(v => v.stage === STAGE?.TRADING || v.stage === 'Trading')

    useEffect(() => {
        loadEvent()
    }, [id])

    // Auto-select vault from URL param
    useEffect(() => {
        const vaultParam = searchParams.get('vault')
        if (vaultParam && tradingVaults.find(v => v.id === vaultParam)) {
            setSelectedVaultId(vaultParam)
        } else if (tradingVaults.length === 1) {
            setSelectedVaultId(tradingVaults[0].id)
        }
    }, [searchParams, tradingVaults])

    const loadEvent = async () => {
        setLoading(true)
        try {
            const data = await dflowAPI.getEvents()
            const found = data.events?.find(e => e.id === id)
            if (found) {
                setEvent(found)
                if (found.markets?.[0]?.outcomes?.[0]) {
                    setSelectedOutcome(found.markets[0].outcomes[0])
                }
            }
        } catch (error) {
            console.error('Failed to load event:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleTrade = () => {
        if (!selectedVaultId) {
            setShowTradeModal(true)
            return
        }

        const result = executeTrade(selectedVaultId, id, event.title, side, contracts)
        if (result.success) {
            const pnlText = result.pnl >= 0 ? `+$${result.pnl.toFixed(2)}` : `-$${Math.abs(result.pnl).toFixed(2)}`
            setTradeSuccess(`Trade executed! ${side} on "${event.title}" - P&L: ${pnlText}`)
            setTimeout(() => setTradeSuccess(''), 3000)
        }
    }

    const selectedVault = tradingVaults.find(v => v.id === selectedVaultId)

    if (loading) {
        return <div className="event-detail-page loading">Loading...</div>
    }

    if (!event) {
        return <div className="event-detail-page not-found">Event not found</div>
    }

    const market = event.markets?.[0]
    const outcomes = market?.outcomes || []

    const estimatedPayout = selectedOutcome
        ? (contracts * (1 / selectedOutcome.price)).toFixed(2)
        : 0

    return (
        <div className="event-detail-page">
            <div className="event-detail-main">
                {/* Header */}
                <div className="event-detail-header">
                    <Link to="/markets" className="back-link">← Back to markets</Link>
                    <h1 className="event-detail-title">{event.title}</h1>
                    <div className="event-detail-actions">
                        <button className="action-btn">📅</button>
                        <button className="action-btn">💬</button>
                        <button className="action-btn">↑</button>
                        <button className="action-btn">⬇</button>
                    </div>
                </div>

                {/* Success Message */}
                {tradeSuccess && (
                    <div className="trade-success-banner">{tradeSuccess}</div>
                )}

                {/* Chart Area */}
                <div className="chart-section glass">
                    <div className="chart-header">
                        <span className="chart-source">DFlow / Kalshi</span>
                        <div className="chart-legend">
                            {outcomes.map((outcome, idx) => (
                                <div key={idx} className="legend-item">
                                    <span
                                        className="legend-dot"
                                        style={{
                                            background: idx === 0 ? 'var(--color-primary)' :
                                                idx === 1 ? 'var(--color-warning)' : 'var(--color-danger)'
                                        }}
                                    />
                                    <span className="legend-name">{outcome.name}</span>
                                    <span className="legend-percent">{Math.round(outcome.price * 100)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="chart-placeholder">
                        <svg viewBox="0 0 600 150" className="price-chart">
                            <defs>
                                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#E63946" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="#E63946" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <path
                                d="M0,100 Q50,95 100,90 T200,85 T300,80 T400,70 T500,50 T600,20"
                                fill="none"
                                stroke="#E63946"
                                strokeWidth="2"
                            />
                            <path
                                d="M0,100 Q50,95 100,90 T200,85 T300,80 T400,70 T500,50 T600,20 L600,150 L0,150 Z"
                                fill="url(#chartGradient)"
                            />
                        </svg>
                    </div>

                    <div className="chart-time-filters">
                        <button className="time-btn">1D</button>
                        <button className="time-btn">1W</button>
                        <button className="time-btn active">1M</button>
                        <button className="time-btn">ALL</button>
                        <button className="time-btn">⇔</button>
                    </div>
                </div>

                {/* Outcomes Table */}
                <div className="outcomes-section glass">
                    <div className="outcomes-header">
                        <span>Chance</span>
                    </div>
                    {outcomes.map((outcome, idx) => (
                        <div
                            key={idx}
                            className={`outcome-detail-row ${selectedOutcome?.name === outcome.name ? 'selected' : ''}`}
                            onClick={() => setSelectedOutcome(outcome)}
                        >
                            <span className="outcome-detail-name">{outcome.name}</span>
                            <span className="outcome-detail-percent">
                                {Math.round(outcome.price * 100)}%
                                {outcome.change !== 0 && (
                                    <span className={outcome.change > 0 ? 'change-up' : 'change-down'}>
                                        {outcome.change > 0 ? '▲' : '▼'}{Math.abs(outcome.change * 100).toFixed(0)}
                                    </span>
                                )}
                            </span>
                            <button
                                className="outcome-yes-btn"
                                onClick={(e) => { e.stopPropagation(); setSelectedOutcome(outcome); setSide('YES'); }}
                            >
                                Yes {formatPrice(outcome.price)}
                            </button>
                            <button
                                className="outcome-no-btn"
                                onClick={(e) => { e.stopPropagation(); setSelectedOutcome(outcome); setSide('NO'); }}
                            >
                                No {formatPrice(1 - outcome.price)}
                            </button>
                        </div>
                    ))}
                    {outcomes.length > 3 && (
                        <button className="more-markets-btn">More markets</button>
                    )}
                </div>

                {/* Rules Section */}
                <div className="rules-section glass">
                    <h2>Rules summary</h2>
                    <p className="rules-text">
                        If the outcome occurs as specified, the market resolves to Yes. Outcome verified from the Governing League.
                    </p>
                    <div className="rules-actions">
                        <button className="rules-btn">View full rules</button>
                        <button className="rules-btn">Help center</button>
                    </div>
                </div>

                {/* Related Markets */}
                <div className="related-section glass">
                    <h2>People are also buying</h2>
                    <div className="related-list">
                        <div className="related-item">
                            <span className="related-icon">🏈</span>
                            <span className="related-name">Buffalo at Cleveland</span>
                        </div>
                        <div className="related-item">
                            <span className="related-icon">🏈</span>
                            <span className="related-name">Pro Football Champion?</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Trading Panel */}
            <div className="trading-panel glass">
                <div className="panel-header">
                    <span className="panel-title">{event.title}</span>
                    <span className="panel-subtitle">
                        Buy {side} · {selectedOutcome?.name || 'Select outcome'}
                    </span>
                </div>

                {/* Vault Selector */}
                {tradingVaults.length > 0 ? (
                    <div className="vault-selector-panel">
                        <label>Trading from vault:</label>
                        <select
                            value={selectedVaultId}
                            onChange={(e) => setSelectedVaultId(e.target.value)}
                            className="vault-select"
                        >
                            <option value="">Select vault...</option>
                            {tradingVaults.map(vault => (
                                <option key={vault.id} value={vault.id}>
                                    {vault.name} (${(vault.vaultUsdc || vault.tvl || 0).toFixed(0)})
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div className="no-vault-warning">
                        <p>No vaults in Trading stage</p>
                        <Link to="/vaults" className="create-vault-link">Create a vault first →</Link>
                    </div>
                )}

                <div className="panel-tabs">
                    <button
                        className={`panel-tab ${side === 'YES' ? 'active' : ''}`}
                        onClick={() => setSide('YES')}
                    >
                        Buy
                    </button>
                    <button
                        className={`panel-tab ${side === 'NO' ? 'active' : ''}`}
                        onClick={() => setSide('NO')}
                    >
                        Sell
                    </button>
                </div>

                <div className="outcome-buttons">
                    <button
                        className={`outcome-btn yes ${side === 'YES' ? 'active' : ''}`}
                        onClick={() => setSide('YES')}
                    >
                        Yes {selectedOutcome ? formatPrice(selectedOutcome.price) : ''}
                    </button>
                    <button
                        className={`outcome-btn no ${side === 'NO' ? 'active' : ''}`}
                        onClick={() => setSide('NO')}
                    >
                        No {selectedOutcome ? formatPrice(1 - selectedOutcome.price) : ''}
                    </button>
                </div>

                <div className="contracts-input">
                    <label>Amount (USDC)</label>
                    <div className="input-row">
                        <input
                            type="number"
                            value={contracts}
                            onChange={(e) => setContracts(parseInt(e.target.value) || 0)}
                            placeholder="100"
                        />
                        {selectedVault && (
                            <span className="vault-balance">
                                Balance: ${(selectedVault.vaultUsdc || 0).toFixed(0)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="estimate-row">
                    <span>Est. payout</span>
                    <span className="payout-value">${estimatedPayout}</span>
                </div>

                <button
                    className="trade-btn"
                    disabled={!selectedVaultId || contracts === 0}
                    onClick={handleTrade}
                >
                    {!selectedVaultId ? 'Select a vault to trade' : `Buy ${side} for $${contracts}`}
                </button>

                {!selectedVaultId && tradingVaults.length === 0 && (
                    <p className="trade-hint">
                        Create a vault and start trading to trade on DFlow markets
                    </p>
                )}
            </div>

            {/* Trade Modal (fallback) */}
            <TradeModal
                isOpen={showTradeModal}
                onClose={() => setShowTradeModal(false)}
                event={event}
                initialSide={side}
                vaultId={selectedVaultId}
            />
        </div>
    )
}

export default EventDetail
