'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import styles from './page.module.css'

// Mock vault data - will be dynamic in production
const initialVaultData = {
    id: '1',
    name: 'Growl HF',
    description: 'Algorithmic trading strategy focused on prediction market inefficiencies.',
    manager: '0x7768...f60d',
    apr: 5.54,
    tvl: 5588099,
    nav: 5588099,
    sharePrice: 1.23,
    totalShares: 4543902,
    depositFeeBps: 100, // 1%
    perfFeeBps: 2000,   // 20%
    earlyExitFeeBps: 500, // 5%
    stage: 'Trading', // Open, Trading, Settlement, Closed
    age: 530,
}

const mockPositions = [
    { marketId: 'btc-100k', marketName: 'BTC $100k EOY', side: 'YES', quantity: 50000, avgPrice: 0.68, currentPrice: 0.72, pnl: 2000 },
    { marketId: 'fed-rate', marketName: 'Fed Rate Cut Dec', side: 'YES', quantity: 30000, avgPrice: 0.80, currentPrice: 0.85, pnl: 1500 },
    { marketId: 'gdp-q4', marketName: 'GDP > 3% Q4', side: 'NO', quantity: 20000, avgPrice: 0.52, currentPrice: 0.55, pnl: -600 },
]

const mockTrades = [
    { id: '1', timestamp: '2024-12-20 14:32', marketName: 'BTC $100k EOY', side: 'YES', direction: 'BUY', quantity: 10000, price: 0.70, fee: 20 },
    { id: '2', timestamp: '2024-12-19 09:15', marketName: 'Fed Rate Cut', side: 'YES', direction: 'BUY', quantity: 15000, price: 0.82, fee: 30.75 },
    { id: '3', timestamp: '2024-12-18 16:45', marketName: 'GDP > 3%', side: 'NO', direction: 'BUY', quantity: 20000, price: 0.52, fee: 20.80 },
]

function formatCurrency(num: number): string {
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
    return `$${num.toFixed(2)}`
}

// Simulated user storage
interface UserBalance {
    usdc: number
    shares: number
    deposits: { amount: number; shares: number; timestamp: string }[]
    withdrawals: { shares: number; usdc: number; timestamp: string }[]
}

function getStoredBalance(): UserBalance {
    if (typeof window === 'undefined') return { usdc: 10000, shares: 0, deposits: [], withdrawals: [] }
    const stored = localStorage.getItem('likeli_mock_balance')
    if (stored) return JSON.parse(stored)
    return { usdc: 10000, shares: 0, deposits: [], withdrawals: [] } // Start with 10k USDC
}

function saveBalance(balance: UserBalance) {
    if (typeof window !== 'undefined') {
        localStorage.setItem('likeli_mock_balance', JSON.stringify(balance))
    }
}

