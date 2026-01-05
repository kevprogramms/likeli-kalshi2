import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDemo } from '../lib/DemoContext'
import {
    parseUnits,
    formatUnits,
    computeEquityUsdc,
    createRedemptionRequest,
    processEpochRedemptions,
    buildInversePositions
} from '../lib/staticEtfVaultMath'
import Button from '../components/Button'
import './VaultDetail.css'

// Sample ETF basket data
const sampleEtfBaskets = {
    'etf-1': {
        id: 'etf-1',
        name: 'Election Hedge Basket',
        leader: '0x8a7d...e4f2',
        description: 'Diversified exposure to major political event outcomes',
        totalShares: '100000',
        cashUsdc: '25000',
        liquidityBufferBps: 1000,
        exitFeeBps: 50,
        positions: [
            { marketId: 'trump-win-2024', side: 'YES', shares: '30000', marketName: 'Trump wins 2024' },
            { marketId: 'dem-senate-2024', side: 'NO', shares: '20000', marketName: 'Dems keep Senate' },
            { marketId: 'recession-2025', side: 'YES', shares: '15000', marketName: 'US Recession 2025' },
        ],
        stage: 'Trading',
        age: 30,
        totalMinters: 142,
    },
    'etf-2': {
        id: 'etf-2',
        name: 'Crypto Sentiment Index',
        leader: '0x2c4b...9a1e',
        description: 'Track crypto market sentiment through prediction markets',
        totalShares: '50000',
        cashUsdc: '15000',
        liquidityBufferBps: 500,
        exitFeeBps: 100,
        positions: [
            { marketId: 'btc-100k-2024', side: 'YES', shares: '25000', marketName: 'BTC hits $100K in 2024' },
            { marketId: 'eth-10k-2025', side: 'YES', shares: '10000', marketName: 'ETH hits $10K in 2025' },
        ],
        stage: 'Trading',
        age: 15,
        totalMinters: 89,
    },
    'etf-3': {
        id: 'etf-3',
        name: 'Tech Events Tracker',
        leader: '0x5f3a...c7d8',
        description: 'Major tech company event outcomes',
        totalShares: '75000',
        cashUsdc: '30000',
        liquidityBufferBps: 750,
        exitFeeBps: 75,
        positions: [
            { marketId: 'apple-ar-2025', side: 'YES', shares: '20000', marketName: 'Apple AR glasses 2025' },
            { marketId: 'openai-ipo-2025', side: 'NO', shares: '15000', marketName: 'OpenAI IPO 2025' },
            { marketId: 'tesla-robotaxi', side: 'YES', shares: '10000', marketName: 'Tesla Robotaxi launch' },
        ],
        stage: 'Trading',
        age: 45,
        totalMinters: 256,
    },
    'etf-4': {
        id: 'etf-4',
        name: 'Sports & Entertainment',
        leader: '0x9e2f...b3a6',
        description: 'Major sports and entertainment event predictions',
        totalShares: '60000',
        cashUsdc: '20000',
        liquidityBufferBps: 800,
        exitFeeBps: 50,
        positions: [
            { marketId: 'superbowl-2025', side: 'YES', shares: '15000', marketName: 'Chiefs win SB 2025' },
            { marketId: 'oscars-2025', side: 'NO', shares: '12000', marketName: 'Wicked wins Best Picture' },
        ],
        stage: 'Trading',
        age: 22,
        totalMinters: 178,
    },
}

// Mock price snapshot for NAV calculation
const mockPriceSnapshot = {
    'trump-win-2024': { bidYes: '0.55', askYes: '0.58', midYes: '0.565' },
    'dem-senate-2024': { bidYes: '0.42', askYes: '0.45', midYes: '0.435' },
    'recession-2025': { bidYes: '0.30', askYes: '0.33', midYes: '0.315' },
    'btc-100k-2024': { bidYes: '0.72', askYes: '0.75', midYes: '0.735' },
    'eth-10k-2025': { bidYes: '0.25', askYes: '0.28', midYes: '0.265' },
    'apple-ar-2025': { bidYes: '0.35', askYes: '0.38', midYes: '0.365' },
    'openai-ipo-2025': { bidYes: '0.48', askYes: '0.52', midYes: '0.50' },
    'tesla-robotaxi': { bidYes: '0.60', askYes: '0.64', midYes: '0.62' },
    'superbowl-2025': { bidYes: '0.45', askYes: '0.48', midYes: '0.465' },
    'oscars-2025': { bidYes: '0.35', askYes: '0.38', midYes: '0.365' },
}

function EtfBasketDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { walletBalance = 50000 } = useDemo()

    const [basket, setBasket] = useState(null)
    const [showMintModal, setShowMintModal] = useState(false)
    const [showRedeemModal, setShowRedeemModal] = useState(false)
    const [mintAmount, setMintAmount] = useState('')
    const [redeemShares, setRedeemShares] = useState('')
    const [redeemType, setRedeemType] = useState('CASH')
    const [pendingRequests, setPendingRequests] = useState([])
    const [userShares, setUserShares] = useState(0)
    const [userWallet, setUserWallet] = useState(walletBalance)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Load basket data
    useEffect(() => {
        const basketData = sampleEtfBaskets[id]
        if (basketData) {
            setBasket(basketData)
        }
    }, [id])

    const formatCurrency = (num) => {
        if (num === undefined || num === null || isNaN(num)) return '$0.00'
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
        return `$${num.toFixed(2)}`
    }

    if (!basket) {
        return (
            <div className="vault-detail-page">
                <button className="back-btn" onClick={() => navigate('/etf-baskets')}>
                    ← Back to Baskets
                </button>
                <div className="no-positions">Loading...</div>
            </div>
        )
    }

    // Compute NAV
    const equityResult = computeEquityUsdc(basket, mockPriceSnapshot, 'MID')
    const equity = equityResult.success ? parseFloat(equityResult.equityUsdc) : 0
    const totalShares = parseFloat(basket.totalShares)
    const navPerShare = totalShares > 0 ? equity / totalShares : 1
    const navChange = (navPerShare - 1) * 100

    const formatNAV = () => {
        if (navChange > 0) return <span className="positive">+{navChange.toFixed(2)}%</span>
        if (navChange < 0) return <span className="negative">{navChange.toFixed(2)}%</span>
        return <span>{navChange.toFixed(2)}%</span>
    }

    // Handle mint
    const handleMint = () => {
        setError('')
        const amount = parseFloat(mintAmount)
        if (!amount || amount <= 0) {
            setError('Enter a valid amount')
            return
        }
        if (amount > userWallet) {
            setError('Insufficient balance')
            return
        }

        const sharesToMint = amount / navPerShare

        setBasket(prev => ({
            ...prev,
            totalShares: String(parseFloat(prev.totalShares) + sharesToMint),
            cashUsdc: String(parseFloat(prev.cashUsdc) + amount),
        }))

        setUserShares(prev => prev + sharesToMint)
        setUserWallet(prev => prev - amount)
        setMintAmount('')
        setSuccess(`Minted ${sharesToMint.toFixed(2)} shares for $${amount.toFixed(2)}`)
        setTimeout(() => {
            setShowMintModal(false)
            setSuccess('')
        }, 2000)
    }

    // Handle redemption request
    const handleRedeem = () => {
        setError('')
        const shares = parseFloat(redeemShares)
        if (!shares || shares <= 0) {
            setError('Enter a valid share amount')
            return
        }
        if (shares > userShares) {
            setError('Insufficient shares')
            return
        }

        const result = createRedemptionRequest(redeemType, String(shares))
        if (!result.success) {
            setError(result.error)
            return
        }

        setPendingRequests(prev => [...prev, result.request])
        setUserShares(prev => prev - shares)
        setRedeemShares('')
        setSuccess(`${redeemType} redemption request created for ${shares.toFixed(2)} shares`)
        setTimeout(() => {
            setShowRedeemModal(false)
            setSuccess('')
        }, 2000)
    }

    const handleProcessEpoch = () => {
        const activePending = pendingRequests.filter(r => r.status === 'Pending' || r.status === 'PartiallyFilled')
        if (activePending.length === 0) {
            setError('No pending requests to process')
            return
        }

        const result = processEpochRedemptions(basket, activePending, mockPriceSnapshot, {})
        if (!result.success) {
            setError(result.error)
            return
        }

        setPendingRequests(prev => prev.map(req => {
            const processed = result.result.processedRequests.find(p => p.id === req.id)
            return processed || req
        }))

        setBasket(result.result.updatedVault)

        const { totalCashPaidOut } = result.result.totals
        if (parseFloat(totalCashPaidOut) > 0) {
            setUserWallet(prev => prev + parseFloat(totalCashPaidOut))
        }

        setSuccess(`Epoch processed! Paid out: ${formatCurrency(parseFloat(totalCashPaidOut))}`)
    }

    const getStageColor = (stage) => {
        switch (stage) {
            case 'Open': return 'open'
            case 'Trading': return 'trading'
            case 'Closed': return 'closed'
            default: return 'trading'
        }
    }

    return (
        <div className="vault-detail-page">
            <button className="back-btn" onClick={() => navigate('/etf-baskets')}>
                ← Back to Baskets
            </button>

            {error && <div className="error-banner">{error}</div>}
            {success && <div className="success-banner">{success}</div>}

            <div className="vault-header">
                <div className="vault-info">
                    <h1 className="vault-title">{basket.name}</h1>
                    <p className="vault-description">{basket.description}</p>
                    <div className="vault-leader">
                        <span className="label">Creator:</span>
                        <span className="leader-address">{basket.leader}</span>
                    </div>
                </div>
                <div className="vault-stage">
                    <span className="vault-type-badge unrestricted">
                        ▣ ETF Basket
                    </span>
                    <span className={`stage-badge ${getStageColor(basket.stage)}`}>
                        {basket.stage}
                    </span>
                </div>
            </div>

            <div className="vault-stats glass">
                <div className="stat-card">
                    <span className="stat-label">Total Value Locked</span>
                    <span className="stat-value">{formatCurrency(equity)}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">NAV Change</span>
                    <span className="stat-value">{formatNAV()}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Age</span>
                    <span className="stat-value">{basket.age} days</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Minters</span>
                    <span className="stat-value">{basket.totalMinters}</span>
                </div>
            </div>

            <div className="vault-fees glass">
                <h2>Fee Structure</h2>
                <div className="fees-grid">
                    <div className="fee-item">
                        <span className="fee-label">Liquidity Buffer</span>
                        <span className="fee-value">{basket.liquidityBufferBps / 100}%</span>
                    </div>
                    <div className="fee-item">
                        <span className="fee-label">Exit Fee</span>
                        <span className="fee-value">{basket.exitFeeBps / 100}%</span>
                    </div>
                </div>
            </div>

            <div className="vault-actions glass">
                <h2>Your Position</h2>
                <div className="position-info">
                    <div className="position-row">
                        <span>Your Shares:</span>
                        <span className="deposit-value">{userShares.toFixed(2)}</span>
                    </div>
                    <div className="position-row">
                        <span>Share Value:</span>
                        <span>${navPerShare.toFixed(4)}/share</span>
                    </div>
                    <div className="position-row">
                        <span>Wallet Balance:</span>
                        <span>{formatCurrency(userWallet)}</span>
                    </div>
                </div>
                <div className="action-buttons">
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={() => setShowMintModal(true)}
                    >
                        Mint Shares
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setShowRedeemModal(true)}
                        disabled={userShares === 0}
                    >
                        Redeem
                    </Button>
                </div>
            </div>

            {/* Positions */}
            {basket.positions && basket.positions.length > 0 && (
                <div className="vault-positions glass">
                    <div className="positions-header">
                        <h2>Underlying Positions ({basket.positions.length})</h2>
                    </div>
                    <div className="positions-list">
                        {basket.positions.map((pos, idx) => {
                            const priceData = mockPriceSnapshot[pos.marketId]
                            const price = priceData ? parseFloat(priceData.midYes) : 0.5
                            const effectivePrice = pos.side === 'YES' ? price : 1 - price
                            const value = parseFloat(pos.shares) * effectivePrice

                            return (
                                <div key={idx} className="position-item">
                                    <div className="position-main">
                                        <span className={`position-side ${pos.side.toLowerCase()}`}>
                                            {pos.side}
                                        </span>
                                        <span className="position-market">{pos.marketName}</span>
                                    </div>
                                    <div className="position-details">
                                        <span className="position-shares">{parseFloat(pos.shares).toLocaleString()} shares</span>
                                        <span className="position-price">@{(effectivePrice * 100).toFixed(0)}¢</span>
                                        <span className="position-cost">{formatCurrency(value)}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Pending Redemption Requests */}
            {pendingRequests.length > 0 && (
                <div className="withdrawal-requests glass">
                    <h2>Your Redemption Requests</h2>
                    <div className="requests-list">
                        {pendingRequests.map(req => (
                            <div key={req.id} className={`request-item ${req.status.toLowerCase()}`}>
                                <div className="request-info">
                                    <span>Type: {req.kind}</span>
                                    <span>Shares: {parseFloat(req.sharesRequested).toFixed(2)}</span>
                                    <span>Filled: {parseFloat(req.sharesFilled).toFixed(2)}</span>
                                </div>
                                <span className={`request-status ${req.status.toLowerCase()}`}>{req.status}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 'var(--space-4)' }}>
                        <Button variant="outline" onClick={handleProcessEpoch}>
                            Process Epoch
                        </Button>
                    </div>
                </div>
            )}

            {/* Mint Modal */}
            {showMintModal && (
                <div className="modal-overlay" onClick={() => setShowMintModal(false)}>
                    <div className="modal-container" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowMintModal(false)}>×</button>
                        <h2>Mint ETF Shares</h2>
                        {success ? (
                            <div className="success-message">{success}</div>
                        ) : (
                            <>
                                {error && <div className="error-message">{error}</div>}
                                <p className="modal-hint">
                                    Deposit USDC to mint ETF basket shares at current NAV (${navPerShare.toFixed(4)}/share)
                                </p>
                                <div className="form-group">
                                    <label>Amount (USDC)</label>
                                    <input
                                        type="number"
                                        value={mintAmount}
                                        onChange={e => setMintAmount(e.target.value)}
                                        placeholder="Enter amount"
                                        className="form-input"
                                    />
                                    <div className="form-balance">
                                        <span>Available:</span>
                                        <span className="balance-value">{userWallet.toFixed(2)} USDC</span>
                                    </div>
                                    {mintAmount && (
                                        <div className="form-balance">
                                            <span>You will receive:</span>
                                            <span className="balance-value">{(parseFloat(mintAmount) / navPerShare).toFixed(2)} shares</span>
                                        </div>
                                    )}
                                </div>
                                <Button variant="primary" fullWidth onClick={handleMint}>
                                    Confirm Mint
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Redeem Modal */}
            {showRedeemModal && (
                <div className="modal-overlay" onClick={() => setShowRedeemModal(false)}>
                    <div className="modal-container" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowRedeemModal(false)}>×</button>
                        <h2>Redeem ETF Shares</h2>
                        {success ? (
                            <div className="success-message">{success}</div>
                        ) : (
                            <>
                                {error && <div className="error-message">{error}</div>}

                                <div className="trade-sides" style={{ marginBottom: 'var(--space-4)' }}>
                                    <button
                                        className={`side-btn yes ${redeemType === 'CASH' ? 'active' : ''}`}
                                        onClick={() => setRedeemType('CASH')}
                                    >
                                        💵 Cash
                                    </button>
                                    <button
                                        className={`side-btn no ${redeemType === 'IN_KIND' ? 'active' : ''}`}
                                        onClick={() => setRedeemType('IN_KIND')}
                                    >
                                        📦 In-Kind
                                    </button>
                                </div>

                                <p className="modal-hint">
                                    {redeemType === 'CASH'
                                        ? `Receive USDC. Subject to liquidity and ${basket.exitFeeBps / 100}% exit fee.`
                                        : 'Receive pro-rata underlying positions. No exit fee.'}
                                </p>

                                <div className="form-group">
                                    <label>Shares to Redeem</label>
                                    <input
                                        type="number"
                                        value={redeemShares}
                                        onChange={e => setRedeemShares(e.target.value)}
                                        placeholder="Enter shares"
                                        className="form-input"
                                    />
                                    <div className="form-balance">
                                        <span>Your Shares:</span>
                                        <span className="balance-value">{userShares.toFixed(2)}</span>
                                    </div>
                                    {redeemShares && (
                                        <div className="form-balance">
                                            <span>Estimated Value:</span>
                                            <span className="balance-value">${(parseFloat(redeemShares) * navPerShare).toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                                <Button variant="primary" fullWidth onClick={handleRedeem}>
                                    Submit Redemption Request
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default EtfBasketDetail
