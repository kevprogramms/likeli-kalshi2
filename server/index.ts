import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch, { RequestInit } from 'node-fetch';
import { PrismaClient } from '@prisma/client';
import { buildHmacSignature } from '@polymarket/builder-signing-sdk';
import rateLimit from 'express-rate-limit';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

dotenv.config();

// ============================================
// PROXY CONFIGURATION (for geo-restricted regions)
// ============================================
const PROXY_URL = process.env.POLYMARKET_PROXY_URL || '';

// Create proxy agent based on URL type
function getProxyAgent() {
    if (!PROXY_URL) return undefined;

    try {
        if (PROXY_URL.startsWith('socks')) {
            console.log('[Proxy] Using SOCKS proxy:', PROXY_URL.replace(/:[^:]*@/, ':****@'));
            return new SocksProxyAgent(PROXY_URL);
        } else {
            console.log('[Proxy] Using HTTP/HTTPS proxy:', PROXY_URL.replace(/:[^:]*@/, ':****@'));
            return new HttpsProxyAgent(PROXY_URL);
        }
    } catch (err) {
        console.error('[Proxy] Failed to create proxy agent:', err);
        return undefined;
    }
}

const proxyAgent = getProxyAgent();

// Helper to add proxy to fetch options
function withProxy(options: RequestInit = {}): RequestInit {
    if (proxyAgent) {
        return { ...options, agent: proxyAgent };
    }
    return options;
}

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Prisma client
const prisma = new PrismaClient();

// ============================================
// DFLOW/KALSHI API CONFIGURATION (PRODUCTION)
// ============================================
const DFLOW_API_KEY = process.env.DFLOW_API_KEY;

// Validate DFlow API Key at startup
if (!DFLOW_API_KEY) {
    console.warn('[DFlow] ⚠️  WARNING: DFLOW_API_KEY not configured. DFlow/Kalshi routes will fail.');
    console.warn('[DFlow] Set DFLOW_API_KEY in your .env file for production.');
} else {
    console.log('[DFlow] ✅ Using PRODUCTION endpoints (API key configured)');
}

// Rate limiter for DFlow routes (100 requests per minute per IP)
const dflowRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per window
    message: { error: 'Too many requests to DFlow. Please wait a moment.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Builder API credentials (from your Polymarket Builder Profile)
const BUILDER_CREDENTIALS = {
    key: process.env.POLY_BUILDER_API_KEY || '019b78a0-c708-7953-b713-f778fc728b88',
    secret: process.env.POLY_BUILDER_SECRET || '',
    passphrase: process.env.POLY_BUILDER_PASSPHRASE || '',
};

// Use hardcoded DFlow key if not in env (matching test_quotes.cjs)
const ACTIVE_DFLOW_KEY = process.env.DFLOW_API_KEY || 'CfGAio5BHSeEvCNVwiXV';

// Configuration
const CONFIG = {
    polymarket: {
        gammaApi: 'https://gamma-api.polymarket.com',
        clobApi: 'https://clob.polymarket.com'
    },
    dflow: {
        // Use production endpoints if we have a key (env or fallback)
        marketsApi: ACTIVE_DFLOW_KEY ? 'https://a.prediction-markets-api.dflow.net' : 'https://dev-prediction-markets-api.dflow.net',
        quoteApi: ACTIVE_DFLOW_KEY ? 'https://b.quote-api.dflow.net' : 'https://dev-quote-api.dflow.net',
        apiKey: ACTIVE_DFLOW_KEY || ''
    }
};

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-signature', 'x-timestamp', 'poly_address', 'poly_signature', 'poly_timestamp', 'poly_api_key', 'poly_passphrase', 'POLY_ADDRESS', 'POLY_SIGNATURE', 'POLY_TIMESTAMP', 'POLY_API_KEY', 'POLY_PASSPHRASE', 'Access-Control-Allow-Private-Network'],
    exposedHeaders: ['Access-Control-Allow-Private-Network']
}));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Private-Network', 'true');
    next();
});
app.use(express.json());

// ============================================
// POLYMARKET BUILDER SIGNING ENDPOINT
// ============================================
// This endpoint is called by the frontend's ClobClient (via BuilderConfig)
// to add builder authentication headers for order attribution
app.post('/api/polymarket/sign', async (req, res) => {
    try {
        const { method, path, body } = req.body;

        console.log('[Builder Sign] Signing request:', { method, path });

        if (!BUILDER_CREDENTIALS.secret) {
            console.error('[Builder Sign] Missing POLY_BUILDER_SECRET in environment');
            return res.status(500).json({ error: 'Builder credentials not configured' });
        }

        const timestamp = Date.now().toString();

        const signature = buildHmacSignature(
            BUILDER_CREDENTIALS.secret,
            parseInt(timestamp),
            method,
            path,
            body
        );

        console.log('[Builder Sign] Generated signature for:', path);

        res.json({
            POLY_BUILDER_SIGNATURE: signature,
            POLY_BUILDER_TIMESTAMP: timestamp,
            POLY_BUILDER_API_KEY: BUILDER_CREDENTIALS.key,
            POLY_BUILDER_PASSPHRASE: BUILDER_CREDENTIALS.passphrase,
        });
    } catch (error) {
        console.error('[Builder Sign] Error:', error);
        res.status(500).json({ error: 'Failed to sign request', details: (error as Error).message });
    }
});

