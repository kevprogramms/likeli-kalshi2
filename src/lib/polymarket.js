/**
 * Polymarket API Adapter
 * 
 * Provides two main services:
 * 1. Market Data via Gamma API (GraphQL)
 * 2. Trading via CLOB Client (on-chain orders on Polygon)
 * 
 * API Key: Uses Builders API key for authentication
 * Trading: Requires Web3 wallet connection for signing orders
 */

import { ClobClient, Side, OrderType } from '@polymarket/clob-client';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { ethers } from 'ethers';

// API Endpoints
const GAMMA_API_URL = 'https://gamma-api.polymarket.com';
const CLOB_HOST = 'https://clob.polymarket.com'; // Direct Polymarket CLOB API
const BUILDER_SIGNING_URL = 'http://localhost:3001/api/polymarket/sign'; // Backend signing endpoint
const CHAIN_ID = 137; // Polygon Mainnet

// Backend URL for data proxy
const BACKEND_API_URL = 'http://localhost:3001/api/markets/polymarket';

// Builders API Key (for reading markets)
const BUILDERS_API_KEY = '019b6962-ccdb-72ce-80c6-96171250a5b1';

// ============================================
// MARKET DATA API (Gamma API)
// ============================================

class PolymarketAPI {
    constructor() {
        this.baseUrl = GAMMA_API_URL;
    }

