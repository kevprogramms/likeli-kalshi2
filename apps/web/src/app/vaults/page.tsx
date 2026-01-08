'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from './page.module.css'

// Type for vault data
interface Vault {
    id: string
    name: string
    manager: string
    apr: number
    tvl: number
    yourDeposit: number
    age: number
    isProtocol: boolean
    stage?: string
    depositFeeBps?: number
    perfFeeBps?: number
}

// Default mock vaults
const defaultMockVaults: Vault[] = [
    {
        id: '1',
        name: 'Likeli Liquidity Provider (LLP)',
        manager: '0x877d...84e7',
        apr: 0.43,
        tvl: 370905447,
        yourDeposit: 0,
        age: 960,
        isProtocol: true,
    },
    {
        id: '2',
        name: 'Growl HF',
        manager: '0x7768...f60d',
        apr: 5.54,
        tvl: 5588099,
        yourDeposit: 0,
        age: 530,
        isProtocol: false,
    },
    {
        id: '3',
        name: 'Alpha Strategy',
        manager: '0x2b80...8f4b',
        apr: 102.07,
        tvl: 3366803,
        yourDeposit: 0,
        age: 331,
        isProtocol: false,
    },
    {
        id: '4',
        name: 'Bitcoin Momentum',
        manager: '0x3675...49da',
        apr: 48.70,
        tvl: 3164907,
        yourDeposit: 0,
        age: 124,
        isProtocol: false,
    },
    {
        id: '5',
        name: 'Market Neutral',
        manager: '0x8d3f...c056',
        apr: 35.87,
        tvl: 2835333,
        yourDeposit: 0,
        age: 16,
        isProtocol: false,
    },
]

// LocalStorage key for user-created vaults
const USER_VAULTS_KEY = 'likeli_user_vaults'

function getStoredVaults(): Vault[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(USER_VAULTS_KEY)
    if (stored) return JSON.parse(stored)
    return []
}

function formatCurrency(num: number): string {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
    return `$${num.toFixed(2)}`
}

export default function VaultsPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const [userCreatedVaults, setUserCreatedVaults] = useState<Vault[]>([])

    // Load user-created vaults from localStorage
    useEffect(() => {
        setUserCreatedVaults(getStoredVaults())
    }, [])

    // Combine default mock vaults with user-created vaults
    const allVaults = [...defaultMockVaults, ...userCreatedVaults]

    // Filter by search term
    const filteredVaults = allVaults.filter(v =>
        searchTerm === '' ||
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.manager.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const protocolVaults = filteredVaults.filter(v => v.isProtocol)
    const userVaults = filteredVaults.filter(v => !v.isProtocol)

    const totalTVL = allVaults.reduce((sum, v) => sum + v.tvl, 0)

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.tvl}>
                    <span className={styles.tvlLabel}>Total Value Locked</span>
                    <span className={styles.tvlValue}>{formatCurrency(totalTVL)}</span>
                </div>
                <Link href="/vaults/create" className={styles.createBtn}>
                    Create Vault
                </Link>
            </div>

            <div className={styles.filters}>
                <div className={styles.searchWrapper}>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search by vault address, name or leader..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className={styles.filterActions}>
                    <button className={styles.filterBtn}>All-time</button>
                </div>
            </div>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Protocol Vaults</h2>
                <div className={`${styles.table} glass`}>
                    <div className={styles.tableHeader}>
                        <div className={styles.th}>Vault</div>
                        <div className={styles.th}>Leader</div>
                        <div className={styles.th}>APR</div>
                        <div className={styles.th}>TVL</div>
                        <div className={styles.th}>Age (days)</div>
                    </div>
                    {protocolVaults.map((vault) => (
                        <Link href={`/vaults/${vault.id}`} key={vault.id} className={styles.tableRow}>
                            <div className={styles.td}>
                                <span className={styles.vaultName}>{vault.name}</span>
                            </div>
                            <div className={`${styles.td} ${styles.leader}`}>{vault.manager}</div>
                            <div className={styles.td}>
                                <span className={vault.apr >= 0 ? styles.positive : styles.negative}>
                                    {vault.apr >= 0 ? '+' : ''}{vault.apr.toFixed(2)}%
                                </span>
                            </div>
                            <div className={styles.td}>{formatCurrency(vault.tvl)}</div>
                            <div className={styles.td}>{vault.age}</div>
                        </Link>
                    ))}
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    User Vaults
                    {userCreatedVaults.length > 0 && (
                        <span className={styles.yourVaultsCount}> ({userCreatedVaults.length} created by you)</span>
                    )}
                </h2>
                <div className={`${styles.table} glass`}>
                    <div className={styles.tableHeader}>
                        <div className={styles.th}>Vault</div>
                        <div className={styles.th}>Leader</div>
                        <div className={styles.th}>APR</div>
                        <div className={styles.th}>TVL</div>
                        <div className={styles.th}>Stage</div>
                    </div>
                    {userVaults.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>No user vaults found.</p>
                            <Link href="/vaults/create" className={styles.createLink}>
                                Create your first vault →
                            </Link>
                        </div>
                    ) : (
                        userVaults.map((vault, idx) => (
                            <Link
                                href={`/vaults/${vault.id}`}
                                key={vault.id}
                                className={`${styles.tableRow} animate-fade-in-up`}
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <div className={styles.td}>
                                    <span className={styles.vaultName}>{vault.name}</span>
                                    {userCreatedVaults.some(v => v.id === vault.id) && (
                                        <span className={styles.yourVaultBadge}>Your Vault</span>
                                    )}
                                </div>
                                <div className={`${styles.td} ${styles.leader}`}>{vault.manager}</div>
                                <div className={styles.td}>
                                    <span className={vault.apr >= 0 ? styles.positive : styles.negative}>
                                        {vault.apr >= 0 ? '+' : ''}{vault.apr.toFixed(2)}%
                                    </span>
                                </div>
                                <div className={styles.td}>{formatCurrency(vault.tvl)}</div>
                                <div className={styles.td}>
                                    <span className={`${styles.stageBadge} ${styles[vault.stage?.toLowerCase() || 'open']}`}>
                                        {vault.stage || 'Open'}
                                    </span>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </section>
        </div>
    )
}