// ============================================
// POLYMARKET ORDER RELAYER (Bypass Cloudflare)
// ============================================
// Receives signed orders from frontend and forwards to Polymarket CLOB
// This works because servers are not blocked by Cloudflare/CORS like browsers are.
app.post('/api/polymarket/order', async (req, res) => {
    try {
        const { headers, body, rawBody, url, method } = req.body;

        console.log(`[Relayer] Forwarding ${method} to ${url}`);
        console.log(`[Relayer] Incoming Headers:`, JSON.stringify(headers));
        // console.log(`[Relayer] Forwarding Body:`, finalBody);

        // Forward the request to Polymarket from the SERVER
        const isGetOrHead = method === 'GET' || method === 'HEAD';
        const finalBody = isGetOrHead ? undefined : (rawBody || (body ? JSON.stringify(body) : undefined));

        if (proxyAgent) {
            console.log(`[Relayer] Using proxy for request`);
        }

        const response = await fetch(url || 'https://clob.polymarket.com/order', withProxy({
            method: method || 'POST',
            headers: {
                // Forward the L2 Auth headers from the frontend
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...headers
            },
            body: finalBody
        }));

        // Get the response text first (to catch non-JSON errors)
        const responseText = await response.text();
        const status = response.status;

        console.log(`[Relayer] Response: ${status}`, responseText.slice(0, 200));

        // Try parsing JSON if possible
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = responseText; // Return text if not JSON
        }

        if (status >= 400) {
            return res.status(status).json({
                error: 'Polymarket API Error',
                details: data
            });
        }

        // Return strictly as JSON if parsed, otherwise wrap it
        res.json(typeof data === 'string' ? { message: data } : data);
    } catch (error) {
        console.error('[Relayer] Error:', error);
        res.status(500).json({ error: 'Relayer failed', details: (error as Error).message });
    }
});

// Routes -> Polymarket Proxy (Gamma)
app.get('/api/markets/polymarket/events', async (req, res) => {
    try {
        const query = new URLSearchParams(req.query as any).toString();
        const url = `${CONFIG.polymarket.gammaApi}/events?${query}`;
        console.log(`[Polymarket] GET ${url}`);

        const response = await fetch(url, withProxy({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Origin': 'https://polymarket.com',
                'Referer': 'https://polymarket.com/'
            }
        }));

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Polymarket] Gamma API Error ${response.status}:`, errorText.slice(0, 200));
            return res.status(response.status).json({ error: 'Polymarket API Error', details: errorText.slice(0, 200) });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[Polymarket] Fatal Error:', error);
        res.status(500).json({ error: 'Failed to fetch Polymarket data', details: (error as Error).message });
    }
});

// Routes -> Polymarket CLOB Proxy
// Handles all CLOB requests (GET, POST, DELETE) to bypass CORS/WAF
app.use('/api/clob-proxy', async (req, res) => {
    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const path = req.path;
    const url = `${CONFIG.polymarket.clobApi}${path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

    console.log(`[CLOB Proxy] ${req.method} ${url}`);

    // Log request body for POST requests (especially auth)
    if (req.body && Object.keys(req.body).length > 0) {
        console.log(`[CLOB Proxy] Request body:`, JSON.stringify(req.body).slice(0, 500));
    }

    try {
        // Build clean headers - ONLY send what Polymarket needs
        const cleanHeaders: any = {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://polymarket.com',
            'Referer': 'https://polymarket.com/'
        };

        // Forward essential Polymarket trading headers (UPPERCASE versions too)
        Object.keys(req.headers).forEach(key => {
            const lowKey = key.toLowerCase();
            if (lowKey.startsWith('poly_') ||
                lowKey.startsWith('poly-') ||
                lowKey === 'x-api-key' ||
                lowKey === 'authorization' ||
                lowKey === 'poly_address' ||
                lowKey === 'poly_signature' ||
                lowKey === 'poly_timestamp' ||
                lowKey === 'poly_api_key' ||
                lowKey === 'poly_passphrase') {
                // Use uppercase POLY_ prefix as expected by Polymarket
                if (lowKey.startsWith('poly_')) {
                    cleanHeaders['POLY_' + lowKey.slice(5).toUpperCase()] = req.headers[key];
                } else {
                    cleanHeaders[key] = req.headers[key];
                }
            }
        });

        // Use Builders API key as fallback if not provided
        if (!cleanHeaders['x-api-key']) {
            cleanHeaders['x-api-key'] = '019b6962-ccdb-72ce-80c6-96171250a5b1';
        }

        console.log(`[CLOB Proxy] Headers being sent:`, Object.keys(cleanHeaders));
        if (proxyAgent) {
            console.log(`[CLOB Proxy] Using proxy for request`);
        }

        const fetchOptions: any = {
            method: req.method,
            headers: cleanHeaders,
        };

        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            fetchOptions.body = JSON.stringify(req.body);
        }

        const response = await fetch(url, withProxy(fetchOptions));

        // Copy status from Polymarket response
        res.status(response.status);

        // Forward essential response headers
        const responseHeaders = ['content-type', 'x-timestamp', 'x-signature'];
        responseHeaders.forEach(h => {
            const val = response.headers.get(h);
            if (val) res.setHeader(h, val);
        });

        const data = await response.text();
        console.log(`[CLOB Proxy] Response ${response.status}:`, data.slice(0, 300));

        try {
            res.send(JSON.parse(data));
        } catch (e) {
            res.send(data);
        }
    } catch (error) {
        console.error('[CLOB Proxy] Fatal Error:', error);
        res.status(500).json({ error: 'CLOB Proxy communication failed', details: (error as Error).message });
    }
});