    /**
     * Fetch markets from backend proxy (Gamma API)
     */
    async getMarkets(params = {}) {
        try {
            const queryParams = new URLSearchParams({
                limit: params.limit || '50',
            });

            // Use backend proxy to bypass CORS
            const response = await fetch(`${BACKEND_API_URL}/markets?${queryParams}`, {
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (!response.ok) {
                const errorMsg = `Backend proxy error: ${response.status}`;
                console.error(errorMsg);
                throw new Error(errorMsg);
            }

            const markets = await response.json();
            console.log(`Polymarket: Fetched ${markets.length} real markets via proxy`);
            return markets;
        } catch (error) {
            console.error('Polymarket API error:', error);
            throw error;
        }
    }

    /**
     * Direct API call (fallback, may fail due to CORS in browser)
     */
    async getMarketsDirect(params = {}) {
        try {
            const queryParams = new URLSearchParams({
                active: 'true',
                closed: 'false',
                limit: params.limit || '50',
            });

            const response = await fetch(`${GAMMA_API_URL}/markets?${queryParams}`, {
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`Direct Gamma API error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Direct Gamma API failed:', error);
            throw error;
        }
    }

    /**
     * Fetch events from backend proxy (Gamma API)
     */
    async getEvents(params = {}) {
        try {
            const queryParams = new URLSearchParams({
                limit: params.limit || '50',
                active: 'true',   // Only fetch active/open markets
                closed: 'false',  // Exclude closed markets
            });

            // Use backend proxy to bypass CORS
            console.log('Fetching Polymarket events via backend proxy...');
            const response = await fetch(`${BACKEND_API_URL}/events?${queryParams}`, {
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (!response.ok) {
                console.error('Backend proxy error:', response.status);
                return [];
            }

            const events = await response.json();
            console.log(`Polymarket: Fetched ${events.length} real events via proxy`);
            return events;
        } catch (error) {
            console.error('Polymarket events error (trying direct):', error);
            // Fallback to direct API
            return this.getEventsDirect(params);
        }
    }

    /**
     * Direct API call for events (fallback)
     */
    async getEventsDirect(params = {}) {
        try {
            const queryParams = new URLSearchParams({
                active: 'true',
                closed: 'false',
                limit: params.limit || '20',
            });

            const response = await fetch(`${GAMMA_API_URL}/events?${queryParams}`, {
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error('Direct Gamma API events failed:', error);
            return [];
        }
    }

    /**
     * Get events formatted for UI (matches DFlow format)
     */
    async getEventsForUI(params = {}) {
        const events = await this.getEvents(params);

        if (!events || events.length === 0) {
            console.log('No events from Gamma API');
            return { events: [], total: 0, source: 'polymarket' };
        }

        // Transform to UI format
        const transformedEvents = events.map(event => this.transformEvent(event));

        return {
            events: transformedEvents,
            total: transformedEvents.length,
            source: 'polymarket'
        };
    }

    /**
     * Transform Polymarket event to UI format
     */
    transformEvent(event) {
        const markets = (event.markets || []).map(market => {
            // Parse JSON strings from API response
            let outcomePrices = null;  // Start with null to detect if we have real prices
            let outcomes = ['Yes', 'No'];
            let clobTokenIds = [];

            try {
                if (market.outcomePrices) {
                    outcomePrices = typeof market.outcomePrices === 'string'
                        ? JSON.parse(market.outcomePrices)
                        : market.outcomePrices;
                }
                if (market.outcomes) {
                    outcomes = typeof market.outcomes === 'string'
                        ? JSON.parse(market.outcomes)
                        : market.outcomes;
                }
                if (market.clobTokenIds) {
                    clobTokenIds = typeof market.clobTokenIds === 'string'
                        ? JSON.parse(market.clobTokenIds)
                        : market.clobTokenIds;
                }
            } catch (e) {
                console.error('Error parsing market data:', e);
            }

            // If no outcomePrices, try fallback sources
            if (!outcomePrices || outcomePrices.length === 0) {
                // Try lastTradePrice first (most recent actual trade)
                if (market.lastTradePrice !== undefined && market.lastTradePrice !== null) {
                    const yesPrice = parseFloat(market.lastTradePrice);
                    if (!isNaN(yesPrice) && yesPrice >= 0 && yesPrice <= 1) {
                        outcomePrices = [yesPrice.toString(), (1 - yesPrice).toString()];
                    }
                }
                // Try bestBid as fallback (current market price)
                else if (market.bestBid !== undefined && market.bestBid !== null && market.bestBid !== 0) {
                    const yesPrice = parseFloat(market.bestBid);
                    if (!isNaN(yesPrice) && yesPrice > 0 && yesPrice < 1) {
                        outcomePrices = [yesPrice.toString(), (1 - yesPrice).toString()];
                    }
                }
                // Final fallback
                if (!outcomePrices) {
                    outcomePrices = ['0.5', '0.5'];
                }
            }

            // Determine if market is resolved and which outcome won
            const isClosed = market.closed === true;
            const isResolved = isClosed && outcomePrices.some(p => parseFloat(p) >= 0.99 || parseFloat(p) <= 0.01);
            let winningOutcome = null;
            if (isResolved) {
                const winningIdx = outcomePrices.findIndex(p => parseFloat(p) >= 0.99);
                if (winningIdx !== -1) {
                    winningOutcome = outcomes[winningIdx];
                }
            }

            const formattedOutcomes = outcomes.map((name, idx) => {
                const rawPrice = outcomePrices[idx];
                // Use actual price from API, only default if truly undefined
                const price = rawPrice !== undefined ? parseFloat(rawPrice) : 0.5;
                return {
                    name,
                    abbr: name.substring(0, 3).toUpperCase(),
                    price: isNaN(price) ? 0.5 : price,
                    change: 0,
                    tokenId: clobTokenIds[idx] || null,
                    isWinner: isResolved && name === winningOutcome
                };
            });

            return {
                id: market.id || market.conditionId,
                title: market.question || market.title || event.title,
                outcomes: formattedOutcomes,
                volume: parseFloat(market.volume) || 0,
                // Status
                active: market.active !== false,
                closed: isClosed,
                resolved: isResolved,
                winningOutcome,
                // CLOB trading data
                clobTokenIds: clobTokenIds,
                conditionId: market.conditionId,
                questionId: market.questionId,
                tickSize: market.minimumTickSize || market.orderPriceMinTickSize?.toString() || '0.01',
                negRisk: market.negRisk || false,
                // Price movement data
                oneDayPriceChange: market.oneDayPriceChange || 0,
                oneHourPriceChange: market.oneHourPriceChange || 0,
            };
        });

        // Determine category from tags
        let category = 'Other';
        if (event.tags && Array.isArray(event.tags)) {
            const tagLabels = event.tags.map(t => t.label?.toLowerCase() || '').join(' ');
            if (tagLabels.includes('politic')) category = 'Politics';
            else if (tagLabels.includes('sport')) category = 'Sports';
            else if (tagLabels.includes('crypto') || tagLabels.includes('bitcoin')) category = 'Crypto';
            else if (tagLabels.includes('entertainment') || tagLabels.includes('culture')) category = 'Culture';
            else if (tagLabels.includes('science') || tagLabels.includes('ai') || tagLabels.includes('tech')) category = 'Tech & Science';
            else if (tagLabels.includes('business') || tagLabels.includes('finance') || tagLabels.includes('economy')) category = 'Economics';
        }

        // Event-level status - use EVENT's closed status, not individual markets
        // For multi-market events (like Super Bowl), individual markets can close (team eliminated)
        // but the overall event stays open until a winner is determined
        const isEventClosed = event.closed === true;

        // Only mark as resolved if the EVENT itself is closed AND has a clear winner
        // For multi-market events, resolved means the competition has ended
        const isEventResolved = isEventClosed && markets.some(m => m.resolved && m.winningOutcome === 'Yes');

        // Filter out closed sub-markets - only show markets that are still tradeable
        // Closed sub-markets (like expired date options, eliminated teams) should not be displayed
        const activeMarkets = markets.filter(m => !m.closed);

        // If all sub-markets are closed, keep them all for historical display
        const displayMarkets = activeMarkets.length > 0 ? activeMarkets : markets;

        return {
            id: event.id || event.slug,
            slug: event.slug,
            title: event.title,
            description: event.description,
            category,
            status: isEventClosed ? 'closed' : (event.active !== false ? 'open' : 'pending'),
            closed: isEventClosed,
            resolved: isEventResolved,
            endDate: event.endDate || event.resolutionDate,
            volume: event.volume || markets.reduce((sum, m) => sum + (m.volume || 0), 0),
            image: event.image || event.icon,
            markets: displayMarkets,
            totalMarkets: markets.length,  // Keep track of total for info
            activeMarkets: activeMarkets.length,  // Track how many are tradeable
            source: 'polymarket',
            // For detail page linking
            polymarketUrl: `https://polymarket.com/event/${event.slug}`,
            // Last update timestamp for live sync
            lastUpdated: new Date().toISOString(),
        };
    }

    /**
     * Search markets
     */
    async searchMarkets(query) {
        const markets = await this.getMarkets({ q: query });
        return markets;
    }

    /**
     * Get market by slug
     */
    async getEventBySlug(slug) {
        try {
            const response = await fetch(`${this.baseUrl}/events/slug/${slug}`, {
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) return null;

            const event = await response.json();
            return this.transformEvent(event);
        } catch (error) {
            console.error('Error fetching event by slug:', error);
            return null;
        }
    }

}


// ============================================
// TRADING CLIENT (CLOB)
// ============================================

// Contract Addresses (Polygon Mainnet)
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';
const NEG_RISK_ADAPTER = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296';

// Minimal ABIs for contract interactions
const USDC_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)'
];

const CTF_ABI = [
    'function isApprovedForAll(address owner, address operator) view returns (bool)',
    'function setApprovalForAll(address operator, bool approved) returns (bool)'
];

// Conditional Token contract address
const CONDITIONAL_TOKENS = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';

class PolymarketTrader {
    constructor() {
        this.client = null;
        this.signer = null;
        this.funder = null;
        this.isInitialized = false;
        this.provider = null;

        // Approval state
        this.usdcAllowance = 0;
        this.ctfApproved = false;
        this.negRiskCtfApproved = false;
    }

    /**
     * Check if wallet is connected
     */
    isConnected() {
        return this.isInitialized && this.signer !== null;
    }

    /**
     * Connect to Web3 wallet
     * @param {string} walletType - 'metamask', 'phantom', or undefined for auto-detect
     */
    async connectWallet(walletType = 'metamask') {
        if (typeof window === 'undefined') {
            throw new Error('No window object. Are you in a browser?');
        }

        // Select the correct provider based on wallet type
        let provider;
        if (walletType === 'phantom') {
            // Phantom injects at window.phantom.ethereum for EVM chains
            if (window.phantom?.ethereum) {
                provider = window.phantom.ethereum;
            } else if (window.solana?.isPhantom) {
                throw new Error('Phantom detected but EVM mode not available. Please enable Polygon in Phantom settings.');
            } else {
                throw new Error('Phantom wallet not detected. Please install Phantom.');
            }
        } else {
            // Explicitly find MetaMask - it has isMetaMask = true
            // When both Phantom and MetaMask are installed, window.ethereum might be Phantom
            if (window.ethereum?.providers) {
                // Multiple providers detected - find MetaMask specifically
                provider = window.ethereum.providers.find(p => p.isMetaMask && !p.isPhantom);
                if (!provider) {
                    throw new Error('MetaMask not found among wallet providers. Please install MetaMask.');
                }
            } else if (window.ethereum?.isMetaMask && !window.ethereum?.isPhantom) {
                // Single provider that is MetaMask (not Phantom pretending to be MetaMask)
                provider = window.ethereum;
            } else if (window.ethereum) {
                // Fallback - might be Phantom intercepting, warn user
                console.warn('window.ethereum detected but may not be MetaMask. Checking...');
                if (window.ethereum.isPhantom) {
                    throw new Error('Phantom is intercepting MetaMask. Please disable Phantom or use MetaMask browser profile.');
                }
                provider = window.ethereum;
            } else {
                throw new Error('MetaMask not detected. Please install MetaMask.');
            }
        }

        try {
            // Request account access
            const accounts = await provider.request({
                method: 'eth_requestAccounts'
            });

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found. Please connect your wallet.');
            }

            this.funder = accounts[0];
            this.selectedProvider = provider; // Store for later use

            // Check current network
            const chainIdHex = await provider.request({ method: 'eth_chainId' });
            const currentChainId = parseInt(chainIdHex, 16);

            // Switch to Polygon if not already on it
            if (currentChainId !== CHAIN_ID) {
                console.warn('Not on Polygon network. Switching...');
                await this.switchToPolygon(provider);
                // Wait a bit for the network switch to complete
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Create ethers provider and signer AFTER confirming Polygon network
            this.provider = new ethers.providers.Web3Provider(provider, 'any');
            this.signer = this.provider.getSigner();

            // Verify we're on Polygon
            const network = await this.provider.getNetwork();
            if (network.chainId !== CHAIN_ID) {
                throw new Error(`Please switch to Polygon network. Current: ${network.name}`);
            }

            console.log(`${walletType} wallet connected on Polygon:`, this.funder);
            return { address: this.funder, chainId: network.chainId };
        } catch (error) {
            console.error('Wallet connection error:', error);
            throw error;
        }
    }

    /**
     * Switch to Polygon network
     * @param {object} provider - The wallet provider to use (optional, defaults to selectedProvider or window.ethereum)
     */
    async switchToPolygon(provider = null) {
        const walletProvider = provider || this.selectedProvider || window.ethereum;
        try {
            await walletProvider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x89' }], // 137 in hex
            });
        } catch (switchError) {
            // If chain not added, add it
            if (switchError.code === 4902) {
                await walletProvider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x89',
                        chainName: 'Polygon Mainnet',
                        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
                        rpcUrls: ['https://polygon-rpc.com'],
                        blockExplorerUrls: ['https://polygonscan.com']
                    }]
                });
            } else {
                throw switchError;
            }
        }
    }

    /**
     * Initialize CLOB client with wallet
     */
    async initialize() {
        this.emitDebug('Trace', 'Init', 'Starting Initialization...');

        if (!this.signer || !this.funder) {
            this.emitDebug('Trace', 'Init', 'Connecting Wallet...');
            await this.connectWallet();
        }

        try {
            // Setup headers with Builders API key
            const headers = {
                'x-api-key': BUILDERS_API_KEY
            };

            // Derive or derivation of API credentials
            // This triggers the first signature request: "Sign this message to create your Polymarket API key"
            console.log('[Polymarket] Creating temp client for key derivation...');
            this.emitDebug('Trace', 'Init', 'Deriving API Key...');

            // Use proxy URL to bypass CORS - signature is based on request body, not URL
            const tempClient = new ClobClient(CLOB_HOST, CHAIN_ID, this.signer);

            let creds = null;
            try {
                console.log('[Polymarket] Calling createOrDeriveApiKey...');

                // Add execution timeout to prevent eternal hanging
                const derivationPromise = tempClient.createOrDeriveApiKey();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Auth Timeout')), 10000)
                );

                creds = await Promise.race([derivationPromise, timeoutPromise]);

                console.log('[Polymarket] createOrDeriveApiKey returned:', JSON.stringify(creds));
            } catch (derivationError) {
                console.warn('[Polymarket] createOrDeriveApiKey failed (will retry on trade):', derivationError.message);
                // Don't throw - let connection succeed, retry during trade
            }

            if (creds && creds.secret) {
                this.creds = creds; // Store for validation
                console.log('[Polymarket] Valid credentials stored');
            } else {
                console.warn('[Polymarket] Credentials empty/invalid - will retry during trade');
                this.creds = null;
            }

            // Configure BuilderConfig for remote signing (builder credentials stay on server)
            const builderConfig = new BuilderConfig({
                remoteBuilderConfig: {
                    url: BUILDER_SIGNING_URL
                }
            });

            // Use signature type 0 (EOA) for standard browser wallets with builder attribution
            this.client = new ClobClient(
                CLOB_HOST, // Use proxy to bypass CORS
                CHAIN_ID,
                this.signer,
                creds || undefined,
                0, // EOA signature type for MetaMask/browser wallets
                this.funder,
                undefined, // no custom headers
                false,
                builderConfig // Builder config for order attribution
            );

            // Note: T&Cs and registration are handled by createOrDeriveApiKey in newer SDK versions
            // The SDK handles these automatically when deriving API keys
            console.log('[Polymarket] Skipping legacy T&C/registration checks (handled by SDK)');

            this.isInitialized = true;
            console.log('Polymarket CLOB client initialized');
            this.emitDebug('Trace', 'Init', 'Initialization Complete');

            return { success: true, address: this.funder };
        } catch (error) {
            console.error('Polymarket initialization error:', error);
            this.emitDebug('Error', 'Init Failed', error.message);
            this.isInitialized = false;
            throw error;
        }
    }

    /**
     * Get order book for a token
     */
    async getOrderBook(tokenId) {
        if (!this.isInitialized) {
            throw new Error('CLOB client not initialized');
        }

        try {
            const book = await this.client.getOrderBook(tokenId);
            return book;
        } catch (error) {
            console.error('Error fetching order book:', error);
            throw error;
        }
    }

    // ============================================
    // USDC & CTF APPROVAL METHODS
    // ============================================

    /**
     * Get USDC balance for connected wallet
     * Checks both bridged USDC.e and native USDC
     * @returns {number} Balance in USDC (not wei)
     */
    async getUSDCBalance() {
        this.emitDebug('Trace', 'getUSDCBalance Started', 'Checking wallet balance...');
        console.log('getUSDCBalance called', {
            hasProvider: !!this.provider,
            funder: this.funder,
            selectedProvider: !!this.selectedProvider
        });

        if (!this.provider || !this.funder) {
            console.error('getUSDCBalance: No provider or funder');
            this.emitDebug('Trace', 'getUSDCBalance Failed', 'No provider');
            return 0;
        }

        try {
            // Verify network
            this.emitDebug('Trace', 'Checking Network', 'Getting chain ID...');
            const network = await this.provider.getNetwork();
            console.log('Current network:', network);
            this.emitDebug('Trace', 'Network Checked', `ChainId: ${network.chainId}`);

            if (network.chainId !== 137) {
                console.warn('Not on Polygon! ChainId:', network.chainId);
                this.emitDebug('Trace', 'Wrong Network', `ChainId: ${network.chainId}`);
            }

            // Bridged USDC.e (used by Polymarket)
            const USDC_E_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
            // Native USDC on Polygon
            const USDC_NATIVE_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';

            const usdcE = new ethers.Contract(USDC_E_ADDRESS, USDC_ABI, this.provider);
            const usdcNative = new ethers.Contract(USDC_NATIVE_ADDRESS, USDC_ABI, this.provider);

            console.log('Fetching balances for:', this.funder);
            this.emitDebug('Trace', 'Fetching Balances', `Address: ${this.funder}`);

            const [balanceE, balanceNative] = await Promise.all([
                usdcE.balanceOf(this.funder).catch((e) => {
                    console.error('USDC.e balance error:', e.message);
                    return ethers.BigNumber.from(0);
                }),
                usdcNative.balanceOf(this.funder).catch((e) => {
                    console.error('Native USDC balance error:', e.message);
                    return ethers.BigNumber.from(0);
                })
            ]);

            const balanceEFloat = parseFloat(ethers.utils.formatUnits(balanceE, 6));
            const balanceNativeFloat = parseFloat(ethers.utils.formatUnits(balanceNative, 6));

            console.log('USDC Balances:', {
                address: this.funder,
                'USDC.e (Polymarket)': balanceEFloat,
                'Native USDC': balanceNativeFloat,
                total: balanceEFloat + balanceNativeFloat
            });

            this.emitDebug('Trace', 'getUSDCBalance Done', `Total: $${(balanceEFloat + balanceNativeFloat).toFixed(2)}`);

            return balanceEFloat + balanceNativeFloat;
        } catch (error) {
            console.error('Error getting USDC balance:', error);
            return 0; // Return 0 instead of throwing
        }
    }

    /**
     * Get MATIC balance for gas
     * @returns {number} Balance in MATIC
     */
    async getMaticBalance() {
        if (!this.provider || !this.funder) {
            throw new Error('Wallet not connected');
        }

        try {
            const balance = await this.provider.getBalance(this.funder);
            return parseFloat(ethers.utils.formatEther(balance));
        } catch (error) {
            console.error('Error getting MATIC balance:', error);
            throw error;
        }
    }

    /**
     * Check USDC allowance for a spender
     * @param {string} spender - Contract address to check allowance for
     * @returns {number} Allowance in USDC
     */
    async checkUSDCAllowance(spender = CTF_EXCHANGE) {
        if (!this.provider || !this.funder) {
            console.warn('checkUSDCAllowance: Wallet not connected');
            return 0;
        }

        try {
            console.log(`Checking allowance for ${this.funder} -> ${spender}`);
            const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, this.provider);
            const allowance = await usdc.allowance(this.funder, spender);
            const formatted = parseFloat(ethers.utils.formatUnits(allowance, 6));

            console.log(`Allowance result: ${formatted} USDC`);
            return formatted;
        } catch (error) {
            console.error('Error checking USDC allowance:', error);
            // Don't throw, just return 0 to be safe
            return 0;
        }
    }

    /**
     * Approve USDC spending for a contract
     * @param {string} spender - Contract address to approve
     * @param {number|string} amount - Amount to approve (or 'max' for unlimited)
     * @returns {object} Transaction result
     */
    async approveUSDC(spender = CTF_EXCHANGE, amount = 'max') {
        if (!this.signer || !this.funder) {
            throw new Error('Wallet not connected');
        }

        try {
            const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, this.signer);

            // Use max uint256 for unlimited approval, or convert amount to 6 decimals
            const approvalAmount = amount === 'max'
                ? ethers.constants.MaxUint256
                : ethers.utils.parseUnits(amount.toString(), 6);

            console.log(`Approving USDC for ${spender}...`);
            const tx = await usdc.approve(spender, approvalAmount);
            console.log('Approval tx hash:', tx.hash);

            // Wait for confirmation
            const receipt = await tx.wait();
            console.log('USDC approval confirmed');

            // Update cached allowance
            this.usdcAllowance = amount === 'max' ? Infinity : parseFloat(amount);

            return {
                success: true,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            console.error('Error approving USDC:', error);
            return {
                success: false,
                error: error.message || 'Failed to approve USDC'
            };
        }
    }

    /**
     * Check if CTF (Conditional Tokens) are approved for operator
     * @param {string} operator - Contract to check approval for
     * @returns {boolean} Approval status
     */
    async checkCTFApproval(operator = CTF_EXCHANGE) {
        if (!this.provider || !this.funder) {
            throw new Error('Wallet not connected');
        }

        try {
            const ctf = new ethers.Contract(CONDITIONAL_TOKENS, CTF_ABI, this.provider);
            const approved = await ctf.isApprovedForAll(this.funder, operator);
            return approved;
        } catch (error) {
            console.error('Error checking CTF approval:', error);
            throw error;
        }
    }

    /**
     * Approve CTF (Conditional Tokens) for operator
     * @param {string} operator - Contract to approve
     * @returns {object} Transaction result
     */
    async approveCTF(operator = CTF_EXCHANGE) {
        if (!this.signer || !this.funder) {
            throw new Error('Wallet not connected');
        }

        try {
            const ctf = new ethers.Contract(CONDITIONAL_TOKENS, CTF_ABI, this.signer);

            console.log(`Approving CTF for ${operator}...`);
            const tx = await ctf.setApprovalForAll(operator, true);
            console.log('CTF approval tx hash:', tx.hash);

            const receipt = await tx.wait();
            console.log('CTF approval confirmed');

            // Update cached state
            if (operator === CTF_EXCHANGE) {
                this.ctfApproved = true;
            } else if (operator === NEG_RISK_CTF_EXCHANGE) {
                this.negRiskCtfApproved = true;
            }

            return {
                success: true,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            console.error('Error approving CTF:', error);
            return {
                success: false,
                error: error.message || 'Failed to approve CTF'
            };
        }
    }

    /**
     * Check all required approvals for trading
     * @param {boolean} negRisk - Whether this is a neg-risk market
     * @returns {object} Approval status for all contracts
     */
    async checkAllApprovals(negRisk = false) {
        try {
            const usdcAllowance = await this.checkUSDCAllowance(CTF_EXCHANGE);
            const ctfApproved = await this.checkCTFApproval(CTF_EXCHANGE);

            let negRiskApprovals = {};
            if (negRisk) {
                negRiskApprovals = {
                    negRiskUsdcAllowance: await this.checkUSDCAllowance(NEG_RISK_CTF_EXCHANGE),
                    negRiskCtfApproved: await this.checkCTFApproval(NEG_RISK_CTF_EXCHANGE),
                    negRiskAdapterApproved: await this.checkCTFApproval(NEG_RISK_ADAPTER)
                };
            }

            console.log('checkAllApprovals result:', {
                usdcAllowance,
                ctfApproved,
                negRisk
            });

            return {
                usdcAllowance,
                ctfApproved,
                ...negRiskApprovals,
                allApproved: usdcAllowance > 0 && ctfApproved
            };
        } catch (error) {
            console.error('Error checking approvals:', error);
            throw error;
        }
    }

    /**
     * Set all required approvals for trading
     * @param {boolean} negRisk - Whether to also approve neg-risk contracts
     * @returns {object} Results of all approval transactions
     */
    async setAllApprovals(negRisk = false) {
        const results = {};

        // Approve USDC for main CTF Exchange
        results.usdcApproval = await this.approveUSDC(CTF_EXCHANGE, 'max');

        // Approve CTF for main Exchange
        results.ctfApproval = await this.approveCTF(CTF_EXCHANGE);

        if (negRisk) {
            // Approve for neg-risk contracts
            results.negRiskUsdcApproval = await this.approveUSDC(NEG_RISK_CTF_EXCHANGE, 'max');
            results.negRiskCtfApproval = await this.approveCTF(NEG_RISK_CTF_EXCHANGE);
            results.negRiskAdapterApproval = await this.approveCTF(NEG_RISK_ADAPTER);
        }

        return results;
    }

    /**
     * Place an order on the CLOB
     * @param {string} tokenId - The token ID to trade
     * @param {string} side - 'BUY' or 'SELL'
     * @param {number} price - Price per share (0.01 to 0.99)
     * @param {number} size - Number of shares
     * @param {object} options - Market options (tickSize, negRisk)
     * @param {string} orderType - 'GTC', 'FOK', or 'GTD'
     */
    /**
     * Test wallet connection by forcing a signature
     */
    async testWalletConnection() {
        try {
            this.emitDebug('Trace', 'Wallet Test', 'Requesting "Test" signature...');
            const msg = "Verifying Wallet Connection...";
            const sig = await this.signer.signMessage(msg);
            this.emitDebug('Trace', 'Wallet Test', 'Signature Received!');
            console.log('Wallet Test Signature:', sig);
            return true;
        } catch (err) {
            console.error('Wallet Test Failed:', err);
            this.emitDebug('Error', 'Wallet Test', 'Failed: ' + err.message);
            return false;
        }
    }

    /**
     * Place an order on the CLOB
     * Supports both legacy signature (Market object) and new signature (Token ID)
     */
    async placeOrder(arg1, arg2, arg3, arg4, arg5, arg6) {
        this.emitDebug('Trace', 'placeOrder Invoked', 'Checking arguments...');

        if (!this.isInitialized) {
            this.emitDebug('Trace', 'placeOrder', 'Triggering Initialization...');
            await this.initialize();
        }

        try {
            // Determine call signature
            let tokenId, side, price, size, options, orderType;

            if (typeof arg1 === 'string') {
                // EventDetail Signature: (tokenId, side, price, size, options, orderType)
                tokenId = arg1;
                side = arg2;
                price = arg3;
                size = arg4;
                options = arg5 || {};
                orderType = arg6 || 'FOK';
                this.emitDebug('Trace', 'Order Mode', 'Low-Level (TokenID)');
            } else {
                // Legacy Signature: (market, side, amountUsd, outcomeIndex)
                const market = arg1;
                const legacySide = arg2; // 'YES' or 'NO'
                const amountUsd = arg3;
                const outcomeIndex = arg4;

                this.emitDebug('Trace', 'Order Mode', 'High-Level (Market Obj)');

                side = 'BUY'; // Always buying
                price = legacySide === 'YES'
                    ? Number(market.outcomePrices[outcomeIndex])
                    : Number(market.outcomePrices[1 - outcomeIndex]);
                price = Math.max(0.01, Math.min(0.99, price));
                size = Number(amountUsd) / price;
                tokenId = market.clobTokenIds[outcomeIndex];
                options = {
                    tickSize: market.minimumTick || 0.01,
                    negRisk: market.negRisk || false
                };
                orderType = 'FOK';
            }

            this.emitDebug('Trace', 'placeOrder Prep', `Token: ${tokenId?.slice(0, 10)}..., Price: ${price}, Size: ${size}`);

            if (!tokenId) throw new Error('Token ID is required for trading');
            if (!this.client) throw new Error('Polymarket client not initialized');

            // Force L2 credentials if missing
            if (!this.creds) {
                console.log('Refreshing API Keys...');
                this.emitDebug('Trace', 'Auth', 'Deriving API Keys...');

                // Use tempClient for clean derivation (like in initialize)
                try {
                    console.log('Creating temp client for derivation in placeOrder...');
                    const tempClient = new ClobClient(CLOB_HOST, CHAIN_ID, this.signer);

                    const derivationPromise = tempClient.createOrDeriveApiKey();
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('AUTH_TIMEOUT')), 30000)
                    );

                    this.creds = await Promise.race([derivationPromise, timeoutPromise]);
                    console.log('Derived creds successfully:', this.creds ? 'Yes' : 'No');
                } catch (err) {
                    console.error('Key derivation failed:', err);
                    this.emitDebug('Error', 'Auth', 'Key derivation failed: ' + err.message);

                    // Provide clearer error messages based on failure type
                    if (err.message === 'AUTH_TIMEOUT' || err.message.includes('Timeout')) {
                        throw new Error('Authentication timeout. This may be due to geographic restrictions on Polymarket. Try using a VPN or check if Polymarket is available in your region.');
                    } else if (err.message.includes('rejected') || err.message.includes('denied')) {
                        throw new Error('Wallet signature rejected. Please approve the signature request to continue.');
                    } else if (err.message.includes('403') || err.message.includes('Forbidden')) {
                        throw new Error('Access denied by Polymarket. Your region may be restricted from trading.');
                    } else {
                        throw new Error(`Authentication failed: ${err.message}`);
                    }
                }

                // Re-initialize logic
                this.client = new ClobClient(
                    CLOB_HOST,
                    CHAIN_ID,
                    this.signer,
                    this.creds,
                    0,
                    this.funder,
                    { 'x-api-key': BUILDERS_API_KEY }
                );
                this.emitDebug('Trace', 'Auth', 'Client Re-initialized');
            }

            this.emitDebug('Trace', 'Signing Order', 'Waiting for wallet...');

            // Map Order Type
            let orderTypeEnum = OrderType.GTC; // Default
            if (orderType === 'FOK') orderTypeEnum = OrderType.FOK;
            if (orderType === 'GTD') orderTypeEnum = OrderType.GTD;

            // Call SDK
            const resp = await this.client.createAndPostOrder({
                tokenID: tokenId,
                price: Number(price),
                side: side === 'BUY' ? Side.BUY : Side.SELL,
                size: Number(size),
                feeRateBps: 0,
                nonce: 0
            }, options, orderTypeEnum);

            this.emitDebug('Trace', 'Order Placed!', `ID: ${resp.orderID || resp.order_id || 'N/A'}`);

            // Normalize Response
            const orderId = resp.orderID || resp.order_id || resp.id;
            if (!orderId && orderTypeEnum === OrderType.FOK && !resp.error) {
                console.warn('FOK Order returned no ID:', resp);
            }

            return {
                success: true,
                orderId: orderId || 'unknown',
                ...resp
            };
        } catch (error) {
            this.emitDebug('Error', 'placeOrder Failed', error.message);
            console.error('Polymarket Order Error:', error);

            // Extract meaningful error
            let msg = error.message;
            if (error.response?.data?.error) msg = error.response.data.error;

            return {
                success: false,
                error: msg
            };
        }
    }

    /**
     * Cancel an order
     */
    async cancelOrder(orderId) {
        if (!this.isInitialized) {
            throw new Error('CLOB client not initialized');
        }

        try {
            const result = await this.client.cancelOrder({ orderID: orderId });
            return { success: true, ...result };
        } catch (error) {
            console.error('Cancel order error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Cancel all orders for a market
     */
    async cancelAllOrders(marketId) {
        if (!this.isInitialized) {
            throw new Error('CLOB client not initialized');
        }

        try {
            const result = await this.client.cancelMarketOrders({ market: marketId });
            return { success: true, ...result };
        } catch (error) {
            console.error('Cancel all orders error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get open orders
     */
    async getOpenOrders() {
        if (!this.isInitialized) {
            throw new Error('CLOB client not initialized');
        }

        try {
            const orders = await this.client.getOpenOrders();
            return orders;
        } catch (error) {
            console.error('Get open orders error:', error);
            return [];
        }
    }

    /**
     * Get trade history
     */
    async getTradeHistory() {
        if (!this.isInitialized) {
            throw new Error('CLOB client not initialized');
        }

        try {
            const trades = await this.client.getTrades();
            return trades;
        } catch (error) {
            console.error('Get trades error:', error);
            return [];
        }
    }

    /**
     * Disconnect wallet
     */
    disconnect() {
        this.client = null;
        this.signer = null;
        this.funder = null;
        this.isInitialized = false;
        this.provider = null;
    }

    emitDebug(type, method, url) {
        try {
            window.dispatchEvent(new CustomEvent('RELAYER_DEBUG', {
                detail: { type, method, url, status: 'Trace' }
            }));
        } catch (e) { }
    }
}


// ============================================
// EXPORTS
// ============================================

// Singleton instances
export const polymarketAPI = new PolymarketAPI();
export const polymarketTrader = new PolymarketTrader();

// Export contract addresses for external use
export const CONTRACTS = {
    USDC: USDC_ADDRESS,
    CTF_EXCHANGE,
    NEG_RISK_CTF_EXCHANGE,
    NEG_RISK_ADAPTER,
    CONDITIONAL_TOKENS,
};

export default {
    api: polymarketAPI,
    trader: polymarketTrader,
    CHAIN_ID,
    CLOB_HOST,
    GAMMA_API_URL,
    CONTRACTS,
};
