'use client'

import { useState, useEffect } from 'react'
import styles from './page.module.css'

// Mock markets data (from DFlow adapter)
const mockMarkets = [
    {
        id: 'btc-100k-2024',
        ticker: 'BTC100K',
        title: 'Will Bitcoin reach $100,000 by end of 2024?',
        category: 'Crypto',
        status: 'open',
        expiresAt: '2024-12-31T23:59:59Z',
        yesPrice: 0.72,
        noPrice: 0.28,
        volume24h: 1500000,
    },
    {
        id: 'fed-rate-dec',
        ticker: 'FEDRATE',
        title: 'Will the Fed cut rates in December 2024?',
        category: 'Economics',
        status: 'open',
        expiresAt: '2024-12-18T19:00:00Z',
        yesPrice: 0.85,
        noPrice: 0.15,
        volume24h: 800000,
    },
    {
        id: 'gdp-q4-2024',
        ticker: 'GDPQ4',
        title: 'Will Q4 2024 US GDP growth exceed 3%?',
        category: 'Economics',
        status: 'open',
        expiresAt: '2025-01-30T12:00:00Z',
        yesPrice: 0.45,
        noPrice: 0.55,
        volume24h: 350000,
    },
    {
        id: 'eth-5k-q1-2025',
        ticker: 'ETH5K',
        title: 'Will Ethereum reach $5,000 by Q1 2025?',
        category: 'Crypto',
        status: 'open',
        expiresAt: '2025-03-31T23:59:59Z',
        yesPrice: 0.38,
        noPrice: 0.62,
        volume24h: 920000,
    },
    {
        id: 'inflation-below-3',
        ticker: 'CPI3',
        title: 'Will US CPI inflation fall below 3% by March 2025?',
        category: 'Economics',
        status: 'open',
        expiresAt: '2025-04-10T12:00:00Z',
        yesPrice: 0.62,
        noPrice: 0.38,
        volume24h: 420000,
    },
]

function formatCurrency(num: number): string {
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
    return `$${num.toFixed(2)}`
}

export default function MarketsPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All')

    const categories = ['All', 'Crypto', 'Economics', 'Politics', 'Sports']

    const filteredMarkets = mockMarkets.filter(market => {
        const matchesSearch = market.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            market.ticker.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = selectedCategory === 'All' || market.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className="gradient-text">Markets</h1>
                <p className={styles.subtitle}>Browse and trade tokenized Kalshi prediction markets</p>
            </div>

            <div className={styles.filters}>
                <div className={styles.searchWrapper}>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search markets..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className={styles.categories}>
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            className={`${styles.categoryBtn} ${selectedCategory === cat ? styles.active : ''}`}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.marketGrid}>
                {filteredMarkets.map((market, idx) => (
                    <div
                        key={market.id}
                        className={`${styles.marketCard} glass animate-fade-in-up`}
                        style={{ animationDelay: `${idx * 50}ms` }}
                    >
                        <div className={styles.marketHeader}>
                            <span className={styles.ticker}>{market.ticker}</span>
                            <span className={styles.category}>{market.category}</span>
                        </div>
                        <h3 className={styles.marketTitle}>{market.title}</h3>
                        <div className={styles.priceBar}>
                            <div className={styles.yesBar} style={{ width: `${market.yesPrice * 100}%` }}>
                                <span className={styles.priceLabel}>YES {(market.yesPrice * 100).toFixed(0)}¢</span>
                            </div>
                            <div className={styles.noBar} style={{ width: `${market.noPrice * 100}%` }}>
                                <span className={styles.priceLabel}>NO {(market.noPrice * 100).toFixed(0)}¢</span>
                            </div>
                        </div>
                        <div className={styles.marketMeta}>
                            <span>Vol: {formatCurrency(market.volume24h)}</span>
                            <span>Expires: {new Date(market.expiresAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                ))}
            </div>

            {filteredMarkets.length === 0 && (
                <div className={styles.empty}>
                    <p>No markets found matching your criteria</p>
                </div>
            )}
        </div>
    )
}
