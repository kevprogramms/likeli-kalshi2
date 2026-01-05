/**
 * Market Service
 * 
 * Unified service for fetching market data from multiple sources.
 * Currently supports:
 * - Polymarket (Gamma API)
 * - DFlow (existing adapter)
 */

import { polymarketAPI, polymarketTrader } from './polymarket.js';
import { dflowAPI } from './dflow.js';

const STORAGE_KEY = 'likeli_market_source';

class MarketService {
    constructor() {
        // Load saved preference or default to polymarket
        this.source = this.loadSource();
    }

    /**
     * Load source preference from localStorage
     */
    loadSource() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved || 'polymarket';
        } catch {
            return 'polymarket';
        }
    }

    /**
     * Save source preference to localStorage
     */
    saveSource(source) {
        try {
            localStorage.setItem(STORAGE_KEY, source);
        } catch (e) {
            console.warn('Could not save source preference:', e);
        }
    }

    /**
     * Get current source
     */
    getSource() {
        return this.source;
    }

    /**
     * Set market data source
     * @param {'polymarket' | 'dflow'} source 
     */
    setSource(source) {
        if (source !== 'polymarket' && source !== 'dflow') {
            console.warn('Invalid source:', source);
            return;
        }
        this.source = source;
        this.saveSource(source);
        console.log(`Market source set to: ${source}`);
    }

    /**
     * Get the current API instance
     */
    getAPI() {
        return this.source === 'polymarket' ? polymarketAPI : dflowAPI;
    }

    /**
     * Get events formatted for UI
     */
    async getEventsForUI(params = {}) {
        try {
            const api = this.getAPI();
            const result = await api.getEventsForUI(params);

            // Add source info to each event
            if (result.events) {
                result.events = result.events.map(event => ({
                    ...event,
                    source: this.source
                }));
            }

            return {
                ...result,
                source: this.source
            };
        } catch (error) {
            console.error(`Error fetching events from ${this.source}:`, error);
            return { events: [], total: 0, source: this.source };
        }
    }

    /**
     * Search markets
     */
    async searchMarkets(query) {
        const api = this.getAPI();
        if (api.searchMarkets) {
            return api.searchMarkets(query);
        }
        // Fallback: filter from all events
        const result = await this.getEventsForUI();
        return result.events.filter(e =>
            e.title.toLowerCase().includes(query.toLowerCase())
        );
    }

    /**
     * Get event by ID or slug
     */
    async getEventById(id) {
        if (this.source === 'polymarket') {
            return polymarketAPI.getEventBySlug(id);
        } else {
            // DFlow doesn't have individual event fetch
            const result = await dflowAPI.getEventsForUI();
            return result.events?.find(e => e.id === id) || null;
        }
    }

    /**
     * Check if current source supports real trading
     */
    supportsRealTrading() {
        return this.source === 'polymarket';
    }

    /**
     * Get trader instance (only for Polymarket)
     */
    getTrader() {
        if (this.source === 'polymarket') {
            return polymarketTrader;
        }
        return null;
    }

    /**
     * Check if wallet is connected for trading
     */
    isWalletConnected() {
        if (this.source === 'polymarket') {
            return polymarketTrader.isConnected();
        }
        return false;
    }

    /**
     * Connect wallet for trading
     */
    async connectWallet() {
        if (this.source === 'polymarket') {
            return polymarketTrader.connectWallet();
        }
        throw new Error('Real trading only supported with Polymarket');
    }

    /**
     * Initialize trading client
     */
    async initializeTrading() {
        if (this.source === 'polymarket') {
            return polymarketTrader.initialize();
        }
        throw new Error('Real trading only supported with Polymarket');
    }

    /**
     * Place a real order (Polymarket only)
     */
    async placeOrder(tokenId, side, price, size, options = {}) {
        if (this.source !== 'polymarket') {
            throw new Error('Real trading only supported with Polymarket');
        }
        return polymarketTrader.placeOrder(tokenId, side, price, size, options);
    }

    /**
     * Cancel an order
     */
    async cancelOrder(orderId) {
        if (this.source !== 'polymarket') {
            throw new Error('Real trading only supported with Polymarket');
        }
        return polymarketTrader.cancelOrder(orderId);
    }

    /**
     * Get open orders
     */
    async getOpenOrders() {
        if (this.source !== 'polymarket') {
            return [];
        }
        return polymarketTrader.getOpenOrders();
    }

    /**
     * Get portfolio data from backend
     */
    async getPortfolio(address) {
        try {
            const response = await fetch(`http://localhost:3001/api/portfolio/${address}`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching portfolio:', error);
            // Return empty structure on error to prevent crash
            return { totalValue: 0, vaults: [] };
        }
    }

    /**
     * Get available vaults from backend
     */
    async getVaults() {
        try {
            const response = await fetch('http://localhost:3001/api/vaults');
            if (!response.ok) throw new Error('Failed to fetch vaults');
            return await response.json();
        } catch (error) {
            console.error('Error fetching vaults:', error);
            // Fallback for demo
            return [];
        }
    }

    /**
     * Get single vault by ID
     */
    async getVault(id) {
        try {
            // For MVP, we fetch all and find (since we don't have a DB yet)
            const vaults = await this.getVaults();
            return vaults.find(v => v.id === id) || null;
        } catch (error) {
            console.error('Error fetching vault:', error);
            return null;
        }
    }
}

// Singleton instance
export const marketService = new MarketService();

export default marketService;
