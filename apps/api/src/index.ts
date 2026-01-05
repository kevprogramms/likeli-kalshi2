import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fundRoutes } from './routes/funds.js';
import { marketRoutes } from './routes/markets.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/funds', fundRoutes);
app.use('/api/vaults', fundRoutes); // Backward compatibility alias
app.use('/api/markets', marketRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '2.0.0-likeli-funds',
    });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`🚀 Likeli Funds API running on http://localhost:${PORT}`);
    console.log('📚 Routes:');
    console.log('   GET  /api/funds          - List all funds');
    console.log('   GET  /api/funds/:id      - Get fund details');
    console.log('   POST /api/funds          - Register new fund');
    console.log('   POST /api/funds/:id/start-trading');
    console.log('   POST /api/funds/:id/end-trading');
    console.log('   POST /api/funds/:id/finalize');
    console.log('   POST /api/funds/:id/trade');
    console.log('   GET  /api/markets        - List prediction markets');
});

export default app;
