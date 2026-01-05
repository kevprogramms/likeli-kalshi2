const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

// ================================================
// API Endpoints Configuration
// ================================================

// DFlow/Kalshi API (Solana) - Dev endpoints for testing
const DFLOW_MARKETS_API = 'https://dev-prediction-markets-api.dflow.net';
const DFLOW_QUOTE_API = 'https://dev-quote-api.dflow.net';

// Polymarket API (Polygon)
const POLYMARKET_GAMMA_API = 'https://gamma-api.polymarket.com';
const POLYMARKET_CLOB_API = 'https://clob.polymarket.com';

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ================================================
// POLYMARKET PROXY ROUTES (Polygon)
// ================================================

// Proxy Polymarket price history (CLOB API)
app.get('/api/markets/polymarket/prices-history', async (req, res) => {
    try {
        const { tokenId, interval, fidelity, startTs, endTs } = req.query;

        if (!tokenId) {
            return res.status(400).json({ error: 'tokenId is required' });
        }

        const params = new URLSearchParams({ market: tokenId });
        if (interval) params.append('interval', interval);
        if (fidelity) params.append('fidelity', fidelity);
        if (startTs) params.append('startTs', startTs);
        if (endTs) params.append('endTs', endTs);

        const url = `${POLYMARKET_CLOB_API}/prices-history?${params.toString()}`;
        console.log(`[Polymarket CLOB] Fetching price history: ${url}`);

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            timeout: 10000
        });

        if (!response.ok) {
            throw new Error(`Polymarket CLOB API error: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[Polymarket CLOB] Got ${data.history?.length || 0} price points`);
        res.json(data);
    } catch (error) {
        console.error('[Polymarket CLOB] Error:', error.message);
        res.status(500).json({ error: error.message, source: 'polymarket-clob' });
    }
});

// Proxy Polymarket events
app.get('/api/markets/polymarket/events', async (req, res) => {
    try {
        const queryString = new URLSearchParams(req.query).toString();
        const url = `${POLYMARKET_GAMMA_API}/events${queryString ? `?${queryString}` : ''}`;

        console.log(`[Polymarket] Fetching: ${url}`);

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            timeout: 10000
        });

        if (!response.ok) {
            throw new Error(`Polymarket API error: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[Polymarket] Got ${Array.isArray(data) ? data.length : 'object'} events`);
        res.json(data);
    } catch (error) {
        console.error('[Polymarket] Error:', error.message);
        res.status(500).json({ error: error.message, source: 'polymarket' });
    }
});

// Proxy Polymarket markets
app.get('/api/markets/polymarket/markets', async (req, res) => {
    try {
        const queryString = new URLSearchParams(req.query).toString();
        const url = `${POLYMARKET_GAMMA_API}/markets${queryString ? `?${queryString}` : ''}`;

        console.log(`[Polymarket] Fetching: ${url}`);

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            timeout: 10000
        });

        if (!response.ok) {
            throw new Error(`Polymarket API error: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[Polymarket] Got ${Array.isArray(data) ? data.length : 'object'} markets`);
        res.json(data);
    } catch (error) {
        console.error('[Polymarket] Error:', error.message);
        res.status(500).json({ error: error.message, source: 'polymarket' });
    }
});

// ================================================
// DFLOW/KALSHI PROXY ROUTES (Solana)
// ================================================

// Proxy DFlow events
app.get('/api/dflow/events', async (req, res) => {
    try {
        const queryString = new URLSearchParams(req.query).toString();
        const url = `${DFLOW_MARKETS_API}/api/v1/events${queryString ? `?${queryString}` : ''}`;

        console.log(`[DFlow] Fetching: ${url}`);

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (!response.ok) {
            throw new Error(`DFlow API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`[DFlow] Got events response`);
        res.json(data);
    } catch (error) {
        console.error('[DFlow] Error:', error.message);
        res.status(500).json({ error: error.message, source: 'dflow' });
    }
});

// Proxy DFlow markets
app.get('/api/dflow/markets', async (req, res) => {
    try {
        const queryString = new URLSearchParams(req.query).toString();
        const url = `${DFLOW_MARKETS_API}/api/v1/markets${queryString ? `?${queryString}` : ''}`;

        console.log(`[DFlow] Fetching: ${url}`);

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (!response.ok) {
            throw new Error(`DFlow API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`[DFlow] Got markets response`);
        res.json(data);
    } catch (error) {
        console.error('[DFlow] Error:', error.message);
        res.status(500).json({ error: error.message, source: 'dflow' });
    }
});

// Proxy DFlow quotes
app.get('/api/dflow/quote', async (req, res) => {
    try {
        const queryString = new URLSearchParams(req.query).toString();
        const url = `${DFLOW_QUOTE_API}/api/v1/quote${queryString ? `?${queryString}` : ''}`;

        console.log(`[DFlow] Fetching quote: ${url}`);

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (!response.ok) {
            throw new Error(`DFlow Quote API error: ${response.status}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[DFlow Quote] Error:', error.message);
        res.status(500).json({ error: error.message, source: 'dflow-quote' });
    }
});

// Generic DFlow proxy for any other endpoint
app.get('/api/dflow/:endpoint', async (req, res) => {
    try {
        const endpoint = '/' + req.params.endpoint;
        const queryString = new URLSearchParams(req.query).toString();
        const url = `${DFLOW_MARKETS_API}/api/v1${endpoint}${queryString ? `?${queryString}` : ''}`;

        console.log(`[DFlow] GET ${url}`);

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error('[DFlow] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ================================================
// STATUS ENDPOINT
// ================================================

app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
            polymarket: POLYMARKET_GAMMA_API,
            dflow: DFLOW_MARKETS_API,
            dflowQuote: DFLOW_QUOTE_API
        }
    });
});

// ================================================
// START SERVER
// ================================================

app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('  Likeli API Proxy Server');
    console.log('='.repeat(50));
    console.log(`  Running on: http://localhost:${PORT}`);
    console.log('');
    console.log('  Proxying:');
    console.log(`    Polymarket → ${POLYMARKET_GAMMA_API}`);
    console.log(`    DFlow      → ${DFLOW_MARKETS_API}`);
    console.log(`    DFlow Quote→ ${DFLOW_QUOTE_API}`);
    console.log('');
    console.log('  Test endpoints:');
    console.log(`    GET http://localhost:${PORT}/api/status`);
    console.log(`    GET http://localhost:${PORT}/api/markets/polymarket/events`);
    console.log(`    GET http://localhost:${PORT}/api/dflow/markets`);
    console.log('='.repeat(50));
    console.log('');
});
