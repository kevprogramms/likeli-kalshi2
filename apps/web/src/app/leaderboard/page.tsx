'use client'

import { useState } from 'react'
import styles from './page.module.css'

const mockTraders = [
    { rank: 1, address: '0xecb6...2b00', accountValue: 81915522.57, pnl: 174347048.26, roi: 173.22, volume: 202684498667.30 },
    { rank: 2, address: '0x5b5d...c060', accountValue: 76185927.92, pnl: 170887344.09, roi: 52.79, volume: 3684577887.22 },
    { rank: 3, address: 'alpha_trader', isVerified: true, accountValue: 8065817.43, pnl: 152654318.32, roi: 3538.53, volume: 4655922.47 },
    { rank: 4, address: '0x9794...333b', accountValue: 1082.73, pnl: 144134266.58, roi: 758.66, volume: 28418407.46 },
    { rank: 5, address: 'BobbyBigSize', isVerified: true, accountValue: 58248400.72, pnl: 135680431.46, roi: 220.21, volume: 9452546078.98 },
    { rank: 6, address: '0xb83d...6c36', accountValue: 38451522.48, pnl: 121312194.66, roi: 85.44, volume: 3292326669.70 },
    { rank: 7, address: '0x2ea1...2314', accountValue: 1.78, pnl: 108341324.52, roi: 673.35, volume: 2135884917.17 },
    { rank: 8, address: 'whale_trader', isVerified: true, accountValue: 39814481.40, pnl: 101061528.71, roi: 145.82, volume: 5284969975.12 },
    { rank: 9, address: '0xde2...60b1', accountValue: 1.01, pnl: 97508580.98, roi: 4332.81, volume: 25181221.12 },
    { rank: 10, address: '0xa312...ad1e', accountValue: 14969379.33, pnl: 84041779.07, roi: 392.76, volume: 87078223.69 },
]

function formatCurrency(num: number): string {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
    return `$${num.toFixed(2)}`
}

export default function LeaderboardPage() {
    const [timeFilter, setTimeFilter] = useState('all-time')

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className="gradient-text">Leaderboard</h1>
            </div>

            <div className={styles.filters}>
                <div className={styles.timeFilters}>
                    {['1D', '7D', '30D', 'All-time'].map((t) => (
                        <button
                            key={t}
                            className={`${styles.timeFilter} ${timeFilter === t.toLowerCase().replace(' ', '-') ? styles.active : ''}`}
                            onClick={() => setTimeFilter(t.toLowerCase().replace(' ', '-'))}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <div className={`${styles.table} glass`}>
                <div className={styles.tableHeader}>
                    <div className={styles.th}>Rank</div>
                    <div className={styles.th}>Trader</div>
                    <div className={styles.th}>Account Value</div>
                    <div className={styles.th}>PnL</div>
                    <div className={styles.th}>ROI</div>
                    <div className={styles.th}>Volume</div>
                </div>
                {mockTraders.map((trader, index) => (
                    <div
                        key={trader.rank}
                        className={`${styles.tableRow} ${trader.rank <= 3 ? styles.topRank : ''} animate-fade-in-up`}
                        style={{ animationDelay: `${index * 30}ms` }}
                    >
                        <div className={styles.td}>
                            <span className={`${styles.rank} ${styles[`rank${trader.rank}`]}`}>
                                {trader.rank}
                            </span>
                        </div>
                        <div className={`${styles.td} ${styles.trader}`}>
                            {trader.isVerified && <span className={styles.verified}>✓</span>}
                            <span className={trader.isVerified ? styles.verifiedName : styles.address}>
                                {trader.address}
                            </span>
                        </div>
                        <div className={styles.td}>{formatCurrency(trader.accountValue)}</div>
                        <div className={`${styles.td} ${styles.positive}`}>{formatCurrency(trader.pnl)}</div>
                        <div className={`${styles.td} ${styles.positive}`}>{trader.roi.toFixed(2)}%</div>
                        <div className={styles.td}>{formatCurrency(trader.volume)}</div>
                    </div>
                ))}
            </div>

            <div className={`${styles.footer} glass`}>
                <p className={styles.note}>
                    Rankings based on realized PnL. ROI = PnL / max starting account value for the time window.
                </p>
            </div>
        </div>
    )
}