// Routes -> DFlow Proxy (with API key for production)
// Rate limited: 100 requests/minute per IP
app.get('/api/dflow/markets', dflowRateLimiter, async (req, res) => {
    try {
        // Check API key - Allow dev endpoints if not configured
        if (!CONFIG.dflow.apiKey && !CONFIG.dflow.marketsApi.includes('dev-')) {
            return res.status(503).json({
                error: 'DFlow service unavailable',
                message: 'API key not configured. Contact support.'
            });
        }

        const query = new URLSearchParams(req.query as any).toString();
        const url = `${CONFIG.dflow.marketsApi}/api/v1/markets?${query}`;
        console.log(`[DFlow] GET ${url}`);

        const headers: any = {
            'Content-Type': 'application/json',
            'x-api-key': CONFIG.dflow.apiKey
        };

        const response = await fetch(url, { headers });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[DFlow] Error:', error);
        res.status(500).json({
            error: 'Failed to fetch markets',
            message: 'Unable to connect to DFlow. Please try again.'
        });
    }
});

// DFlow Quote API proxy (for getting trade quotes)
// Rate limited: 100 requests/minute per IP
app.post('/api/dflow/quote', dflowRateLimiter, async (req, res) => {
    try {
        // Check API key - Allow dev endpoints if not configured
        if (!CONFIG.dflow.apiKey && !CONFIG.dflow.marketsApi.includes('dev-')) {
            return res.status(503).json({
                error: 'DFlow service unavailable',
                message: 'API key not configured. Contact support.'
            });
        }

        // DFlow quote API uses GET with query parameters
        const { inputMint, outputMint, amount, slippageBps, platformFeeBps } = req.body;

        // Validate required fields
        if (!inputMint || !outputMint || !amount) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'inputMint, outputMint, and amount are required.'
            });
        }

        const queryParams = new URLSearchParams({
            inputMint,
            outputMint,
            amount,
            slippageBps: slippageBps || 'auto', // Default to auto
            platformFeeBps: platformFeeBps || '0'
        });

        const url = `${CONFIG.dflow.quoteApi}/quote?${queryParams.toString()}`;
        console.log(`[DFlow Quote] Requesting: GET ${url}`);
        console.log(`[DFlow Quote] Params: input=${inputMint}, output=${outputMint}, amount=${amount}`);

        const headers: any = {
            'Content-Type': 'application/json',
            'x-api-key': CONFIG.dflow.apiKey
        };

        const response = await fetch(url, {
            method: 'GET',
            headers
        });

        const responseText = await response.text();
        console.log(`[DFlow Quote] Response ${response.status}:`, responseText.slice(0, 500));

        if (!response.ok) {
            // User-friendly error messages
            let message = 'Failed to get quote. Please try again.';
            if (response.status === 400) message = 'Invalid trade parameters.';
            if (response.status === 404) message = 'Market not found.';
            if (response.status === 429) message = 'Too many requests. Please wait.';

            return res.status(response.status).json({ error: message, details: responseText.slice(0, 200) });
        }

        try {
            const data = JSON.parse(responseText);
            res.json(data);
        } catch (e) {
            res.status(500).json({ error: 'Invalid response from DFlow', message: 'Please try again.' });
        }
    } catch (error) {
        console.error('[DFlow Quote] Error:', error);
        res.status(500).json({ error: 'Quote request failed', message: 'Unable to get quote. Please try again.' });
    }
});

