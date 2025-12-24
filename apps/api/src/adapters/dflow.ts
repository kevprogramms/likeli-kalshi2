/**
 * DFlow Prediction Markets API Adapter
 * 
 * This adapter interfaces with DFlow's API to:
 * - Fetch available Kalshi markets (tokenized on Solana)
 * - Get market prices and details
 * - Build trade transactions
 * 
 * API Docs: https://pond.dflow.net/prediction-market-metadata-api-reference/introduction
 * Trade API: https://pond.dflow.net/swap-api-reference/order/order
 */

export interface Market {
    id: string;
    ticker: string;
    title: string;
    description: string;
    category: string;
    status: 'open' | 'closed' | 'resolved';
    expiresAt: string;
    yesPrice: number; // 0-1
    noPrice: number;  // 0-1
    yesMint?: string; // SPL token mint for YES tokens
    noMint?: string;  // SPL token mint for NO tokens
    volume24h: number;
    openInterest: number;
}

export interface MarketDetail extends Market {
    rules: string;
    resolutionSource: string;
    eventId?: string;
    seriesId?: string;
}

export interface TradeParams {
    marketId: string;
    side: 'YES' | 'NO';
    direction: 'BUY' | 'SELL';
    amount: number; // USDC amount (scaled, 6 decimals)
    slippageBps?: number;
    userPublicKey: string; // Vault authority pubkey
}

export interface TradeQuote {
    marketId: string;
    side: 'YES' | 'NO';
    direction: 'BUY' | 'SELL';
    inputAmount: number;
    outputAmount: number;
    price: number;
    fee: number;
    priceImpact: number;
}

export interface OrderResponse {
    contextSlot: number;
    executionMode: 'sync' | 'async';
    inAmount: string;
    inputMint: string;
    outAmount: string;
    outputMint: string;
    minOutAmount: string;
    slippageBps: number;
    priceImpactPct: string;
    transaction?: string; // Base64-encoded serialized transaction
    routePlan?: Array<{
        data: string;
        inAmount: string;
        inputMint: string;
        outAmount: string;
        outputMint: string;
        venue: string;
    }>;
}

// API Base URLs
const DFLOW_METADATA_API = process.env.DFLOW_METADATA_API_URL || 'https://prediction-markets-api.dflow.net/api/v1';
const DFLOW_ORDER_API = process.env.DFLOW_ORDER_API_URL || 'https://quote-api.dflow.net';

class DFlowAdapter {
    private apiKey: string;
    private useRealApi: boolean;

    constructor(apiKey?: string) {
        this.apiKey = apiKey || process.env.DFLOW_API_KEY || '';
        this.useRealApi = !!this.apiKey;
    }

