import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemo } from '../lib/DemoContext'
import Button from '../components/Button'
import CreateVaultModal from '../components/CreateVaultModal'
import VaultCard from '../components/VaultCard'
import './Vaults.css'



import { marketService } from '../lib/marketService'

// Static vaults removed - fetching from Backend API
const userVaults = []

function Vaults() {
    const navigate = useNavigate()
    const { userVaults: customVaults } = useDemo()
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [backendVaults, setBackendVaults] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadVaults = async () => {
            try {
                // Determine API base URL dynamically or fallback to localhost
                // For MVP, calling the service which calls localhost:3001
                const data = await marketService.getVaults()
                if (Array.isArray(data)) {
                    setBackendVaults(data)
                } else {
                    console.error("Vaults data is not an array:", data)
                    setBackendVaults([])
                }
            } catch (e) {
                console.error("Failed to load vaults", e)
                setBackendVaults([])
            } finally {
                setLoading(false)
            }
        }
        loadVaults()
    }, [])

    // Simple filter logic
    const filterVaults = (list) => {
        if (!searchTerm) return list
        const lower = searchTerm.toLowerCase()
        return list.filter(v =>
            v.name.toLowerCase().includes(lower) ||
            v.leader.toLowerCase().includes(lower)
        )
    }

    const allUserVaults = [...backendVaults, ...customVaults]
    const filteredUserVaults = filterVaults(allUserVaults)

    const formatCurrency = (num) => {
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
        return `$${num.toFixed(2)}`
    }

    const totalTVL = allUserVaults.reduce((sum, v) => sum + v.tvl, 0)

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



            <section className="vaults-section">
                <h2 className="section-title">User Vaults</h2>
                {filteredUserVaults.length > 0 ? (
                    <div className="vaults-grid">
                        {filteredUserVaults.map((vault, index) => (
                            <div key={vault.id || index} className="animate-fade-in-up" style={{ animationDelay: `${(index + 2) * 50}ms` }}>
                                <VaultCard
                                    vault={vault}
                                    onClick={() => navigate(`/vault/${vault.id}`)}
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
