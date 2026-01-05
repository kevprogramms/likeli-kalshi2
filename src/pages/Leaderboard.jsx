import { useState } from 'react'
import './Leaderboard.css'

const traders = [
    { rank: 1, address: '0xecb6...2b00', accountValue: 81915522.57, pnl: 174347048.26, roi: 173.22, volume: 202684498667.30 },
    { rank: 2, address: '0x5b5d...c060', accountValue: 76185927.92, pnl: 170887344.09, roi: 52.79, volume: 3684577887.22 },
    { rank: 3, address: 'thank you jcfef', isVerified: true, accountValue: 8065817.43, pnl: 152654318.32, roi: 3538.53, volume: 4655922.47 },
    { rank: 4, address: '0x9794...333b', accountValue: 1082.73, pnl: 144134266.58, roi: 758.66, volume: 28418407.46 },
    { rank: 5, address: 'BobbyBigSize', isVerified: true, accountValue: 58248400.72, pnl: 135680431.46, roi: 220.21, volume: 9452546078.98 },
    { rank: 6, address: '0xb83d...6c36', accountValue: 38451522.48, pnl: 121312194.66, roi: 85.44, volume: 3292326669.70 },
    { rank: 7, address: '0x2ea1...2314', accountValue: 1.78, pnl: 108341324.52, roi: 673.35, volume: 2135884917.17 },
    { rank: 8, address: 'x.com/alkbtc', isVerified: true, accountValue: 39814481.40, pnl: 101061528.71, roi: 145.82, volume: 5284969975.12 },
    { rank: 9, address: '0xde2...60b1', accountValue: 1.01, pnl: 97508580.98, roi: 4332.81, volume: 25181221.12 },
    { rank: 10, address: '0xa312...ad1e', accountValue: 14969379.33, pnl: 84041779.07, roi: 392.76, volume: 87078223.69 },
]

function Leaderboard() {
    const [searchTerm, setSearchTerm] = useState('')
    const [timeFilter, setTimeFilter] = useState('all-time')

    const formatCurrency = (num) => {
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
        return `$${num.toFixed(2)}`
    }

    const formatPercent = (num) => {
        return `${num.toFixed(2)}%`
    }

    return (
        <div className="leaderboard-page">
            <div className="page-header">
                <h1 className="page-title gradient-text">Leaderboard</h1>
            </div>

            <div className="leaderboard-filters">
                <div className="search-wrapper">
                    <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search by wallet address..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="time-filters">
                    {['1D', '7D', '30D', 'All-time'].map((t) => (
                        <button
                            key={t}
                            className={`time-filter ${timeFilter === t.toLowerCase().replace(' ', '-') ? 'active' : ''}`}
                            onClick={() => setTimeFilter(t.toLowerCase().replace(' ', '-'))}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <div className="leaderboard-table glass">
                <div className="table-header">
                    <div className="th rank-col">Rank</div>
                    <div className="th trader-col">Trader</div>
                    <div className="th">Account Value</div>
                    <div className="th">PNL (All-Time)</div>
                    <div className="th">ROI (All-Time)</div>
                    <div className="th">Volume (All-Time)</div>
                </div>
                {traders.map((trader, index) => (
                    <div
                        key={trader.rank}
                        className={`table-row ${trader.rank <= 3 ? 'top-rank' : ''} animate-fade-in-up`}
                        style={{ animationDelay: `${index * 30}ms` }}
                    >
                        <div className="td rank-col">
                            <span className={`rank rank-${trader.rank}`}>{trader.rank}</span>
                        </div>
                        <div className="td trader-col">
                            {trader.isVerified && <span className="verified-badge">✓</span>}
                            <span className={`trader-address ${trader.isVerified ? 'verified' : ''}`}>
                                {trader.address}
                            </span>
                        </div>
                        <div className="td">{formatCurrency(trader.accountValue)}</div>
                        <div className="td pnl-positive">{formatCurrency(trader.pnl)}</div>
                        <div className="td pnl-positive">{formatPercent(trader.roi)}</div>
                        <div className="td">{formatCurrency(trader.volume)}</div>
                    </div>
                ))}
            </div>

            <div className="table-footer glass">
                <div className="footer-note">
                    Excludes accounts with less than 100k USDC account value and less than 10M USDC trading volume.
                    ROI = PNL / max(100, starting account value + maximum net deposits) for the time window.
                </div>
                <div className="pagination-info">
                    <span>Rows per page: 10</span>
                    <span>1-10 of 27929</span>
                    <div className="pagination">
                        <button className="page-btn" disabled>←</button>
                        <button className="page-btn">→</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Leaderboard
