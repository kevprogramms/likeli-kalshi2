/**
 * Manifold-style CPMM (Constant Product Market Maker) for Demo Markets
 * 
 * Based on Manifold's CPMM implementation:
 * - Uses the formula: k = YES^p * NO^(1-p)
 * - For binary markets, p = 0.5 (balanced)
 * - Probability = (p * NO) / ((1-p) * YES + p * NO)
 * 
 * Simplified from: manifold-main/common/src/calculate-cpmm.ts
 */

// Store market states in memory (persisted to localStorage)
const STORAGE_KEY = 'likeli_amm_markets'

// Validate that a pool has sensible values
const isValidPool = (pool) => {
    if (!pool) return false
    if (!isFinite(pool.poolYes) || pool.poolYes <= 0) return false
    if (!isFinite(pool.poolNo) || pool.poolNo <= 0) return false
    // Check that reserves are in reasonable range (not corrupted)
    if (pool.poolYes > 1e12 || pool.poolNo > 1e12) return false
    // Check that probability is in valid range
    const prob = getProbability(pool.poolYes, pool.poolNo, pool.p)
    if (prob <= 0.01 || prob >= 0.99) return true // Allow edge cases
    return true
}

// Load initial state with validation
const loadMarkets = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return {}

        const pools = JSON.parse(stored)
        const validated = {}

        // Only keep valid pools
        for (const [id, pool] of Object.entries(pools)) {
            if (isValidPool(pool)) {
                validated[id] = pool
            } else {
                console.log('Removing corrupted market pool:', id)
            }
        }

        return validated
    } catch {
        return {}
    }
}

// Save state
const saveMarkets = (markets) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(markets))
}

// Market state store
let marketPools = loadMarkets()

/**
 * Sync marketPools from localStorage (for cross-component updates)
 */
export const syncFromStorage = () => {
    marketPools = loadMarkets()
}

/**
 * Get probability from pool reserves
 * Formula: prob = (p * NO) / ((1-p) * YES + p * NO)
 * For p = 0.5: prob = NO / (YES + NO)
 */
const getProbability = (poolYes, poolNo, p = 0.5) => {
    return (p * poolNo) / ((1 - p) * poolYes + p * poolNo)
}

/**
 * Calculate shares from bet amount (before fees)
 * Formula from Manifold: https://www.wolframalpha.com/input?i=%28y%2Bb-s%29%5E%28p%29*%28n%2Bb%29%5E%281-p%29+%3D+k%2C+solve+s
 */
const calculateShares = (poolYes, poolNo, p, betAmount, outcome) => {
    if (betAmount === 0) return 0

    const k = Math.pow(poolYes, p) * Math.pow(poolNo, 1 - p)

    if (outcome === 'YES') {
        // Buying YES shares
        return poolYes + betAmount - Math.pow(k * Math.pow(betAmount + poolNo, p - 1), 1 / p)
    } else {
        // Buying NO shares
        return poolNo + betAmount - Math.pow(k * Math.pow(betAmount + poolYes, -p), 1 / (1 - p))
    }
}

/**
 * Initialize a market pool with given probability
 * @param {string} marketId - Unique market identifier
 * @param {number} initialProb - Initial YES probability (0-1)
 * @param {number} liquidity - Initial liquidity
 */
export const initializeMarket = (marketId, initialProb = 0.5, liquidity = 1000) => {
    if (marketPools[marketId]) {
        return marketPools[marketId]
    }

    // For p = 0.5, set pools such that prob = NO / (YES + NO) = initialProb
    // So NO = initialProb * (YES + NO), and YES = (1 - initialProb) * (YES + NO)
    // With total liquidity L: YES = L * (1 - prob), NO = L * prob
    const poolYes = liquidity * (1 - initialProb)
    const poolNo = liquidity * initialProb

    const pool = {
        marketId,
        poolYes,
        poolNo,
        p: 0.5, // Balanced market
        totalVolume: 0,
        trades: [],
        createdAt: Date.now()
    }

    marketPools[marketId] = pool
    saveMarkets(marketPools)
    return pool
}