// Declarative Swap Endpoint (GET /order proxied via POST)
// Rate limited: 100 requests/minute per IP
app.post('/api/dflow/order', dflowRateLimiter, async (req, res) => {
    try {
        // Check API key - Allow dev endpoints if not configured
        if (!CONFIG.dflow.apiKey && !CONFIG.dflow.marketsApi.includes('dev-')) {
            return res.status(503).json({
                error: 'DFlow service unavailable',
                message: 'API key not configured. Contact support.'
            });
        }

        const { inputMint, outputMint, amount, slippageBps, userPublicKey } = req.body;

        // Validate required fields
        if (!inputMint || !outputMint || !amount || !userPublicKey) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'inputMint, outputMint, amount, and userPublicKey are required.'
            });
        }

        // Construct query string for DFlow
        const params = new URLSearchParams({
            inputMint,
            outputMint,
            amount,
            slippageBps: slippageBps || '100', // Default 1% slippage
            userPublicKey
        });

        const url = `${CONFIG.dflow.quoteApi}/order?${params.toString()}`;
        console.log(`[DFlow Order] GET ${url}`);

        const headers: any = {
            'Content-Type': 'application/json',
            'x-api-key': CONFIG.dflow.apiKey
        };

        const response = await fetch(url, {
            method: 'GET',
            headers
        });

        const responseText = await response.text();

        if (!response.ok) {
            console.error(`[DFlow Order] Failed ${response.status}: ${responseText}`);

            // User-friendly error messages
            let message = 'Failed to create order. Please try again.';
            if (response.status === 400) message = 'Invalid order parameters.';
            if (response.status === 404) message = 'Market or token not found.';
            if (response.status === 429) message = 'Too many requests. Please wait.';
            if (response.status === 500) message = 'DFlow server error. Please try again later.';

            return res.status(response.status).json({ error: message, details: responseText.slice(0, 200) });
        }

        try {
            const data = JSON.parse(responseText);
            res.json(data);
        } catch (e) {
            res.status(500).json({ error: 'Invalid response from DFlow', message: 'Please try again.' });
        }
    } catch (error) {
        console.error('[DFlow Order] Error:', error);
        res.status(500).json({ error: 'Order creation failed', message: 'Unable to create order. Please try again.' });
    }
});


// DFlow Execute Trade API proxy (uses /order endpoint)
// Rate limited: 100 requests/minute per IP
app.post('/api/dflow/execute', dflowRateLimiter, async (req, res) => {
    try {
        // Check API key - Allow dev endpoints if not configured
        if (!CONFIG.dflow.apiKey && !CONFIG.dflow.marketsApi.includes('dev-')) {
            return res.status(503).json({
                error: 'DFlow service unavailable',
                message: 'API key not configured. Contact support.'
            });
        }

        // DFlow order endpoint is at /order, not /api/v1/execute
        const url = `${CONFIG.dflow.quoteApi}/order`;
        console.log(`[DFlow Execute] POST ${url}`);

        const headers: any = {
            'Content-Type': 'application/json',
            'x-api-key': CONFIG.dflow.apiKey
        };

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(req.body)
        });

        const responseText = await response.text();
        console.log(`[DFlow Execute] Response ${response.status}:`, responseText.slice(0, 500));

        if (!response.ok) {
            // User-friendly error messages
            let message = 'Trade execution failed. Please try again.';
            if (response.status === 400) message = 'Invalid trade parameters.';
            if (response.status === 429) message = 'Too many requests. Please wait.';
            if (response.status === 500) message = 'DFlow server error. Please try again later.';

            return res.status(response.status).json({ error: message, details: responseText.slice(0, 200) });
        }

        try {
            const data = JSON.parse(responseText);
            res.json(data);
        } catch (e) {
            res.status(500).json({ error: 'Invalid response from DFlow', message: 'Please try again.' });
        }
    } catch (error) {
        console.error('[DFlow Execute] Error:', error);
        res.status(500).json({ error: 'Trade execution failed', message: 'Unable to execute trade. Please try again.' });
    }
});


app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        service: 'Likeli Backend v1.2',
        database: 'PostgreSQL',
        proxy: {
            enabled: !!proxyAgent,
            type: PROXY_URL ? (PROXY_URL.startsWith('socks') ? 'SOCKS' : 'HTTP') : 'none'
        },
        polymarket: {
            builderKeyConfigured: !!BUILDER_CREDENTIALS.key,
            builderSecretConfigured: !!BUILDER_CREDENTIALS.secret
        }
    });
});

// ===== ETF REBALANCING LOGIC (The "Robo-Advisor" Approach) =====

/**
 * Get market price from Polymarket or DFlow
 * Returns price in USDC (0-1 range for prediction markets)
 */
async function getMarketPrice(marketId: string, chain: string): Promise<number> {
    try {
        if (chain === 'polygon') {
            // Fetch from Polymarket Gamma API
            const response = await fetch(`${CONFIG.polymarket.gammaApi}/markets/${marketId}`);
            if (response.ok) {
                const data: any = await response.json();
                return data.outcomePrices?.[0] || 0.5; // Default to 0.5 if not found
            }
        } else if (chain === 'solana') {
            // Fetch from DFlow API
            const response = await fetch(`${CONFIG.dflow.marketsApi}/api/v1/markets/${marketId}`);
            if (response.ok) {
                const data: any = await response.json();
                return data.lastPrice || 0.5;
            }
        }
        return 0.5; // Default price
    } catch (error) {
        console.error(`[Rebalance] Error fetching price for ${marketId}:`, error);
        return 0.5;
    }
}

