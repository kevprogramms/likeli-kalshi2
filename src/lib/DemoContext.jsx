import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
    calculateDeposit,
    calculateWithdrawalRequest,
    calculateCancelRequest,
    calculateRedemption,
    calculateEpochProcessing,
    validateAmount,
    generateId
} from './vaultMath'
import { executeBuy, executeSell, getYesPrice, getNoPrice, getMarketInfo } from './amm'

const DemoContext = createContext()

// Protocol Config (matches Anchor program)
const PROTOCOL_CONFIG = {
    maxDepositFeeBps: 300,      // 3%
    maxPerfFeeBps: 3000,        // 30%
    maxEarlyExitFeeBps: 500,    // 5%
    minBufferBps: 1000,         // 10% liquidity buffer
    epochIntervalMs: 60000,     // 1 minute for demo (would be 24h in prod)
}

// Initial demo wallet balance
const INITIAL_BALANCE = 50000

// Vault stages matching Anchor program
const STAGE = {
    OPEN: 'Open',
    TRADING: 'Trading',
    SETTLEMENT: 'Settlement',
    EXTENDED_SETTLEMENT: 'ExtendedSettlement',  // For unrestricted vaults with open positions
    CLOSED: 'Closed',
}

// Vault types
const VAULT_TYPE = {
    RESTRICTED: 'restricted',     // Enforced resolution date limit
    UNRESTRICTED: 'unrestricted', // No limit, but has voting mechanism
}

// Load from localStorage or use defaults
const loadFromStorage = (key, defaultValue) => {
    try {
        const stored = localStorage.getItem(key)
        return stored ? JSON.parse(stored) : defaultValue
    } catch {
        return defaultValue
    }
}

// Precision constants (imported from math lib if needed, or just used for UI)
const PRECISION = 1000000
const toUSDC = (amount) => Math.floor(amount * PRECISION) / PRECISION
const toShares = (amount) => Math.floor(amount * PRECISION) / PRECISION

