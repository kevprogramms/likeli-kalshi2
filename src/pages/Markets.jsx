import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { marketService } from '../lib/marketService'
import { useLiveMarkets, formatLastUpdated } from '../lib/useLiveMarkets'
import { useDemo } from '../lib/DemoContext'
import EventCard from '../components/EventCard'
import TradeModal from '../components/TradeModal'
import './Markets.css'

const CATEGORIES = [
    { id: 'trending', name: 'Trending' },
    { id: 'new', name: 'New' },
    { id: 'all', name: 'All' },
    { id: 'politics', name: 'Politics' },
    { id: 'sports', name: 'Sports' },
    { id: 'culture', name: 'Culture' },
    { id: 'crypto', name: 'Crypto' },
    { id: 'climate', name: 'Climate' },
    { id: 'economics', name: 'Economics' },
    { id: 'mentions', name: 'Mentions' },
    { id: 'companies', name: 'Companies' },
    { id: 'financials', name: 'Financials' },
    { id: 'tech', name: 'Tech & Science' },
    { id: 'health', name: 'Health' },
    { id: 'world', name: 'World' },
]

const MARKET_SOURCES = [
    { id: 'polymarket', name: 'Polymarket', icon: '🟣', description: 'Real on-chain trading' },
    { id: 'dflow', name: 'DFlow', icon: '🔵', description: 'Demo markets' },
]

function Markets() {
    const [searchParams] = useSearchParams()
    const { userVaults, STAGE } = useDemo()

    const [selectedCategory, setSelectedCategory] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [sortBy, setSortBy] = useState('trending')
    const [frequency, setFrequency] = useState('all')
    const [marketStatus, setMarketStatus] = useState('open')

    // Market source state
    const [marketSource, setMarketSource] = useState(marketService.getSource())

    // Live market data with auto-polling (30 second intervals to reduce API load)
    // Pass marketSource so polling restarts when source changes
    const {
        events,
        loading,
        error,
        lastUpdated,
        isPolling,
        refresh
    } = useLiveMarkets({
        enabled: true,
        pollInterval: 30000,  // 30 seconds to reduce API load
        source: marketSource,  // Pass source so polling restarts on change
    })

    // Vault trading state
    const [selectedVaultId, setSelectedVaultId] = useState(searchParams.get('vault') || '')
    const [tradeModal, setTradeModal] = useState({ isOpen: false, event: null, side: 'YES' })

    // Get vaults that are in Trading stage
    const tradingVaults = userVaults.filter(v => v.stage === STAGE?.TRADING || v.stage === 'Trading')

    // Auto-select vault from URL param
    useEffect(() => {
        const vaultParam = searchParams.get('vault')
        if (vaultParam && tradingVaults.find(v => v.id === vaultParam)) {
            setSelectedVaultId(vaultParam)
        } else if (tradingVaults.length === 1) {
            setSelectedVaultId(tradingVaults[0].id)
        }
    }, [searchParams, tradingVaults])

    const handleSourceChange = (source) => {
        marketService.setSource(source)
        setMarketSource(source)
    }

    const handleTrade = (event, side) => {
        if (!selectedVaultId) {
            alert('Please select a vault to trade from')
            return
        }
        setTradeModal({ isOpen: true, event, side })
    }

    const filteredEvents = events.filter(event => {
        if (searchTerm) {
            return event.title.toLowerCase().includes(searchTerm.toLowerCase())
        }
        return true
    })

    return (
        <div className="markets-page">
            {/* Market Source Toggle */}
            <div className="source-toggle-container">
                <div className="source-toggle">
                    {MARKET_SOURCES.map(source => (
                        <button
                            key={source.id}
                            className={`source-btn ${marketSource === source.id ? 'active' : ''}`}
                            onClick={() => handleSourceChange(source.id)}
                        >
                            <span className="source-icon">{source.icon}</span>
                            <span className="source-name">{source.name}</span>
                            {marketSource === source.id && (
                                <span className="source-badge">
                                    {source.id === 'polymarket' ? '● LIVE' : '○ DEMO'}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                {marketSource === 'polymarket' && (
                    <div className="source-info">
                        <span className={`live-indicator ${isPolling ? 'pulsing' : ''}`}>●</span>
                        Real Polymarket data • Auto-updating
                        <span className="last-updated">
                            {lastUpdated ? `• Updated ${formatLastUpdated(lastUpdated)}` : ''}
                        </span>
                        <button className="refresh-btn" onClick={refresh} disabled={isPolling}>
                            ↻
                        </button>
                    </div>
                )}
            </div>

            {/* Vault Selector Banner (for managers) */}
            {tradingVaults.length > 0 && (
                <div className="vault-trading-banner">
                    <div className="banner-content">
                        <span className="banner-label">Trading from:</span>
                        <select
                            className="vault-selector"
                            value={selectedVaultId}
                            onChange={(e) => setSelectedVaultId(e.target.value)}
                        >
                            <option value="">Select a vault...</option>
                            {tradingVaults.map(vault => (
                                <option key={vault.id} value={vault.id}>
                                    {vault.name} (${(vault.vaultUsdc || vault.tvl || 0).toFixed(0)} USDC)
                                </option>
                            ))}
                        </select>
                        {selectedVaultId && (
                            <span className="banner-status">
                                ✓ Click YES/NO on any market to trade
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Category Tabs */}
            <div className="category-tabs">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.id}
                        className={`category-tab ${selectedCategory === cat.id ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat.id)}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Filters Bar */}
            <div className="filters-bar">
                <div className="filter-group">
                    <select
                        className="filter-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="trending">Trending</option>
                        <option value="volume">Volume</option>
                        <option value="recent">Recent</option>
                        <option value="closing">Closing Soon</option>
                    </select>

                    <select
                        className="filter-select"
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                    >
                        <option value="all">Frequency</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="annually">Annually</option>
                    </select>

                    <select
                        className="filter-select"
                        value={marketStatus}
                        onChange={(e) => setMarketStatus(e.target.value)}
                    >
                        <option value="open">Open markets</option>
                        <option value="closed">Closed</option>
                        <option value="all">All</option>
                    </select>
                </div>

                <div className="search-box">
                    <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search markets or profiles"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Events Grid */}
            <div className="events-grid">
                {loading ? (
                    Array(8).fill(0).map((_, i) => (
                        <div key={i} className="event-card skeleton" />
                    ))
                ) : (
                    filteredEvents.map((event, idx) => (
                        <EventCard
                            key={event.id}
                            event={event}
                            style={{ animationDelay: `${idx * 30}ms` }}
                            onTrade={selectedVaultId ? handleTrade : null}
                            vaultSelected={!!selectedVaultId}
                        />
                    ))
                )}
            </div>

            {!loading && filteredEvents.length === 0 && (
                <div className="empty-state">
                    <p>No markets found</p>
                </div>
            )}

            {/* Trade Modal */}
            <TradeModal
                isOpen={tradeModal.isOpen}
                onClose={() => setTradeModal({ isOpen: false, event: null, side: 'YES' })}
                event={tradeModal.event}
                initialSide={tradeModal.side}
                vaultId={selectedVaultId}
                marketSource={marketSource}
            />
        </div>
    )
}

export default Markets
