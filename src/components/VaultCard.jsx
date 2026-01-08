import React from 'react'
import Sparkline from './Sparkline'
import './VaultCard.css'

function formatCurrency(num) {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
    return `$${num.toFixed(2)}`
}

function formatAPR(apr) {
    const formatted = apr.toFixed(2)
    if (apr > 0) return <span className="stat-value apr positive">+{formatted}%</span>
    if (apr < 0) return <span className="stat-value apr negative">{formatted}%</span>
    return <span className="stat-value apr">{formatted}%</span>
}

function VaultCard({ vault, onClick, style }) {
    return (
        <div className="vault-card" onClick={onClick} style={{ cursor: 'pointer', ...style }}>
            <div className="vault-header">
                <div className="vault-identity">
                    <span className="vault-leader">👤 {vault.leader}</span>
                    <h3 className="vault-name">{vault.name}</h3>
                </div>
            </div>

            <div className="sparkline-wrapper">
                {/* Fixed height for uniformity */}
                <Sparkline data={vault.data} color={vault.apr >= 0 ? '#00C805' : '#FF5252'} width={280} height={40} />
            </div>

            <div className="vault-stats-grid">
                <div className="stat-item">
                    <span className="stat-label">APR</span>
                    {formatAPR(vault.apr)}
                </div>
                <div className="stat-item">
                    <span className="stat-label">TVL</span>
                    <span className="stat-value">{formatCurrency(vault.tvl)}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Age</span>
                    <span className="stat-value">{vault.age} days</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Your Deposit</span>
                    <span className="stat-value">${(vault.yourDeposit || 0).toFixed(2)}</span>
                </div>
            </div>

            <div className="vault-footer">
                {vault.yourDeposit > 0 ? (
                    <span className="deposit-badge">Deposited</span>
                ) : (
                    <span className="deposit-badge">View Details</span>
                )}
                <div className="action-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                </div>
            </div>
        </div>
    )
}

export default VaultCard