export default function VaultDetailPage() {
    const { id } = useParams()
    const { publicKey, connected } = useWallet()
    const [depositAmount, setDepositAmount] = useState('')
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit')
    const [userBalance, setUserBalance] = useState<UserBalance>({ usdc: 10000, shares: 0, deposits: [], withdrawals: [] })
    const [vault, setVault] = useState(initialVaultData)
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Load balance from localStorage
    useEffect(() => {
        setUserBalance(getStoredBalance())
    }, [])

    const isManager = connected && publicKey?.toBase58().startsWith('0x7768')

    const handleDeposit = async () => {
        const amount = parseFloat(depositAmount)
        if (!amount || amount <= 0) {
            setMessage({ type: 'error', text: 'Please enter a valid amount' })
            return
        }
        if (amount > userBalance.usdc) {
            setMessage({ type: 'error', text: 'Insufficient USDC balance' })
            return
        }

        setIsLoading(true)
        setMessage(null)

        // Simulate transaction delay
        await new Promise(resolve => setTimeout(resolve, 1500))

        // Calculate deposit fee (1%)
        const depositFee = amount * vault.depositFeeBps / 10000
        const netAmount = amount - depositFee

        // Calculate shares to mint
        const sharesToMint = netAmount / vault.sharePrice

        // Update balances
        const newBalance: UserBalance = {
            ...userBalance,
            usdc: userBalance.usdc - amount,
            shares: userBalance.shares + sharesToMint,
            deposits: [
                { amount, shares: sharesToMint, timestamp: new Date().toISOString() },
                ...userBalance.deposits,
            ],
        }

        setUserBalance(newBalance)
        saveBalance(newBalance)

        // Update vault TVL
        setVault(prev => ({
            ...prev,
            tvl: prev.tvl + netAmount,
            nav: prev.nav + netAmount,
            totalShares: prev.totalShares + sharesToMint,
        }))

        setMessage({
            type: 'success',
            text: `✅ Deposited $${amount.toFixed(2)} → Received ${sharesToMint.toFixed(2)} shares (Fee: $${depositFee.toFixed(2)})`
        })
        setDepositAmount('')
        setIsLoading(false)
    }

    const handleWithdraw = async () => {
        const shares = parseFloat(withdrawAmount)
        if (!shares || shares <= 0) {
            setMessage({ type: 'error', text: 'Please enter valid shares amount' })
            return
        }
        if (shares > userBalance.shares) {
            setMessage({ type: 'error', text: 'Insufficient shares balance' })
            return
        }

        setIsLoading(true)
        setMessage(null)

        // Simulate transaction delay
        await new Promise(resolve => setTimeout(resolve, 1500))

        // Calculate USDC to receive
        let usdcToReceive = shares * vault.sharePrice
        let feeText = ''

        // Apply early exit fee if in Trading stage (5%)
        if (vault.stage === 'Trading') {
            const earlyExitFee = usdcToReceive * vault.earlyExitFeeBps / 10000
            usdcToReceive -= earlyExitFee
            feeText = ` (Early exit fee: $${earlyExitFee.toFixed(2)})`
        }

        // Update balances
        const newBalance: UserBalance = {
            ...userBalance,
            usdc: userBalance.usdc + usdcToReceive,
            shares: userBalance.shares - shares,
            withdrawals: [
                { shares, usdc: usdcToReceive, timestamp: new Date().toISOString() },
                ...userBalance.withdrawals,
            ],
        }

        setUserBalance(newBalance)
        saveBalance(newBalance)

        // Update vault TVL
        setVault(prev => ({
            ...prev,
            tvl: prev.tvl - usdcToReceive,
            nav: prev.nav - usdcToReceive,
            totalShares: prev.totalShares - shares,
        }))

        setMessage({
            type: 'success',
            text: `✅ Withdrew ${shares.toFixed(2)} shares → Received $${usdcToReceive.toFixed(2)}${feeText}`
        })
        setWithdrawAmount('')
        setIsLoading(false)
    }

    const resetBalance = () => {
        const fresh = { usdc: 10000, shares: 0, deposits: [], withdrawals: [] }
        setUserBalance(fresh)
        saveBalance(fresh)
        setMessage({ type: 'success', text: 'Balance reset to $10,000 USDC' })
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>{vault.name}</h1>
                    <p className={styles.description}>{vault.description}</p>
                    <div className={styles.meta}>
                        <span className={styles.manager}>Manager: {vault.manager}</span>
                        <span className={styles.fee}>Deposit Fee: {vault.depositFeeBps / 100}%</span>
                        <span className={styles.fee}>Perf Fee: {vault.perfFeeBps / 100}%</span>
                        <span className={`${styles.stage} ${styles[vault.stage.toLowerCase()]}`}>
                            {vault.stage}
                        </span>
                    </div>
                </div>
            </div>

            <div className={styles.statsGrid}>
                <div className={`${styles.statCard} glass`}>
                    <span className={styles.statLabel}>TVL</span>
                    <span className={styles.statValue}>{formatCurrency(vault.tvl)}</span>
                </div>
                <div className={`${styles.statCard} glass`}>
                    <span className={styles.statLabel}>NAV</span>
                    <span className={styles.statValue}>{formatCurrency(vault.nav)}</span>
                </div>
                <div className={`${styles.statCard} glass`}>
                    <span className={styles.statLabel}>Share Price</span>
                    <span className={styles.statValue}>${vault.sharePrice.toFixed(4)}</span>
                </div>
                <div className={`${styles.statCard} glass`}>
                    <span className={styles.statLabel}>APR</span>
                    <span className={`${styles.statValue} ${styles.positive}`}>+{vault.apr}%</span>
                </div>
            </div>

            <div className={styles.mainGrid}>
                <div className={styles.leftCol}>
                    {/* Performance Chart */}
                    <div className={`${styles.section} glass`}>
                        <h2 className={styles.sectionTitle}>Performance</h2>
                        <div className={styles.chartPlaceholder}>
                            <svg viewBox="0 0 400 120" className={styles.chart}>
                                <defs>
                                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#00FFFF" stopOpacity="0.3" />
                                        <stop offset="100%" stopColor="#00FFFF" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <path
                                    d="M0,100 Q50,90 100,70 T200,60 T300,40 T400,35"
                                    fill="none"
                                    stroke="#00FFFF"
                                    strokeWidth="2"
                                />
                                <path
                                    d="M0,100 Q50,90 100,70 T200,60 T300,40 T400,35 L400,120 L0,120 Z"
                                    fill="url(#chartGradient)"
                                />
                            </svg>
                        </div>
                    </div>

                    {/* Positions */}
                    <div className={`${styles.section} glass`}>
                        <h2 className={styles.sectionTitle}>Open Positions</h2>
                        <div className={styles.table}>
                            <div className={styles.tableHeader}>
                                <div className={styles.th}>Market</div>
                                <div className={styles.th}>Side</div>
                                <div className={styles.th}>Qty</div>
                                <div className={styles.th}>Avg Price</div>
                                <div className={styles.th}>PnL</div>
                            </div>
                            {mockPositions.map((pos, idx) => (
                                <div key={idx} className={styles.tableRow}>
                                    <div className={styles.td}>{pos.marketName}</div>
                                    <div className={styles.td}>
                                        <span className={pos.side === 'YES' ? styles.yes : styles.no}>{pos.side}</span>
                                    </div>
                                    <div className={styles.td}>{pos.quantity.toLocaleString()}</div>
                                    <div className={styles.td}>${pos.avgPrice.toFixed(2)}</div>
                                    <div className={`${styles.td} ${pos.pnl >= 0 ? styles.positive : styles.negative}`}>
                                        {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Trade History */}
                    <div className={`${styles.section} glass`}>
                        <h2 className={styles.sectionTitle}>Trade History</h2>
                        <div className={styles.table}>
                            <div className={styles.tableHeader}>
                                <div className={styles.th}>Time</div>
                                <div className={styles.th}>Market</div>
                                <div className={styles.th}>Side</div>
                                <div className={styles.th}>Type</div>
                                <div className={styles.th}>Qty</div>
                                <div className={styles.th}>Price</div>
                            </div>
                            {mockTrades.map((trade) => (
                                <div key={trade.id} className={styles.tableRow}>
                                    <div className={`${styles.td} ${styles.time}`}>{trade.timestamp}</div>
                                    <div className={styles.td}>{trade.marketName}</div>
                                    <div className={styles.td}>
                                        <span className={trade.side === 'YES' ? styles.yes : styles.no}>{trade.side}</span>
                                    </div>
                                    <div className={styles.td}>{trade.direction}</div>
                                    <div className={styles.td}>{trade.quantity.toLocaleString()}</div>
                                    <div className={styles.td}>${trade.price.toFixed(2)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={styles.rightCol}>
                    {/* Your Balance Card */}
                    <div className={`${styles.balanceCard} glass`}>
                        <h3 className={styles.balanceTitle}>Your Balance (Simulated)</h3>
                        <div className={styles.balanceGrid}>
                            <div className={styles.balanceItem}>
                                <span className={styles.balanceLabel}>USDC</span>
                                <span className={styles.balanceValue}>${userBalance.usdc.toFixed(2)}</span>
                            </div>
                            <div className={styles.balanceItem}>
                                <span className={styles.balanceLabel}>Shares</span>
                                <span className={styles.balanceValue}>{userBalance.shares.toFixed(2)}</span>
                            </div>
                            <div className={styles.balanceItem}>
                                <span className={styles.balanceLabel}>Value</span>
                                <span className={styles.balanceValue}>${(userBalance.shares * vault.sharePrice).toFixed(2)}</span>
                            </div>
                        </div>
                        <button onClick={resetBalance} className={styles.resetBtn}>
                            Reset to $10,000
                        </button>
                    </div>

                    {/* Deposit/Withdraw Card */}
                    <div className={`${styles.actionCard} glass`}>
                        <div className={styles.tabs}>
                            <button
                                className={`${styles.tab} ${activeTab === 'deposit' ? styles.active : ''}`}
                                onClick={() => setActiveTab('deposit')}
                            >
                                Deposit
                            </button>
                            <button
                                className={`${styles.tab} ${activeTab === 'withdraw' ? styles.active : ''}`}
                                onClick={() => setActiveTab('withdraw')}
                            >
                                Withdraw
                            </button>
                        </div>

                        {message && (
                            <div className={`${styles.message} ${styles[message.type]}`}>
                                {message.text}
                            </div>
                        )}

                        {activeTab === 'deposit' ? (
                            <div className={styles.form}>
                                <label className={styles.label}>Amount (USDC)</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="0.00"
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    max={userBalance.usdc}
                                />
                                <div className={styles.estimate}>
                                    <span>Deposit Fee ({vault.depositFeeBps / 100}%)</span>
                                    <span>-${depositAmount ? (parseFloat(depositAmount) * vault.depositFeeBps / 10000).toFixed(2) : '0.00'}</span>
                                </div>
                                <div className={styles.estimate}>
                                    <span>Shares to receive</span>
                                    <span>{depositAmount ? ((parseFloat(depositAmount) * (1 - vault.depositFeeBps / 10000)) / vault.sharePrice).toFixed(2) : '0.00'}</span>
                                </div>
                                <button
                                    className={styles.actionBtn}
                                    onClick={handleDeposit}
                                    disabled={isLoading || !depositAmount}
                                >
                                    {isLoading ? 'Processing...' : 'Deposit'}
                                </button>
                            </div>
                        ) : (
                            <div className={styles.form}>
                                <label className={styles.label}>Shares to Withdraw</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="0.00"
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    max={userBalance.shares}
                                />
                                {vault.stage === 'Trading' && (
                                    <div className={`${styles.estimate} ${styles.warning}`}>
                                        <span>Early Exit Fee ({vault.earlyExitFeeBps / 100}%)</span>
                                        <span>-${withdrawAmount ? (parseFloat(withdrawAmount) * vault.sharePrice * vault.earlyExitFeeBps / 10000).toFixed(2) : '0.00'}</span>
                                    </div>
                                )}
                                <div className={styles.estimate}>
                                    <span>USDC to receive</span>
                                    <span>${withdrawAmount ?
                                        ((parseFloat(withdrawAmount) * vault.sharePrice) * (1 - (vault.stage === 'Trading' ? vault.earlyExitFeeBps / 10000 : 0))).toFixed(2)
                                        : '0.00'}
                                    </span>
                                </div>
                                <button
                                    className={styles.actionBtn}
                                    onClick={handleWithdraw}
                                    disabled={isLoading || !withdrawAmount}
                                >
                                    {isLoading ? 'Processing...' : 'Withdraw'}
                                </button>
                            </div>
                        )}

                        <p className={styles.disclaimer}>
                            ⚠️ This is simulated. Real funds will require wallet signature.
                        </p>
                    </div>

                    {/* Transaction History */}
                    {(userBalance.deposits.length > 0 || userBalance.withdrawals.length > 0) && (
                        <div className={`${styles.historyCard} glass`}>
                            <h3 className={styles.historyTitle}>Your Activity</h3>
                            <div className={styles.historyList}>
                                {userBalance.deposits.slice(0, 3).map((d, i) => (
                                    <div key={`d-${i}`} className={styles.historyItem}>
                                        <span className={styles.historyIcon}>⬇️</span>
                                        <span>Deposited ${d.amount.toFixed(2)} → {d.shares.toFixed(2)} shares</span>
                                    </div>
                                ))}
                                {userBalance.withdrawals.slice(0, 3).map((w, i) => (
                                    <div key={`w-${i}`} className={styles.historyItem}>
                                        <span className={styles.historyIcon}>⬆️</span>
                                        <span>Withdrew {w.shares.toFixed(2)} shares → ${w.usdc.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
