import { useState, useEffect } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { marketService } from '../lib/marketService'
import { useLiveMarkets, useLiveEvent, formatLastUpdated } from '../lib/useLiveMarkets'
import { useDemo } from '../lib/DemoContext'
import { polymarketTrader } from '../lib/polymarket'
import TradeModal from '../components/TradeModal'
import WalletModal from '../components/WalletModal'
import PriceChart from '../components/PriceChart'
import './EventDetail.css'

function EventDetail() {
    const { id } = useParams()
    const [searchParams] = useSearchParams()
    const { userVaults, walletBalance, STAGE } = useDemo()

    // Live event data with auto-polling
    const { event, loading, error, lastUpdated, refresh } = useLiveEvent(id, {
        enabled: true,
        fastMode: true,
    })

    // Related markets
    const { events: allEvents } = useLiveMarkets({ enabled: true, pollInterval: 60000 })

    const [selectedMarketIndex, setSelectedMarketIndex] = useState(0)
    const [direction, setDirection] = useState('BUY')
    const [side, setSide] = useState('YES')
    const [amount, setAmount] = useState('')
    const [selectedVaultId, setSelectedVaultId] = useState(searchParams.get('vault') || '')
    const [orderType, setOrderType] = useState('MARKET')
    const [limitPrice, setLimitPrice] = useState('')
    const [trading, setTrading] = useState(false)
    const [tradeSuccess, setTradeSuccess] = useState('')
    const [activeTab, setActiveTab] = useState('activity')

    // Wallet state
    const [walletConnected, setWalletConnected] = useState(false)
    const [showWalletModal, setShowWalletModal] = useState(false)
    const [usdcApproved, setUsdcApproved] = useState(false)

    const tradingVaults = userVaults.filter(v => v.stage === STAGE?.TRADING || v.stage === 'Trading')

    // Check wallet on mount
    useEffect(() => {
        setWalletConnected(polymarketTrader.isConnected())
    }, [])

    // Get current market
    const currentMarket = event?.markets?.[selectedMarketIndex] || event?.markets?.[0]
    const outcomes = currentMarket?.outcomes || []
    const isMultiMarket = (event?.markets?.length || 0) > 1

    // Prices
    const yesPrice = outcomes[0]?.price || 0.5
    const noPrice = outcomes[1]?.price || 0.5
    const currentPrice = side === 'YES' ? yesPrice : noPrice
    const tokenId = outcomes[0]?.tokenId || currentMarket?.clobTokenIds?.[0]

    // Calculate shares
    const amountNum = parseFloat(amount) || 0
    const shares = currentPrice > 0 ? (amountNum / currentPrice).toFixed(2) : '0.00'
    const potentialReturn = amountNum > 0 ? ((amountNum / currentPrice) - amountNum).toFixed(2) : '0.00'

    // Related markets
    const relatedMarkets = allEvents
        .filter(e => e.id !== id)
        .slice(0, 4)

    // Mock activity data
    const recentActivity = [
        { type: 'buy', side: 'YES', amount: 250, price: yesPrice, time: '2m ago' },
        { type: 'buy', side: 'NO', amount: 100, price: noPrice, time: '5m ago' },
        { type: 'sell', side: 'YES', amount: 500, price: yesPrice - 0.02, time: '8m ago' },
        { type: 'buy', side: 'YES', amount: 150, price: yesPrice - 0.01, time: '12m ago' },
        { type: 'buy', side: 'NO', amount: 300, price: noPrice + 0.01, time: '15m ago' },
    ]

    const handleTrade = async () => {
        if (!walletConnected) {
            setShowWalletModal(true)
            return
        }
        setTrading(true)
        setTradeSuccess('Placing order...')

        // Simulate trade
        setTimeout(() => {
            setTrading(false)
            setTradeSuccess('✓ Order placed successfully!')
            setAmount('')
            setTimeout(() => setTradeSuccess(''), 3000)
        }, 1500)
    }

    const handleWalletSelect = async (walletType) => {
        try {
            await polymarketTrader.connectWallet(walletType)
            setWalletConnected(true)
            setShowWalletModal(false)
        } catch (err) {
            console.error('Connection failed:', err)
        }
    }

    if (loading) {
        return (
            <div className="event-page">
                <div className="event-loading">
                    <div className="loading-spinner" />
                    <span>Loading market...</span>
                </div>
            </div>
        )
    }

    if (!event) {
        return (
            <div className="event-page">
                <div className="event-error">
                    <h2>Market not found</h2>
                    <Link to="/markets" className="back-link">← Back to Markets</Link>
                </div>
            </div>
        )
    }

    return (
        <div className="event-page">
            {/* Navigation */}
            <nav className="event-nav">
                <Link to="/markets" className="nav-back">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    Markets
                </Link>
                <div className="nav-breadcrumb">
                    <span className="nav-category">{event.category}</span>
                    <span className="nav-sep">/</span>
                    <span className="nav-current">{event.title?.slice(0, 40)}...</span>
                </div>
            </nav>

            <div className="event-layout">
                {/* Left Column - Chart & Info */}
                <main className="event-main">
                    {/* Header Card */}
                    <header className="event-header">
                        <div className="header-content">
                            {event.image && (
                                <img src={event.image} alt="" className="event-image" />
                            )}
                            <div className="header-info">
                                <div className="header-tags">
                                    <span className="tag category">{event.category}</span>
                                    {event.isLive && <span className="tag live">● Live</span>}
                                    <span className="tag source">
                                        {event.source === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                                    </span>
                                </div>
                                <h1 className="event-title">{event.title}</h1>
                                {isMultiMarket && currentMarket && (
                                    <p className="market-subtitle">{currentMarket.title}</p>
                                )}
                            </div>
                        </div>
                        <div className="header-stats">
                            <div className="stat-item highlight">
                                <span className="stat-value">{Math.round(yesPrice * 100)}%</span>
                                <span className="stat-label">Yes</span>
                            </div>
                            <div className="stat-divider" />
                            <div className="stat-item">
                                <span className="stat-value">${((event.volume || 0) / 1000).toFixed(0)}K</span>
                                <span className="stat-label">Volume</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{formatLastUpdated(lastUpdated)}</span>
                                <span className="stat-label">Updated</span>
                            </div>
                        </div>
                    </header>

                    {/* Multi-Market Selector */}
                    {isMultiMarket && (
                        <div className="market-selector">
                            <h3>Select Market</h3>
                            <div className="market-options">
                                {event.markets.map((market, idx) => {
                                    const mktPrice = market.outcomes?.[0]?.price || 0.5
                                    return (
                                        <button
                                            key={market.id || idx}
                                            className={`market-option ${idx === selectedMarketIndex ? 'active' : ''}`}
                                            onClick={() => setSelectedMarketIndex(idx)}
                                        >
                                            <span className="option-title">{market.title}</span>
                                            <span className="option-price">{Math.round(mktPrice * 100)}%</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Main Chart */}
                    <section className="chart-section">
                        <div className="chart-wrapper">
                            <PriceChart
                                tokenId={tokenId}
                                currentPrice={yesPrice}
                                source={event.source || 'polymarket'}
                                width={720}
                                height={360}
                                showTimeSelector={true}
                                showTooltip={true}
                                showStats={true}
                                initialTimeRange="24h"
                                animate={true}
                                className="full main-chart"
                            />
                        </div>
                    </section>

                    {/* Info Tabs */}
                    <section className="info-section">
                        <div className="info-tabs">
                            <button
                                className={`tab ${activeTab === 'activity' ? 'active' : ''}`}
                                onClick={() => setActiveTab('activity')}
                            >
                                Activity
                            </button>
                            <button
                                className={`tab ${activeTab === 'about' ? 'active' : ''}`}
                                onClick={() => setActiveTab('about')}
                            >
                                About
                            </button>
                            <button
                                className={`tab ${activeTab === 'related' ? 'active' : ''}`}
                                onClick={() => setActiveTab('related')}
                            >
                                Related
                            </button>
                        </div>

                        <div className="info-content">
                            {activeTab === 'activity' && (
                                <div className="activity-feed">
                                    {recentActivity.map((activity, idx) => (
                                        <div key={idx} className="activity-item">
                                            <div className={`activity-icon ${activity.type}`}>
                                                {activity.type === 'buy' ? '↑' : '↓'}
                                            </div>
                                            <div className="activity-details">
                                                <span className="activity-action">
                                                    <strong>{activity.type === 'buy' ? 'Bought' : 'Sold'}</strong>
                                                    {' '}<span className={activity.side.toLowerCase()}>{activity.side}</span>
                                                </span>
                                                <span className="activity-meta">
                                                    ${activity.amount} @ {Math.round(activity.price * 100)}¢
                                                </span>
                                            </div>
                                            <span className="activity-time">{activity.time}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'about' && (
                                <div className="about-content">
                                    <div className="about-grid">
                                        <div className="about-item">
                                            <span className="about-label">Resolution</span>
                                            <span className="about-value">
                                                {event.endDate
                                                    ? new Date(event.endDate).toLocaleDateString('en-US', {
                                                        month: 'long', day: 'numeric', year: 'numeric'
                                                      })
                                                    : 'TBD'}
                                            </span>
                                        </div>
                                        <div className="about-item">
                                            <span className="about-label">Volume</span>
                                            <span className="about-value">${(event.volume || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="about-item">
                                            <span className="about-label">Liquidity</span>
                                            <span className="about-value">${((event.liquidity || event.volume * 0.3) || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="about-item">
                                            <span className="about-label">Source</span>
                                            <span className="about-value">
                                                {event.source === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                                            </span>
                                        </div>
                                    </div>
                                    {(event.polymarketUrl || event.kalshiUrl) && (
                                        <a
                                            href={event.polymarketUrl || event.kalshiUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="external-link"
                                        >
                                            View on {event.source === 'polymarket' ? 'Polymarket' : 'Kalshi'} ↗
                                        </a>
                                    )}
                                </div>
                            )}

                            {activeTab === 'related' && (
                                <div className="related-grid">
                                    {relatedMarkets.map(market => {
                                        const price = market.markets?.[0]?.outcomes?.[0]?.price || 0.5
                                        return (
                                            <Link
                                                key={market.id}
                                                to={`/event/${market.id}`}
                                                className="related-card"
                                            >
                                                {market.image && (
                                                    <img src={market.image} alt="" className="related-image" />
                                                )}
                                                <div className="related-info">
                                                    <span className="related-title">{market.title}</span>
                                                    <span className="related-price">{Math.round(price * 100)}% Yes</span>
                                                </div>
                                            </Link>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </section>
                </main>

                {/* Right Column - Trading Panel */}
                <aside className="trade-panel">
                    <div className="panel-card">
                        {/* Direction Toggle */}
                        <div className="direction-toggle">
                            <button
                                className={`toggle-btn ${direction === 'BUY' ? 'active' : ''}`}
                                onClick={() => setDirection('BUY')}
                            >
                                Buy
                            </button>
                            <button
                                className={`toggle-btn ${direction === 'SELL' ? 'active' : ''}`}
                                onClick={() => setDirection('SELL')}
                            >
                                Sell
                            </button>
                        </div>

                        {/* Outcome Selection */}
                        <div className="outcome-selection">
                            <button
                                className={`outcome-btn yes ${side === 'YES' ? 'active' : ''}`}
                                onClick={() => setSide('YES')}
                            >
                                <span className="outcome-name">Yes</span>
                                <span className="outcome-price">{Math.round(yesPrice * 100)}¢</span>
                            </button>
                            <button
                                className={`outcome-btn no ${side === 'NO' ? 'active' : ''}`}
                                onClick={() => setSide('NO')}
                            >
                                <span className="outcome-name">No</span>
                                <span className="outcome-price">{Math.round(noPrice * 100)}¢</span>
                            </button>
                        </div>

                        {/* Order Type */}
                        <div className="order-type">
                            <button
                                className={`type-btn ${orderType === 'MARKET' ? 'active' : ''}`}
                                onClick={() => setOrderType('MARKET')}
                            >
                                Market
                            </button>
                            <button
                                className={`type-btn ${orderType === 'LIMIT' ? 'active' : ''}`}
                                onClick={() => setOrderType('LIMIT')}
                            >
                                Limit
                            </button>
                        </div>

                        {/* Amount Input */}
                        <div className="amount-input">
                            <label>Amount</label>
                            <div className="input-wrapper">
                                <span className="input-prefix">$</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                />
                                <span className="input-suffix">USDC</span>
                            </div>
                            <div className="quick-amounts">
                                {[10, 50, 100, 500].map(val => (
                                    <button key={val} onClick={() => setAmount(val.toString())}>
                                        ${val}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Limit Price (if limit order) */}
                        {orderType === 'LIMIT' && (
                            <div className="limit-input">
                                <label>Limit Price</label>
                                <div className="input-wrapper">
                                    <input
                                        type="number"
                                        value={limitPrice}
                                        onChange={(e) => setLimitPrice(e.target.value)}
                                        placeholder={Math.round(currentPrice * 100).toString()}
                                        step="1"
                                        min="1"
                                        max="99"
                                    />
                                    <span className="input-suffix">¢</span>
                                </div>
                            </div>
                        )}

                        {/* Order Summary */}
                        <div className="order-summary">
                            <div className="summary-row">
                                <span>Shares</span>
                                <span>{shares}</span>
                            </div>
                            <div className="summary-row">
                                <span>Avg Price</span>
                                <span>{Math.round(currentPrice * 100)}¢</span>
                            </div>
                            <div className="summary-row highlight">
                                <span>Potential Return</span>
                                <span className="positive">+${potentialReturn}</span>
                            </div>
                        </div>

                        {/* Trade Button */}
                        {!walletConnected ? (
                            <button
                                className="trade-button connect"
                                onClick={() => setShowWalletModal(true)}
                            >
                                Connect Wallet
                            </button>
                        ) : (
                            <button
                                className={`trade-button ${side.toLowerCase()}`}
                                onClick={handleTrade}
                                disabled={trading || !amount}
                            >
                                {trading ? 'Placing Order...' : `${direction} ${side}`}
                            </button>
                        )}

                        {/* Vault Selector */}
                        {tradingVaults.length > 0 && (
                            <div className="vault-selector">
                                <label>Trade from Vault</label>
                                <select
                                    value={selectedVaultId}
                                    onChange={(e) => setSelectedVaultId(e.target.value)}
                                >
                                    <option value="">Personal Wallet</option>
                                    {tradingVaults.map(v => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Price Levels */}
                    <div className="panel-card price-levels">
                        <h4>Order Book</h4>
                        <div className="levels-header">
                            <span>Price</span>
                            <span>Size</span>
                        </div>
                        <div className="asks">
                            {[0.03, 0.02, 0.01].map((diff, i) => (
                                <div key={i} className="level ask">
                                    <span>{Math.round((currentPrice + diff) * 100)}¢</span>
                                    <span>${Math.round(Math.random() * 1000 + 200)}</span>
                                    <div className="level-bar" style={{ width: `${30 + Math.random() * 40}%` }} />
                                </div>
                            ))}
                        </div>
                        <div className="spread">
                            <span>Spread: 1¢</span>
                        </div>
                        <div className="bids">
                            {[0.01, 0.02, 0.03].map((diff, i) => (
                                <div key={i} className="level bid">
                                    <span>{Math.round((currentPrice - diff) * 100)}¢</span>
                                    <span>${Math.round(Math.random() * 1000 + 200)}</span>
                                    <div className="level-bar" style={{ width: `${30 + Math.random() * 40}%` }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>

            {/* Toast */}
            {tradeSuccess && (
                <div className="toast">{tradeSuccess}</div>
            )}

            {/* Wallet Modal */}
            <WalletModal
                isOpen={showWalletModal}
                onClose={() => setShowWalletModal(false)}
                onSelect={handleWalletSelect}
            />
        </div>
    )
}

export default EventDetail
