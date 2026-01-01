import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemo } from '../lib/DemoContext'
import { marketService } from '../lib/marketService'
import Button from '../components/Button'
import EtfBasketCard from '../components/EtfBasketCard'
import './Vaults.css'

// Fallback sample data (only used if API is unavailable)
const fallbackEtfBaskets = [
    {
        id: 'etf-1',
        name: 'Election Hedge Basket',
        leader: '0x8a7d...e4f2',
        description: 'Diversified exposure to major political event outcomes',
        totalShares: 100000,
        cashUsdc: 25000,
        positions: [
            { marketId: 'trump-win-2024', side: 'YES', shares: 30000, marketName: 'Trump wins 2024' },
            { marketId: 'dem-senate-2024', side: 'NO', shares: 20000, marketName: 'Dems keep Senate' },
        ],
        stage: 'Trading',
        nav: 1.15,
        tvl: 115000,
        age: 30,
        data: [45, 48, 52, 55, 58, 60, 62, 65, 68, 70],
    },
    {
        id: 'etf-2',
        name: 'Crypto Sentiment Index',
        leader: '0x2c4b...9a1e',
        description: 'Track crypto market sentiment through prediction markets',
        totalShares: 50000,
        cashUsdc: 15000,
        positions: [
            { marketId: 'btc-100k-2024', side: 'YES', shares: 25000, marketName: 'BTC hits $100K in 2024' },
        ],
        stage: 'Trading',
        nav: 0.95,
        tvl: 47500,
        age: 15,
        data: [60, 58, 55, 52, 50, 48, 46, 45, 44, 43],
    },
]

function EtfBaskets() {
    const navigate = useNavigate()
    const { etfBaskets: customBaskets = [] } = useDemo()
    const [searchTerm, setSearchTerm] = useState('')
    const [backendBaskets, setBackendBaskets] = useState([])
    const [loading, setLoading] = useState(true)

    // Fetch ETF baskets from backend API
    useEffect(() => {
        const loadBaskets = async () => {
            try {
                const data = await marketService.getEtfBaskets()
                if (Array.isArray(data) && data.length > 0) {
                    // Transform backend data to match UI expectations
                    const transformed = data.map(basket => ({
                        ...basket,
                        leader: basket.manager || 'Likeli Platform',
                        tvl: basket.totalShares * (basket.nav || 1),
                        age: Math.floor((Date.now() - new Date(basket.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
                        data: [50, 52, 54, 56, 58, 60, 62, 64, 66, 68], // Default chart data
                    }))
                    setBackendBaskets(transformed)
                } else {
                    // Use fallback data if API returns empty
                    setBackendBaskets(fallbackEtfBaskets)
                }
            } catch (e) {
                console.error('Failed to load ETF baskets from API:', e)
                setBackendBaskets(fallbackEtfBaskets)
            } finally {
                setLoading(false)
            }
        }
        loadBaskets()
    }, [])

    const allBaskets = [...backendBaskets, ...customBaskets]


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
