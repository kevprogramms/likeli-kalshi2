/**
 * DFlow Prediction Markets API Adapter (Kalshi via DFlow)
 * 
 * PRODUCTION API Endpoints (proxied via backend server):
 * - Quote API: https://b.quote-api.dflow.net
 * - Markets API: https://a.prediction-markets-api.dflow.net
 * 
 * All requests are proxied through the backend server which:
 * - Adds the API key (kept server-side for security)
 * - Handles CORS issues
 * - Rate limits requests (100/min)
 */

// Proxy server URL (handles CORS and API key injection)
const PROXY_BASE_URL = 'http://localhost:3001';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second

/**
 * Sleep for a given number of milliseconds
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class DFlowAPI {
    constructor(apiKey = null) {
        this.apiKey = apiKey;
        this.proxyUrl = PROXY_BASE_URL;
    }

    /**
     * Fetch with automatic retry on failure
     * @param {string} endpoint - API endpoint
     * @param {object} options - Fetch options
     * @param {number} retriesLeft - Number of retries remaining
     */
    async fetch(endpoint, options = {}, retriesLeft = MAX_RETRIES) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        // Use proxy to avoid CORS
        const url = `${this.proxyUrl}/api/dflow${endpoint}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers: { ...headers, ...options.headers },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.message || errorData.error || `API error: ${response.status}`;

                // Retry on 5xx errors or rate limiting
                if ((response.status >= 500 || response.status === 429) && retriesLeft > 0) {
                    const delay = INITIAL_RETRY_DELAY_MS * (MAX_RETRIES - retriesLeft + 1);
                    console.warn(`[DFlow] Request failed (${response.status}), retrying in ${delay}ms... (${retriesLeft} retries left)`);
                    await sleep(delay);
                    return this.fetch(endpoint, options, retriesLeft - 1);
                }

                throw new Error(errorMessage);
            }

            return await response.json();
        } catch (error) {
            // Network errors - retry if possible
            if (retriesLeft > 0 && error.name === 'TypeError') {
                const delay = INITIAL_RETRY_DELAY_MS * (MAX_RETRIES - retriesLeft + 1);
                console.warn(`[DFlow] Network error, retrying in ${delay}ms... (${retriesLeft} retries left)`);
                await sleep(delay);
                return this.fetch(endpoint, options, retriesLeft - 1);
            }
            throw error;
        }
    }

    // Quote API methods - Get a quote for a trade
    async requestQuote(params = {}) {
        // POST to backend proxy which adds the API key header
        const url = `${this.proxyUrl}/api/dflow/quote`;
        console.log(`DFlow Quote API: POST ${url}`, params);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(`Quote API error: ${response.status} - ${error.error || error.details || 'Unknown'}`);
        }
        return response.json();
    }

    // Execute a trade with a signed quote
    async executeTrade(params = {}) {
        // POST to backend proxy which adds the API key header
        const url = `${this.proxyUrl}/api/dflow/execute`;
        console.log(`DFlow Execute API: POST ${url}`, params);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(`Execute API error: ${response.status} - ${error.error || error.details || 'Unknown'}`);
        }
        return response.json();
    }

    // New Declarative Swap Method
    // Calls GET /order (proxied) to get a constructed transaction
    async getDeclarativeOrder(params = {}) {
        const url = `${this.proxyUrl}/api/dflow/order`;
        console.log(`DFlow Declarative Order: POST ${url}`, params);

        const response = await fetch(url, {
            method: 'POST', // Proxy uses POST to accept body params
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorJson = {};
            try { errorJson = JSON.parse(errorText); } catch (e) { }

            throw new Error(`Order request failed: ${response.status} - ${errorJson.error || errorJson.details || errorText}`);
        }

        return response.json();
    }

    // Legacy getQuote method for backward compatibility
    async getQuote(params = {}) {
        return this.requestQuote(params);
    }


    // Markets API methods
    async getEvents(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.fetch(`/events${query ? `?${query}` : ''}`);
    }

    async getMarkets(params = {}) {
        // Default to active/open markets only
        const defaultParams = {
            status: 'active',       // Only active markets
            isInitialized: 'true',  // Only initialized markets
            limit: '50',            // Limit results
            sort: 'volume',         // Sort by volume
            ...params               // Allow overrides
        };
        const query = new URLSearchParams(defaultParams).toString();
        return this.fetch(`/markets${query ? `?${query}` : ''}`);
    }

    async getTrades(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.fetch(`/trades${query ? `?${query}` : ''}`);
    }

    async getLiveData() {
        return this.fetch('/live_data');
    }

    async getSeries() {
        return this.fetch('/series');
    }

    async getTagsByCategories() {
        return this.fetch('/tags_by_categories');
    }

    async getFiltersBySports() {
        return this.fetch('/filters_by_sports');
    }

    async search(query) {
        return this.fetch(`/search?q=${encodeURIComponent(query)}`);
    }

    /**
     * Get user positions (mock implementation for now using standard RPC if needed)
     * For DFlow/Prediction Markets, positions are just SPL tokens held by the user.
     * We can fetch them via standard Solana RPC if we have the wallet address.
     */
    async getUserPositions(walletAddress, events = []) {
        if (!walletAddress) return [];

        try {
            // We need a connection to fetch token accounts
            // Use standard mainnet/devnet endpoint
            // For now, this is a placeholder or we can implement client-side fetching in the component
            // because dflow.js is technically just an API wrapper.

            // However, we can help filter:
            // 1. Fetch all token accounts for wallet (client side)
            // 2. Map mints to market outcomes using the "events" data

            return []; // Implemented in component for direct RPC access
        } catch (error) {
            console.error('Error fetching user positions:', error);
            return [];
        }
    }

    /**
     * Get events formatted for the UI
     * Transforms DFlow API market data into the event format expected by the app
     */
    async getEventsForUI(params = {}) {
        // Fetch markets from DFlow API
        const response = await this.getMarkets(params);

        if (!response || !response.markets) {
            console.log('No markets data returned');
            return { events: [], total: 0 };
        }

        // Group markets by eventTicker to create "events"
        const eventMap = new Map();

        for (const market of response.markets) {
            const eventTicker = market.eventTicker || market.ticker;

            if (!eventMap.has(eventTicker)) {
                // Determine category from ticker prefix
                let category = 'Other';
                if (market.ticker.startsWith('KXNFL') || market.ticker.includes('NFL')) category = 'Pro Football';
                else if (market.ticker.startsWith('KXNBA') || market.ticker.includes('NBA')) category = 'Pro Basketball';
                else if (market.ticker.startsWith('KXMLB') || market.ticker.includes('MLB')) category = 'Pro Baseball';
                else if (market.ticker.startsWith('KXNCAA')) category = 'College Sports';
                else if (market.ticker.includes('PRES') || market.ticker.includes('SENATE') || market.ticker.includes('MAYOR')) category = 'Politics';
                else if (market.ticker.includes('FED')) category = 'Economics';
                else if (market.ticker.includes('BOXING')) category = 'Combat Sports';
                else if (market.ticker.includes('MASTERS') || market.ticker.includes('WMEN')) category = 'Tennis/Golf';

                eventMap.set(eventTicker, {
                    id: eventTicker,
                    title: market.title,
                    category: category,
                    status: market.status === 'active' ? 'open' : market.status,
                    endDate: new Date(market.closeTime * 1000).toISOString(),
                    volume: market.volume || 0,
                    isLive: market.status === 'active',
                    // Link to Kalshi event series page (e.g., KXNCAAF-26 -> /markets/kxncaaf)
                    kalshiUrl: `https://kalshi.com/markets/${eventTicker.split('-')[0].toLowerCase()}`,
                    markets: []
                });
            }

            // Calculate yes/no prices from the market data
            // DFlow returns yesBid/yesAsk/noBid/noAsk as decimal STRINGS (e.g., "0.54" = 54¢)
            // Need to parse properly and handle null values
            let yesPrice = 0.5;
            let noPrice = 0.5;

            if (market.status === 'finalized' && market.result) {
                // Market is resolved - show final prices based on result
                if (market.result === 'yes') {
                    yesPrice = 0.99;
                    noPrice = 0.01;
                } else if (market.result === 'no') {
                    yesPrice = 0.01;
                    noPrice = 0.99;
                }
            } else {
                // Parse available bid/ask prices (they're strings like "0.54")
                const yesBid = market.yesBid ? parseFloat(market.yesBid) : null;
                const yesAsk = market.yesAsk ? parseFloat(market.yesAsk) : null;
                const noBid = market.noBid ? parseFloat(market.noBid) : null;
                const noAsk = market.noAsk ? parseFloat(market.noAsk) : null;

                // Calculate yes price from available data
                if (yesBid !== null && yesAsk !== null) {
                    // Use midpoint of bid/ask spread
                    yesPrice = (yesBid + yesAsk) / 2;
                } else if (yesAsk !== null) {
                    yesPrice = yesAsk;
                } else if (yesBid !== null) {
                    yesPrice = yesBid;
                } else if (noBid !== null) {
                    // Derive from no price (yes = 1 - no)
                    yesPrice = 1 - noBid;
                } else if (noAsk !== null) {
                    yesPrice = 1 - noAsk;
                }

                // Calculate no price
                if (noBid !== null && noAsk !== null) {
                    noPrice = (noBid + noAsk) / 2;
                } else if (noBid !== null) {
                    noPrice = noBid;
                } else if (noAsk !== null) {
                    noPrice = noAsk;
                } else {
                    noPrice = 1 - yesPrice;
                }
            }
            // Parse outcome mints from accounts
            // "accounts" maps Collateral Mint -> { yesMint, noMint, ... }
            // We want to find the account for USDC (devnet or mainnet)
            // or fallback to the first available account

            let usdcAccount = null;

            // Known USDC Mints
            const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
            const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

            if (market.accounts) {
                if (market.accounts[USDC_MAINNET]) {
                    usdcAccount = market.accounts[USDC_MAINNET];
                } else if (market.accounts[USDC_DEVNET]) {
                    usdcAccount = market.accounts[USDC_DEVNET];
                } else {
                    // Fallback: take the first account that isn't CASH if possible, or just the first one
                    const keys = Object.keys(market.accounts);
                    const realKey = keys.find(k => !k.includes('CASH'));
                    usdcAccount = market.accounts[realKey || keys[0]];
                }
            }

            const outcomeMints = {
                curr: usdcAccount ? (market.accounts[USDC_MAINNET] ? USDC_MAINNET : USDC_DEVNET) : null, // Collateral mint
                yes: usdcAccount?.yesMint || null,
                no: usdcAccount?.noMint || null
            };

            // Clamp prices to valid range
            yesPrice = Math.max(0.01, Math.min(0.99, yesPrice));
            noPrice = Math.max(0.01, Math.min(0.99, noPrice));

            // Add market to event
            const event = eventMap.get(eventTicker);
            // Build Kalshi URL: https://kalshi.com/markets/{eventTicker}/{marketTicker}
            const kalshiMarketUrl = `https://kalshi.com/markets/${eventTicker.toLowerCase()}/${market.ticker.toLowerCase()}`;

            event.markets.push({
                id: market.ticker,
                title: market.title,
                subtitle: market.subtitle || '',
                kalshiUrl: kalshiMarketUrl,
                // Critical for trading:
                outcomeMints: outcomeMints,
                accounts: market.accounts,
                outcomes: [
                    {
                        name: market.yesSubTitle || 'Yes',
                        abbr: market.yesSubTitle?.substring(0, 3).toUpperCase() || 'YES',
                        price: yesPrice,
                        change: 0
                    },
                    {
                        name: market.noSubTitle || 'No',
                        abbr: market.noSubTitle?.substring(0, 3).toUpperCase() || 'NO',
                        price: noPrice,
                        change: 0
                    }
                ],
                result: market.result,
                status: market.status
            });

            // Update event volume (sum of all markets)
            event.volume = Math.max(event.volume, market.volume || 0);
        }

        // Convert map to array and sort by volume
        const events = Array.from(eventMap.values())
            .sort((a, b) => b.volume - a.volume);

        console.log(`DFlow API: Transformed ${response.markets.length} markets into ${events.length} events`);

        return { events, total: events.length, source: 'dflow' };
    }

    // WebSocket connection (dev endpoint)
    connectWebSocket(onMessage) {
        const wsUrl = 'wss://dev-prediction-markets-api.dflow.net/api/v1/ws';
        console.log(`DFlow WS: Connecting to ${wsUrl}`);

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('DFlow WS: Connected');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            onMessage(data);
        };

        ws.onerror = (error) => {
            console.error('DFlow WS error:', error);
        };

        ws.onclose = () => {
            console.log('DFlow WS: Disconnected');
        };

        return ws;
    }

}

export const dflowAPI = new DFlowAPI();
export default DFlowAPI;