    private async fetchMetadata<T>(endpoint: string): Promise<T> {
        const url = `${DFLOW_METADATA_API}${endpoint}`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (this.apiKey) {
            headers['x-api-key'] = this.apiKey;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`DFlow Metadata API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    private async fetchOrder<T>(params: Record<string, string>): Promise<T> {
        const queryString = new URLSearchParams(params).toString();
        const url = `${DFLOW_ORDER_API}/order?${queryString}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (this.apiKey) {
            headers['x-api-key'] = this.apiKey;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`DFlow Order API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Get all available prediction markets
     */
    async getMarkets(): Promise<Market[]> {
        if (this.useRealApi) {
            try {
                // TODO: Call real DFlow API when available
                // const events = await this.fetchMetadata<any>('/events');
                // return this.transformEvents(events);
            } catch (error) {
                console.warn('DFlow API unavailable, using mock data:', error);
            }
        }
        return this.getMockMarkets();
    }

    /**
     * Get detailed market information
     */
    async getMarket(id: string): Promise<MarketDetail | null> {
        const markets = await this.getMarkets();
        const market = markets.find(m => m.id === id);
        if (!market) return null;

        return {
            ...market,
            rules: 'Market resolves YES if the condition is met by the expiration date.',
            resolutionSource: 'Kalshi Official Resolution via DFlow',
        };
    }

    /**
     * Get current price for a market
     */
    async getPrice(marketId: string): Promise<{ yes: number; no: number }> {
        const market = await this.getMarket(marketId);
        if (!market) {
            throw new Error(`Market ${marketId} not found`);
        }
        return { yes: market.yesPrice, no: market.noPrice };
    }

    /**
     * Get a quote for a trade
     */
    async getQuote(params: TradeParams): Promise<TradeQuote> {
        const price = await this.getPrice(params.marketId);
        const sidePrice = params.side === 'YES' ? price.yes : price.no;

        // Simple quote calculation (will be replaced with DFlow's actual quote API)
        const fee = params.amount * 0.002; // 0.2% fee
        const effectiveAmount = params.amount - fee;
        const tokensReceived = effectiveAmount / sidePrice;

        return {
            marketId: params.marketId,
            side: params.side,
            direction: params.direction,
            inputAmount: params.amount,
            outputAmount: tokensReceived,
            price: sidePrice,
            fee,
            priceImpact: 0.001, // 0.1% mock impact
        };
    }

    /**
     * Build trade order via DFlow Order API
     * Returns serialized transaction ready for signing
     */
    async buildTradeOrder(params: TradeParams): Promise<OrderResponse | null> {
        if (!this.useRealApi) {
            console.log('[MOCK] Building trade order:', params);
            return null;
        }

        const market = await this.getMarket(params.marketId);
        if (!market) {
            throw new Error(`Market ${params.marketId} not found`);
        }

        const inputMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
        const outputMint = params.side === 'YES' ? market.yesMint : market.noMint;

        if (!outputMint) {
            throw new Error(`No ${params.side} mint found for market ${params.marketId}`);
        }

        try {
            const orderResponse = await this.fetchOrder<OrderResponse>({
                userPublicKey: params.userPublicKey,
                inputMint,
                outputMint,
                amount: params.amount.toString(),
                slippageBps: (params.slippageBps || 100).toString(),
            });

            return orderResponse;
        } catch (error) {
            console.error('Failed to get DFlow order:', error);
            throw error;
        }
    }

    /**
     * Search markets by query
     */
    async searchMarkets(query: string): Promise<Market[]> {
        const markets = await this.getMarkets();
        const lowerQuery = query.toLowerCase();
        return markets.filter(m =>
            m.title.toLowerCase().includes(lowerQuery) ||
            m.ticker.toLowerCase().includes(lowerQuery) ||
            m.category.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Get markets by category
     */
    async getMarketsByCategory(category: string): Promise<Market[]> {
        const markets = await this.getMarkets();
        return markets.filter(m => m.category.toLowerCase() === category.toLowerCase());
    }

    /**
     * Mock markets for development
     */
    private getMockMarkets(): Market[] {
        return [
            {
                id: 'btc-100k-2025',
                ticker: 'BTC100K',
                title: 'Will Bitcoin reach $100,000 by end of Q1 2025?',
                description: 'This market resolves YES if Bitcoin reaches $100,000 USD on any major exchange.',
                category: 'Crypto',
                status: 'open',
                expiresAt: '2025-03-31T23:59:59Z',
                yesPrice: 0.72,
                noPrice: 0.28,
                yesMint: 'BTC100K_YES_MOCK_MINT',
                noMint: 'BTC100K_NO_MOCK_MINT',
                volume24h: 1500000,
                openInterest: 5000000,
            },
            {
                id: 'fed-rate-jan',
                ticker: 'FEDJAN',
                title: 'Will the Fed cut rates in January 2025?',
                description: 'Resolves YES if the Federal Reserve announces a rate cut at the January FOMC meeting.',
                category: 'Economics',
                status: 'open',
                expiresAt: '2025-01-29T19:00:00Z',
                yesPrice: 0.15,
                noPrice: 0.85,
                yesMint: 'FEDJAN_YES_MOCK_MINT',
                noMint: 'FEDJAN_NO_MOCK_MINT',
                volume24h: 800000,
                openInterest: 2500000,
            },
            {
                id: 'eth-5k-q1-2025',
                ticker: 'ETH5K',
                title: 'Will Ethereum reach $5,000 by Q1 2025?',
                description: 'This market resolves YES if ETH/USD reaches $5,000 on major exchanges.',
                category: 'Crypto',
                status: 'open',
                expiresAt: '2025-03-31T23:59:59Z',
                yesPrice: 0.38,
                noPrice: 0.62,
                yesMint: 'ETH5K_YES_MOCK_MINT',
                noMint: 'ETH5K_NO_MOCK_MINT',
                volume24h: 920000,
                openInterest: 3100000,
            },
            {
                id: 'inflation-below-3',
                ticker: 'CPI3',
                title: 'Will US CPI inflation fall below 3% by March 2025?',
                description: 'Resolves YES if the 12-month CPI reading is below 3.0%.',
                category: 'Economics',
                status: 'open',
                expiresAt: '2025-04-10T12:00:00Z',
                yesPrice: 0.55,
                noPrice: 0.45,
                yesMint: 'CPI3_YES_MOCK_MINT',
                noMint: 'CPI3_NO_MOCK_MINT',
                volume24h: 420000,
                openInterest: 1800000,
            },
            {
                id: 'sol-300-2025',
                ticker: 'SOL300',
                title: 'Will Solana reach $300 by end of Q2 2025?',
                description: 'Resolves YES if SOL/USD reaches $300 on major exchanges.',
                category: 'Crypto',
                status: 'open',
                expiresAt: '2025-06-30T23:59:59Z',
                yesPrice: 0.42,
                noPrice: 0.58,
                yesMint: 'SOL300_YES_MOCK_MINT',
                noMint: 'SOL300_NO_MOCK_MINT',
                volume24h: 650000,
                openInterest: 2200000,
            },
            {
                id: 'gdp-q4-2024',
                ticker: 'GDPQ4',
                title: 'Will Q4 2024 US GDP growth exceed 3%?',
                description: 'Resolves YES if the final estimate of Q4 2024 GDP growth is above 3%.',
                category: 'Economics',
                status: 'open',
                expiresAt: '2025-02-28T12:00:00Z',
                yesPrice: 0.48,
                noPrice: 0.52,
                yesMint: 'GDPQ4_YES_MOCK_MINT',
                noMint: 'GDPQ4_NO_MOCK_MINT',
                volume24h: 350000,
                openInterest: 1200000,
            },
        ];
    }
}

export const dflowAdapter = new DFlowAdapter();
export default DFlowAdapter;