/**
 * Get current YES probability
 */
export const getYesPrice = (marketId) => {
    syncFromStorage()

    const pool = marketPools[marketId]
    if (!pool) return 0.5

    const prob = getProbability(pool.poolYes, pool.poolNo, pool.p)

    // Clamp to valid range
    if (!isFinite(prob) || prob <= 0 || prob >= 1) {
        return 0.5
    }

    return prob
}

/**
 * Get current NO probability
 */
export const getNoPrice = (marketId) => {
    return 1 - getYesPrice(marketId)
}

/**
 * Calculate purchase result including new pool state
 */
const calculatePurchase = (pool, betAmount, outcome) => {
    const { poolYes, poolNo, p } = pool

    const shares = calculateShares(poolYes, poolNo, p, betAmount, outcome)

    let newPoolYes, newPoolNo
    if (outcome === 'YES') {
        // Buying YES: add bet to both pools, remove shares from YES
        newPoolYes = poolYes - shares + betAmount
        newPoolNo = poolNo + betAmount
    } else {
        // Buying NO: add bet to both pools, remove shares from NO
        newPoolYes = poolYes + betAmount
        newPoolNo = poolNo - shares + betAmount
    }

    return {
        shares,
        newPoolYes,
        newPoolNo
    }
}

/**
 * Execute a buy trade
 * @param {string} marketId 
 * @param {string} side - 'YES' or 'NO'
 * @param {number} betAmount 
 */
export const executeBuy = (marketId, side, betAmount) => {
    syncFromStorage()

    let pool = marketPools[marketId]
    if (!pool) {
        pool = initializeMarket(marketId, 0.5, 1000)
        marketPools[marketId] = pool
    }

    const beforeProb = getProbability(pool.poolYes, pool.poolNo, pool.p)

    // Calculate the purchase
    const { shares, newPoolYes, newPoolNo } = calculatePurchase(pool, betAmount, side)

    if (shares <= 0 || !isFinite(shares)) {
        return { success: false, error: 'Invalid trade calculation' }
    }

    const avgPrice = betAmount / shares

    // Update pool
    pool.poolYes = newPoolYes
    pool.poolNo = newPoolNo
    pool.totalVolume = (pool.totalVolume || 0) + betAmount

    const afterProb = getProbability(pool.poolYes, pool.poolNo, pool.p)

    console.log(`CPMM Trade: ${side} $${betAmount} for ${shares.toFixed(2)} shares`)
    console.log(`  Probability: ${(beforeProb * 100).toFixed(1)}% → ${(afterProb * 100).toFixed(1)}%`)
    console.log(`  Pool: YES=${newPoolYes.toFixed(0)}, NO=${newPoolNo.toFixed(0)}`)

    const trade = {
        id: 'trade-' + Date.now(),
        side,
        direction: 'BUY',
        amount: betAmount,
        shares,
        avgPrice,
        beforeProb,
        afterProb,
        timestamp: Date.now()
    }

    pool.trades = pool.trades || []
    pool.trades.push(trade)

    // Save to memory AND localStorage
    marketPools[marketId] = pool
    saveMarkets(marketPools)

    return {
        success: true,
        shares,
        avgPrice,
        priceImpact: ((afterProb - beforeProb) / beforeProb) * 100,
        newYesPrice: afterProb,
        newNoPrice: 1 - afterProb,
        trade
    }
}

/**
 * Execute a sell trade (sells shares for the underlying)
 */
