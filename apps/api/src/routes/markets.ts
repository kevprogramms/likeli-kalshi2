import { Router } from 'express';
import { dflowAdapter } from '../adapters/dflow.js';

const router = Router();

// Polymarket Gamma API base URL
const GAMMA_API_URL = 'https://gamma-api.polymarket.com';

// GET /api/markets - List all markets
router.get('/', async (req, res) => {
    try {
        const markets = await dflowAdapter.getMarkets();
        res.json(markets);
    } catch (error) {
        console.error('Error fetching markets:', error);
        res.status(500).json({ error: 'Failed to fetch markets' });
    }
});

// GET /api/markets/polymarket/events - Proxy to Polymarket Gamma API
router.get('/polymarket/events', async (req, res) => {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const queryParams = new URLSearchParams({
                active: 'true',
                closed: 'false',
                limit: (req.query.limit as string) || '100',  // Reduced to avoid rate limiting
            });

            console.log(`Fetching Polymarket events (attempt ${attempt}/${maxRetries})...`);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch(`${GAMMA_API_URL}/events?${queryParams}`, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Likeli/1.0',
                },
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                console.error('Gamma API error:', response.status, response.statusText);
                return res.status(response.status).json({ error: 'Gamma API error' });
            }

            const events = await response.json();
            console.log(`Fetched ${(events as any[]).length} events from Polymarket`);
            return res.json(events);
        } catch (error) {
            lastError = error as Error;
            console.error(`Attempt ${attempt} failed:`, (error as Error).message);

            if (attempt < maxRetries) {
                // Wait before retry (exponential backoff)
                const waitMs = Math.pow(2, attempt) * 1000;
                console.log(`Waiting ${waitMs}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
            }
        }
    }

    console.error('All retries failed:', lastError?.message);
    res.status(503).json({ error: 'Polymarket API temporarily unavailable', retry: true });
});

// GET /api/markets/polymarket/markets - Proxy to Polymarket Gamma API markets
router.get('/polymarket/markets', async (req, res) => {
    try {
        const queryParams = new URLSearchParams({
            active: 'true',
            closed: 'false',
            limit: (req.query.limit as string) || '50',
        });

        console.log(`Fetching Polymarket markets from: ${GAMMA_API_URL}/markets?${queryParams}`);

        const response = await fetch(`${GAMMA_API_URL}/markets?${queryParams}`, {
            headers: {
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            console.error('Gamma API error:', response.status, response.statusText);
            return res.status(response.status).json({ error: 'Gamma API error' });
        }

        const markets = await response.json();
        console.log(`Fetched ${markets.length} markets from Polymarket`);
        res.json(markets);
    } catch (error) {
        console.error('Error fetching Polymarket markets:', error);
        res.status(500).json({ error: 'Failed to fetch Polymarket markets' });
    }
});

// GET /api/markets/polymarket/events/:slug - Get single event by slug
router.get('/polymarket/events/:slug', async (req, res) => {
    try {
        const response = await fetch(`${GAMMA_API_URL}/events/slug/${req.params.slug}`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = await response.json();
        res.json(event);
    } catch (error) {
        console.error('Error fetching Polymarket event:', error);
        res.status(500).json({ error: 'Failed to fetch Polymarket event' });
    }
});

// GET /api/markets/:id - Get market detail
router.get('/:id', async (req, res) => {
    try {
        const market = await dflowAdapter.getMarket(req.params.id);

        if (!market) {
            return res.status(404).json({ error: 'Market not found' });
        }

        res.json(market);
    } catch (error) {
        console.error('Error fetching market:', error);
        res.status(500).json({ error: 'Failed to fetch market' });
    }
});

// GET /api/markets/:id/price - Get current price
router.get('/:id/price', async (req, res) => {
    try {
        const price = await dflowAdapter.getPrice(req.params.id);
        res.json(price);
    } catch (error) {
        console.error('Error fetching price:', error);
        res.status(500).json({ error: 'Failed to fetch price' });
    }
});

// POST /api/markets/:id/quote - Get trade quote
router.post('/:id/quote', async (req, res) => {
    try {
        const { side, direction, amount } = req.body;

        if (!side || !direction || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const quote = await dflowAdapter.getQuote({
            marketId: req.params.id,
            side,
            direction,
            amount: parseFloat(amount),
        });

        res.json(quote);
    } catch (error) {
        console.error('Error getting quote:', error);
        res.status(500).json({ error: 'Failed to get quote' });
    }
});

export { router as marketRoutes };
