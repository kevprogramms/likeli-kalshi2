import './Dashboard.css'

function Dashboard() {
    const portfolioStats = [
        { label: 'Portfolio Value', value: '$124,532.50', change: '+12.4%', positive: true },
        { label: 'Total Profit', value: '$24,532.50', change: '+$4,231', positive: true },
        { label: 'Active Positions', value: '12', change: '+3', positive: true },
        { label: 'Win Rate', value: '68%', change: '+2.1%', positive: true },
    ]

    const recentTrades = [
        { market: 'Will Bitcoin reach $100k by EOY?', position: 'YES', amount: '$5,000', price: '0.72', pnl: '+$1,234', time: '2h ago' },
        { market: 'Fed rate cut in December?', position: 'NO', amount: '$2,500', price: '0.45', pnl: '+$890', time: '5h ago' },
        { market: 'GDP growth > 3%?', position: 'YES', amount: '$1,000', price: '0.58', pnl: '-$120', time: '1d ago' },
    ]

    return (
        <div className="dashboard">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Portfolio</h1>
                    <p className="page-subtitle">Your prediction market portfolio overview</p>
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
                        <h2 className="section-title">Portfolio Performance</h2>
                        <div className="time-filters">
                            <button className="time-filter">1D</button>
                            <button className="time-filter">1W</button>
                            <button className="time-filter active">1M</button>
                            <button className="time-filter">1Y</button>
                            <button className="time-filter">All</button>
                        </div>
                    </div>
                    <div className="chart-placeholder glass">
                        <svg viewBox="0 0 400 150" className="demo-chart">
                            <defs>
                                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#00FFFF" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="#00FFFF" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <path
                                d="M0,100 Q50,90 100,70 T200,80 T300,40 T400,50"
                                fill="none"
                                stroke="#00FFFF"
                                strokeWidth="2"
                            />
                            <path
                                d="M0,100 Q50,90 100,70 T200,80 T300,40 T400,50 L400,150 L0,150 Z"
                                fill="url(#chartGradient)"
                            />
                        </svg>
                        <div className="chart-overlay">
                            <span className="chart-value gradient-text">$124,532.50</span>
                            <span className="chart-change positive">+$24,532.50 (24.5%)</span>
                        </div>
                    </div>
                </div>

                <div className="dashboard-section">
                    <div className="section-header">
                        <h2 className="section-title">Recent Trades</h2>
                        <button className="view-all-btn">View All</button>
                    </div>
                    <div className="trades-list glass">
                        {recentTrades.map((trade, index) => (
                            <div key={index} className="trade-item">
                                <div className="trade-info">
                                    <span className="trade-market">{trade.market}</span>
                                    <span className="trade-meta">
                                        <span className={`trade-position ${trade.position.toLowerCase()}`}>{trade.position}</span>
                                        <span className="trade-amount">{trade.amount} @ {trade.price}</span>
                                    </span>
                                </div>
                                <div className="trade-right">
                                    <span className={`trade-pnl ${trade.pnl.startsWith('+') ? 'positive' : 'negative'}`}>
                                        {trade.pnl}
                                    </span>
                                    <span className="trade-time">{trade.time}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="dashboard-section">
                <div className="section-header">
                    <h2 className="section-title">Top Vaults</h2>
                    <button className="view-all-btn">Explore Vaults</button>
                </div>
                <div className="vaults-preview">
                    {[1, 2, 3].map((_, index) => (
                        <div key={index} className="vault-preview-card glass animate-fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>
                            <div className="vault-preview-header">
                                <span className="vault-rank">#{index + 1}</span>
                                <span className="vault-name">Alpha Strategy {index + 1}</span>
                            </div>
                            <div className="vault-preview-stats">
                                <div className="vault-stat">
                                    <span className="vault-stat-label">TVL</span>
                                    <span className="vault-stat-value">${(50 - index * 10).toFixed(1)}M</span>
                                </div>
                                <div className="vault-stat">
                                    <span className="vault-stat-label">APR</span>
                                    <span className="vault-stat-value positive">+{(25 - index * 3).toFixed(1)}%</span>
                                </div>
                                <div className="vault-stat">
                                    <span className="vault-stat-label">Age</span>
                                    <span className="vault-stat-value">{365 - index * 50}d</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Dashboard
