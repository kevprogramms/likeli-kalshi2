// Vault types
export interface Vault {
    id: string;
    address: string;
    name: string;
    description?: string;
    manager: string;
    feeBps: number;
    tvl: string;
    nav: string;
    sharePrice: string;
    totalShares: string;
    createdAt: string;
}

export interface VaultDetail extends Vault {
    snapshots: Snapshot[];
    positions: Position[];
    trades: Trade[];
}

export interface Snapshot {
    timestamp: string;
    nav: string;
    sharePrice: string;
    tvl: string;
    totalShares?: string;
}

export interface Position {
    marketId: string;
    marketName?: string;
    side: 'YES' | 'NO';
    quantity: string;
    avgPrice: string;
    currentPrice?: string;
    unrealizedPnl?: string;
}

export interface Trade {
    id: string;
    txSig: string;
    marketId: string;
    marketName?: string;
    side: 'YES' | 'NO';
    direction: 'BUY' | 'SELL';
    quantity: string;
    price: string;
    fee: string;
    timestamp: string;
}

// Market types
export interface Market {
    id: string;
    ticker: string;
    title: string;
    description: string;
    category: string;
    status: 'open' | 'closed' | 'resolved';
    expiresAt: string;
    yesPrice: number;
    noPrice: number;
    volume24h: number;
    openInterest: number;
}

export interface MarketDetail extends Market {
    rules: string;
    resolutionSource: string;
    yesMint?: string;
    noMint?: string;
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

// API response types
export interface ApiResponse<T> {
    data?: T;
    error?: string;
}

// Utils
export function formatUSDC(amount: string | number, decimals = 6): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    const value = num / Math.pow(10, decimals);
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export function formatPercent(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
}

export function formatNumber(num: number): string {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toFixed(2);
}

export function shortenAddress(address: string, chars = 4): string {
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