export function DemoProvider({ children }) {
    const [walletBalance, setWalletBalance] = useState(() =>
        loadFromStorage('demo_balance', INITIAL_BALANCE)
    )

    const [vaults, setVaults] = useState(() =>
        loadFromStorage('demo_vaults', [])
    )

    const [withdrawalRequests, setWithdrawalRequests] = useState(() =>
        loadFromStorage('demo_withdrawal_requests', [])
    )

    // Persist to localStorage
    useEffect(() => {
        localStorage.setItem('demo_balance', JSON.stringify(walletBalance))
    }, [walletBalance])

    useEffect(() => {
        localStorage.setItem('demo_vaults', JSON.stringify(vaults))
    }, [vaults])

    useEffect(() => {
        localStorage.setItem('demo_withdrawal_requests', JSON.stringify(withdrawalRequests))
    }, [withdrawalRequests])

    // =====================
    // VAULT CREATION
    // =====================
    const createVault = (name, description, initialDeposit, options = {}) => {
        const {
            depositFeeBps = 100,
            perfFeeBps = 1000,
            tradingDurationMs = 300000,
            vaultType = VAULT_TYPE.RESTRICTED,
            maxResolutionDays = 5,  // Days after trading ends for restricted vaults
        } = options

        const validation = validateAmount(initialDeposit)
        if (!validation.valid) return { success: false, error: validation.error }
        const depositAmount = parseFloat(validation.value)

        if (depositAmount > walletBalance) {
            return { success: false, error: 'Insufficient balance' }
        }
        if (depositFeeBps > PROTOCOL_CONFIG.maxDepositFeeBps) {
            return { success: false, error: `Deposit fee exceeds max ${PROTOCOL_CONFIG.maxDepositFeeBps / 100}%` }
        }
        if (perfFeeBps > PROTOCOL_CONFIG.maxPerfFeeBps) {
            return { success: false, error: `Performance fee exceeds max ${PROTOCOL_CONFIG.maxPerfFeeBps / 100}%` }
        }

        const now = Date.now()
        const tradingEndTs = now + 60000 + tradingDurationMs

        const newVault = {
            id: generateId('vault'),
            name,
            description,
            leader: '0x' + Math.random().toString(16).slice(2, 6) + '...' + Math.random().toString(16).slice(2, 6),
            manager: 'demo-manager', // Manager wallet address

            // Vault type
            vaultType,

            // Fee config (immutable after creation)
            depositFeeBps,
            perfFeeBps,
            earlyExitFeeBps: 500, // 5%
            liquidityBufferBps: 1000, // 10%

            // Lifecycle timestamps
            createdAt: now,
            tradingStartTs: now + 60000, // 1 min from now for demo
            tradingEndTs,

            // Resolution limit (for restricted vaults)
            maxResolutionTs: vaultType === VAULT_TYPE.RESTRICTED
                ? tradingEndTs + (maxResolutionDays * 24 * 60 * 60 * 1000)
                : null,
            maxResolutionDays: vaultType === VAULT_TYPE.RESTRICTED ? maxResolutionDays : null,

            // Extended Settlement voting (for unrestricted vaults)
            extendedSettlement: vaultType === VAULT_TYPE.UNRESTRICTED ? {
                active: false,
                voteDeadline: null,
                votesWait: 0,
                votesForceExit: 0,
                voters: {},
                outcome: null,  // 'pending' | 'waiting' | 'forceExit'
            } : null,

            // Current stage
            stage: STAGE.OPEN,

            // Financial tracking
            vaultUsdc: depositAmount,
            totalShares: depositAmount, // 1 share = 1 USDC at start
            initialAumUsdc: 0, // Set when trading starts
            highWaterMark: depositAmount, // For performance fee calculation
            perfFeeDueUsdc: 0,
            perfFeePaid: false,

            // Manager fee tracking (production-ready)
            managerFeesCollected: {
                depositFees: 0,
                earlyExitFees: 0,
                performanceFees: 0,
                totalCollected: 0,
                withdrawn: 0,
            },

            // Positions (mock trading)
            positions: [],
            trades: [],

            // Withdrawal queue
            pendingWithdrawalShares: 0,
            escrowedShares: {}, // Share escrow for pending withdrawals
            lastEpochTs: now,

            // Stats
            totalDepositors: 1,
            apr: 0,
            age: 0,
            yourDeposit: depositAmount,
            tvl: depositAmount,
            data: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
        }

        // Investor's share in this vault
        const investorShare = {
            vaultId: newVault.id,
            shares: depositAmount,
            depositedUsdc: depositAmount,
            acknowledgedRisks: vaultType === VAULT_TYPE.UNRESTRICTED,
        }

        setVaults(prev => [...prev, { ...newVault, investors: { 'demo-user': investorShare } }])
        setWalletBalance(prev => prev - depositAmount)

        return { success: true, vault: newVault }
    }

    // =====================
    // DEPOSIT (Open stage only)
    // =====================
    const depositToVault = (vaultId, amount) => {
        let depositFeeCharged = 0
        let depositSuccess = false

        setVaults(prev => prev.map(vault => {
            if (vault.id !== vaultId) return vault
            if (vault.stage !== STAGE.OPEN) return vault

            // Use Pure Logic - Spec: Pass hasOpenPositions explicitly check
            const shouldBlock = (vault.positions && vault.positions.length > 0)
            const result = calculateDeposit({ ...vault, hasOpenPositions: shouldBlock }, amount)

            if (!result.success) {
                console.error(result.error)
                return vault
            }

            depositFeeCharged = parseFloat(result.depositFee)
            depositSuccess = true

            // Glue: Update Investors & Manager Fees
            const updatedInvestors = { ...vault.investors }
            const userInvestment = updatedInvestors['demo-user'] || { vaultId, shares: 0, depositedUsdc: 0 }

            const depositVal = parseFloat(amount)
            const sharesToMint = parseFloat(result.sharesToMint)

            updatedInvestors['demo-user'] = {
                ...userInvestment,
                shares: toShares(userInvestment.shares + sharesToMint),
                depositedUsdc: toUSDC(userInvestment.depositedUsdc + depositVal),
            }

            const depositFee = parseFloat(result.depositFee)
            const updatedManagerFees = {
                ...vault.managerFeesCollected,
                depositFees: toUSDC((vault.managerFeesCollected?.depositFees || 0) + depositFee),
                totalCollected: toUSDC((vault.managerFeesCollected?.totalCollected || 0) + depositFee),
            }

            return {
                ...vault,
                vaultUsdc: parseFloat(result.newVaultUsdc),
                tvl: parseFloat(result.newVaultUsdc),
                totalShares: parseFloat(result.newTotalShares),
                highWaterMark: parseFloat(result.newHighWaterMark),
                totalDepositors: vault.totalDepositors + 1,
                yourDeposit: toUSDC((vault.yourDeposit || 0) + parseFloat(result.netAmount)),
                investors: updatedInvestors,
                managerFeesCollected: updatedManagerFees,
            }
        }))

        if (depositSuccess) {
            setWalletBalance(prev => prev - parseFloat(amount))
            return { success: true, fee: depositFeeCharged }
        }
        return { success: false, error: 'Deposit failed' }
    }

    // =====================
    // REQUEST WITHDRAWAL (Strict - Escrow Immediate)
    // =====================
    const requestWithdrawal = (vaultId, shares) => {
        const validation = validateAmount(shares)
        if (!validation.valid) return { success: false, error: validation.error }
        const sharesToWithdraw = parseFloat(validation.value)

        const vault = vaults.find(v => v.id === vaultId)
        if (!vault) return { success: false, error: 'Vault not found' }

        // Spec: Requests only allowed in Trading stage (use calculateWithdrawalRequest validation)
        if (vault.stage !== STAGE.TRADING) {
            return { success: false, error: 'Withdrawal requests only allowed in Trading stage' }
        }

        const userInvestment = vault.investors['demo-user'] || { shares: 0 }

        // Validate user has enough shares
        if (userInvestment.shares < sharesToWithdraw) {
            return { success: false, error: 'Insufficient shares' }
        }

        const request = {
            id: generateId('wr'),
            vaultId,
            investor: 'demo-user',
            sharesRequested: sharesToWithdraw,
            sharesFilled: 0,
            usdcReceived: 0,
            requestedAt: Date.now(),
            status: 'Pending',
        }

        setWithdrawalRequests(prev => [...prev, request])

        setVaults(prev => prev.map(v => {
            if (v.id !== vaultId) return v

            const updatedInvestors = { ...v.investors }
            const currentUser = updatedInvestors['demo-user']

            // DEDUCT SHARES (Escrow)
            updatedInvestors['demo-user'] = {
                ...currentUser,
                shares: toShares(currentUser.shares - sharesToWithdraw)
            }

            return {
                ...v,
                pendingWithdrawalShares: toShares((v.pendingWithdrawalShares || 0) + sharesToWithdraw),
                escrowedShares: {
                    ...v.escrowedShares,
                    'demo-user': toShares((v.escrowedShares?.['demo-user'] || 0) + sharesToWithdraw),
                },
                investors: updatedInvestors
            }
        }))

        return { success: true, request }
    }

    // =====================
    // REDEEM (Closed stage)
    // =====================
    const redeem = (vaultId, shares) => {
        let result = { success: false, error: 'Unknown error' }

        setVaults(prev => prev.map(vault => {
            if (vault.id !== vaultId) return vault
            if (vault.stage !== STAGE.CLOSED) {
                result = { success: false, error: 'Redemption only in Closed stage' }
                return vault
            }

            const userInvestment = vault.investors['demo-user']
            if (!userInvestment) return vault

            const calc = calculateRedemption(vault, shares)
            if (!calc.success) {
                result = calc
                return vault
            }

            result = {
                success: true,
                amount: parseFloat(calc.payout), // Updated property name
                perfFeePaid: parseFloat(calc.feeDeducted) > 0,
                perfFeeAmount: parseFloat(calc.feeDeducted)
            }

            const updatedInvestors = { ...vault.investors }
            updatedInvestors['demo-user'] = {
                ...userInvestment,
                shares: toShares(userInvestment.shares - parseFloat(shares)),
            }

            let updatedManagerFees = vault.managerFeesCollected || { depositFees: 0, earlyExitFees: 0, performanceFees: 0, totalCollected: 0, withdrawn: 0 }
            if (calc.feeDeducted > 0) {
                updatedManagerFees = {
                    ...updatedManagerFees,
                    performanceFees: toUSDC((updatedManagerFees.performanceFees || 0) + calc.feeDeducted),
                    totalCollected: toUSDC((updatedManagerFees.totalCollected || 0) + calc.feeDeducted),
                }
            }

            return {
                ...vault,
                vaultUsdc: parseFloat(calc.newVaultUsdc),
                tvl: parseFloat(calc.newVaultUsdc),
                totalShares: parseFloat(calc.newTotalShares),
                perfFeePaid: parseFloat(calc.feeDeducted) > 0 ? true : vault.perfFeePaid,
                yourDeposit: toUSDC(Math.max(0, (vault.yourDeposit || 0) - calc.usdcToReturn)),
                investors: updatedInvestors,
                managerFeesCollected: updatedManagerFees,
            }
        }))

        if (result.success) {
            setWalletBalance(prev => toUSDC(prev + result.amount))
        }
        return result
    }

    // =====================
    // EPOCH PROCESSING
    // =====================
    const processEpoch = (vaultId) => {
        const vault = vaults.find(v => v.id === vaultId)
        if (!vault) return { success: false, error: 'Vault not found' }

        const pendingRequests = withdrawalRequests.filter(r =>
            r.vaultId === vaultId && (r.status === 'Pending' || r.status === 'PartiallyFilled')
        )

        if (pendingRequests.length === 0) return { success: false, error: 'No pending withdrawals' }

        // Calculate Equity (NAV)
        let vaultEquityUsdc = vault.vaultUsdc // Cash
        // Add position value (Mark to Market)
        if (vault.positions && vault.positions.length > 0) {
            vault.positions.forEach(p => {
                vaultEquityUsdc += (p.shares * (p.currentPrice || p.avgPrice))
            })
        }

        const calc = calculateEpochProcessing(vault, pendingRequests, vaultEquityUsdc)
        if (!calc.success) return calc

        // Update Requests State
        setWithdrawalRequests(prev => prev.map(r => {
            const update = calc.processedRequests.find(pr => pr.id === r.id)
            if (update) {
                return {
                    ...r,
                    sharesFilled: toShares(r.sharesFilled + parseFloat(update.sharesFilledToAdd || 0)), // update.sharesFilled is string
                    // usdcReceived: ... actually we don't track it here per spec, but we can for UI
                    status: update.status, // Fixed from newStatus to status based on vaultMath
                    payoutThisEpoch: parseFloat(update.payoutThisEpoch),
                    exitFeeThisEpoch: parseFloat(update.exitFeeThisEpoch)
                }
            }
            return r
        }))

        // Update Vault State
        // Spec: "totalShares decreases by sharesFilled (shares are burned/removed from escrow)"
        // Fee stays in vault (part of vaultUsdc math in lib)

        let userSharesBurned = 0
        calc.processedRequests.forEach(pr => {
            const originalReq = pendingRequests.find(r => r.id === pr.id)
            if (originalReq && originalReq.investor === 'demo-user') {
                userSharesBurned += parseFloat(pr.sharesFilled || 0) // sharesFilled is total filled? No, sharesFilledToAdd missing in result?
                // Wait. calculateEpochProcessing processedRequests returns sharesFilled (TOTAL).
                // We need DELTA.
                // processedRequests has: sharesFilled (total), payoutThisEpoch, etc.
                // We can usage pr.payoutThisEpoch to confirm active? 
                // But specifically for escrow deduction, we need shares filled THIS turn.
                // "sharesFilled" in result is NEW TOTAL.
                // We need (pr.sharesFilled - originalReq.sharesFilled).
                const filledNow = parseFloat(pr.sharesFilled) - originalReq.sharesFilled
                if (filledNow > 0) userSharesBurned += filledNow
            }
        })

        setVaults(prev => prev.map(v => {
            if (v.id !== vaultId) return v

            const currentEscrow = v.escrowedShares?.['demo-user'] || 0
            // Remove BURNED shares from escrow (not user shares, they were already removed on request)
            const newEscrow = toShares(Math.max(0, currentEscrow - userSharesBurned))

            // Note: yourDeposit tracks pure USD value estimate, or shares?
            // Usually 'yourDeposit' is just a UI helper. We should update derived stats if needed.

            return {
                ...v,
                vaultUsdc: parseFloat(calc.newVaultUsdc),
                tvl: parseFloat(calc.newVaultUsdc) + (v.tvl - v.vaultUsdc), // Add position value back
                totalShares: parseFloat(calc.newTotalShares),

                // pendingWithdrawalShares actually DECREASES by the amount FILLED/BURNED
                pendingWithdrawalShares: toShares(v.pendingWithdrawalShares - parseFloat(calc.totalSharesBurned)),

                escrowedShares: {
                    ...v.escrowedShares,
                    'demo-user': newEscrow
                },
                lastEpochTs: Date.now(),
            }
        }))

        setWalletBalance(prev => toUSDC(prev + parseFloat(calc.totalNetPaid)))

        return { success: true, processed: parseFloat(calc.totalSharesBurned), paid: parseFloat(calc.totalNetPaid) }
    }

    // =====================
    // REST OF FILE (Pasthrough logic for trading/voting - less math heavy)
    // =====================

    // CANCEL WITHDRAWAL REQUEST
    const cancelWithdrawal = (requestId) => {
        const request = withdrawalRequests.find(r => r.id === requestId)
        if (!request) return { success: false, error: 'Request not found' }
        if (request.sharesFilled > 0) return { success: false, error: 'Cannot cancel partially filled request' }

        setWithdrawalRequests(prev => prev.filter(r => r.id !== requestId))

        setVaults(prev => prev.map(v => {
            if (v.id !== request.vaultId) return v

            const currentEscrow = v.escrowedShares?.['demo-user'] || 0
            const newEscrow = toShares(currentEscrow - request.sharesRequested)

            return {
                ...v,
                pendingWithdrawalShares: toShares(v.pendingWithdrawalShares - request.sharesRequested),
                escrowedShares: {
                    ...v.escrowedShares,
                    'demo-user': Math.max(0, newEscrow)
                }
            }
        }))

        return { success: true }
    }

    const startTrading = (vaultId) => {
        let result = { success: false, error: 'Unknown error' }

        setVaults(prev => prev.map(vault => {
            if (vault.id !== vaultId) return vault
            if (vault.stage !== STAGE.OPEN) {
                result = { success: false, error: 'Vault not in Open stage' }
                return vault
            }
            result = { success: true }
            return {
                ...vault,
                stage: STAGE.TRADING,
                initialAumUsdc: vault.vaultUsdc,
            }
        }))
        return result
    }

    const executeTrade = (vaultId, marketId, marketName, side, amount, marketResolutionDate = null) => {
        const validation = validateAmount(amount)
        if (!validation.valid) return { success: false, error: validation.error }
        const tradeAmount = parseFloat(validation.value) // Convert string to number

        if (!tradeAmount || isNaN(tradeAmount) || tradeAmount <= 0) {
            return { success: false, error: 'Invalid trade amount' }
        }

        let result = { success: false, error: 'Unknown error' }

        setVaults(prev => prev.map(vault => {
            if (vault.id !== vaultId) return vault
            if (vault.stage !== STAGE.TRADING) {
                result = { success: false, error: 'Trading only allowed during Trading stage' }
                return vault
            }
            if (tradeAmount > vault.vaultUsdc) {
                result = { success: false, error: `Insufficient vault balance: need $${tradeAmount}, have $${vault.vaultUsdc.toFixed(2)}` }
                return vault
            }

            if (vault.vaultType === VAULT_TYPE.RESTRICTED && vault.maxResolutionTs && marketResolutionDate) {
                const resolutionTs = new Date(marketResolutionDate).getTime()
                if (resolutionTs > vault.maxResolutionTs) {
                    result = {
                        success: false,
                        error: `Market resolves too late.`
                    }
                    return vault
                }
            }

            // Use AMM for realistic pricing
            const ammResult = executeBuy(marketId, side, tradeAmount)
            if (!ammResult.success) {
                result = { success: false, error: 'AMM trade failed' }
                return vault
            }

            const price = ammResult.avgPrice
            const sharesAcquired = ammResult.shares

            const trade = {
                id: generateId('trade'),
                marketId,
                marketName,
                side,
                direction: 'BUY',
                amount: tradeAmount,
                shares: sharesAcquired,
                price,
                priceImpact: ammResult.priceImpact,
                newMarketPrice: ammResult.newYesPrice,
                timestamp: Date.now(),
                marketResolutionDate,
            }

            const positions = [...(vault.positions || [])]
            const existingIdx = positions.findIndex(p =>
                p.marketId === marketId && p.side === side
            )

            // Get current market price from AMM for position valuation
            const currentYesPrice = ammResult.newYesPrice
            const currentNoPrice = ammResult.newNoPrice
            const currentPrice = side === 'YES' ? currentYesPrice : currentNoPrice

            if (existingIdx >= 0) {
                const existing = positions[existingIdx]
                const newShares = existing.shares + sharesAcquired
                const newCostBasis = existing.costBasis + tradeAmount
                positions[existingIdx] = {
                    ...existing,
                    shares: newShares,
                    costBasis: newCostBasis,
                    avgPrice: newCostBasis / newShares,
                    currentPrice,
                }
            } else {
                positions.push({
                    id: generateId('pos'),
                    marketId,
                    marketName,
                    side,
                    shares: sharesAcquired,
                    costBasis: tradeAmount,
                    avgPrice: price,
                    currentPrice,
                    entryPrice: price,
                    unrealizedPnl: 0,
                    openedAt: Date.now(),
                })
            }

            // Update all position valuations using AMM prices
            let totalUnrealizedPnl = 0
            positions.forEach(pos => {
                // Get current price from AMM
                const posYesPrice = getYesPrice(pos.marketId) || pos.currentPrice
                const posNoPrice = getNoPrice(pos.marketId) || (1 - pos.currentPrice)
                pos.currentPrice = pos.side === 'YES' ? posYesPrice : posNoPrice
                pos.unrealizedPnl = (pos.currentPrice - pos.avgPrice) * pos.shares
                totalUnrealizedPnl += pos.unrealizedPnl
            })

            const pnl = totalUnrealizedPnl

            result = {
                success: true,
                trade,
                pnl,
                sharesAcquired,
                price,
                priceImpact: ammResult.priceImpact,
                newMarketPrice: side === 'YES' ? ammResult.newYesPrice : ammResult.newNoPrice,
            }

            const newCash = toUSDC(vault.vaultUsdc - tradeAmount)
            let positionValue = 0
            positions.forEach(p => positionValue += p.shares * p.currentPrice)

            const newTvl = toUSDC(newCash + positionValue)

            return {
                ...vault,
                vaultUsdc: newCash,
                tvl: newTvl,
                highWaterMark: Math.max(vault.highWaterMark || 0, newTvl),
                positions,
                trades: [...(vault.trades || []), trade],
                data: [...vault.data.slice(1), newTvl / 100],
            }
        }))

        return result
    }

    const closePosition = (vaultId, positionId) => {
        let result = { success: false, error: 'Unknown error' }

        setVaults(prev => prev.map(vault => {
            if (vault.id !== vaultId) return vault
            if (vault.stage !== STAGE.SETTLEMENT && vault.stage !== STAGE.TRADING) {
                result = { success: false, error: 'Can only close positions during Trading or Settlement' }
                return vault
            }

            const positions = [...(vault.positions || [])]
            const posIdx = positions.findIndex(p => p.id === positionId)

            if (posIdx < 0) {
                result = { success: false, error: 'Position not found' }
                return vault
            }

            const position = positions[posIdx]

            const exitPrice = position.currentPrice || position.avgPrice
            const exitValue = position.shares * exitPrice
            const realizedPnl = exitValue - position.costBasis

            positions.splice(posIdx, 1)

            const exitTrade = {
                id: generateId('trade'),
                marketId: position.marketId,
                marketName: position.marketName,
                side: position.side,
                direction: 'SELL',
                amount: exitValue,
                shares: position.shares,
                price: exitPrice,
                realizedPnl,
                timestamp: Date.now(),
            }

            result = { success: true, pnl: realizedPnl, exitValue }

            return {
                ...vault,
                vaultUsdc: toUSDC(vault.vaultUsdc + exitValue),
                tvl: toUSDC(vault.vaultUsdc + exitValue),
                positions,
                trades: [...(vault.trades || []), exitTrade],
            }
        }))

        return result
    }

    const closeAllPositions = (vaultId) => {
        const vault = vaults.find(v => v.id === vaultId)
        if (!vault) return { success: false, error: 'Vault not found' }
        if (!vault.positions || vault.positions.length === 0) {
            return { success: true, closed: 0, totalPnl: 0 }
        }

        let totalPnl = 0
        let closed = 0

        vault.positions.forEach(pos => {
            const res = closePosition(vaultId, pos.id)
            if (res.success) {
                totalPnl += res.pnl
                closed++
            }
        })

        return { success: true, closed, totalPnl }
    }

    const endTrading = (vaultId) => {
        let result = { success: false, error: 'Unknown error' }

        setVaults(prev => prev.map(vault => {
            if (vault.id !== vaultId) return vault
            if (vault.stage !== STAGE.TRADING) {
                result = { success: false, error: 'Vault not in Trading stage' }
                return vault
            }

            if (vault.vaultType === VAULT_TYPE.UNRESTRICTED &&
                vault.positions &&
                vault.positions.length > 0) {
                result = { success: true, extended: true }
                return {
                    ...vault,
                    stage: STAGE.EXTENDED_SETTLEMENT,
                    extendedSettlement: {
                        ...vault.extendedSettlement,
                        active: true,
                        voteDeadline: Date.now() + (2 * 60 * 1000),
                        votesWait: 0,
                        votesForceExit: 0,
                        voters: {},
                        outcome: 'pending',
                    }
                }
            }

            result = { success: true }
            return {
                ...vault,
                stage: STAGE.SETTLEMENT,
            }
        }))

        return result
    }

    const voteExtendedSettlement = (vaultId, vote) => {
        if (vote !== 'wait' && vote !== 'forceExit') return { success: false, error: 'Invalid vote option' }
        let result = { success: false, error: 'Unknown error' }

        setVaults(prev => prev.map(vault => {
            if (vault.id !== vaultId) return vault
            if (vault.stage !== STAGE.EXTENDED_SETTLEMENT) {
                result = { success: false, error: 'Voting only available during Extended Settlement' }
                return vault
            }

            const userShares = vault.investors['demo-user']?.shares || 0
            if (userShares <= 0) {
                result = { success: false, error: 'No shares to vote with' }
                return vault
            }

            const previousVote = vault.extendedSettlement.voters['demo-user']
            let votesWait = vault.extendedSettlement.votesWait
            let votesForceExit = vault.extendedSettlement.votesForceExit

            if (previousVote === 'wait') votesWait -= userShares
            if (previousVote === 'forceExit') votesForceExit -= userShares

            if (vote === 'wait') votesWait += userShares
            if (vote === 'forceExit') votesForceExit += userShares

            result = { success: true }

            return {
                ...vault,
                extendedSettlement: {
                    ...vault.extendedSettlement,
                    votesWait,
                    votesForceExit,
                    voters: { ...vault.extendedSettlement.voters, 'demo-user': vote }
                }
            }
        }))

        return result
    }

    const resolveExtendedSettlement = (vaultId) => {
        let result = { success: false, error: 'Unknown error' }

        setVaults(prev => prev.map(vault => {
            if (vault.id !== vaultId) return vault
            if (vault.stage !== STAGE.EXTENDED_SETTLEMENT) {
                result = { success: false, error: 'Not in Extended Settlement' }
                return vault
            }

            const { votesWait, votesForceExit } = vault.extendedSettlement
            const totalVotes = votesWait + votesForceExit

            let outcome = 'waiting'
            if (totalVotes > 0) {
                outcome = votesForceExit > votesWait ? 'forceExit' : 'waiting'
            }

            if (outcome === 'forceExit') {
                let totalExitValue = 0
                vault.positions.forEach(pos => {
                    const exitPrice = pos.currentPrice || pos.avgPrice
                    totalExitValue += pos.shares * exitPrice
                })

                result = { success: true, outcome: 'forceExit', exitValue: totalExitValue }

                return {
                    ...vault,
                    stage: STAGE.SETTLEMENT,
                    positions: [],
                    vaultUsdc: toUSDC(vault.vaultUsdc + totalExitValue),
                    tvl: toUSDC(vault.vaultUsdc + totalExitValue),
                    extendedSettlement: {
                        ...vault.extendedSettlement,
                        active: false,
                        outcome: 'forceExit'
                    }
                }
            } else {
                result = { success: true, outcome: 'waiting' }
                return {
                    ...vault,
                    extendedSettlement: {
                        ...vault.extendedSettlement,
                        outcome: 'waiting'
                    }
                }
            }
        }))

        return result
    }

    const finalizeClose = (vaultId) => {
        let result = { success: false, error: 'Unknown error' }

        setVaults(prev => prev.map(vault => {
            if (vault.id !== vaultId) return vault
            if (vault.stage !== STAGE.SETTLEMENT) {
                result = { success: false, error: 'Vault not in Settlement stage' }
                return vault
            }

            if (vault.positions && vault.positions.length > 0) {
                result = {
                    success: false,
                    error: `Close all ${vault.positions.length} position(s) before finalizing`
                }
                return vault
            }

            const profit = toUSDC(Math.max(vault.vaultUsdc - vault.initialAumUsdc, 0))
            const perfFee = toUSDC(Math.floor(profit * vault.perfFeeBps / 10000))

            const ageMs = Date.now() - vault.createdAt
            const ageDays = Math.max(ageMs / (1000 * 60 * 60 * 24), 1)
            const returnPct = vault.initialAumUsdc > 0
                ? ((vault.vaultUsdc - vault.initialAumUsdc) / vault.initialAumUsdc) * 100
                : 0
            const apr = (returnPct / ageDays) * 365

            result = { success: true, profit, perfFee }

            return {
                ...vault,
                stage: STAGE.CLOSED,
                perfFeeDueUsdc: perfFee,
                perfFeePaid: false,
                apr: apr || 0,
                age: Math.floor(ageDays),
            }
        }))

        return result
    }

    const getVault = (vaultId) => vaults.find(v => v.id === vaultId)

    const getUserShares = (vaultId) => {
        const vault = vaults.find(v => v.id === vaultId)
        return vault?.investors?.['demo-user']?.shares || 0
    }

    const getWithdrawalRequests = (vaultId) =>
        withdrawalRequests.filter(r => r.vaultId === vaultId && r.investor === 'demo-user')

    const getDeposit = getUserShares


    const resetDemo = () => {
        setWalletBalance(INITIAL_BALANCE)
        setVaults([])
        setWithdrawalRequests([])
        localStorage.clear()
    }

    useEffect(() => {
        const interval = setInterval(() => {
            setVaults(prev => prev.map(vault => {
                const now = Date.now()
                if (vault.stage === STAGE.OPEN && now >= vault.tradingStartTs) {
                    return { ...vault, stage: STAGE.TRADING, initialAumUsdc: vault.vaultUsdc }
                }
                if (vault.stage === STAGE.TRADING && now >= vault.tradingEndTs) {
                    return { ...vault, stage: STAGE.SETTLEMENT }
                }
                return vault
            }))
        }, 10000)
        return () => clearInterval(interval)
    }, [])

    return (
        <DemoContext.Provider value={{
            walletBalance,
            setWalletBalance,
            userVaults: vaults,
            withdrawalRequests,
            STAGE,
            VAULT_TYPE,
            PROTOCOL_CONFIG,
            createVault,
            depositToVault,
            requestWithdrawal,
            cancelWithdrawal,
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
            getVault,
            getUserShares,
            getDeposit,
            getWithdrawalRequests,
            resetDemo,
        }}>
            {children}
        </DemoContext.Provider>
    )
}

export function useDemo() {
    const context = useContext(DemoContext)
    if (!context) {
        throw new Error('useDemo must be used within a DemoProvider')
    }
    return context
}
