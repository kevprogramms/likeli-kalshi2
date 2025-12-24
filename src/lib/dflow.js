/**
 * DFlow Prediction Markets API Adapter
 * 
 * API Endpoints:
 * - GET /events - List all events
 * - GET /markets - List all markets
 * - GET /trades - Get trade history
 * - GET /live_data - Live market data
 * - GET /series - Series data
 * - GET /tags_by_categories - Category tags
 * - GET /filters_by_sports - Sports filters
 * - GET /search - Search events
 * - WSS /ws - WebSocket for live updates
 */

const DFLOW_API_URL = 'http://localhost:3001/api';

class DFlowAPI {
    constructor(apiKey = null) {
        this.apiKey = apiKey;
        this.useMockData = true; // Using mock data - email hello@dflow.net for API access
    }

    async fetch(endpoint, options = {}) {
        if (this.useMockData) {
            return this.getMockData(endpoint);
        }

        const headers = {
            'Content-Type': 'application/json',
        };

        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const response = await fetch(`${DFLOW_API_URL}${endpoint}`, {
            ...options,
            headers: { ...headers, ...options.headers },
        });

        if (!response.ok) {
            throw new Error(`DFlow API error: ${response.status}`);
        }

        return response.json();
    }

    async getEvents(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.fetch(`/events${query ? `?${query}` : ''}`);
    }

    async getMarkets(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.fetch(`/markets${query ? `?${query}` : ''}`);
    }

    async getTrades(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.fetch(`/trades${query ? `?${query}` : ''}`);
    }

    async getLiveData() {
        return this.fetch('/live_data');
    }

    async getSeries() {
        return this.fetch('/series');
    }

    async getTagsByCategories() {
        return this.fetch('/tags_by_categories');
    }

    async getFiltersBySports() {
        return this.fetch('/filters_by_sports');
    }

    async search(query) {
        return this.fetch(`/search?q=${encodeURIComponent(query)}`);
    }

    // WebSocket connection
    connectWebSocket(onMessage) {
        const ws = new WebSocket('wss://prediction-markets-api.dflow.net/api/v1/ws');

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            onMessage(data);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        return ws;
    }

