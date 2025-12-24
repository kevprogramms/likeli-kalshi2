import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemo } from '../lib/DemoContext'
import Button from '../components/Button'
import CreateVaultModal from '../components/CreateVaultModal'
import VaultCard from '../components/VaultCard'
import './Vaults.css'

const protocolVaults = [
    {
        name: 'Likeli Liquidity Provider (LLP)',
        leader: '0x877d...84e7',
        apr: 0.43,
        tvl: 370905447.41,
        yourDeposit: 0,
        age: 960,
        data: [30, 35, 32, 38, 42, 45, 48, 46, 50, 52],
    },
    {
        name: 'Liquidator',
        leader: '0xfc13...80c9',
        apr: -0.00,
        tvl: 15990.94,
        yourDeposit: 0,
        age: 1027,
        data: [50, 48, 52, 55, 53, 50, 48, 45, 47, 50],
    },
]

const userVaults = [
    {
        name: 'Growl HF',
        leader: '0x7768...f60d',
        apr: 5.54,
        tvl: 5588099.37,
        yourDeposit: 0,
        age: 530,
        data: [20, 25, 30, 35, 40, 45, 50, 55, 60, 65],
    },
    {
        name: '[ Systemic Strategies ] ⚡ HyperGrowth ⚡',
        leader: '0x2b80...8f4b',
        apr: -23.62,
        tvl: 3576446.78,
        yourDeposit: 0,
        age: 112,
        data: [70, 65, 60, 55, 50, 45, 40, 35, 30, 25],
    },
    {
        name: '[ Systemic Strategies ] 1/5 Grids',
        leader: '0x2b80...8f4b',
        apr: 102.07,
        tvl: 3366803.08,
        yourDeposit: 0,
        age: 331,
        data: [10, 20, 35, 45, 55, 70, 80, 90, 95, 100],
    },
    {
        name: 'AceVault Hyper01',
        leader: '0x3675...49da',
        apr: 48.70,
        tvl: 3164907.55,
        yourDeposit: 0,
        age: 124,
        data: [25, 30, 40, 55, 60, 75, 80, 85, 90, 92],
    },
    {
        name: 'Ultron',
        leader: '0x8d3f...c056',
        apr: 35.87,
        tvl: 2835333.78,
        yourDeposit: 0,
        age: 16,
        data: [40, 45, 50, 60, 65, 70, 75, 80, 82, 85],
    },
    {
        name: 'FC Genesis - Quantum',
        leader: '0x3d32...cfec',
        apr: -0.94,
        tvl: 2803278.01,
        yourDeposit: 0,
        age: 98,
        data: [60, 58, 55, 52, 50, 48, 50, 52, 51, 49],
    },
    {
        name: 'Sifu',
        leader: '0x5dd5...5d77',
        apr: 383.59,
        tvl: 2688552.07,
        yourDeposit: 0,
        age: 734,
        data: [5, 15, 30, 50, 65, 80, 88, 92, 95, 98],
    },
    {
        name: 'Bitcoin Moving Average Long/Short',
        leader: '0x1fa1...1d08',
        apr: 7.48,
        tvl: 2465609.17,
        yourDeposit: 0,
        age: 79,
        data: [45, 50, 48, 55, 60, 58, 65, 68, 70, 72],
    },
]

function Vaults() {
    const navigate = useNavigate()
    const { userVaults: customVaults } = useDemo()
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    // Simple filter logic
    const filterVaults = (list) => {
        if (!searchTerm) return list
        const lower = searchTerm.toLowerCase()
        return list.filter(v =>
            v.name.toLowerCase().includes(lower) ||
            v.leader.toLowerCase().includes(lower)
        )
    }

    const allUserVaults = [...userVaults, ...customVaults]
    const filteredProtocolVaults = filterVaults(protocolVaults)
    const filteredUserVaults = filterVaults(allUserVaults)

    const formatCurrency = (num) => {
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
        return `$${num.toFixed(2)}`
    }

    const totalTVL = [...protocolVaults, ...allUserVaults].reduce((sum, v) => sum + v.tvl, 0)

    return (
        <div className="vaults-page">
            <div className="vaults-header">
                <div className="tvl-section">
                    <span className="tvl-label">Total Value Locked</span>
                    <span className="tvl-value">{formatCurrency(totalTVL)}</span>
                </div>
                <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                    Create Vault
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
                        placeholder="Search by vault address, name or leader..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-actions">
                    <div className="filter-dropdown">
                        <span>All Vaults</span>
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

            {filteredProtocolVaults.length > 0 && (
                <section className="vaults-section">
                    <h2 className="section-title">Protocol Vaults</h2>
                    <div className="vaults-grid">
                        {filteredProtocolVaults.map((vault, index) => (
                            <div key={`proto-${index}`} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                                <VaultCard
                                    vault={vault}
                                    onClick={() => navigate(`/vault/p-${index}`)}
                                />
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section className="vaults-section">
                <h2 className="section-title">User Vaults</h2>
                {filteredUserVaults.length > 0 ? (
                    <div className="vaults-grid">
                        {filteredUserVaults.map((vault, index) => (
                            <div key={`user-${index}`} className="animate-fade-in-up" style={{ animationDelay: `${(index + 2) * 50}ms` }}>
                                <VaultCard
                                    vault={vault}
                                    onClick={() => navigate(`/vault/${vault.id || `user-${index}`}`)}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        No vaults found matching "{searchTerm}"
                    </div>
                )}

                {filteredUserVaults.length > 10 && (
                    <div className="table-footer">
                        <div className="pagination">
                            <button className="page-btn" disabled>←</button>
                            <button className="page-btn">→</button>
                        </div>
                    </div>
                )}
            </section>

            <CreateVaultModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
        </div>
    )
}

export default Vaults