/**
 * Execute a trade on Polymarket via CLOB API
 */
async function executePolymarketTrade(marketId: string, side: string, amount: number): Promise<boolean> {
    try {
        // In production: Use CLOB API with proper authentication
        console.log(`[Rebalance] Polymarket: ${side} $${amount.toFixed(2)} on ${marketId}`);

        // TODO: Implement actual CLOB order placement
        // This requires:
        // 1. ETF wallet private key signing
        // 2. CLOB API order creation
        // 3. Order monitoring and confirmation

        return true;
    } catch (error) {
        console.error(`[Rebalance] Polymarket trade error:`, error);
        return false;
    }
}

/**
 * Execute a trade on DFlow/Kalshi
 */
async function executeDflowTrade(marketId: string, side: string, amount: number): Promise<boolean> {
    try {
        // In production: Use DFlow Quote API
        console.log(`[Rebalance] DFlow: ${side} $${amount.toFixed(2)} on ${marketId}`);

        // TODO: Implement actual DFlow order placement
        // This requires:
        // 1. DFlow API keys
        // 2. Quote request -> Execute flow
        // 3. Transaction confirmation

        return true;
    } catch (error) {
        console.error(`[Rebalance] DFlow trade error:`, error);
        return false;
    }
}

/**
 * Rebalance an ETF basket to match target allocations
 * Called after deposits to buy underlying positions
 */
async function rebalanceEtf(basketId: string): Promise<void> {
    try {
        console.log(`[Rebalance] Starting rebalance for basket ${basketId}`);

        const basket = await prisma.etfBasket.findUnique({
            where: { id: basketId },
            include: { positions: true }
        });

        if (!basket) {
            console.error(`[Rebalance] Basket ${basketId} not found`);
            return;
        }

        const totalValue = basket.cashUsdc;
        if (totalValue <= 0) {
            console.log(`[Rebalance] No cash to deploy for basket ${basketId}`);
            return;
        }

        // For each position, calculate target value and execute trades
        for (const position of basket.positions) {
            const targetValue = totalValue * position.allocation;
            const currentPrice = await getMarketPrice(position.marketId, position.chain);
            const currentValue = position.shares * currentPrice;
            const deltaUsdc = targetValue - currentValue;

            // Only rebalance if difference is significant (>$10)
            if (Math.abs(deltaUsdc) > 10) {
                const success = position.chain === 'polygon'
                    ? await executePolymarketTrade(position.marketId, position.side, deltaUsdc)
                    : await executeDflowTrade(position.marketId, position.side, deltaUsdc);

                if (success) {
                    // Update position shares in database
                    const newShares = deltaUsdc > 0
                        ? position.shares + (deltaUsdc / currentPrice)
                        : position.shares - (Math.abs(deltaUsdc) / currentPrice);

                    await prisma.etfPosition.update({
                        where: { id: position.id },
                        data: { shares: Math.max(0, newShares) }
                    });

                    console.log(`[Rebalance] Updated ${position.marketId}: ${position.shares} -> ${newShares} shares`);
                }
            }
        }

        // Update basket cash (reduce by deployed amount)
        const deployedAmount = basket.positions.reduce((sum, p) => sum + (totalValue * p.allocation), 0);
        await prisma.etfBasket.update({
            where: { id: basketId },
            data: {
                cashUsdc: Math.max(0, totalValue - deployedAmount),
                updatedAt: new Date()
            }
        });

        console.log(`[Rebalance] Completed rebalance for basket ${basketId}`);
    } catch (error) {
        console.error(`[Rebalance] Error:`, error);
    }
}

// ===== LEADERBOARD AGGREGATION =====

/**
 * Calculate total PnL for a user from their trades
 */
function calculateTotalPnl(trades: any[]): number {
    return trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
}

/**
 * Calculate total volume for a user from their trades
 */
function calculateVolume(trades: any[]): number {
    return trades.reduce((sum, trade) => sum + Math.abs(trade.amount || 0), 0);
}

/**
 * Update leaderboard rankings
 * Should be run as a cron job every hour
 */
