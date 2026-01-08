import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDemo } from '../lib/DemoContext'
import Button from '../components/Button'
import './VaultDetail.css'

// Static vault data for non-custom vaults
const staticVaults = {
    '0': {
        name: 'Likeli Liquidity Provider (LLP)',
        leader: '0x877d...84e7',
        apr: 0.43,
        vaultUsdc: 370905447.41,
        tvl: 370905447.41,
        age: 960,
        description: 'Official Likeli liquidity provider vault for optimal prediction market trading.',
        depositFeeBps: 50,
        perfFeeBps: 1000,
        stage: 'Trading',
        totalDepositors: 1247,
    },
    '1': {
        name: 'Liquidator',
        leader: '0xfc13...80c9',
        apr: -0.00,
        vaultUsdc: 15990.94,
        tvl: 15990.94,
        age: 1027,
        description: 'Automated liquidation vault for optimal protocol health.',
        depositFeeBps: 30,
        perfFeeBps: 1500,
        stage: 'Trading',
        totalDepositors: 89,
    },
    'static-0': {
        name: 'Growl HF',
        leader: '0x7768...f60d',
        apr: 5.54,
        vaultUsdc: 5588099.37,
        tvl: 5588099.37,
        age: 530,
        description: 'High-frequency trading vault with advanced strategies.',
        depositFeeBps: 100,
        perfFeeBps: 2000,
        stage: 'Trading',
        totalDepositors: 342,
    },
    'static-1': {
        name: '[ Systemic Strategies ] ⚡ HyperGrowth ⚡',
        leader: '0x2b80...8f4b',
        apr: -23.62,
        vaultUsdc: 3576446.78,
        tvl: 3576446.78,
        age: 112,
        description: 'Aggressive growth strategy vault.',
        depositFeeBps: 150,
        perfFeeBps: 2500,
        stage: 'Trading',
        totalDepositors: 187,
    },
    'static-2': {
        name: '[ Systemic Strategies ] 1/5 Grids',
        leader: '0x2b80...8f4b',
        apr: 102.07,
        vaultUsdc: 3366803.08,
        tvl: 3366803.08,
        age: 331,
        description: 'Grid trading strategy vault.',
        depositFeeBps: 100,
        perfFeeBps: 2000,
        stage: 'Trading',
        totalDepositors: 256,
    },
    'static-3': {
        name: 'AceVault Hyper01',
        leader: '0x3675...49da',
        apr: 48.70,
        vaultUsdc: 3164907.55,
        tvl: 3164907.55,
        age: 124,
        description: 'Hyper-optimized trading vault.',
        depositFeeBps: 100,
        perfFeeBps: 1500,
        stage: 'Trading',
        totalDepositors: 198,
    },
    'static-4': {
        name: 'Ultron',
        leader: '0x8d3f...c056',
        apr: 35.87,
        vaultUsdc: 2835333.78,
        tvl: 2835333.78,
        age: 16,
        description: 'AI-powered trading vault.',
        depositFeeBps: 100,
        perfFeeBps: 2000,
        stage: 'Trading',
        totalDepositors: 145,
    },
    'static-5': {
        name: 'FC Genesis - Quantum',
        leader: '0x3d32...cfec',
        apr: -0.94,
        vaultUsdc: 2803278.01,
        tvl: 2803278.01,
        age: 98,
        description: 'Quantum strategy vault.',
        depositFeeBps: 50,
        perfFeeBps: 1000,
        stage: 'Trading',
        totalDepositors: 312,
    },
    'static-6': {
        name: 'Sifu',
        leader: '0x5dd5...5d77',
        apr: 383.59,
        vaultUsdc: 2688552.07,
        tvl: 2688552.07,
        age: 734,
        description: 'Legendary trading vault with exceptional returns.',
        depositFeeBps: 200,
        perfFeeBps: 3000,
        stage: 'Trading',
        totalDepositors: 892,
    },
    'static-7': {
        name: 'Bitcoin Moving Average Long/Short',
        leader: '0x1fa1...1d08',
        apr: 7.48,
        vaultUsdc: 2465609.17,
        tvl: 2465609.17,
        age: 79,
        description: 'Bitcoin moving average strategy vault.',
        depositFeeBps: 100,
        perfFeeBps: 1500,
        stage: 'Trading',
        totalDepositors: 167,
    },
}

function VaultDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const {
        walletBalance,
        userVaults,
        getDeposit,
        depositToVault,
        requestWithdrawal,
        getWithdrawalRequests,
        processEpoch,
        startTrading,
        executeTrade,
        closePosition,
        closeAllPositions,
        endTrading,
        finalizeClose,
        redeem,
        voteExtendedSettlement,
        resolveExtendedSettlement,
        STAGE,
        VAULT_TYPE,
    } = useDemo()

    const [showDepositModal, setShowDepositModal] = useState(false)
    const [showWithdrawModal, setShowWithdrawModal] = useState(false)
    const [showTradeModal, setShowTradeModal] = useState(false)
    const [depositAmount, setDepositAmount] = useState('')
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [tradeAmount, setTradeAmount] = useState('')
    const [tradeSide, setTradeSide] = useState('YES')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [timeRemaining, setTimeRemaining] = useState('')
    const [backendVault, setBackendVault] = useState(null)
    const [loading, setLoading] = useState(true)

    // Find vault from custom vaults or static vaults or backend
    const customVault = userVaults.find(v => v.id === id)
    // Priority: Custom (Demo) -> Backend -> Static
    // REMOVED 'static-0' default fallback to allow proper loading state
    const vault = customVault || backendVault || staticVaults[id]
    const yourShares = customVault?.investors?.['demo-user']?.shares || 0
    const withdrawalRequests = customVault ? getWithdrawalRequests(id) : []
    const isCustomVault = !!customVault
    // We treat backend vaults as "Real" or "Simulated Real" so we allow actions if chain logic exists
    const isRealVault = vault?.chain === 'Polygon' || vault?.chain === 'Solana'

    useEffect(() => {
        const loadVaultData = async () => {
            // If we already found it in custom or static, no need to fetch (unless we want fresh data)
            if (customVault || staticVaults[id]) {
                setLoading(false)
                return
            }

            try {
                // Dynamically import to avoid circular dep issues if any, or just use standard
                const { marketService } = await import('../lib/marketService')
                const v = await marketService.getVault(id)
                if (v) setBackendVault(v)
            } catch (e) {
                console.error("Failed to fetch vault details", e)
            } finally {
                setLoading(false)
            }
        }
        loadVaultData()
    }, [id, customVault])

    if (loading && !vault) return <div className="loading-state">Loading Vault Details...</div>
    if (!vault) return <div className="error-state">Vault not found</div>

    // Update time remaining
    useEffect(() => {
        if (!customVault) return

        const updateTimer = () => {
            const now = Date.now()
            let targetTs, label

            if (customVault.stage === 'Open' && customVault.tradingStartTs) {
                targetTs = customVault.tradingStartTs
                label = 'Trading starts in'
            } else if (customVault.stage === 'Trading' && customVault.tradingEndTs) {
                targetTs = customVault.tradingEndTs
                label = 'Trading ends in'
            } else {
                setTimeRemaining('')
                return
            }

            const diff = targetTs - now
            if (diff <= 0) {
                setTimeRemaining(`${label}: Now!`)
                return
            }

            const mins = Math.floor(diff / 60000)
            const secs = Math.floor((diff % 60000) / 1000)
            setTimeRemaining(`${label}: ${mins}m ${secs}s`)
        }

        updateTimer()
        const interval = setInterval(updateTimer, 1000)
        return () => clearInterval(interval)
    }, [customVault])

    const formatCurrency = (num) => {
        // Handle NaN, undefined, null
        if (num === undefined || num === null || isNaN(num)) return '$0.00'
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
        return `$${num.toFixed(2)}`
    }

    const formatAPR = (apr) => {
        const formatted = (apr || 0).toFixed(2)
        if (apr > 0) return <span className="positive">+{formatted}%</span>
        if (apr < 0) return <span className="negative">{formatted}%</span>
        return <span>{formatted}%</span>
    }

    const handleDeposit = () => {
        setError('')
        const amount = parseFloat(depositAmount)
        if (!amount || amount <= 0) {
            setError('Enter a valid amount')
            return
        }
        if (amount > walletBalance) {
            setError('Insufficient balance')
            return
        }

        const result = depositToVault(id, amount)
        if (result.success) {
            setSuccess(`Deposit successful! Fee: ${formatCurrency(result.fee || 0)}`)
            setDepositAmount('')
            setTimeout(() => {
                setShowDepositModal(false)
                setSuccess('')
            }, 2000)
        } else {
            setError(result.error)
        }
    }

    const handleWithdraw = () => {
        setError('')
        const shares = parseFloat(withdrawAmount)
        if (!shares || shares <= 0) {
            setError('Enter a valid amount')
            return
        }
        if (shares > yourShares) {
            setError('Amount exceeds your shares')
            return
        }

        let result
        if (vault.stage === 'Closed') {
            result = redeem(id, shares)
        } else {
            // For Open/Trading/Settlement, we use Request flow
            result = requestWithdrawal(id, shares)
        }

        if (result.success) {
            if (vault.stage === 'Closed') {
                let msg = `Redemption successful! Received: ${formatCurrency(result.amount)}`
                if (result.perfFeePaid) msg += ` (Performance fee deducted: ${formatCurrency(result.perfFeeAmount)})`
                setSuccess(msg)
            } else {
                setSuccess('Withdrawal request submitted! Will be processed at next epoch.')
            }
            setWithdrawAmount('')
            setTimeout(() => {
                setShowWithdrawModal(false)
                setSuccess('')
            }, 3000)
        } else {
            setError(result.error)
        }
    }

    const handleRequestWithdrawal = () => {
        setError('')
        const shares = parseFloat(withdrawAmount)
        if (!shares || shares <= 0) {
            setError('Enter a valid amount')
            return
        }

        const result = requestWithdrawal(id, shares)
        if (result.success) {
            setSuccess('Withdrawal request submitted! Will be processed at next epoch.')
            setWithdrawAmount('')
            setTimeout(() => {
                setShowWithdrawModal(false)
                setSuccess('')
            }, 2000)
        } else {
            setError(result.error)
        }
    }

    const handleTrade = async () => {
        setError('')
        const amount = parseFloat(tradeAmount)
        if (!amount || amount <= 0) {
            setError('Enter a valid amount')
            return
        }

        // Logic check for "Real" execution
        if (vault.chain === 'Polygon' || vault.id.includes('real')) {
            try {
                // Get active market from vault positions or use first available
                const activeMarket = vault.positions?.[0]?.tokenId || vault.activeMarketTokenId || null;
                if (!activeMarket) {
                    setError("No active market configured for this vault. Manager needs to set trading target.");
                    return;
                }
                const result = await import('../lib/marketService').then(m => m.marketService.placeOrder(activeMarket, tradeSide, 0.50, amount))
                // Note: placeOrder in marketService is currently just a shim to polymarketTrader

                setSuccess(`Real Trade executed on ${vault.chain}! (Order ID: ${result?.orderID || 'sim-123'})`)
            } catch (e) {
                console.error("Trade failed", e)
                setError("Trade failed: " + e.message)
                return
            }
        } else {
            // Fallback to Demo mock
            const result = executeTrade(id, 'market-1', 'Will BTC hit $100k?', tradeSide, amount)
            if (result.success) {
                const pnlText = result.pnl >= 0 ? `+${result.pnl.toFixed(2)}` : result.pnl.toFixed(2)
                setSuccess(`Trade executed! P&L: ${pnlText} USDC`)
            } else {
                setError(result.error)
                return
            }
        }

        setTradeAmount('')
        setTimeout(() => {
            setShowTradeModal(false)
            setSuccess('')
        }, 2000)
    }

    const handleStartTrading = () => {
        const result = startTrading(id)
        if (!result.success) setError(result.error)
    }

    const handleEndTrading = () => {
        const result = endTrading(id)
        if (!result.success) setError(result.error)
    }

    const handleFinalizeClose = () => {
        const result = finalizeClose(id)
        if (result.success) {
            setSuccess(`Vault closed! Profit: ${formatCurrency(result.profit)}, Perf Fee: ${formatCurrency(result.perfFee)}`)
        } else {
            setError(result.error)
        }
    }

    const handleProcessEpoch = () => {
        const result = processEpoch(id)
        if (result.success) {
            setSuccess(`Epoch processed! Paid out: ${formatCurrency(result.paid)}`)
        } else {
            setError(result.error)
        }
    }

    const getStageColor = (stage) => {
        switch (stage) {
            case 'Open': return 'open'
            case 'Trading': return 'trading'
            case 'Settlement': return 'settlement'
            case 'ExtendedSettlement': return 'extended-settlement'
            case 'Closed': return 'closed'
            default: return 'trading'
        }
    }

    return (
        <div className="vault-detail-page">
            <button className="back-btn" onClick={() => navigate('/vaults')}>
                ← Back to Vaults
            </button>

            {error && <div className="error-banner">{error}</div>}
            {success && <div className="success-banner">{success}</div>}

            <div className="vault-header">
                <div className="vault-info">
                    <h1 className="vault-title">{vault.name}</h1>
                    <p className="vault-description">{vault.description}</p>
                    <div className="vault-leader">
                        <span className="label">Manager:</span>
                        <span className="leader-address">{vault.leader}</span>
                    </div>
                    {timeRemaining && <div className="time-remaining">{timeRemaining}</div>}
                </div>
                <div className="vault-stage">
                    <span className={`vault-type-badge ${vault.vaultType}`}>
                        {vault.vaultType === 'restricted' ? '🔒 Restricted' : '🌐 Unrestricted'}
                    </span>
                    <span className={`stage-badge ${getStageColor(vault.stage)}`}>
                        {vault.stage === 'ExtendedSettlement' ? 'Extended Settlement' : vault.stage || 'Trading'}
                    </span>
                </div>
            </div>

            {/* Lifecycle Actions (for custom vaults) */}
            {isCustomVault && (
                <div className="lifecycle-actions glass">
                    <h2>Lifecycle Actions</h2>
                    <div className="lifecycle-buttons">
                        {vault.stage === 'Open' && (
                            <Button variant="primary" onClick={handleStartTrading}>
                                Start Trading
                            </Button>
                        )}
                        {vault.stage === 'Trading' && (
                            <>
                                <Button variant="primary" onClick={() => navigate(`/markets?vault=${id}`)}>
                                    Trade on DFlow Markets
                                </Button>
                                <Button variant="outline" onClick={() => setShowTradeModal(true)}>
                                    Quick Trade
                                </Button>
                                <Button variant="outline" onClick={handleEndTrading}>
                                    End Trading → Settlement
                                </Button>
                            </>
                        )}
                        {vault.stage === 'Settlement' && (
                            <>
                                <Button variant="primary" onClick={handleFinalizeClose}>
                                    Finalize & Close
                                </Button>
                                <Button variant="outline" onClick={handleProcessEpoch}>
                                    Process Withdrawal Queue
                                </Button>
                            </>
                        )}
                        {vault.stage === 'Closed' && withdrawalRequests.some(r => r.status !== 'Completed') && (
                            <Button variant="outline" onClick={handleProcessEpoch}>
                                Process Remaining Withdrawals
                            </Button>
                        )}
                    </div>
                    <p className="lifecycle-hint">
                        {vault.stage === 'Open' && "Deposits and withdrawals allowed. Click 'Start Trading' when ready."}
                        {vault.stage === 'Trading' && "Execute trades. Early exit available with penalty."}
                        {vault.stage === 'Settlement' && "Close all positions, then finalize to calculate performance fee."}
                        {vault.stage === 'ExtendedSettlement' && "Investor vote in progress. Vote below."}
                        {vault.stage === 'Closed' && "Investors can now redeem shares for USDC."}
                    </p>
                </div>
            )}

            {/* Extended Settlement Voting */}
            {vault.stage === 'ExtendedSettlement' && vault.extendedSettlement && (
                <div className="extended-settlement-voting glass">
                    <h2>⚠️ Extended Settlement - Investor Vote Required</h2>
                    <p className="voting-description">
                        This vault has {vault.positions?.length || 0} open position(s) that haven't resolved.
                        Vote on how to proceed:
                    </p>

                    <div className="vote-options">
                        <div className={`vote-card ${vault.extendedSettlement.voters?.['demo-user'] === 'wait' ? 'selected' : ''}`}>
                            <h3>⏳ Wait for Resolution</h3>
                            <p>Keep positions open until markets resolve naturally. May take longer but gets full resolution value.</p>
                            <div className="vote-count">
                                {vault.extendedSettlement.votesWait?.toFixed(0) || 0} shares voted
                            </div>
                            <Button
                                variant={vault.extendedSettlement.voters?.['demo-user'] === 'wait' ? 'primary' : 'outline'}
                                onClick={() => {
                                    const result = voteExtendedSettlement(id, 'wait')
                                    if (!result.success) setError(result.error)
                                    else setSuccess('Vote recorded: Wait for resolution')
                                }}
                            >
                                {vault.extendedSettlement.voters?.['demo-user'] === 'wait' ? '✓ Voted Wait' : 'Vote Wait'}
                            </Button>
                        </div>

                        <div className={`vote-card ${vault.extendedSettlement.voters?.['demo-user'] === 'forceExit' ? 'selected' : ''}`}>
                            <h3>💨 Force Market Exit</h3>
                            <p>Sell all positions at current market price. Faster but may incur slippage on illiquid markets.</p>
                            <div className="vote-count">
                                {vault.extendedSettlement.votesForceExit?.toFixed(0) || 0} shares voted
                            </div>
                            <Button
                                variant={vault.extendedSettlement.voters?.['demo-user'] === 'forceExit' ? 'primary' : 'outline'}
                                onClick={() => {
                                    const result = voteExtendedSettlement(id, 'forceExit')
                                    if (!result.success) setError(result.error)
                                    else setSuccess('Vote recorded: Force exit')
                                }}
                            >
                                {vault.extendedSettlement.voters?.['demo-user'] === 'forceExit' ? '✓ Voted Exit' : 'Vote Force Exit'}
                            </Button>
                        </div>
                    </div>

                    <div className="vote-footer">
                        {vault.extendedSettlement.voteDeadline && (
                            <div className="vote-deadline">
                                Vote deadline: {new Date(vault.extendedSettlement.voteDeadline).toLocaleString()}
                            </div>
                        )}
                        <Button
                            variant="primary"
                            onClick={() => {
                                const result = resolveExtendedSettlement(id)
                                if (result.success) {
                                    if (result.outcome === 'forceExit') {
                                        setSuccess(`Positions force-sold for ${formatCurrency(result.exitValue)}`)
                                    } else {
                                        setSuccess('Vote resolved: Waiting for market resolution')
                                    }
                                } else {
                                    setError(result.error)
                                }
                            }}
                        >
                            Resolve Vote & Proceed
                        </Button>
                    </div>

                    {vault.extendedSettlement.outcome === 'waiting' && (
                        <div className="waiting-notice">
                            <strong>📋 Waiting for Resolution</strong>
                            <p>Investors voted to wait. Vault will move to Settlement once all markets resolve.</p>
                        </div>
                    )}
                </div>
            )}

            <div className="vault-stats glass">
                <div className="stat-card">
                    <span className="stat-label">Total Value Locked</span>
                    <span className="stat-value">{formatCurrency(vault.vaultUsdc || vault.tvl)}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">APR</span>
                    <span className="stat-value">{formatAPR(vault.apr)}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Age</span>
                    <span className="stat-value">{vault.age || 0} days</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Depositors</span>
                    <span className="stat-value">{vault.totalDepositors}</span>
                </div>
            </div>

            <div className="vault-fees glass">
                <h2>Fee Structure</h2>
                <div className="fees-grid">
                    <div className="fee-item">
                        <span className="fee-label">Deposit Fee</span>
                        <span className="fee-value">{(vault.depositFeeBps || 0) / 100}%</span>
                    </div>
                    <div className="fee-item">
                        <span className="fee-label">Performance Fee</span>
                        <span className="fee-value">{(vault.perfFeeBps || 0) / 100}%</span>
                    </div>
                    {vault.earlyExitFeeBps && (
                        <div className="fee-item">
                            <span className="fee-label">Early Exit Fee</span>
                            <span className="fee-value">{vault.earlyExitFeeBps / 100}%</span>
                        </div>
                    )}
                    {vault.perfFeeDueUsdc > 0 && (
                        <div className="fee-item">
                            <span className="fee-label">Perf Fee Due</span>
                            <span className="fee-value">{formatCurrency(vault.perfFeeDueUsdc)} {vault.perfFeePaid ? '(Paid)' : '(Pending)'}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="vault-actions glass">
                <h2>Your Position</h2>
                <div className="position-info">
                    <div className="position-row">
                        <span>Your Shares:</span>
                        <span className="deposit-value">{yourShares.toFixed(2)}</span>
                    </div>
                    <div className="position-row">
                        <span>Share Value:</span>
                        <span>{vault.totalShares ? formatCurrency((vault.vaultUsdc || vault.tvl) / vault.totalShares) : '$1.00'}/share</span>
                    </div>
                    <div className="position-row">
                        <span>Wallet Balance:</span>
                        <span>{formatCurrency(walletBalance)}</span>
                    </div>
                </div>
                <div className="action-buttons">
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={() => setShowDepositModal(true)}
                        disabled={!isCustomVault || vault.stage !== 'Open'}
                    >
                        Deposit USDC
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setShowWithdrawModal(true)}
                        disabled={yourShares === 0 || (vault.stage === 'Settlement')}
                    >
                        {vault.stage === 'Open' ? 'Withdraw' :
                            vault.stage === 'Trading' ? 'Early Exit / Queue' :
                                'Redeem'}
                    </Button>
                </div>
            </div>

            {/* Open Positions */}
            {(vault.stage === 'Trading' || vault.stage === 'Settlement') && vault.positions?.length > 0 && (
                <div className="vault-positions glass">
                    <div className="positions-header">
                        <h2>Open Positions ({vault.positions.length})</h2>
                        {vault.stage === 'Settlement' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const result = closeAllPositions(id)
                                    if (result.success) {
                                        setSuccess(`Closed ${result.closed} positions. Total P&L: ${formatCurrency(result.totalPnl)}`)
                                    } else {
                                        setError(result.error)
                                    }
                                }}
                            >
                                Close All
                            </Button>
                        )}
                    </div>
                    <div className="positions-list">
                        {vault.positions.map((pos, idx) => {
                            // Defensive checks for corrupted position data
                            if (!pos || !pos.id) return null

                            const shares = pos.shares || 0
                            const avgPrice = pos.avgPrice || 0
                            const currentPrice = pos.currentPrice || avgPrice
                            const costBasis = pos.costBasis || 0
                            const side = pos.side || 'YES'

                            const pnl = pos.unrealizedPnl || ((currentPrice - avgPrice) * shares)
                            const pnlClass = pnl >= 0 ? 'positive' : 'negative'

                            return (
                                <div key={pos.id || idx} className="position-item">
                                    <div className="position-main">
                                        <span className={`position-side ${side.toLowerCase()}`}>
                                            {side}
                                        </span>
                                        <span className="position-market">{pos.marketName || 'Unknown'}</span>
                                    </div>
                                    <div className="position-details">
                                        <span className="position-shares">{shares.toFixed(2)} shares</span>
                                        <span className="position-cost">Cost: {formatCurrency(costBasis)}</span>
                                        <span className="position-price">@{(avgPrice * 100).toFixed(0)}¢</span>
                                        <span className={`position-pnl ${pnlClass}`}>
                                            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                        </span>
                                    </div>
                                    {vault.stage === 'Settlement' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const result = closePosition(id, pos.id)
                                                if (result.success) {
                                                    setSuccess(`Position closed. P&L: ${formatCurrency(result.pnl)}`)
                                                } else {
                                                    setError(result.error)
                                                }
                                            }}
                                        >
                                            Close
                                        </Button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    {vault.stage === 'Settlement' && (
                        <p className="positions-hint">
                            Close all positions before finalizing the vault to calculate performance fee.
                        </p>
                    )}
                </div>
            )}

            {/* Withdrawal Requests */}
            {withdrawalRequests.length > 0 && (
                <div className="withdrawal-requests glass">
                    <h2>Your Withdrawal Requests</h2>
                    <div className="requests-list">
                        {withdrawalRequests.map(req => (
                            <div key={req.id} className={`request-item ${req.status.toLowerCase()}`}>
                                <div className="request-info">
                                    <span>Shares: {req.sharesRequested.toFixed(2)}</span>
                                    <span>Filled: {req.sharesFilled.toFixed(2)}</span>
                                    <span>Received: {formatCurrency(req.usdcReceived)}</span>
                                </div>
                                <span className={`request-status ${req.status.toLowerCase()}`}>{req.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Trades */}
            {vault.trades && vault.trades.length > 0 && (
                <div className="vault-trades glass">
                    <h2>Recent Trades</h2>
                    <div className="trades-list">
                        {vault.trades.slice(-5).reverse().map((trade, idx) => {
                            if (!trade) return null
                            const side = trade.side || 'BUY'
                            const price = trade.price || 0
                            const amount = trade.amount || 0
                            return (
                                <div key={trade.id || idx} className="trade-item">
                                    <span className={`trade-side ${side.toLowerCase()}`}>{side}</span>
                                    <span className="trade-market">{trade.marketName || 'Market'}</span>
                                    <span className="trade-amount">{formatCurrency(amount)}</span>
                                    <span className="trade-price">@{(price * 100).toFixed(0)}¢</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Deposit Modal */}
            {showDepositModal && (
                <div className="modal-overlay" onClick={() => setShowDepositModal(false)}>
                    <div className="modal-container" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowDepositModal(false)}>×</button>
                        <h2>Deposit USDC</h2>
                        {success ? (
                            <div className="success-message">{success}</div>
                        ) : (
                            <>
                                {error && <div className="error-message">{error}</div>}
                                <p className="modal-hint">Deposit fee: {(vault.depositFeeBps || 0) / 100}% will be charged</p>
                                <div className="form-group">
                                    <label>Amount (USDC)</label>
                                    <input
                                        type="number"
                                        value={depositAmount}
                                        onChange={e => setDepositAmount(e.target.value)}
                                        placeholder="Enter amount"
                                        className="form-input"
                                    />
                                    <div className="form-balance">
                                        <span>Available:</span>
                                        <span className="balance-value">{walletBalance.toFixed(2)} USDC</span>
                                    </div>
                                </div>
                                <Button variant="primary" fullWidth onClick={handleDeposit}>
                                    Confirm Deposit
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Withdraw Modal */}
            {showWithdrawModal && (
                <div className="modal-overlay" onClick={() => setShowWithdrawModal(false)}>
                    <div className="modal-container" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowWithdrawModal(false)}>×</button>
                        <h2>{vault.stage === 'Closed' ? 'Redeem Shares' : 'Withdraw'}</h2>
                        {success ? (
                            <div className="success-message">{success}</div>
                        ) : (
                            <>
                                {error && <div className="error-message">{error}</div>}


                                <div className="form-group">
                                    <label>Shares to {vault.stage === 'Closed' ? 'Redeem' : 'Withdraw'}</label>
                                    <input
                                        type="number"
                                        value={withdrawAmount}
                                        onChange={e => setWithdrawAmount(e.target.value)}
                                        placeholder="Enter shares"
                                        className="form-input"
                                    />
                                    <div className="form-balance">
                                        <span>Your shares:</span>
                                        <span className="balance-value">{yourShares.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="withdraw-buttons">
                                    {vault.stage !== 'Closed' ? (
                                        <Button variant="primary" fullWidth onClick={handleWithdraw}>
                                            Submit Withdrawal Request
                                        </Button>
                                    ) : (
                                        <Button variant="primary" fullWidth onClick={handleWithdraw}>
                                            Confirm {vault.stage === 'Closed' ? 'Redemption' : 'Withdrawal'}
                                        </Button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Trade Modal */}
            {showTradeModal && (
                <div className="modal-overlay" onClick={() => setShowTradeModal(false)}>
                    <div className="modal-container" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowTradeModal(false)}>×</button>
                        <h2>Execute Trade</h2>
                        {success ? (
                            <div className="success-message">{success}</div>
                        ) : (
                            <>
                                {error && <div className="error-message">{error}</div>}
                                <p className="modal-hint">Mock trade on "Will BTC hit $100k?"</p>
                                <div className="form-group">
                                    <label>Side</label>
                                    <div className="trade-sides">
                                        <button
                                            className={`side-btn yes ${tradeSide === 'YES' ? 'active' : ''}`}
                                            onClick={() => setTradeSide('YES')}
                                        >
                                            YES
                                        </button>
                                        <button
                                            className={`side-btn no ${tradeSide === 'NO' ? 'active' : ''}`}
                                            onClick={() => setTradeSide('NO')}
                                        >
                                            NO
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Amount (USDC)</label>
                                    <input
                                        type="number"
                                        value={tradeAmount}
                                        onChange={e => setTradeAmount(e.target.value)}
                                        placeholder="Enter amount"
                                        className="form-input"
                                    />
                                    <div className="form-balance">
                                        <span>Vault USDC:</span>
                                        <span className="balance-value">{formatCurrency(vault.vaultUsdc)}</span>
                                    </div>
                                </div>
                                <Button variant="primary" fullWidth onClick={handleTrade}>
                                    Execute Trade
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default VaultDetail
