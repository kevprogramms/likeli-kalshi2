/**
 * DFlow Prediction Markets API Adapter (Kalshi via DFlow)
 * 
 * Development API Endpoints (proxied via localhost:3001):
 * - Quote API: https://dev-quote-api.dflow.net
 * - Prediction Markets API: https://dev-prediction-markets-api.dflow.net
 * 
 * IMPORTANT: This is for end-to-end trading during development.
 * - Don't release in prod without notifying DFlow
 * - Be willing to lose test capital
 */

// Proxy server URL (handles CORS)
const PROXY_BASE_URL = 'http://localhost:3001';

// Direct API URLs (for reference - not used directly due to CORS)
const DFLOW_QUOTE_API_DIRECT = 'https://dev-quote-api.dflow.net';
const DFLOW_MARKETS_API_DIRECT = 'https://dev-prediction-markets-api.dflow.net';

class DFlowAPI {
    constructor(apiKey = null) {
        this.apiKey = apiKey;
        this.proxyUrl = PROXY_BASE_URL;
    }

    async fetch(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        // Use proxy to avoid CORS
        const url = `${this.proxyUrl}/api/dflow${endpoint}`;
        console.log(`DFlow API: Fetching ${url}`);

        const response = await fetch(url, {
            ...options,
            headers: { ...headers, ...options.headers },
        });

        if (!response.ok) {
            const errorMsg = `DFlow API error: ${response.status} ${response.statusText}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        const data = await response.json();
        console.log(`DFlow API: Success`, data);
        return data;
    }

    // Quote API methods
    async getQuote(params = {}) {
        const query = new URLSearchParams(params).toString();
        // Quote API uses different proxy endpoint
        const url = `${this.proxyUrl}/api/dflow/quote${query ? `?${query}` : ''}`;
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error(`Quote API error: ${response.status}`);
        return response.json();
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
