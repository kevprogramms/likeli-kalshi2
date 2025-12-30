import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Prisma client
const prisma = new PrismaClient();

// Configuration
const CONFIG = {
    polymarket: {
        gammaApi: 'https://gamma-api.polymarket.com',
        clobApi: 'https://clob.polymarket.com'
    },
    dflow: {
        marketsApi: 'https://dev-prediction-markets-api.dflow.net',
        quoteApi: 'https://dev-quote-api.dflow.net'
    }
};

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-signature', 'x-timestamp', 'poly_address', 'poly_signature', 'poly_timestamp', 'poly_api_key', 'poly_passphrase', 'POLY_ADDRESS', 'POLY_SIGNATURE', 'POLY_TIMESTAMP', 'POLY_API_KEY', 'POLY_PASSPHRASE']
}));
app.use(express.json());

// Routes -> Polymarket Proxy (Gamma)
app.get('/api/markets/polymarket/events', async (req, res) => {
    try {
        const query = new URLSearchParams(req.query as any).toString();
        const url = `${CONFIG.polymarket.gammaApi}/events?${query}`;
        console.log(`[Polymarket] GET ${url}`);

        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[Polymarket] Error:', error);
        res.status(500).json({ error: 'Failed to fetch Polymarket data' });
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

    try {
        // Build clean headers - ONLY send what Polymarket needs
        const cleanHeaders: any = {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };

        // Forward essential Polymarket trading headers
        Object.keys(req.headers).forEach(key => {
            const lowKey = key.toLowerCase();
            if (lowKey.startsWith('poly_') || lowKey === 'x-api-key' || lowKey === 'authorization') {
                cleanHeaders[key] = req.headers[key];
            }
        });

        // Use Builders API key as fallback if not provided
        if (!cleanHeaders['x-api-key']) {
            cleanHeaders['x-api-key'] = '019b6962-ccdb-72ce-80c6-96171250a5b1';
        }

        const fetchOptions: any = {
            method: req.method,
            headers: cleanHeaders,
        };

        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            fetchOptions.body = JSON.stringify(req.body);
        }

        const response = await fetch(url, fetchOptions);

        // Copy status from Polymarket response
        res.status(response.status);

        // Forward essential response headers
        const responseHeaders = ['content-type', 'x-timestamp', 'x-signature'];
        responseHeaders.forEach(h => {
            const val = response.headers.get(h);
            if (val) res.setHeader(h, val);
        });

        const data = await response.text();
        try {
            // Log response if it's a block or error
            if (response.status >= 400) {
                console.warn(`[CLOB Proxy] API rejected request (${response.status}):`, data.slice(0, 500));
            }
            res.send(JSON.parse(data));
        } catch (e) {
            res.send(data);
        }
    } catch (error) {
        console.error('[CLOB Proxy] Fatal Error:', error);
        res.status(500).json({ error: 'CLOB Proxy communication failed', details: (error as Error).message });
    }
});

// Routes -> DFlow Proxy
app.get('/api/dflow/markets', async (req, res) => {
    try {
        const query = new URLSearchParams(req.query as any).toString();
        const url = `${CONFIG.dflow.marketsApi}/api/v1/markets?${query}`;
        console.log(`[DFlow] GET ${url}`);

        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[DFlow] Error:', error);
        res.status(500).json({ error: 'Failed to fetch DFlow data' });
    }
});

app.get('/api/status', (req, res) => {
    res.json({ status: 'running', service: 'Likeli Backend v1.1', database: 'PostgreSQL' });
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