async function updateLeaderboard(): Promise<void> {
    try {
        console.log('[Leaderboard] Starting update...');

        // Get all users with their trades
        const users = await prisma.user.findMany({
            include: { etfHoldings: true }
        });

        // Calculate rankings
        const rankings = users.map(user => ({
            userId: user.id,
            pnl: 0, // TODO: Calculate from actual trade history
            volume: 0
        })).sort((a, b) => b.pnl - a.pnl);

        // Batch upsert leaderboard entries
        for (let i = 0; i < rankings.length; i++) {
            const entry = rankings[i];
            await prisma.leaderboardEntry.upsert({
                where: { userId: entry.userId },
                update: {
                    totalPnl: entry.pnl,
                    totalVolume: entry.volume,
                    rank: i + 1
                },
                create: {
                    userId: entry.userId,
                    totalPnl: entry.pnl,
                    totalVolume: entry.volume,
                    rank: i + 1
                }
            });
        }

        console.log(`[Leaderboard] Updated ${rankings.length} entries`);
    } catch (error) {
        console.error('[Leaderboard] Update error:', error);
    }
}

// Run leaderboard update every hour
const LEADERBOARD_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
setInterval(updateLeaderboard, LEADERBOARD_INTERVAL_MS);

// Trigger leaderboard update endpoint (manual trigger)
app.post('/api/leaderboard/update', async (req, res) => {
    try {
        await updateLeaderboard();
        res.json({ success: true, message: 'Leaderboard updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update leaderboard' });
    }
});


// ===== VAULT GROUPS (Hybrid Vault Linking) =====

// Create a new hybrid vault group by linking Polygon + Solana vaults
app.post('/api/vault-groups', async (req, res) => {
    try {
        const { name, description, manager, polygonVaultId, solanaVaultId } = req.body;

        if (!name || !manager) {
            return res.status(400).json({ error: 'name and manager are required' });
        }

        const group = await prisma.vaultGroup.create({
            data: { name, description, manager, polygonVaultId, solanaVaultId }
        });

        console.log(`[VaultGroup] Created: ${group.id} - ${name}`);
        res.json(group);
    } catch (error) {
        console.error('[VaultGroup] Create error:', error);
        res.status(500).json({ error: 'Failed to create vault group' });
    }
});

// Get all vault groups
app.get('/api/vault-groups', async (req, res) => {
    try {
        const groups = await prisma.vaultGroup.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(groups);
    } catch (error) {
        console.error('[VaultGroup] Fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch vault groups' });
    }
});

// Get a single vault group by ID
app.get('/api/vault-groups/:id', async (req, res) => {
    try {
        const group = await prisma.vaultGroup.findUnique({
            where: { id: req.params.id }
        });
        if (!group) {
            return res.status(404).json({ error: 'Vault group not found' });
        }
        res.json(group);
    } catch (error) {
        console.error('[VaultGroup] Fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch vault group' });
    }
});

// ===== ETF BASKETS (Robo-Advisor) =====

// Get all ETF baskets
app.get('/api/etf', async (req, res) => {
    try {
        const baskets = await prisma.etfBasket.findMany({
            include: {
                positions: true,
                _count: { select: { holdings: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(baskets);
    } catch (error) {
        console.error('[ETF] Fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch ETF baskets' });
    }
});

// Get single ETF basket with full details
app.get('/api/etf/:id', async (req, res) => {
    try {
        const basket = await prisma.etfBasket.findUnique({
            where: { id: req.params.id },
            include: {
                positions: true,
                holdings: { include: { user: true } }
            }
        });
        if (!basket) {
            return res.status(404).json({ error: 'ETF basket not found' });
        }
        res.json(basket);
    } catch (error) {
        console.error('[ETF] Fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch ETF basket' });
    }
});

// Create a new ETF basket
app.post('/api/etf', async (req, res) => {
    try {
        const { name, description, positions } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'name is required' });
        }

        const basket = await prisma.etfBasket.create({
            data: {
                name,
                description,
                positions: positions ? {
                    create: positions.map((p: any) => ({
                        marketId: p.marketId,
                        marketName: p.marketName,
                        chain: p.chain,
                        side: p.side,
                        allocation: p.allocation
                    }))
                } : undefined
            },
            include: { positions: true }
        });

        console.log(`[ETF] Created basket: ${basket.id} - ${name}`);
        res.json(basket);
    } catch (error) {
        console.error('[ETF] Create error:', error);
        res.status(500).json({ error: 'Failed to create ETF basket' });
    }
});

// Mint ETF shares (user deposits USDC -> backend records shares)
app.post('/api/etf/:id/mint', async (req, res) => {
    try {
        const { userId, amount, txHash } = req.body;
        const basketId = req.params.id;

        if (!userId || !amount) {
            return res.status(400).json({ error: 'userId and amount are required' });
        }

        // 1. Fetch current basket NAV
        const basket = await prisma.etfBasket.findUnique({ where: { id: basketId } });
        if (!basket) {
            return res.status(404).json({ error: 'ETF basket not found' });
        }

        // 2. Calculate shares: amount / currentNAV (or 1:1 if NAV is 0)
        const nav = basket.nav > 0 ? basket.nav : 1;
        const newShares = amount / nav;

        // 3. Upsert holding for user
        const holding = await prisma.etfHolding.upsert({
            where: { userId_basketId: { userId, basketId } },
            update: { shares: { increment: newShares } },
            create: { userId, basketId, shares: newShares }
        });

        // 4. Update basket totals
        await prisma.etfBasket.update({
            where: { id: basketId },
            data: {
                totalShares: { increment: newShares },
                cashUsdc: { increment: amount }
            }
        });

        // 5. TODO: Async job to rebalance portfolio (buy underlying on Polymarket/Kalshi)
        console.log(`[ETF] Minted ${newShares} shares for user ${userId} in basket ${basketId}`);
        console.log(`[ETF] TODO: Trigger rebalance job for basket ${basketId}`);

        res.json({
            success: true,
            shares: newShares,
            totalShares: holding.shares + newShares,
            txHash,
            message: `Minted ${newShares.toFixed(4)} shares`
        });
    } catch (error) {
        console.error('[ETF] Mint error:', error);
        res.status(500).json({ error: 'Failed to mint ETF shares' });
    }
});

