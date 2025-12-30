import { Router } from 'express';
import { prisma } from '../db.js';
import { dflowAdapter } from '../adapters/dflow.js';

const router = Router();

// GET /api/funds - List all funds
router.get('/', async (req, res) => {
    try {
        const { stage, manager } = req.query;

        const where: any = {};
        if (stage) where.stage = stage;
        if (manager) where.manager = manager;

        const funds = await prisma.fund.findMany({
            where,
            include: {
                snapshots: {
                    orderBy: { timestamp: 'desc' },
                    take: 1,
                },
                _count: {
                    select: { depositors: true, trades: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });

        const formatted = funds.map(fund => {
            const latestSnapshot = fund.snapshots[0];
            return {
                id: fund.id,
                address: fund.address,
                fundId: fund.fundId,
                name: fund.name,
                symbol: fund.symbol,
                description: fund.description,
                manager: fund.manager,
                depositFeeBps: fund.depositFeeBps,
                perfFeeBps: fund.perfFeeBps,
                stage: fund.stage,
                tradingStartTs: fund.tradingStartTs?.toISOString(),
                tradingEndTs: fund.tradingEndTs?.toISOString(),
                tvl: latestSnapshot?.tvl?.toString() || '0',
                nav: latestSnapshot?.nav?.toString() || '0',
                sharePrice: latestSnapshot?.sharePrice?.toString() || '1000000',
                totalShares: latestSnapshot?.totalShares?.toString() || '0',
                depositorCount: fund._count.depositors,
                tradeCount: fund._count.trades,
                createdAt: fund.createdAt.toISOString(),
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('Error fetching funds:', error);
        res.status(500).json({ error: 'Failed to fetch funds' });
    }
});

// GET /api/funds/:id - Get fund detail
router.get('/:id', async (req, res) => {
    try {
        const fund = await prisma.fund.findUnique({
            where: { id: req.params.id },
            include: {
                snapshots: {
                    orderBy: { timestamp: 'desc' },
                    take: 100,
                },
                positions: {
                    where: { isOpen: true },
                },
                trades: {
                    orderBy: { timestamp: 'desc' },
                    take: 50,
                },
                depositors: {
                    orderBy: { shares: 'desc' },
                    take: 20,
                },
            },
        });

        if (!fund) {
            return res.status(404).json({ error: 'Fund not found' });
        }

        const latestSnapshot = fund.snapshots[0];

        res.json({
            id: fund.id,
            address: fund.address,
            fundId: fund.fundId,
            name: fund.name,
            symbol: fund.symbol,
            description: fund.description,
            manager: fund.manager,
            depositFeeBps: fund.depositFeeBps,
            perfFeeBps: fund.perfFeeBps,
            stage: fund.stage,
            tradingStartTs: fund.tradingStartTs?.toISOString(),
            tradingEndTs: fund.tradingEndTs?.toISOString(),
            initialAumUsdc: fund.initialAumUsdc?.toString(),
            perfFeeDueUsdc: fund.perfFeeDueUsdc?.toString(),
            perfFeePaid: fund.perfFeePaid,
            tvl: latestSnapshot?.tvl?.toString() || '0',
            nav: latestSnapshot?.nav?.toString() || '0',
            sharePrice: latestSnapshot?.sharePrice?.toString() || '1000000',
            totalShares: latestSnapshot?.totalShares?.toString() || '0',
            createdAt: fund.createdAt.toISOString(),
            snapshots: fund.snapshots.map(s => ({
                timestamp: s.timestamp.toISOString(),
                nav: s.nav.toString(),
                sharePrice: s.sharePrice.toString(),
                tvl: s.tvl.toString(),
                stage: s.stage,
            })),
            positions: fund.positions.map(p => ({
                marketId: p.marketId,
                marketName: p.marketName,
                side: p.side,
                quantity: p.quantity.toString(),
                avgPrice: p.avgPrice.toString(),
                currentPrice: p.currentPrice?.toString(),
                unrealizedPnl: p.unrealizedPnl?.toString(),
            })),
            trades: fund.trades.map(t => ({
                id: t.id,
                txSig: t.txSig,
                marketId: t.marketId,
                marketName: t.marketName,
                side: t.side,
                direction: t.direction,
                quantity: t.quantity.toString(),
                price: t.price.toString(),
                fee: t.fee.toString(),
                timestamp: t.timestamp.toISOString(),
            })),
            depositors: fund.depositors.map(d => ({
                wallet: d.wallet,
                shares: d.shares.toString(),
                deposited: d.deposited.toString(),
            })),
        });
    } catch (error) {
        console.error('Error fetching fund:', error);
        res.status(500).json({ error: 'Failed to fetch fund' });
    }
});

// POST /api/funds - Create fund (register in DB after on-chain creation)
router.post('/', async (req, res) => {
    try {
        const {
            address,
            fundId,
            manager,
            name,
            symbol,
            description,
            depositFeeBps,
            perfFeeBps,
            tradingStartTs,
            tradingEndTs,
        } = req.body;

        if (!address || !fundId || !manager || !name) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const fund = await prisma.fund.create({
            data: {
                address,
                fundId,
                manager,
                name,
                symbol: symbol || name.substring(0, 8).toUpperCase(),
                description: description || '',
                depositFeeBps: depositFeeBps || 0,
                perfFeeBps: perfFeeBps || 2000, // 20% default
                stage: 'Open',
                tradingStartTs: tradingStartTs ? new Date(tradingStartTs) : null,
                tradingEndTs: tradingEndTs ? new Date(tradingEndTs) : null,
            },
        });

        // Create initial snapshot
        await prisma.snapshot.create({
            data: {
                fundId: fund.id,
                nav: BigInt(0),
                sharePrice: BigInt(1_000_000), // 1 USDC
                tvl: BigInt(0),
                totalShares: BigInt(0),
                stage: 'Open',
            },
        });

        res.status(201).json({
            id: fund.id,
            address: fund.address,
            name: fund.name,
            stage: fund.stage,
        });
    } catch (error) {
        console.error('Error creating fund:', error);
        res.status(500).json({ error: 'Failed to create fund' });
    }
});

// POST /api/funds/:id/start-trading - Transition to Trading stage
router.post('/:id/start-trading', async (req, res) => {
    try {
        const { initialAumUsdc } = req.body;

        const fund = await prisma.fund.findUnique({
            where: { id: req.params.id },
        });

        if (!fund) {
            return res.status(404).json({ error: 'Fund not found' });
        }

        if (fund.stage !== 'Open') {
            return res.status(400).json({ error: 'Fund must be in Open stage' });
        }

        const updated = await prisma.fund.update({
            where: { id: req.params.id },
            data: {
                stage: 'Trading',
                initialAumUsdc: BigInt(initialAumUsdc || 0),
            },
        });

        res.json({
            id: updated.id,
            stage: updated.stage,
            initialAumUsdc: updated.initialAumUsdc?.toString(),
        });
    } catch (error) {
        console.error('Error starting trading:', error);
        res.status(500).json({ error: 'Failed to start trading' });
    }
});

// POST /api/funds/:id/end-trading - Transition to Settlement stage
router.post('/:id/end-trading', async (req, res) => {
    try {
        const fund = await prisma.fund.findUnique({
            where: { id: req.params.id },
        });

        if (!fund) {
            return res.status(404).json({ error: 'Fund not found' });
        }

        if (fund.stage !== 'Trading') {
            return res.status(400).json({ error: 'Fund must be in Trading stage' });
        }

        const updated = await prisma.fund.update({
            where: { id: req.params.id },
            data: { stage: 'Settlement' },
        });

        res.json({
            id: updated.id,
            stage: updated.stage,
        });
    } catch (error) {
        console.error('Error ending trading:', error);
        res.status(500).json({ error: 'Failed to end trading' });
    }
});

// POST /api/funds/:id/finalize - Transition to Closed stage
router.post('/:id/finalize', async (req, res) => {
    try {
        const { finalBalanceUsdc } = req.body;

        const fund = await prisma.fund.findUnique({
            where: { id: req.params.id },
        });

        if (!fund) {
            return res.status(404).json({ error: 'Fund not found' });
        }

        if (fund.stage !== 'Settlement') {
            return res.status(400).json({ error: 'Fund must be in Settlement stage' });
        }

        // Calculate performance fee
        const initialAum = Number(fund.initialAumUsdc || 0);
        const finalBalance = Number(finalBalanceUsdc || 0);
        const profit = Math.max(0, finalBalance - initialAum);
        const perfFee = Math.floor(profit * fund.perfFeeBps / 10000);

        const updated = await prisma.fund.update({
            where: { id: req.params.id },
            data: {
                stage: 'Closed',
                perfFeeDueUsdc: BigInt(perfFee),
            },
        });

        res.json({
            id: updated.id,
            stage: updated.stage,
            initialAumUsdc: fund.initialAumUsdc?.toString(),
            finalBalanceUsdc: finalBalanceUsdc.toString(),
            profit: profit.toString(),
            perfFeeDueUsdc: perfFee.toString(),
        });
    } catch (error) {
        console.error('Error finalizing fund:', error);
        res.status(500).json({ error: 'Failed to finalize fund' });
    }
});

// POST /api/funds/:id/trade - Execute trade (manager only)
router.post('/:id/trade', async (req, res) => {
    try {
        const { marketId, side, direction, amount } = req.body;

        const fund = await prisma.fund.findUnique({
            where: { id: req.params.id },
        });

        if (!fund) {
            return res.status(404).json({ error: 'Fund not found' });
        }

        if (fund.stage !== 'Trading') {
            return res.status(400).json({ error: 'Trading only allowed in Trading stage' });
        }

        // Get quote from DFlow
        const quote = await dflowAdapter.getQuote({
            marketId,
            side,
            direction,
            amount: parseFloat(amount),
            userPublicKey: fund.address,
        });

        // In production, would call buildTradeOrder and return transaction
        res.json({
            success: true,
            message: 'Trade quote generated (execution pending DFlow API integration)',
            quote,
            params: { marketId, side, direction, amount },
        });
    } catch (error) {
        console.error('Error executing trade:', error);
        res.status(500).json({ error: 'Failed to execute trade' });
    }
});

// POST /api/funds/:id/snapshot - Create snapshot (for indexer)
router.post('/:id/snapshot', async (req, res) => {
    try {
        const { nav, sharePrice, tvl, totalShares, stage } = req.body;

        const fund = await prisma.fund.findUnique({
            where: { id: req.params.id },
        });

        if (!fund) {
            return res.status(404).json({ error: 'Fund not found' });
        }

        const snapshot = await prisma.snapshot.create({
            data: {
                fundId: fund.id,
                nav: BigInt(nav),
                sharePrice: BigInt(sharePrice),
                tvl: BigInt(tvl),
                totalShares: BigInt(totalShares),
                stage: stage || fund.stage,
            },
        });

        res.status(201).json({
            id: snapshot.id,
            timestamp: snapshot.timestamp.toISOString(),
        });
    } catch (error) {
        console.error('Error creating snapshot:', error);
        res.status(500).json({ error: 'Failed to create snapshot' });
    }
});

// GET /api/funds/:id/depositors - Get fund depositors
router.get('/:id/depositors', async (req, res) => {
    try {
        const depositors = await prisma.depositor.findMany({
            where: { fundId: req.params.id },
            orderBy: { shares: 'desc' },
        });

        res.json(depositors.map(d => ({
            wallet: d.wallet,
            shares: d.shares.toString(),
            deposited: d.deposited.toString(),
            withdrawn: d.withdrawn.toString(),
        })));
    } catch (error) {
        console.error('Error fetching depositors:', error);
        res.status(500).json({ error: 'Failed to fetch depositors' });
    }
});

export { router as fundRoutes };
