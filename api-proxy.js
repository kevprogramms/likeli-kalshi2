const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
const PORT = 3001;

// Store market data from WebSocket
let eventsData = [];
let marketsData = [];
let liveData = {};
let wsConnected = false;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to DFlow WebSocket
function connectWebSocket() {
    console.log('Connecting to DFlow WebSocket...');

    const ws = new WebSocket('wss://prediction-markets-api.dflow.net/api/v1/ws');

    ws.on('open', () => {
        console.log('✓ WebSocket connected to DFlow!');
        wsConnected = true;

        // Subscribe to all events/markets updates
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'events' }));
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'markets' }));
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'trades' }));
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log('WS message:', message.type || 'data received');

            // Store the data based on type
            if (message.type === 'events' || message.events) {
                eventsData = message.events || message.data || message;
                console.log(`Got ${eventsData.length || 0} events`);
            } else if (message.type === 'markets' || message.markets) {
                marketsData = message.markets || message.data || message;
            } else if (message.type === 'trade' || message.type === 'price') {
                liveData[message.marketId || 'latest'] = message;
            } else {
                // Store any data we receive
                if (Array.isArray(message)) {
                    eventsData = message;
                    console.log(`Received array of ${message.length} items`);
                } else {
                    console.log('Unknown message type:', JSON.stringify(message).substring(0, 200));
                }
            }
        } catch (e) {
            console.log('WS parse error:', e.message);
        }
    });

    ws.on('error', (error) => {
        console.log('✗ WebSocket error:', error.message);
        wsConnected = false;
    });

    ws.on('close', () => {
        console.log('WebSocket closed, reconnecting in 5s...');
        wsConnected = false;
        setTimeout(connectWebSocket, 5000);
    });

    return ws;
}

// API routes - serve data from WebSocket
app.get('/api/events', (req, res) => {
    if (eventsData.length > 0) {
        res.json(eventsData);
    } else {
        res.json({
            error: 'No data yet - WebSocket connecting',
            connected: wsConnected
        });
    }
});

app.get('/api/markets', (req, res) => {
    if (marketsData.length > 0) {
        res.json(marketsData);
    } else {
        res.json({ markets: [], connected: wsConnected });
    }
});

app.get('/api/live_data', (req, res) => {
    res.json(liveData);
});

app.get('/api/status', (req, res) => {
    res.json({
        wsConnected,
        eventsCount: eventsData.length,
        marketsCount: marketsData.length,
        liveDataKeys: Object.keys(liveData).length
    });
});

// Start server and WebSocket
app.listen(PORT, () => {
    console.log(`Proxy at http://localhost:${PORT}`);
    console.log('Testing WebSocket connection...');
    connectWebSocket();
});
