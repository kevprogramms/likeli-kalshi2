import React from 'react'
import Sparkline from './Sparkline'
import './VaultCard.css'

function formatCurrency(num) {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
    return `$${num.toFixed(2)}`
}

function formatNAV(nav) {
    const change = (nav - 1) * 100
    if (change > 0) return <span className="stat-value apr positive">+{change.toFixed(2)}%</span>
    if (change < 0) return <span className="stat-value apr negative">{change.toFixed(2)}%</span>
    return <span className="stat-value apr">{change.toFixed(2)}%</span>
}

function EtfBasketCard({ basket, onClick, style }) {
    const navChange = (basket.nav - 1) * 100

    return (
        <div className="vault-card" onClick={onClick} style={{ cursor: 'pointer', ...style }}>
            <div className="vault-header">
                <div className="vault-identity">
                    <span className="vault-leader">▣ {basket.leader}</span>
                    <h3 className="vault-name">{basket.name}</h3>
                </div>
            </div>

            <div className="sparkline-wrapper">
                <Sparkline
                    data={basket.data}
                    color={navChange >= 0 ? '#00C805' : '#FF5252'}
                    width={280}
                    height={40}
                />
            </div>

            <div className="vault-stats-grid">
                <div className="stat-item">
                    <span className="stat-label">NAV</span>
                    {formatNAV(basket.nav)}
                </div>
                <div className="stat-item">
                    <span className="stat-label">TVL</span>
                    <span className="stat-value">{formatCurrency(basket.tvl)}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Age</span>
                    <span className="stat-value">{basket.age} days</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Your Shares</span>
                    <span className="stat-value">{(basket.yourShares || 0).toFixed(2)}</span>
                </div>
            </div>

            <div className="vault-footer">
                <span className="deposit-badge">
                    {basket.positions?.length || 0} positions
                </span>
                <div className="action-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                </div>
            </div>
        </div>
    )
}

export default EtfBasketCard
