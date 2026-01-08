const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function fetchVaults() {
    const res = await fetch(`${API_URL}/vaults`);
    if (!res.ok) throw new Error('Failed to fetch vaults');
    return res.json();
}

export async function fetchVault(id: string) {
    const res = await fetch(`${API_URL}/vaults/${id}`);
    if (!res.ok) throw new Error('Failed to fetch vault');
    return res.json();
}

export async function createVault(data: {
    address: string;
    manager: string;
    name: string;
    description?: string;
    feeBps?: number;
}) {
    const res = await fetch(`${API_URL}/vaults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create vault');
    return res.json();
}

export async function fetchMarkets() {
    const res = await fetch(`${API_URL}/markets`);
    if (!res.ok) throw new Error('Failed to fetch markets');
    return res.json();
}

export async function fetchMarket(id: string) {
    const res = await fetch(`${API_URL}/markets/${id}`);
    if (!res.ok) throw new Error('Failed to fetch market');
    return res.json();
}

export async function getQuote(marketId: string, side: string, direction: string, amount: number) {
    const res = await fetch(`${API_URL}/markets/${marketId}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side, direction, amount }),
    });
    if (!res.ok) throw new Error('Failed to get quote');
    return res.json();
}
