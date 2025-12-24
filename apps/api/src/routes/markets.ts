import { Router } from 'express';
import { dflowAdapter } from '../adapters/dflow.js';

const router = Router();

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