    // Mock data for development
    getMockData(endpoint) {
        const mockEvents = [
            {
                id: 'evt-nfl-week16-1',
                title: 'New England at Baltimore',
                category: 'Pro Football',
                status: 'open',
                endDate: '2024-12-22T18:00:00Z',
                volume: 1874290,
                markets: [
                    {
                        id: 'NE-BAL', title: 'Winner', outcomes: [
                            { name: 'NE', abbr: 'NE', price: 0.38, change: 0 },
                            { name: 'BAL', abbr: 'BAL', price: 0.63, change: 0 }
                        ]
                    }
                ]
            },
            {
                id: 'evt-nfl-week16-2',
                title: 'Buffalo at Cleveland',
                category: 'Pro Football',
                status: 'open',
                endDate: '2024-12-22T13:00:00Z',
                volume: 1313116,
                markets: [
                    {
                        id: 'BUF-CLE', title: 'Winner', outcomes: [
                            { name: 'BUF', abbr: 'BUF', price: 0.84, change: 0.02 },
                            { name: 'CLE', abbr: 'CLE', price: 0.17, change: -0.02 }
                        ]
                    }
                ]
            },
            {
                id: 'evt-nfl-week16-3',
                title: 'Pittsburgh at Detroit',
                category: 'Pro Football',
                status: 'open',
                endDate: '2024-12-22T13:00:00Z',
                volume: 709275,
                markets: [
                    {
                        id: 'PIT-DET', title: 'Winner', outcomes: [
                            { name: 'PIT', abbr: 'PIT', price: 0.26, change: 0 },
                            { name: 'DET', abbr: 'DET', price: 0.75, change: 0 }
                        ]
                    }
                ]
            },
            {
                id: 'evt-nfl-week16-4',
                title: 'Minnesota at New York G',
                category: 'Pro Football',
                status: 'open',
                endDate: '2024-12-22T13:00:00Z',
                volume: 635790,
                markets: [
                    {
                        id: 'MIN-NYG', title: 'Winner', outcomes: [
                            { name: 'MIN', abbr: 'MIN', price: 0.59, change: 0 },
                            { name: 'NYG', abbr: 'NYG', price: 0.43, change: 0 }
                        ]
                    }
                ]
            },
            {
                id: 'evt-nfl-champion',
                title: 'Pro Football Champion?',
                category: 'Pro Football',
                status: 'open',
                endDate: '2025-02-09T23:00:00Z',
                volume: 52716340,
                frequency: 'Annually',
                markets: [
                    {
                        id: 'NFL-CHAMP', title: 'Champion', outcomes: [
                            { name: 'Los Angeles R', price: 0.17, change: 0 },
                            { name: 'Seattle', price: 0.15, change: 0 },
                            { name: 'Detroit', price: 0.14, change: 0 },
                            { name: 'Kansas City', price: 0.12, change: 0 }
                        ]
                    }
                ]
            },
            {
                id: 'evt-cfb-champion',
                title: 'College Football Championship Winner?',
                category: 'College Football',
                status: 'open',
                endDate: '2025-01-20T23:00:00Z',
                volume: 24502174,
                frequency: 'Annually',
                markets: [
                    {
                        id: 'CFB-CHAMP', title: 'Champion', outcomes: [
                            { name: 'Ohio St.', price: 0.31, change: 0 },
                            { name: 'Indiana', price: 0.21, change: 0 },
                            { name: 'Texas', price: 0.18, change: 0 }
                        ]
                    }
                ]
            },
            {
                id: 'evt-nfl-coach',
                title: 'Who will be the next permanent Head Coach of...',
                category: 'Pro Football',
                status: 'open',
                endDate: '2025-02-28T23:00:00Z',
                volume: 11939335,
                markets: [
                    {
                        id: 'NFL-COACH', title: 'Next Coach', outcomes: [
                            { name: 'Kyle Whittingham', price: 0.25, change: 0 },
                            { name: 'Jedd Fisch', price: 0.12, change: 0 }
                        ]
                    }
                ]
            },
            {
                id: 'evt-philly-announce',
                title: 'What will the announcers say during the Philadelphia at...',
                category: 'Pro Football',
                status: 'open',
                endDate: '2024-12-22T20:00:00Z',
                volume: 784333,
                markets: [
                    {
                        id: 'PHI-ANNOUNCE', title: 'Announcer Says', outcomes: [
                            { name: 'Safety', price: 0.99, change: 0.05 },
                            { name: 'Wind / Windy', price: 0.03, change: -0.67 },
                            { name: 'One Handed', price: 0.01, change: 0 }
                        ]
                    }
                ]
            },
            {
                id: 'evt-avatar-rt',
                title: '"Avatar: Fire And Ash" Rotten Tomatoes score?',
                category: 'Culture',
                status: 'open',
                endDate: '2024-12-20T12:00:00Z',
                volume: 2855802,
                markets: [
                    {
                        id: 'AVATAR-RT', title: 'RT Score', outcomes: [
                            { name: 'Above 67', price: 0.76, change: 0 },
                            { name: 'Above 70', price: 0.06, change: 0 }
                        ]
                    }
                ]
            },
            {
                id: 'evt-epl-avl-mun',
                title: 'Aston Villa vs Manchester United',
                category: 'EPL',
                status: 'live',
                endDate: '2024-12-21T17:00:00Z',
                volume: 350405,
                isLive: true,
                markets: [
                    {
                        id: 'AVL-MUN', title: 'Match Result', outcomes: [
                            { name: 'AVL', abbr: 'AVL', price: 0.47, change: 0 },
                            { name: 'TIE', abbr: 'TIE', price: 0.22, change: 0 },
                            { name: 'MUN', abbr: 'MUN', price: 0.30, change: 0 }
                        ]
                    }
                ]
            },
            {
                id: 'evt-netflix-top',
                title: 'Top US Netflix show this week?',
                category: 'Culture',
                status: 'open',
                endDate: '2024-12-28T12:00:00Z',
                volume: 485232,
                frequency: 'Weekly',
                markets: [
                    {
                        id: 'NETFLIX-TOP', title: 'Top Show', outcomes: [
                            { name: 'Jake Paul vs. Ani', price: 0.94, change: 0 },
                            { name: 'Stranger Things 5', price: 0.01, change: 0 }
                        ]
                    }
                ]
            }
        ];

        const mockMarkets = mockEvents.flatMap(event =>
            event.markets.map(market => ({
                ...market,
                eventId: event.id,
                eventTitle: event.title,
                category: event.category,
                volume: event.volume,
                endDate: event.endDate,
                isLive: event.isLive || false
            }))
        );

        if (endpoint.includes('/events')) {
            return Promise.resolve({ events: mockEvents, total: mockEvents.length });
        }
        if (endpoint.includes('/markets')) {
            return Promise.resolve({ markets: mockMarkets, total: mockMarkets.length });
        }
        if (endpoint.includes('/live_data')) {
            return Promise.resolve({ events: mockEvents.filter(e => e.isLive) });
        }
        if (endpoint.includes('/tags_by_categories')) {
            return Promise.resolve({
                categories: [
                    { id: 'all', name: 'All', count: mockEvents.length },
                    { id: 'politics', name: 'Politics', count: 0 },
                    { id: 'sports', name: 'Sports', count: 8 },
                    { id: 'culture', name: 'Culture', count: 2 },
                    { id: 'crypto', name: 'Crypto', count: 0 },
                    { id: 'climate', name: 'Climate', count: 0 },
                    { id: 'economics', name: 'Economics', count: 0 },
                    { id: 'tech', name: 'Tech & Science', count: 0 },
                ]
            });
        }

        return Promise.resolve({ data: [] });
    }
}

export const dflowAPI = new DFlowAPI();
export default DFlowAPI;