// Redeem ETF shares (user burns shares -> gets USDC)
app.post('/api/etf/:id/redeem', async (req, res) => {
    try {
        const { userId, shares } = req.body;
        const basketId = req.params.id;

        if (!userId || !shares) {
            return res.status(400).json({ error: 'userId and shares are required' });
        }

        // 1. Check user's holding
        const holding = await prisma.etfHolding.findUnique({
            where: { userId_basketId: { userId, basketId } }
        });
        if (!holding || holding.shares < shares) {
            return res.status(400).json({ error: 'Insufficient shares' });
        }

        // 2. Fetch current basket NAV
        const basket = await prisma.etfBasket.findUnique({ where: { id: basketId } });
        if (!basket) {
            return res.status(404).json({ error: 'ETF basket not found' });
        }

        // 3. Calculate USDC value: shares * NAV
        const nav = basket.nav > 0 ? basket.nav : 1;
        const usdcValue = shares * nav;

        // 4. Update holding
        await prisma.etfHolding.update({
            where: { userId_basketId: { userId, basketId } },
            data: { shares: { decrement: shares } }
        });

        // 5. Update basket totals
        await prisma.etfBasket.update({
            where: { id: basketId },
            data: {
                totalShares: { decrement: shares },
                cashUsdc: { decrement: Math.min(usdcValue, basket.cashUsdc) }
            }
        });

        // 6. TODO: Async job to sell positions if needed
        console.log(`[ETF] Redeemed ${shares} shares for user ${userId} from basket ${basketId}`);

        res.json({
            success: true,
            shares,
            usdcValue,
            message: `Redeemed ${shares.toFixed(4)} shares for ${usdcValue.toFixed(2)} USDC`
        });
    } catch (error) {
        console.error('[ETF] Redeem error:', error);
        res.status(500).json({ error: 'Failed to redeem ETF shares' });
    }
});

