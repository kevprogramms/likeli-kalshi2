'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import styles from './page.module.css'

export default function CreateFundPage() {
    const router = useRouter()
    const { publicKey, connected } = useWallet()

    // Fund parameters
    const [name, setName] = useState('')
    const [symbol, setSymbol] = useState('')
    const [description, setDescription] = useState('')

    // Fee configuration
    const [depositFeeBps, setDepositFeeBps] = useState('0') // 0%
    const [perfFeeBps, setPerfFeeBps] = useState('2000') // 20%

    // Trading window
    const [tradingStartDays, setTradingStartDays] = useState('7') // Days from now
    const [tradingDurationDays, setTradingDurationDays] = useState('30') // Duration in days

    // Initial deposit
    const [depositAmount, setDepositAmount] = useState('')

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    // Calculate timestamps
    const getTradingStartTs = () => {
        const days = parseInt(tradingStartDays) || 7
        return Date.now() + days * 24 * 60 * 60 * 1000
    }

    const getTradingEndTs = () => {
        const startTs = getTradingStartTs()
        const durationDays = parseInt(tradingDurationDays) || 30
        return startTs + durationDays * 24 * 60 * 60 * 1000
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!connected || !publicKey) return

        setIsLoading(true)
        setError('')

        try {
            const fundId = `user_${Date.now()}`
            const managerAddress = publicKey.toBase58()
            const shortManager = `${managerAddress.slice(0, 6)}...${managerAddress.slice(-4)}`

            const newVault = {
                id: fundId,
                name,
                symbol: symbol || name.substring(0, 8).toUpperCase(),
                description,
                manager: shortManager,
                depositFeeBps: parseInt(depositFeeBps),
                perfFeeBps: parseInt(perfFeeBps),
                tvl: parseFloat(depositAmount) || 0,
                apr: 0,
                yourDeposit: parseFloat(depositAmount) || 0,
                age: 0,
                isProtocol: false,
                stage: 'Open',
                tradingStartTs: new Date(getTradingStartTs()).toISOString(),
                tradingEndTs: new Date(getTradingEndTs()).toISOString(),
                createdAt: new Date().toISOString(),
            }

            console.log('Creating fund:', newVault)

            // Save to localStorage
            const USER_VAULTS_KEY = 'likeli_user_vaults'
            const existingVaults = JSON.parse(localStorage.getItem(USER_VAULTS_KEY) || '[]')
            existingVaults.push(newVault)
            localStorage.setItem(USER_VAULTS_KEY, JSON.stringify(existingVaults))

            // Simulate transaction delay
            await new Promise(resolve => setTimeout(resolve, 1500))

            // Redirect to vaults page
            router.push('/vaults')
        } catch (err: any) {
            console.error('Failed to create fund:', err)
            setError(err.message || 'Failed to create fund')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <h1 className={styles.title}>Create a Prediction Fund</h1>
                <p className={styles.subtitle}>
                    Manage investor capital by trading on DFlow prediction markets.
                </p>

                {error && <div className={styles.error}>{error}</div>}

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Basic Info */}
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Fund Details</h2>

                        <div className={styles.field}>
                            <label className={styles.label}>Fund Name</label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="e.g., Alpha Predictions Fund"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                maxLength={32}
                            />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Symbol (optional)</label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="e.g., ALPHA"
                                value={symbol}
                                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                                maxLength={8}
                            />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Description</label>
                            <textarea
                                className={styles.textarea}
                                placeholder="Describe your trading strategy and target markets..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </section>

                    {/* Fee Configuration */}
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Fee Structure</h2>

                        <div className={styles.fieldRow}>
                            <div className={styles.field}>
                                <label className={styles.label}>Deposit Fee (%)</label>
                                <select
                                    className={styles.select}
                                    value={depositFeeBps}
                                    onChange={(e) => setDepositFeeBps(e.target.value)}
                                >
                                    <option value="0">0%</option>
                                    <option value="50">0.5%</option>
                                    <option value="100">1%</option>
                                    <option value="150">1.5%</option>
                                    <option value="200">2%</option>
                                    <option value="250">2.5%</option>
                                    <option value="300">3% (max)</option>
                                </select>
                                <p className={styles.hint}>
                                    Charged immediately when investors deposit.
                                </p>
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>Performance Fee (%)</label>
                                <select
                                    className={styles.select}
                                    value={perfFeeBps}
                                    onChange={(e) => setPerfFeeBps(e.target.value)}
                                >
                                    <option value="1000">10%</option>
                                    <option value="1500">15%</option>
                                    <option value="2000">20%</option>
                                    <option value="2500">25%</option>
                                    <option value="3000">30% (max)</option>
                                </select>
                                <p className={styles.hint}>
                                    Charged only on profits at fund closure.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Trading Window */}
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Trading Window</h2>

                        <div className={styles.fieldRow}>
                            <div className={styles.field}>
                                <label className={styles.label}>Open Period (days)</label>
                                <select
                                    className={styles.select}
                                    value={tradingStartDays}
                                    onChange={(e) => setTradingStartDays(e.target.value)}
                                >
                                    <option value="3">3 days</option>
                                    <option value="5">5 days</option>
                                    <option value="7">7 days</option>
                                    <option value="14">14 days</option>
                                </select>
                                <p className={styles.hint}>
                                    Days accepting deposits before trading starts.
                                </p>
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>Trading Duration (days)</label>
                                <select
                                    className={styles.select}
                                    value={tradingDurationDays}
                                    onChange={(e) => setTradingDurationDays(e.target.value)}
                                >
                                    <option value="14">14 days</option>
                                    <option value="30">30 days</option>
                                    <option value="60">60 days</option>
                                    <option value="90">90 days</option>
                                </select>
                                <p className={styles.hint}>
                                    How long you can actively trade.
                                </p>
                            </div>
                        </div>

                        <div className={styles.timeline}>
                            <div className={styles.timelineItem}>
                                <span className={styles.timelineLabel}>Trading Starts</span>
                                <span className={styles.timelineValue}>
                                    {new Date(getTradingStartTs()).toLocaleDateString()}
                                </span>
                            </div>
                            <div className={styles.timelineItem}>
                                <span className={styles.timelineLabel}>Trading Ends</span>
                                <span className={styles.timelineValue}>
                                    {new Date(getTradingEndTs()).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* Initial Deposit */}
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Initial Deposit (Optional)</h2>

                        <div className={styles.field}>
                            <input
                                type="number"
                                className={styles.input}
                                placeholder="0.00"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                                min="0"
                                step="0.01"
                            />
                            <p className={styles.hint}>
                                Deposit your own USDC to show commitment. Not required.
                            </p>
                        </div>
                    </section>

                    {/* Warnings */}
                    <div className={styles.warnings}>
                        <p className={styles.warning}>
                            ⚠️ Fund parameters (name, fees, timeline) cannot be changed after creation.
                        </p>
                        <p className={styles.warning}>
                            ⚠️ Investors can only withdraw during Open or Closed stages.
                        </p>
                    </div>

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={!connected || isLoading || !name}
                    >
                        {isLoading ? 'Creating...' : connected ? 'Create Fund' : 'Connect Wallet First'}
                    </button>
                </form>
            </div>
        </div>
    )
}