export const executeSell = (marketId, side, sharesToSell) => {
    syncFromStorage()

    const pool = marketPools[marketId]
    if (!pool) return { success: false, error: 'Market not found' }

    const beforeProb = getProbability(pool.poolYes, pool.poolNo, pool.p)

    // Selling is opposite of buying - we're returning shares to the pool
    // and receiving money based on the inverse operation
    const { poolYes, poolNo, p } = pool
    const k = Math.pow(poolYes, p) * Math.pow(poolNo, 1 - p)

    let payout, newPoolYes, newPoolNo

    if (side === 'YES') {
        // Selling YES shares - add shares back to YES pool
        // Calculate what bet amount would give these shares
        const newYes = poolYes + sharesToSell
        // k = newYes^p * newNo^(1-p), solve for newNo
        const newNo = Math.pow(k / Math.pow(newYes, p), 1 / (1 - p))
        payout = poolNo - newNo
        newPoolYes = newYes
        newPoolNo = newNo
    } else {
        // Selling NO shares
        const newNo = poolNo + sharesToSell
        const newYes = Math.pow(k / Math.pow(newNo, 1 - p), 1 / p)
        payout = poolYes - newYes
        newPoolYes = newYes
        newPoolNo = newNo
    }

    if (payout <= 0 || !isFinite(payout)) {
        return { success: false, error: 'Invalid sell calculation' }
    }

    // Update pool
    pool.poolYes = newPoolYes
    pool.poolNo = newPoolNo
    pool.totalVolume = (pool.totalVolume || 0) + payout

    const afterProb = getProbability(pool.poolYes, pool.poolNo, pool.p)

    console.log(`CPMM Sell: ${side} ${sharesToSell.toFixed(2)} shares for $${payout.toFixed(2)}`)
    console.log(`  Probability: ${(beforeProb * 100).toFixed(1)}% → ${(afterProb * 100).toFixed(1)}%`)

    const trade = {
        id: 'trade-' + Date.now(),
        side,
        direction: 'SELL',
        shares: sharesToSell,
        payout,
        avgPrice: payout / sharesToSell,
        beforeProb,
        afterProb,
        timestamp: Date.now()
    }

    pool.trades = pool.trades || []
    pool.trades.push(trade)

    marketPools[marketId] = pool
    saveMarkets(marketPools)

    return {
        success: true,
        payout,
        avgPrice: payout / sharesToSell,
        newYesPrice: afterProb,
        newNoPrice: 1 - afterProb,
        trade
    }
}

/**
 * Get market info
 */
export const getMarketInfo = (marketId) => {
    syncFromStorage()
    const pool = marketPools[marketId]
    if (!pool) return null

    return {
        marketId,
        yesPrice: getYesPrice(marketId),
        noPrice: getNoPrice(marketId),
        poolYes: pool.poolYes,
        poolNo: pool.poolNo,
        totalVolume: pool.totalVolume,
        tradeCount: pool.trades?.length || 0,
        lastTrade: pool.trades?.[pool.trades.length - 1] || null
    }
}

/**
 * Get all market pools
 */
export const getAllMarkets = () => {
    syncFromStorage()
    return Object.keys(marketPools).map(id => getMarketInfo(id))
}

/**
 * Reset a market to initial state
 */
export const resetMarket = (marketId, initialProb = 0.5) => {
    delete marketPools[marketId]
    saveMarkets(marketPools)
    return initializeMarket(marketId, initialProb, 1000)
}

/**
 * Reset all markets
 */
export const resetAllMarkets = () => {
    marketPools = {}
    saveMarkets(marketPools)
}

// Initialize default markets on load with their initial probabilities
const DEFAULT_MARKETS = {
    'NE-BAL': 0.38,
    'BUF-CLE': 0.84,
    'PIT-DET': 0.26,
    'MIN-NYG': 0.59,
    'NFL-CHAMP': 0.17,
    'CFB-CHAMP': 0.31,
    'NFL-COACH': 0.25,
    'PHI-ANNOUNCE': 0.99,
    'AVATAR-RT': 0.76,
    'AVL-MUN': 0.47,
    'NETFLIX-TOP': 0.94
}

// Initialize markets if not already done
Object.entries(DEFAULT_MARKETS).forEach(([id, prob]) => {
    if (!marketPools[id]) {
        initializeMarket(id, prob, 1000)
    }
})

export default {
    initializeMarket,
    getYesPrice,
    getNoPrice,
    executeBuy,
    executeSell,
    getMarketInfo,
    getAllMarkets,
    resetMarket,
    resetAllMarkets,
    syncFromStorage
}
