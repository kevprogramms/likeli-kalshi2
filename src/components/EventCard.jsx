import { useState } from 'react'
import { Link } from 'react-router-dom'
import PriceChart from './PriceChart'
import './EventCard.css'

function formatCurrency(num) {
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
    if (num >= 1e3) return `$${(num / 1e3).toFixed(0)}K`
    return `$${num.toFixed(0)}`
}

function EventCard({ event, style, onTrade, vaultSelected }) {
    const [isHovered, setIsHovered] = useState(false)

    // Guard against undefined event
    if (!event) {
        return null;
    }

    const markets = event.markets || []
    const market = markets[0]
    const outcomes = market?.outcomes || []

    // Detect event type
    const isMultiMarket = markets.length > 1  // Multiple sub-markets (e.g., "CEOs gone", "Super Bowl")
    const isBinary = !isMultiMarket && outcomes.length === 2
    const isMultiOutcome = !isMultiMarket && outcomes.length > 2

    // Get YES price for binary markets
    const yesOutcome = outcomes.find(o => o.name === 'Yes') || outcomes[0]
    const noOutcome = outcomes.find(o => o.name === 'No') || outcomes[1]
    const yesPrice = yesOutcome?.price || 0

    // Get token ID for fetching real price data
    const tokenId = yesOutcome?.tokenId || market?.clobTokenIds?.[0]
    const source = event.source || 'polymarket'

    const handleTradeClick = (e, marketId, side) => {
        e.preventDefault()
        e.stopPropagation()
        if (onTrade) {
            onTrade(event, `${marketId}:${side}`)
        }
    }

    return (
        <Link
            to={`/event/${event.id}`}
            className="event-card-kalshi"
            style={style}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Hover Chart Overlay - Shows real price data on hover */}
            <div className={`hover-chart-overlay ${isHovered ? 'visible' : ''}`}>
                {isHovered && (
                    <PriceChart
                        tokenId={tokenId}
                        currentPrice={yesPrice}
                        source={source}
                        width={280}
                        height={120}
                        showTimeSelector={false}
                        showTooltip={true}
                        showStats={false}
                        initialTimeRange="24h"
                        animate={true}
                        className="compact card-chart"
                    />
                )}
                <div className="chart-y-axis">
                    <span>99¢</span>
                    <span>50¢</span>
                    <span>1¢</span>
                </div>
            </div>

            {/* Header Row: Image + Title + Probability */}
            <div className="card-header-row">
                {event.image && (
                    <img src={event.image} alt="" className="card-icon" />
                )}
                <div className="card-title-section">
                    <span className="card-category">{event.category}</span>
                    <h3 className="card-title">{event.title}</h3>
                </div>
                {isBinary && (
                    <span className="card-probability">{Math.round(yesPrice * 100)}%</span>
                )}
            </div>

            {/* Binary Market: Single Yes/No row */}
            {isBinary && (
                <div className="card-binary-row">
                    <button
                        className="btn-yes"
                        onClick={(e) => handleTradeClick(e, market?.id, 'YES')}
                    >
                        Yes
                    </button>
                    <button
                        className="btn-no"
                        onClick={(e) => handleTradeClick(e, market?.id, 'NO')}
                    >
                        No
                    </button>
                </div>
            )}

            {/* Multi-Market: List of sub-markets sorted by probability */}
            {isMultiMarket && (() => {
                const marketsWithPrices = markets.map(m => {
                    const yesOut = m.outcomes?.find(o => o.name === 'Yes') || m.outcomes?.[0]
                    return {
                        ...m,
                        yesPrice: yesOut?.price || 0,
                        shortName: (m.title || m.question || '')
                            .replace(/ in 2025\?$/i, '')
                            .replace(/ by .*\?$/i, '')
                            .replace(/\?$/, '')
                            .replace(/^Will /, '')
                    }
                })
                const sorted = [...marketsWithPrices].sort((a, b) => b.yesPrice - a.yesPrice)
                const display = sorted.slice(0, 2)

                return (
                    <div className="card-markets-list">
                        {display.map((m, idx) => (
                            <div key={idx} className="market-row">
                                <span className="market-name">{m.shortName}</span>
                                <span className="market-percent">{Math.round(m.yesPrice * 100)}%</span>
                                <button
                                    className="btn-yes-sm"
                                    onClick={(e) => handleTradeClick(e, m.id, 'YES')}
                                >
                                    Yes
                                </button>
                                <button
                                    className="btn-no-sm"
                                    onClick={(e) => handleTradeClick(e, m.id, 'NO')}
                                >
                                    No
                                </button>
                            </div>
                        ))}
                    </div>
                )
            })()}

            {/* Multi-Outcome: List of outcomes sorted by probability */}
            {isMultiOutcome && (() => {
                const sorted = [...outcomes].sort((a, b) => b.price - a.price)
                const display = sorted.slice(0, 2)

                return (
                    <div className="card-markets-list">
                        {display.map((o, idx) => (
                            <div key={idx} className="market-row">
                                <span className="market-name">{o.name}</span>
                                <span className="market-percent">{Math.round(o.price * 100)}%</span>
                                <button
                                    className="btn-yes-sm"
                                    onClick={(e) => handleTradeClick(e, o.name, 'YES')}
                                >
                                    Yes
                                </button>
                                <button
                                    className="btn-no-sm"
                                    onClick={(e) => handleTradeClick(e, o.name, 'NO')}
                                >
                                    No
                                </button>
                            </div>
                        ))}
                    </div>
                )
            })()}

            {/* Footer: Volume + AI Research + External Link + Expand */}
            <div className="card-footer-row">
                <span className="card-volume">{formatCurrency(event.volume)}</span>
                <div className="card-footer-actions">
                    {/* AI Research button */}
                    <Link
                        to={`/ai-researcher/${event.id}`}
                        className="card-ai-research-btn"
                        onClick={(e) => e.stopPropagation()}
                        title="Analyze with AI"
                    >
                        🔍 AI
                    </Link>
                    {/* External link to original market */}
                    {(event.kalshiUrl || event.polymarketUrl) && (
                        <a
                            href={event.kalshiUrl || event.polymarketUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="card-external-link"
                            onClick={(e) => e.stopPropagation()}
                            title={event.kalshiUrl ? "View on Kalshi" : "View on Polymarket"}
                        >
                            ↗
                        </a>
                    )}
                    {(isMultiMarket && markets.length > 2) || (isMultiOutcome && outcomes.length > 2) ? (
                        <span className="card-expand">⊕</span>
                    ) : null}
                </div>
            </div>
        </Link>
    )
}

export default EventCard