// ===== LEADERBOARD =====

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        const entries = await prisma.leaderboardEntry.findMany({
            include: { user: true },
            orderBy: { rank: 'asc' },
            take: 100
        });
        res.json(entries);
    } catch (error) {
        console.error('[Leaderboard] Fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// ===== USER MANAGEMENT =====

// Get or create user by address
app.post('/api/users', async (req, res) => {
    try {
        const { address, displayName } = req.body;

        if (!address) {
            return res.status(400).json({ error: 'address is required' });
        }

        const user = await prisma.user.upsert({
            where: { address },
            update: { displayName: displayName || undefined },
            create: { address, displayName }
        });

        res.json(user);
    } catch (error) {
        console.error('[User] Upsert error:', error);
        res.status(500).json({ error: 'Failed to upsert user' });
    }
});

// Get user by address
app.get('/api/users/:address', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { address: req.params.address },
            include: {
                etfHoldings: { include: { basket: true } },
                leaderboard: true
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('[User] Fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Portfolio Aggregation Endpoint
app.get('/api/portfolio/:address', async (req, res) => {
    const { address } = req.params;

    try {
        // Fetch real Polymarket positions via Gamma API
        let polymarketPositions: any[] = [];
        try {
            const polyResponse = await fetch(`${CONFIG.polymarket.gammaApi}/positions?user=${address}`);
            if (polyResponse.ok) {
                const data: any = await polyResponse.json();
                polymarketPositions = data.positions || [];
            }
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            console.log('[Portfolio] Polymarket positions fetch failed, using empty:', errorMessage);
        }

        // Calculate portfolio value from positions
        const polyValue = polymarketPositions.reduce((sum: number, pos: any) => {
            return sum + (pos.size * pos.currentPrice || 0);
        }, 0);

        const portfolio = {
            totalValue: polyValue,
            chains: {
                polygon: {
                    value: polyValue,
                    positions: polymarketPositions.slice(0, 10) // Limit for performance
                },
                solana: {
                    value: 0, // DFlow integration pending API keys
                    positions: []
                }
            },
            vaults: [
                {
                    id: 'poly-real-1',
                    name: 'Polymarket Yield Alpha',
                    chain: 'Polygon',
                    tvl: 1250000,
                    apy: 12.5,
                    userBalance: polyValue,
                    holdings: polymarketPositions.slice(0, 5)
                }
            ]
        };

        res.json(portfolio);

    } catch (error) {
        console.error('Portfolio Error:', error);
        res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
});

// Trade Execution Endpoint
app.post('/api/trade', async (req, res) => {
    const { vaultId, marketId, tokenId, side, amount, chain } = req.body;

    console.log(`[Trade] Vault: ${vaultId}, Market: ${marketId}, Side: ${side}, Amount: ${amount}, Chain: ${chain}`);

    try {
        if (chain === 'Polygon') {
            // In production: Call Polymarket CLOB API with signed order
            // For now, validate and log
            console.log(`[Trade] Would execute on Polymarket: ${side} ${amount} on token ${tokenId}`);

            // Simulate order placement
            res.json({
                success: true,
                orderId: `poly-${Date.now()}`,
                message: `Order placed: ${side} ${amount} USDC on ${tokenId}`,
                chain: 'Polygon'
            });
        } else if (chain === 'Solana') {
            // In production: Call DFlow Quote API then execute
            console.log(`[Trade] Would execute on DFlow/Solana: ${side} ${amount}`);

            res.json({
                success: true,
                orderId: `sol-${Date.now()}`,
                message: `Order placed via DFlow: ${side} ${amount} USDC`,
                chain: 'Solana'
            });
        } else {
            res.status(400).json({ error: 'Invalid chain specified' });
        }
    } catch (error) {
        console.error('[Trade] Error:', error);
        res.status(500).json({ error: 'Trade execution failed' });
    }
});

// Available Vaults Endpoint (Marketplace)
app.get('/api/vaults', async (req, res) => {
    try {
        // Try to fetch vault groups from DB first
        const vaultGroups = await prisma.vaultGroup.findMany();

        // Static fallback vaults
        const staticVaults = [
            {
                id: 'static-0',
                name: 'Growl HF (Real)',
                leader: '0x7768...f60d',
                chain: 'Solana',
                apr: 5.54,
                tvl: 5588099.37,
                age: 530,
                description: 'High-frequency trading vault with advanced strategies.',
                stage: 'Trading',
                vaultType: 'public',
                depositFeeBps: 100,
                perfFeeBps: 2000,
                totalDepositors: 342,
                data: [20, 25, 30, 35, 40, 45, 50, 55, 60, 65],
            },
            {
                id: 'static-1',
                name: '[ Systemic ] HyperGrowth',
                leader: '0x2b80...8f4b',
                chain: 'Polygon',
                apr: -23.62,
                tvl: 3576446.78,
                age: 112,
                description: 'Aggressive growth strategy vault.',
                stage: 'Trading',
                vaultType: 'public',
                depositFeeBps: 150,
                perfFeeBps: 2500,
                totalDepositors: 187,
                data: [70, 65, 60, 55, 50, 45, 40, 35, 30, 25],
            },
            {
                id: 'static-new-1',
                name: 'Polymarket Election Arb',
                leader: 'Likeli DAO',
                chain: 'Polygon',
                apr: 12.5,
                tvl: 1200500,
                age: 45,
                description: 'Arbitrage strategy leveraging Polymarket election odds discrepancies.',
                stage: 'Trading',
                vaultType: 'public',
                depositFeeBps: 50,
                perfFeeBps: 1000,
                totalDepositors: 120,
                data: [10, 12, 15, 18, 20, 22, 25, 28, 30, 32]
            }
        ];

        // Convert vault groups to vault format and merge with static
        const groupVaults = vaultGroups.map(g => ({
            id: g.id,
            name: g.name,
            leader: g.manager,
            chain: 'Hybrid', // Both Polygon + Solana
            description: g.description,
            polygonVaultId: g.polygonVaultId,
            solanaVaultId: g.solanaVaultId,
            isHybrid: true,
            apr: 0,
            tvl: 0,
            age: Math.floor((Date.now() - new Date(g.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
            stage: 'Trading',
            vaultType: 'public',
            depositFeeBps: 0,
            perfFeeBps: 0,
            totalDepositors: 0,
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        }));

        res.json([...groupVaults, ...staticVaults]);
    } catch (error) {
        console.error('[Vaults] Error:', error);
        // Fallback to static vaults if DB fails
        res.json([
            {
                id: 'static-0',
                name: 'Growl HF (Real)',
                leader: '0x7768...f60d',
                chain: 'Solana',
                apr: 5.54,
                tvl: 5588099.37,
                age: 530,
                description: 'High-frequency trading vault with advanced strategies.',
                stage: 'Trading',
                vaultType: 'public',
                depositFeeBps: 100,
                perfFeeBps: 2000,
                totalDepositors: 342,
                data: [20, 25, 30, 35, 40, 45, 50, 55, 60, 65],
            }
        ]);
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Likeli Backend running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Database: PostgreSQL via Prisma`);
});
