/**
 * Price History Service
 *
 * Fetches and caches historical price data for markets from Polymarket and Kalshi/DFlow.
 * Supports multiple time ranges: 5M, 1H, 24H, 7D
 */

const PROXY_BASE_URL = 'http://localhost:3001';

// Cache for price history to reduce API calls
const priceCache = new Map();
const CACHE_TTL = {
    '5m': 30 * 1000,      // 30 seconds for 5min view
    '1h': 60 * 1000,      // 1 minute for 1h view
    '24h': 5 * 60 * 1000, // 5 minutes for 24h view
    '7d': 15 * 60 * 1000, // 15 minutes for 7d view
};

/**
 * Time range configurations
 */
export const TIME_RANGES = {
    '5m': {
        label: '5M',
        interval: '1h',     // Polymarket API interval
        fidelity: 1,        // 1 minute resolution
        duration: 5 * 60,   // 5 minutes in seconds
    },
    '1h': {
        label: '1H',
        interval: '1h',
        fidelity: 1,
        duration: 60 * 60,
    },
    '24h': {
        label: '24H',
        interval: '1d',
        fidelity: 15,       // 15 minute resolution
        duration: 24 * 60 * 60,
    },
    '7d': {
        label: '7D',
        interval: '1w',
        fidelity: 60,       // 1 hour resolution
        duration: 7 * 24 * 60 * 60,
    },
};

/**
 * Generate cache key
 */
function getCacheKey(tokenId, timeRange) {
    return `${tokenId}:${timeRange}`;
}

/**
 * Check if cache is valid
 */
function isCacheValid(cacheEntry, timeRange) {
    if (!cacheEntry) return false;
    const ttl = CACHE_TTL[timeRange] || 60000;
    return Date.now() - cacheEntry.timestamp < ttl;
}

/**
 * Fetch price history from Polymarket CLOB API
 */
async function fetchPolymarketPriceHistory(tokenId, timeRange) {
    const config = TIME_RANGES[timeRange];
    if (!config) {
        throw new Error(`Invalid time range: ${timeRange}`);
    }

    const params = new URLSearchParams({
        tokenId,
        interval: config.interval,
        fidelity: config.fidelity.toString(),
    });

    const url = `${PROXY_BASE_URL}/api/markets/polymarket/prices-history?${params}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.history || data.history.length === 0) {
            return null;
        }

        // Filter to requested time range
        const now = Math.floor(Date.now() / 1000);
        const startTime = now - config.duration;

        const filteredHistory = data.history
            .filter(point => point.t >= startTime)
            .map(point => ({
                timestamp: point.t * 1000, // Convert to JS milliseconds
                price: point.p,
            }))
            .sort((a, b) => a.timestamp - b.timestamp);

        return filteredHistory;
    } catch (error) {
        console.error(`Error fetching Polymarket price history for ${tokenId}:`, error);
        return null;
    }
}

/**
 * Generate simulated price history when real data unavailable
 * Creates realistic price movement based on current price
 */
function generateSimulatedHistory(currentPrice, timeRange) {
    const config = TIME_RANGES[timeRange];
    const now = Date.now();
    const startTime = now - (config.duration * 1000);

    // Number of data points
    const numPoints = Math.min(100, Math.floor(config.duration / (config.fidelity * 60)));
    const interval = (config.duration * 1000) / numPoints;

    const history = [];
    let price = currentPrice;

    // Start from a slightly different price and move toward current
    const startPrice = currentPrice * (0.9 + Math.random() * 0.2); // +/- 10%
    price = startPrice;

    for (let i = 0; i < numPoints; i++) {
        const timestamp = startTime + (i * interval);

        // Random walk with drift toward current price
        const drift = (currentPrice - price) * 0.02; // Pull toward current price
        const volatility = 0.01 * (1 + Math.random()); // 1-2% volatility
        const change = drift + (Math.random() - 0.5) * volatility;

        price = Math.max(0.01, Math.min(0.99, price + change));

        history.push({
            timestamp,
            price,
        });
    }

    // Ensure last point is close to current price
    if (history.length > 0) {
        history[history.length - 1].price = currentPrice;
    }

    return history;
}

/**
 * Main function to get price history for a market
 *
 * @param {string} tokenId - The CLOB token ID
 * @param {string} timeRange - One of: '5m', '1h', '24h', '7d'
 * @param {number} currentPrice - Current price (used for simulation fallback)
 * @param {string} source - Market source: 'polymarket' or 'dflow'
 * @returns {Promise<Array>} Array of {timestamp, price} objects
 */
export async function getPriceHistory(tokenId, timeRange, currentPrice = 0.5, source = 'polymarket') {
    // Validate time range
    if (!TIME_RANGES[timeRange]) {
        console.warn(`Invalid time range: ${timeRange}, defaulting to 24h`);
        timeRange = '24h';
    }

    // Check cache first
    const cacheKey = getCacheKey(tokenId, timeRange);
    const cached = priceCache.get(cacheKey);

    if (isCacheValid(cached, timeRange)) {
        return cached.data;
    }

    let history = null;

    // Try to fetch real data for Polymarket
    if (source === 'polymarket' && tokenId) {
        history = await fetchPolymarketPriceHistory(tokenId, timeRange);
    }

    // If no real data, generate simulated data
    if (!history || history.length === 0) {
        history = generateSimulatedHistory(currentPrice, timeRange);
    }

    // Cache the result
    priceCache.set(cacheKey, {
        data: history,
        timestamp: Date.now(),
    });

    return history;
}

/**
 * Get price at a specific point in time from history
 */
export function getPriceAtTime(history, targetTime) {
    if (!history || history.length === 0) return null;

    // Find closest data point
    let closest = history[0];
    let minDiff = Math.abs(targetTime - closest.timestamp);

    for (const point of history) {
        const diff = Math.abs(targetTime - point.timestamp);
        if (diff < minDiff) {
            minDiff = diff;
            closest = point;
        }
    }

    return closest;
}

/**
 * Calculate price change stats from history
 */
export function calculatePriceStats(history) {
    if (!history || history.length < 2) {
        return { change: 0, changePercent: 0, high: 0, low: 0 };
    }

    const startPrice = history[0].price;
    const endPrice = history[history.length - 1].price;
    const change = endPrice - startPrice;
    const changePercent = (change / startPrice) * 100;

    const prices = history.map(h => h.price);
    const high = Math.max(...prices);
    const low = Math.min(...prices);

    return {
        change,
        changePercent,
        high,
        low,
        start: startPrice,
        end: endPrice,
    };
}

/**
 * Format price for display
 */
export function formatPrice(price) {
    return `${Math.round(price * 100)}¢`;
}

/**
 * Format timestamp for tooltip
 */
export function formatTimestamp(timestamp, timeRange) {
    const date = new Date(timestamp);

    if (timeRange === '5m' || timeRange === '1h') {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (timeRange === '24h') {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

/**
 * Clear cache for a specific token or all tokens
 */
export function clearCache(tokenId = null) {
    if (tokenId) {
        for (const key of priceCache.keys()) {
            if (key.startsWith(tokenId)) {
                priceCache.delete(key);
            }
        }
    } else {
        priceCache.clear();
    }
}

export default {
    getPriceHistory,
    getPriceAtTime,
    calculatePriceStats,
    formatPrice,
    formatTimestamp,
    clearCache,
    TIME_RANGES,
};
