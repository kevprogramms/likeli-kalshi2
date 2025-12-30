import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemo } from '../lib/DemoContext'
import Button from '../components/Button'
import EtfBasketCard from '../components/EtfBasketCard'
import './Vaults.css'

// Sample ETF Baskets data
const sampleEtfBaskets = [
    {
        id: 'etf-1',
        name: 'Election Hedge Basket',
        leader: '0x8a7d...e4f2',
        description: 'Diversified exposure to major political event outcomes',
        totalShares: '100000',
        cashUsdc: '25000',
        liquidityBufferBps: 1000,
        exitFeeBps: 50,
        positions: [
            { marketId: 'trump-win-2024', side: 'YES', shares: '30000', marketName: 'Trump wins 2024' },
            { marketId: 'dem-senate-2024', side: 'NO', shares: '20000', marketName: 'Dems keep Senate' },
            { marketId: 'recession-2025', side: 'YES', shares: '15000', marketName: 'US Recession 2025' },
        ],
        stage: 'Trading',
        nav: 1.15,
        tvl: 115000,
        yourShares: 0,
        age: 30,
        data: [45, 48, 52, 55, 58, 60, 62, 65, 68, 70],
    },
    {
        id: 'etf-2',
        name: 'Crypto Sentiment Index',
        leader: '0x2c4b...9a1e',
        description: 'Track crypto market sentiment through prediction markets',
        totalShares: '50000',
        cashUsdc: '15000',
        liquidityBufferBps: 500,
        exitFeeBps: 100,
        positions: [
            { marketId: 'btc-100k-2024', side: 'YES', shares: '25000', marketName: 'BTC hits $100K in 2024' },
            { marketId: 'eth-10k-2025', side: 'YES', shares: '10000', marketName: 'ETH hits $10K in 2025' },
        ],
        stage: 'Trading',
        nav: 0.95,
        tvl: 47500,
        yourShares: 0,
        age: 15,
        data: [60, 58, 55, 52, 50, 48, 46, 45, 44, 43],
    },
    {
        id: 'etf-3',
        name: 'Tech Events Tracker',
        leader: '0x5f3a...c7d8',
        description: 'Major tech company event outcomes',
        totalShares: '75000',
        cashUsdc: '30000',
        liquidityBufferBps: 750,
        exitFeeBps: 75,
        positions: [
            { marketId: 'apple-ar-2025', side: 'YES', shares: '20000', marketName: 'Apple AR glasses 2025' },
            { marketId: 'openai-ipo-2025', side: 'NO', shares: '15000', marketName: 'OpenAI IPO 2025' },
            { marketId: 'tesla-robotaxi', side: 'YES', shares: '10000', marketName: 'Tesla Robotaxi launch' },
        ],
        stage: 'Trading',
        nav: 1.08,
        tvl: 81000,
        yourShares: 0,
        age: 45,
        data: [50, 52, 54, 55, 57, 58, 60, 61, 62, 63],
    },
    {
        id: 'etf-4',
        name: 'Sports & Entertainment',
        leader: '0x9e2f...b3a6',
        description: 'Major sports and entertainment event predictions',
        totalShares: '60000',
        cashUsdc: '20000',
        liquidityBufferBps: 800,
        exitFeeBps: 50,
        positions: [
            { marketId: 'superbowl-2025', side: 'YES', shares: '15000', marketName: 'Chiefs win SB 2025' },
            { marketId: 'oscars-2025', side: 'NO', shares: '12000', marketName: 'Wicked wins Best Picture' },
        ],
        stage: 'Trading',
        nav: 1.03,
        tvl: 61800,
        yourShares: 0,
        age: 22,
        data: [48, 50, 52, 51, 53, 55, 54, 56, 55, 57],
    },
]

function EtfBaskets() {
    const navigate = useNavigate()
    const { etfBaskets: customBaskets = [] } = useDemo()
    const [searchTerm, setSearchTerm] = useState('')

    const allBaskets = [...sampleEtfBaskets, ...customBaskets]

    const filteredBaskets = allBaskets.filter(basket => {
        if (!searchTerm) return true
        const lower = searchTerm.toLowerCase()
        return basket.name.toLowerCase().includes(lower) ||
            basket.leader.toLowerCase().includes(lower)
    })

    const formatCurrency = (num) => {
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
        return `$${num.toFixed(2)}`
    }

    const totalTVL = allBaskets.reduce((sum, b) => sum + b.tvl, 0)

    return (
        <div className="vaults-page">
            <div className="vaults-header">
                <div className="tvl-section">
                    <span className="tvl-label">Total Value Locked</span>
                    <span className="tvl-value">{formatCurrency(totalTVL)}</span>
                </div>
                <Button variant="primary" onClick={() => navigate('/etf-basket/create')}>
                    Create Basket
                </Button>
            </div>

            <div className="vaults-filters">
                <div className="search-wrapper">
                    <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search by basket name or creator..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-actions">
                    <div className="filter-dropdown">
                        <span>All Baskets</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    </div>
                    <div className="time-dropdown">
                        <span>TVL (High to Low)</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    </div>
                </div>
            </div>

            <section className="vaults-section">
                <h2 className="section-title">ETF Baskets</h2>
                {filteredBaskets.length > 0 ? (
                    <div className="vaults-grid">
                        {filteredBaskets.map((basket, index) => (
                            <div key={basket.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                                <EtfBasketCard
                                    basket={basket}
                                    onClick={() => navigate(`/etf-basket/${basket.id}`)}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        No baskets found matching "{searchTerm}"
                    </div>
                )}
            </section>
        </div>
    )
}

export default EtfBaskets
