import { useState, useEffect } from 'react'
import { marketService } from '../lib/marketService'
import './Dashboard.css'

function Dashboard() {
    const [portfolioData, setPortfolioData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchPortfolio = async () => {
            try {
                // In production, get real address from wallet connection
                const address = '0x123';
                const data = await marketService.getPortfolio(address);
                setPortfolioData(data);
            } catch (error) {
                console.error('Failed to load portfolio', error);
            } finally {
                setLoading(false);
            }
        };
        fetchPortfolio();
    }, []);

    if (loading) return <div className="loading-state">Loading Portfolio...</div>
    if (!portfolioData) return <div className="error-state">Failed to load portfolio data.</div>

    const { totalValue, vaults } = portfolioData;

    const portfolioStats = [
        { label: 'Portfolio Value', value: `$${totalValue.toLocaleString()}`, change: '+0%', positive: true },
        { label: 'Total Profit', value: '$0.00', change: '0%', positive: true },
        { label: 'Active Vaults', value: vaults.length.toString(), change: '0', positive: true },
        { label: 'Chain Exposure', value: 'Poly/Sol', change: 'Balanced', positive: true },
    ]

    return (
        <div className="dashboard">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Portfolio</h1>
                    <p className="page-subtitle">Your unified prediction market portfolio</p>
                </div>
            </div>

            <div className="stats-grid">
                {portfolioStats.map((stat, index) => (
                    <div key={index} className="stat-card glass animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                        <span className="stat-label">{stat.label}</span>
                        <span className="stat-value">{stat.value}</span>
                        <span className={`stat-change ${stat.positive ? 'positive' : 'negative'}`}>
                            {stat.change}
                        </span>
                    </div>
                ))}
            </div>

            <div className="dashboard-grid">
                <div className="dashboard-section">
                    <div className="section-header">
                        <h2 className="section-title">Aggregated Performance</h2>
                    </div>
                    {/* Simplified Chart Placeholder for MVP */}
                    <div className="chart-placeholder glass">
                        <div className="chart-overlay">
                            <span className="chart-value gradient-text">${totalValue.toLocaleString()}</span>
                            <span className="chart-change positive">+0.00 (0.00%)</span>
                        </div>
                    </div>
                </div>

                <div className="dashboard-section">
                    <div className="section-header">
                        <h2 className="section-title">Your Active Vaults</h2>
                    </div>
                    <div className="trades-list glass">
                        {vaults.map((vault, index) => (
                            <div key={index} className="trade-item">
                                <div className="trade-info">
                                    <span className="trade-market">{vault.name}</span>
                                    <span className="trade-meta">
                                        <span className={`trade-position ${vault.chain.toLowerCase()}`}>{vault.chain}</span>
                                        <span className="trade-amount">TVL: ${vault.tvl.toLocaleString()}</span>
                                    </span>
                                </div>
                                <div className="trade-right">
                                    <span className="trade-pnl positive">
                                        {vault.apy}% APY
                                    </span>
                                    <span className="trade-time">Balance: ${vault.userBalance}</span>
                                </div>
                            </div>
                        ))}
                        {vaults.length === 0 && <div className="empty-state">No active vault positions found.</div>}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Dashboard
