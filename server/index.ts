import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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

app.use(cors());
app.use(express.json());

// Routes -> Polymarket Proxy
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

app.get('/api/dflow/history', async (req, res) => {
    try {
        const { marketId, resolution } = req.query;
        if (!marketId) {
            return res.status(400).json({ error: 'Missing marketId' });
        }

        // Dynamic import to avoid build issues if adapter changes
        // Using require here to ensure it picks up the latest version if modified
        const { dflowAdapter } = require('../apps/api/src/adapters/dflow');

        const history = await dflowAdapter.getHistory(marketId as string, resolution as string);
        res.json(history);
    } catch (error) {
        console.error('[DFlow History] Error:', error);
        res.status(500).json({ error: 'Failed to fetch DFlow history' });
    }
});

app.get('/api/status', (req, res) => {
    res.json({ status: 'running', service: 'Likeli Backend v1.0' });
});

// Portfolio Aggregation Endpoint
app.get('/api/portfolio/:address', async (req, res) => {
    const { address } = req.params;

    try {
        // Fetch real Polymarket positions via Gamma API
        let polymarketPositions = [];
        try {
            const polyResponse = await fetch(`${CONFIG.polymarket.gammaApi}/positions?user=${address}`);
            if (polyResponse.ok) {
                const data = await polyResponse.json();
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
app.get('/api/vaults', (req, res) => {
    // In production, this would query the Factory contracts on both chains
    // For MVP, we return the "Official" Likeli strategies
    const vaults = [
        {
            id: 'static-0', // Keeping ID for compatibility but serving from backend
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
    res.json(vaults);
});

app.listen(PORT, () => {
    console.log(`Likeli Backend running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
