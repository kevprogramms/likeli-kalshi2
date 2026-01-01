import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { marketService } from '../lib/marketService'
import { useLiveEvent, formatLastUpdated } from '../lib/useLiveMarkets'
import { useDemo } from '../lib/DemoContext'
import { useWallet } from '../lib/WalletContext'
// import { getYesPrice, getNoPrice, resetMarket, executeBuy } from '../lib/amm'
import { polymarketTrader } from '../lib/polymarket'
import { dflowAPI } from '../lib/dflow'
import { VersionedTransaction, Connection } from '@solana/web3.js' // Direct import
import TradeModal from '../components/TradeModal'
import WalletModal from '../components/WalletModal'
import './EventDetail.css'

function EventDetail() {
    const { id } = useParams()
    const [searchParams] = useSearchParams()
    const { userVaults, executeTrade, walletBalance, setWalletBalance, STAGE } = useDemo()

    // Wallet context for unified wallet management
    const {
        phantomConnected,
        metamaskConnected,
        getWalletForSource,
        connectPhantom,
        connectMetamask
    } = useWallet()

    // Live event data with auto-polling (5 second intervals for trading)
    const {
        event,
        loading,
        error,
        lastUpdated,
        refresh
    } = useLiveEvent(id, {
        enabled: true,
        fastMode: true,  // 5 second polling for trading view
    })

    const [selectedMarketIndex, setSelectedMarketIndex] = useState(0) // For multi-market events
    const [selectedOutcome, setSelectedOutcome] = useState(null)
    const [direction, setDirection] = useState('BUY') // BUY or SELL
    const [side, setSide] = useState('YES') // YES or NO
    const [usdcAmount, setUsdcAmount] = useState(100) // Changed from contracts to USDC amount
    const [selectedVaultId, setSelectedVaultId] = useState(searchParams.get('vault') || '')
    const [tradeMode, setTradeMode] = useState('individual') // 'individual' or 'vault'
    const [showTradeModal, setShowTradeModal] = useState(false)
    const [tradeSuccess, setTradeSuccess] = useState('')
    const [chartView, setChartView] = useState('YES') // Changed from 'Both' to 'YES'
    const [timeFilter, setTimeFilter] = useState('1D')
    const [userPositions, setUserPositions] = useState([]) // Track individual positions

    // Wallet state for real Polymarket trading
    const [walletConnected, setWalletConnected] = useState(false)
    const [trading, setTrading] = useState(false)
    const [showWalletModal, setShowWalletModal] = useState(false)

    // Order type and custom price
    const [orderType, setOrderType] = useState('MARKET') // 'MARKET' or 'LIMIT'
    const [customPrice, setCustomPrice] = useState('')

    // DFlow/Kalshi slippage setting (in basis points)
    const [slippageBps, setSlippageBps] = useState(100) // Default 1% (100 bps)
    const SLIPPAGE_OPTIONS = [
        { label: '0.5%', value: 50 },
        { label: '1%', value: 100 },
        { label: '2%', value: 200 },
        { label: '5%', value: 500 },
    ]

    // Order confirmation dialog
    const [showDFlowConfirmation, setShowDFlowConfirmation] = useState(false)
    const [pendingDFlowOrder, setPendingDFlowOrder] = useState(null)

    // Minimum trade amount (USD)
    const MIN_TRADE_AMOUNT = 1

    // Approval state
    const [usdcApproved, setUsdcApproved] = useState(false)
    const [ctfApproved, setCtfApproved] = useState(false)
    const [checkingApprovals, setCheckingApprovals] = useState(false)
    const [approvingUsdc, setApprovingUsdc] = useState(false)
    const [approvingCtf, setApprovingCtf] = useState(false)

    // Sticky approval state
    const manualUsdcApproval = useRef(false)
    const manualCtfApproval = useRef(false)

    // DEBUG LOGGING STATE
    const [debugLogs, setDebugLogs] = useState([])
    useEffect(() => {
        const handleDebug = (e) => {
            setDebugLogs(prev => [e.detail, ...prev].slice(0, 10))
        }
        window.addEventListener('RELAYER_DEBUG', handleDebug)
        return () => window.removeEventListener('RELAYER_DEBUG', handleDebug)
    }, [])

    const tradingVaults = userVaults.filter(v => v.stage === STAGE?.TRADING || v.stage === 'Trading')

    // Set initial selected outcome when event loads
    useEffect(() => {
        if (event?.markets?.[0]?.outcomes?.[0] && !selectedOutcome) {
            setSelectedOutcome(event.markets[0].outcomes[0])
        }
    }, [event, selectedOutcome])

    useEffect(() => {
        const vaultParam = searchParams.get('vault')
        if (vaultParam && tradingVaults.find(v => v.id === vaultParam)) {
            setSelectedVaultId(vaultParam)
            setTradeMode('vault')
        }
    }, [searchParams, tradingVaults])

    // Get current market based on selection
    const currentMarket = event?.markets?.[selectedMarketIndex] || event?.markets?.[0]
    const outcomes = currentMarket?.outcomes || []
    const isMultiMarket = (event?.markets?.length || 0) > 1

    const handleTrade = async () => {
        const marketId = currentMarket?.id || id
        const sideIndex = side === 'YES' ? 0 : 1
        const tokenId = outcomes[sideIndex]?.tokenId || currentMarket?.clobTokenIds?.[sideIndex]
        const marketPrice = outcomes[sideIndex]?.price || 0.5

        // Use custom price for limit orders, market price for market orders
        const price = orderType === 'LIMIT' && customPrice ? parseFloat(customPrice) : marketPrice

        // Check wallet connection
        if (!polymarketTrader.isConnected()) {
            setTradeSuccess('⚠️ Connect your wallet to trade. Click the Connect button.')
            setTimeout(() => setTradeSuccess(''), 4000)
            return
        }

        // Check if we have a valid token ID for trading
        if (!tokenId) {
            setTradeSuccess('⚠️ This market does not have trading tokens.')
            setTimeout(() => setTradeSuccess(''), 4000)
            return
        }

        // Check approvals
        if (!usdcApproved) {
            setTradeSuccess('⚠️ Please approve USDC before trading.')
            setTimeout(() => setTradeSuccess(''), 4000)
            return
        }

        // For sells, need CTF approval too
        if (direction === 'SELL' && !ctfApproved) {
            setTradeSuccess('⚠️ Please approve CTF before selling.')
            setTimeout(() => setTradeSuccess(''), 4000)
            return
        }

        setTrading(true)
        setTradeSuccess('Placing order on Polymarket...')

        try {
            // Check balances
            const usdcBalance = await polymarketTrader.getUSDCBalance()
            if (usdcBalance < usdcAmount) {
                setTradeSuccess(`⚠️ Insufficient USDC. You have $${usdcBalance.toFixed(2)}, need $${usdcAmount.toFixed(2)}`)
                setTrading(false)
                setTimeout(() => setTradeSuccess(''), 4000)
                return
            }

            // Calculate size based on USDC amount and price
            const size = usdcAmount / price

            // Define order type string early for logging
            const orderTypeStr = orderType === 'LIMIT' ? 'GTC' : 'FOK' // FOK = Fill-Or-Kill for market orders

            console.log('EventDetail: Placing order:', {
                tokenId,
                side: 'BUY',
                price,
                size,
                tickSize: currentMarket?.tickSize,
                negRisk: currentMarket?.negRisk,
                orderTypeStr
            });

            if (!tokenId) {
                console.error('EventDetail: Token ID is missing!');
                setTradeSuccess('❌ Error: Token ID missing for this market.');
                setTrading(false);
                return;
            }

            // Place real order on Polymarket CLOB
            const result = await polymarketTrader.placeOrder(
                tokenId,
                'BUY',
                price,
                size,
                {
                    tickSize: currentMarket?.tickSize || '0.01',
                    negRisk: currentMarket?.negRisk || false
                },
                orderTypeStr
            )

            if (result.success) {
                setTradeSuccess(`✅ Order placed on Polymarket! Order ID: ${result.orderId?.slice(0, 10)}...`)
                refresh()
                setTimeout(() => setTradeSuccess(''), 6000)
            } else {
                setTradeSuccess(`❌ Order failed: ${result.error}`)
                setTimeout(() => setTradeSuccess(''), 5000)
            }
        } catch (err) {
            console.error('Trade error:', err)
            setTradeSuccess(`❌ Trade failed: ${err.message}`)
            setTimeout(() => setTradeSuccess(''), 5000)
        } finally {
            setTrading(false)
        }
    }

    // Handle DFlow/Kalshi trade - Initial validation and confirmation
    const handleDFlowTrade = async () => {
        const marketId = currentMarket?.id || id
        const sideIndex = side === 'YES' ? 0 : 1
        const marketPrice = outcomes[sideIndex]?.price || 0.5

        // Validate minimum trade amount
        if (usdcAmount < MIN_TRADE_AMOUNT) {
            setTradeSuccess(`❌ Minimum trade amount is $${MIN_TRADE_AMOUNT}`)
            setTimeout(() => setTradeSuccess(''), 4000)
            return
        }

        // Check Phantom connection first
        if (!window.solana || !window.solana.isPhantom) {
            setTradeSuccess('❌ Phantom wallet not found. Install from phantom.app')
            setTimeout(() => setTradeSuccess(''), 4000)
            return
        }

        // Connect if not connected
        if (!window.solana.isConnected) {
            try {
                await window.solana.connect()
            } catch (err) {
                setTradeSuccess('❌ Failed to connect wallet. Please try again.')
                setTimeout(() => setTradeSuccess(''), 4000)
                return
            }
        }

        const walletAddress = window.solana.publicKey.toString()

        // Prepare order for confirmation
        const mints = currentMarket?.outcomeMints
        if (!mints || !mints.curr) {
            setTradeSuccess('❌ Market data not available. Try refreshing.')
            setTimeout(() => setTradeSuccess(''), 4000)
            return
        }

        const targetOutcomeMint = side === 'YES' ? mints.yes : mints.no
        const isBuy = direction === 'BUY'
        const amountAtomic = Math.floor(usdcAmount * 1_000_000).toString()

        // Store pending order and show confirmation
        setPendingDFlowOrder({
            marketId,
            side,
            direction,
            usdcAmount,
            marketPrice,
            slippageBps,
            walletAddress,
            mints,
            targetOutcomeMint,
            isBuy,
            amountAtomic
        })
        setShowDFlowConfirmation(true)
    }

    // Execute confirmed DFlow trade
    const executeDFlowTrade = async () => {
        if (!pendingDFlowOrder) return

        setShowDFlowConfirmation(false)
        setTrading(true)
        setTradeSuccess('Getting Order from DFlow...')

        const { walletAddress, mints, targetOutcomeMint, isBuy, amountAtomic, slippageBps: orderSlippage } = pendingDFlowOrder

        try {
            console.log(`[DFlow Trade] Wallet: ${walletAddress}`)

            const USDC_MINT = mints.curr

            const orderParams = {
                inputMint: isBuy ? USDC_MINT : targetOutcomeMint,
                outputMint: isBuy ? targetOutcomeMint : USDC_MINT,
                amount: amountAtomic,
                slippageBps: orderSlippage, // Use selected slippage
                userPublicKey: walletAddress
            };

            console.log('[DFlow Order] Params:', orderParams);

            // 1. Get Constructed Transaction from DFlow (Declarative Swap)
            const orderData = await dflowAPI.getDeclarativeOrder(orderParams);

            if (!orderData || !orderData.transaction) {
                throw new Error('No transaction returned from DFlow');
            }

            console.log('[DFlow Order] Transaction received');
            setTradeSuccess('Signing transaction in Phantom...');

            // 2. Deserialize Transaction
            const transactionBuffer = Buffer.from(orderData.transaction, "base64");
            const transaction = VersionedTransaction.deserialize(transactionBuffer);

            // 3. Sign & Send Transaction via Phantom (uses Phantom's RPC, avoids 403)
            // Phantom supports versioned transactions via signAndSendTransaction
            console.log('[DFlow Trade] Signing and Sending via Phantom...');
            const { signature } = await window.solana.signAndSendTransaction(transaction, {
                skipPreflight: false
            });

            console.log('[DFlow Trade] Signature:', signature);

            // Success! Phantom already confirmed the transaction was sent
            // We trust Phantom's signAndSendTransaction response
            setTradeSuccess(`✅ Trade Submitted! Tx: ${signature.slice(0, 8)}...`);

            // Background check for on-chain confirmation (after 5 seconds)
            const confirmCheckTimeout = setTimeout(async () => {
                try {
                    const isMainnet = mints.curr === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
                    const rpcUrl = isMainnet
                        ? 'https://api.mainnet-beta.solana.com'
                        : 'https://api.devnet.solana.com';
                    const connection = new Connection(rpcUrl, 'confirmed');

                    const status = await connection.getSignatureStatus(signature);
                    const confStatus = status?.value?.confirmationStatus;

                    if (confStatus === 'confirmed' || confStatus === 'finalized') {
                        setTradeSuccess(`✅ Trade Confirmed! Tx: ${signature.slice(0, 8)}...`);
                        // Keep confirmed message visible for 5 more seconds
                        setTimeout(() => setTradeSuccess(''), 5000);
                    } else {
                        // If not confirmed yet, show pending status
                        setTradeSuccess(`⏳ Confirming on-chain... Tx: ${signature.slice(0, 8)}...`);
                        setTimeout(() => setTradeSuccess(''), 8000);
                    }
                } catch (e) {
                    // On error, just clear the message (trade was still sent)
                    console.log('[DFlow] Confirmation check error:', e);
                    setTradeSuccess(`✅ Trade Sent! Check Solana Explorer for confirmation.`);
                    setTimeout(() => setTradeSuccess(''), 5000);
                }
            }, 5000); // Check after 5 seconds to give chain time

        } catch (err) {
            console.error('[DFlow Trade] Error:', err)
            // Only show error if it's actually a failure (not just confirmation timeout)
            const errorMsg = err.message || 'Unknown error';
            if (errorMsg.includes('User rejected') || errorMsg.includes('cancelled')) {
                setTradeSuccess(`⚠️ Trade cancelled by user`);
            } else {
                setTradeSuccess(`❌ Trade failed: ${errorMsg}`);
            }
            setTimeout(() => setTradeSuccess(''), 5000)
        } finally {
            setTrading(false)
            setPendingDFlowOrder(null)
        }
    }

    // Handle wallet selection from modal
    const handleWalletSelect = async (walletType) => {
        try {
            const walletName = walletType === 'metamask' ? 'MetaMask' : walletType === 'phantom' ? 'Phantom' : 'wallet'
            setTradeSuccess(`Connecting ${walletName}...`)

            if (walletType === 'metamask') {
                // MetaMask → Polygon for Polymarket trading
                await polymarketTrader.connectWallet('metamask')
                await polymarketTrader.initialize()
                setWalletConnected(true)
                setTradeSuccess(`✅ ${walletName} connected to Polygon! Ready to trade Polymarket.`)
                setTimeout(() => setTradeSuccess(''), 3000)
            } else if (walletType === 'phantom') {
                // Phantom → Solana for DFlow/Kalshi trading
                if (!window.solana || !window.solana.isPhantom) {
                    setTradeSuccess('❌ Phantom not found. Install from phantom.app')
                    setTimeout(() => setTradeSuccess(''), 4000)
                    throw new Error('Phantom wallet not detected')
                }

                // Connect to Solana (not Polygon!)
                const resp = await window.solana.connect()
                const solanaAddress = resp.publicKey.toString()
                console.log(`[Phantom] Connected to Solana: ${solanaAddress}`)

                setWalletConnected(true)
                setTradeSuccess(`✅ Phantom connected to Solana! Ready to trade Kalshi.`)
                setTimeout(() => setTradeSuccess(''), 3000)
            } else if (walletType === 'walletconnect') {
                // WalletConnect - not implemented yet
                setTradeSuccess('⚠️ WalletConnect coming soon!')
                setTimeout(() => setTradeSuccess(''), 3000)
                throw new Error('WalletConnect not implemented')
            }
        } catch (err) {
            setTradeSuccess(`❌ Connection failed: ${err.message}`)
            setTimeout(() => setTradeSuccess(''), 4000)
            throw err
        }
    }

    // Check wallet connection on mount and check approvals
    useEffect(() => {
        const checkWalletAndApprovals = async () => {
            const connected = polymarketTrader.isConnected();
            setWalletConnected(connected);

            if (connected) {
                await checkApprovalStatus();
            }

            // Also check Solana wallet connection for DFlow
            if (window.solana && window.solana.isConnected) {
                fetchSolanaPositions();
            }
        };
        checkWalletAndApprovals();
    }, [currentMarket]) // Re-run when market changes

    // Fetch Solana positions for DFlow markets
    const fetchSolanaPositions = async () => {
        if (!window.solana || !window.solana.publicKey || !currentMarket?.outcomeMints) return;

        try {
            const userKey = window.solana.publicKey.toString();
            // Determine RPC based on checks
            const isMainnet = currentMarket.outcomeMints.curr === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
            const rpcUrl = isMainnet
                ? 'https://api.mainnet-beta.solana.com'
                : 'https://api.devnet.solana.com';

            // Direct fetch to avoid importing Connection which might be heavy or not tree-shaken
            // Or just use the imported Connection class
            const connection = new Connection(rpcUrl, 'confirmed');

            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                window.solana.publicKey,
                { programId: new window.solana.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') } // standard SPL token program
            );

            // Map token accounts to outcomes
            const positions = [];
            const { yes, no } = currentMarket.outcomeMints;

            for (const { account } of tokenAccounts.value) {
                const mint = account.data.parsed.info.mint;
                const amount = account.data.parsed.info.tokenAmount.uiAmount;

                if (amount > 0) {
                    if (mint === yes) {
                        positions.push({ side: 'YES', amount, mint });
                    } else if (mint === no) {
                        positions.push({ side: 'NO', amount, mint });
                    }
                }
            }

            if (positions.length > 0) {
                console.log('Found user positions:', positions);
                setUserPositions(positions);
            }

        } catch (e) {
            console.error('Error fetching Solana positions:', e);
        }
    }

    // Check approval status
    const checkApprovalStatus = async () => {
        // Don't overwrite if we are currently currently approving to avoid race conditions
        if (approvingUsdc || approvingCtf) return;

        setCheckingApprovals(true);
        try {
            const approvals = await polymarketTrader.checkAllApprovals(currentMarket?.negRisk || false);

            // USDC Sticky Logic
            if (approvals.usdcApproved) {
                setUsdcApproved(true);
                manualUsdcApproval.current = true;
            } else if (!manualUsdcApproval.current) {
                setUsdcApproved(false);
            }

            // CTF Sticky Logic
            if (approvals.ctfApproved) {
                setCtfApproved(true);
                manualCtfApproval.current = true;
            } else if (!manualCtfApproval.current) {
                setCtfApproved(false);
            }
        } catch (error) {
            console.error('Failed to check approvals:', error);
        } finally {
            setCheckingApprovals(false);
        }
    };

    // Handle USDC approval
    // Handle USDC approval
    const handleApproveUSDC = async () => {
        setApprovingUsdc(true);
        setTradeSuccess('Approving USDC... Check your wallet');
        try {
            // 1. Send tx
            const result = await polymarketTrader.approveUSDC();

            if (!result.success) {
                throw new Error(result.error || 'Approval failed');
            }

            setTradeSuccess('Waitng for confirmation...');

            // 2. Wait and Verify
            // Small delay to let node index
            await new Promise(r => setTimeout(r, 2000));

            const allowance = await polymarketTrader.checkUSDCAllowance();
            console.log('Post-approval allowance:', allowance);

            if (allowance > 0) {
                setUsdcApproved(true);
                manualUsdcApproval.current = true; // Sticky!
                setTradeSuccess('✅ USDC approved!');
                setTimeout(() => setTradeSuccess(''), 3000);
            } else {
                setTradeSuccess('⚠️ Approval tx sent but allowance check failed. Trusting tx...');
                // Optimistically approve to verify flow
                setUsdcApproved(true);
                manualUsdcApproval.current = true; // Force sticky
            }

        } catch (error) {
            console.error('USDC approval error:', error);
            setTradeSuccess(`❌ Approval failed: ${error.message}`);
            setTimeout(() => setTradeSuccess(''), 4000);
        } finally {
            setApprovingUsdc(false);
        }
    };

    // Handle CTF approval
    const handleApproveCTF = async () => {
        setApprovingCtf(true);
        setTradeSuccess('Approving CTF...');
        try {
            const isNegRisk = currentMarket?.negRisk || false;
            if (isNegRisk) {
                await polymarketTrader.approveNegRiskCTF();
            } else {
                await polymarketTrader.approveCTF();
            }
            setCtfApproved(true);
            setTradeSuccess('✅ CTF approved!');
            setTimeout(() => setTradeSuccess(''), 3000);
        } catch (error) {
            console.error('CTF approval error:', error);
            setTradeSuccess(`❌ Approval failed: ${error.message}`);
            setTimeout(() => setTradeSuccess(''), 4000);
        } finally {
            setApprovingCtf(false);
        }
    };

    // Get prices - ALWAYS use API prices for Polymarket markets
    const getDisplayPrice = () => {
        // Always prioritize API prices from outcomes (Polymarket data)
        const apiYesPrice = outcomes[0]?.price
        const apiNoPrice = outcomes[1]?.price

        // If we have valid API prices, use them
        if (apiYesPrice !== undefined && apiYesPrice !== null) {
            return {
                yes: apiYesPrice,
                no: apiNoPrice !== undefined ? apiNoPrice : (1 - apiYesPrice)
            }
        }

        // Only fallback if no API data at all (shouldn't happen for Polymarket)
        console.warn('No API price data, using fallback')
        return { yes: 0.5, no: 0.5 }
    }

    if (loading) {
        return <div className="detail-loading">Loading...</div>
    }

    if (!event) {
        return <div className="detail-loading">Event not found</div>
    }

    // Get prices
    const prices = getDisplayPrice()
    const yesPrice = prices.yes
    const noPrice = prices.no
    const yesCents = (yesPrice * 100).toFixed(1)
    const noCents = (noPrice * 100).toFixed(1)

    // Calculate shares from USDC amount
    const currentPrice = side === 'YES' ? yesPrice : noPrice
    const calculatedShares = currentPrice > 0 ? (usdcAmount / currentPrice).toFixed(2) : '0.00'
    const totalCost = usdcAmount.toFixed(2)

    return (
        <div className="poly-detail">
            <Link to="/markets" className="poly-back">← Back to Markets</Link>

            <div className="poly-card">
                {/* Header Row */}
                <div className="poly-header">
                    <div className="poly-header-left">
                        {event.image ? (
                            <img src={event.image} alt="" className="poly-event-image" />
                        ) : (
                            <div className="poly-icon">◈</div>
                        )}
                        <div className="poly-title-area">
                            <h1>{event.title}</h1>
                            <div className="poly-meta">
                                <span className="poly-brand">{event.source === 'polymarket' ? 'POLYMARKET' : 'LIKELI'}</span>
                                {event.resolved ? (
                                    <span className="poly-resolved">✓ Resolved</span>
                                ) : event.closed ? (
                                    <span className="poly-closed">Closed</span>
                                ) : (
                                    <span className="poly-live">● Live</span>
                                )}
                                <span className="poly-sep">|</span>
                                <span className="poly-vol">Vol ${((event.volume || 0) / 1000).toFixed(0)}K</span>
                                {isMultiMarket && (
                                    <>
                                        <span className="poly-sep">|</span>
                                        <span className="poly-markets-count">{event.markets.length} markets</span>
                                    </>
                                )}
                                {/* External link to original market */}
                                {(event.kalshiUrl || event.polymarketUrl) && (
                                    <>
                                        <span className="poly-sep">|</span>
                                        <a
                                            href={event.kalshiUrl || event.polymarketUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="poly-external-link"
                                        >
                                            View on {event.kalshiUrl ? 'Kalshi' : 'Polymarket'} ↗
                                        </a>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="poly-header-right">
                        <div className="poly-price">{yesCents}¢</div>
                        <div className="poly-change positive">YES probability</div>
                    </div>
                </div>

                {/* Multi-Market Selector - Show when event has multiple markets */}
                {isMultiMarket && (
                    <div className="multi-market-selector">
                        <div className="market-selector-header">
                            <h3>Select a market to trade</h3>
                            <span className="market-count">{event.markets.length} options</span>
                        </div>
                        <div className="market-list">
                            {event.markets.map((market, idx) => {
                                const mktYesPrice = market.outcomes?.[0]?.price || 0.5
                                const isSelected = idx === selectedMarketIndex
                                return (
                                    <button
                                        key={market.id || idx}
                                        className={`market-option ${isSelected ? 'selected' : ''}`}
                                        onClick={() => setSelectedMarketIndex(idx)}
                                    >
                                        <div className="market-option-left">
                                            <span className="market-option-title">{market.title}</span>
                                        </div>
                                        <div className="market-option-right">
                                            <span className={`market-option-price ${mktYesPrice > 0.5 ? 'high' : 'low'}`}>
                                                {(mktYesPrice * 100).toFixed(0)}%
                                            </span>
                                            <span className="market-option-label">Yes</span>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Current Market Info (for multi-market events) */}
                {isMultiMarket && currentMarket && (
                    <div className="current-market-info">
                        <h2>{currentMarket.title}</h2>
                    </div>
                )}

                {/* Chart Controls */}
                <div className="poly-chart-controls">
                    <div className="poly-toggles">
                        {['YES', 'NO', 'Both'].map(v => (
                            <button key={v} className={chartView === v ? 'active' : ''} onClick={() => setChartView(v)}>
                                {v}
                            </button>
                        ))}
                    </div>
                    <div className="poly-times">
                        {['5M', '15M', '30M', '1H', '6H', '1D', '1W', '1M', 'MAX'].map(t => (
                            <button key={t} className={timeFilter === t ? 'active' : ''} onClick={() => setTimeFilter(t)}>
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chart Area - YES/NO Price Lines */}
                <div className="poly-chart" style={{ display: 'flex', position: 'relative' }}>
                    {/* Y-Axis Labels */}
                    <div className="poly-y-left" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '10px 8px', fontSize: '11px', color: '#888' }}>
                        <span>100%</span>
                        <span>50%</span>
                        <span>0%</span>
                    </div>

                    {/* Chart Area */}
                    <div className="poly-chart-area" style={{ flex: 1, position: 'relative', height: '200px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', overflow: 'hidden' }}>
                        {/* Grid lines */}
                        <div style={{ position: 'absolute', top: '25%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.05)' }} />
                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.1)' }} />
                        <div style={{ position: 'absolute', top: '75%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.05)' }} />

                        {/* "Now" indicator line at 80% */}
                        <div style={{
                            position: 'absolute',
                            left: '80%',
                            top: 0,
                            bottom: 0,
                            borderLeft: '1px dashed rgba(255,255,255,0.15)',
                            zIndex: 1
                        }} />
                        <span style={{
                            position: 'absolute',
                            left: '80%',
                            bottom: '5px',
                            transform: 'translateX(-50%)',
                            fontSize: '9px',
                            color: '#666'
                        }}>NOW</span>

                        {/* YES Price Line (Green) - ends at 80% with live dot */}
                        {(chartView === 'YES' || chartView === 'Both') && (
                            <>
                                {/* Trailing line */}
                                <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    width: '80%',
                                    top: `${(1 - yesPrice) * 100}%`,
                                    height: '2px',
                                    background: 'linear-gradient(90deg, rgba(16,185,129,0.2) 0%, #10b981 100%)',
                                    transition: 'top 0.3s ease'
                                }} />
                                {/* Live price dot */}
                                <div style={{
                                    position: 'absolute',
                                    left: '80%',
                                    top: `${(1 - yesPrice) * 100}%`,
                                    transform: 'translate(-50%, -50%)',
                                    width: '12px',
                                    height: '12px',
                                    background: '#10b981',
                                    borderRadius: '50%',
                                    boxShadow: '0 0 15px rgba(16, 185, 129, 0.8)',
                                    transition: 'top 0.3s ease',
                                    zIndex: 2
                                }} />
                                {/* Price label */}
                                <div style={{
                                    position: 'absolute',
                                    left: 'calc(80% + 20px)',
                                    top: `${(1 - yesPrice) * 100}%`,
                                    transform: 'translateY(-50%)',
                                    fontSize: '11px',
                                    color: '#10b981',
                                    fontWeight: 'bold',
                                    transition: 'top 0.3s ease'
                                }}>{(yesPrice * 100).toFixed(1)}%</div>
                            </>
                        )}

                        {/* NO Price Line (Red) - ends at 80% with live dot */}
                        {(chartView === 'NO' || chartView === 'Both') && (
                            <>
                                {/* Trailing line */}
                                <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    width: '80%',
                                    top: `${(1 - noPrice) * 100}%`,
                                    height: '2px',
                                    background: 'linear-gradient(90deg, rgba(239,68,68,0.2) 0%, #ef4444 100%)',
                                    transition: 'top 0.3s ease'
                                }} />
                                {/* Live price dot */}
                                <div style={{
                                    position: 'absolute',
                                    left: '80%',
                                    top: `${(1 - noPrice) * 100}%`,
                                    transform: 'translate(-50%, -50%)',
                                    width: '12px',
                                    height: '12px',
                                    background: '#ef4444',
                                    borderRadius: '50%',
                                    boxShadow: '0 0 15px rgba(239, 68, 68, 0.8)',
                                    transition: 'top 0.3s ease',
                                    zIndex: 2
                                }} />
                                {/* Price label */}
                                <div style={{
                                    position: 'absolute',
                                    left: 'calc(80% + 20px)',
                                    top: `${(1 - noPrice) * 100}%`,
                                    transform: 'translateY(-50%)',
                                    fontSize: '11px',
                                    color: '#ef4444',
                                    fontWeight: 'bold',
                                    transition: 'top 0.3s ease'
                                }}>{(noPrice * 100).toFixed(1)}%</div>
                            </>
                        )}

                        {/* Legend */}
                        <div className="poly-legend" style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '15px', fontSize: '12px' }}>
                            {(chartView === 'YES' || chartView === 'Both') && (
                                <span style={{ color: '#10b981' }}>● YES</span>
                            )}
                            {(chartView === 'NO' || chartView === 'Both') && (
                                <span style={{ color: '#ef4444' }}>● NO</span>
                            )}
                        </div>

                        {/* Timeframe note */}
                        <div style={{ position: 'absolute', bottom: '5px', left: '10px', fontSize: '9px', color: '#555' }}>
                            📊 Live price • Historical data coming soon
                        </div>
                    </div>
                </div>

                {/* Trade Section */}
                <div className="poly-trade">
                    <div className="poly-trade-tabs">
                        <button
                            className={direction === 'BUY' ? 'active' : ''}
                            onClick={() => setDirection('BUY')}
                        >
                            BUY
                        </button>
                        <button
                            className={direction === 'SELL' ? 'active' : ''}
                            onClick={() => setDirection('SELL')}
                        >
                            SELL
                        </button>
                        <div className="poly-levels">● 78 levels</div>
                    </div>

                    {/* User Positions Display */}
                    {userPositions.length > 0 && (
                        <div className="user-positions" style={{ padding: '10px', background: '#2C3E50', borderRadius: '8px', marginBottom: '10px' }}>
                            <div style={{ fontSize: '12px', color: '#BDC3C7', marginBottom: '5px' }}>YOUR POSITIONS</div>
                            {userPositions.map((pos, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#ECF0F1', fontWeight: 'bold' }}>
                                    <span style={{ color: pos.side === 'YES' ? '#00b894' : '#e17055' }}>
                                        {pos.side}
                                    </span>
                                    <span>{pos.amount} shares</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Order Type Toggle */}
                    <div className="poly-order-type-toggle">
                        <button
                            className={orderType === 'MARKET' ? 'active' : ''}
                            onClick={() => {
                                setOrderType('MARKET');
                                setCustomPrice('');
                            }}
                        >
                            Market
                        </button>
                        <button
                            className={orderType === 'LIMIT' ? 'active' : ''}
                            onClick={() => setOrderType('LIMIT')}
                        >
                            Limit
                        </button>
                    </div>

                    {/* Outcome Buttons - Support multi-outcome */}
                    <div className="poly-trade-row">
                        {outcomes.slice(0, 2).map((outcome, idx) => (
                            <button
                                key={idx}
                                className={`poly-outcome ${side === outcome.name.toUpperCase() ? 'active' : ''} ${idx === 0 ? 'yes' : 'no'}`}
                                onClick={() => setSide(outcome.name.toUpperCase())}
                            >
                                <span className="label">{outcome.name}</span>
                                <span className="value">{(outcome.price * 100).toFixed(1)}¢</span>
                            </button>
                        ))}

                        <div className="poly-input">
                            <label>PRICE</label>
                            {orderType === 'LIMIT' ? (
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max="0.99"
                                    value={customPrice}
                                    onChange={(e) => setCustomPrice(e.target.value)}
                                    placeholder={(side === 'YES' ? yesCents / 100 : noCents / 100).toFixed(2)}
                                    className="price-input"
                                />
                            ) : (
                                <span className="input-value">{side === 'YES' ? yesCents : noCents}¢</span>
                            )}
                        </div>
                        {/* USDC Amount Input */}
                        <div className="poly-input-group">
                            <div className="poly-input usdc-input">
                                <label>
                                    <span className="input-icon">💵</span>
                                    USDC AMOUNT
                                </label>
                                <div className="input-wrapper">
                                    <span className="currency-symbol">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={usdcAmount}
                                        onChange={(e) => setUsdcAmount(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {/* Calculated Shares Display */}
                            <div className="poly-input shares-display">
                                <label>
                                    <span className="input-icon">📊</span>
                                    SHARES
                                </label>
                                <div className="shares-value">
                                    <span className="shares-number">{calculatedShares}</span>
                                    <span className="shares-label">shares</span>
                                </div>
                            </div>
                        </div>
                        <div className="poly-input total">
                            <label>TOTAL</label>
                            <span className="total-value">${totalCost}</span>
                        </div>
                    </div>

                    {/* Action Row */}
                    <div className="poly-action">
                        <div className="trade-mode-toggle">
                            <button
                                className={tradeMode === 'individual' ? 'active' : ''}
                                onClick={() => setTradeMode('individual')}
                            >
                                💰 Individual (${walletBalance?.toFixed(0) || 0})
                            </button>
                            <button
                                className={tradeMode === 'vault' ? 'active' : ''}
                                onClick={() => setTradeMode('vault')}
                            >
                                🏦 Vault
                            </button>
                        </div>

                        {tradeMode === 'vault' && tradingVaults.length > 0 && (
                            <select value={selectedVaultId} onChange={(e) => setSelectedVaultId(e.target.value)}>
                                <option value="">Select vault...</option>
                                {tradingVaults.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                        )}

                        {/* DFlow/Kalshi markets - Require Phantom */}
                        {(event?.source === 'dflow' || event?.source === 'kalshi') ? (
                            !phantomConnected ? (
                                <button
                                    className="poly-execute connect-wallet phantom"
                                    onClick={connectPhantom}
                                    style={{ background: 'linear-gradient(135deg, #ab9ff2 0%, #7b68ee 100%)' }}
                                >
                                    👻 Connect Phantom to Trade
                                </button>
                            ) : (
                                /* Phantom connected - show slippage selector + trade button */
                                <>
                                    <div className="slippage-selector" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '12px', color: '#888' }}>Slippage:</span>
                                        {SLIPPAGE_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setSlippageBps(opt.value)}
                                                style={{
                                                    padding: '4px 8px',
                                                    fontSize: '11px',
                                                    border: slippageBps === opt.value ? '2px solid #10b981' : '1px solid #333',
                                                    background: slippageBps === opt.value ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    color: slippageBps === opt.value ? '#10b981' : '#888'
                                                }}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        className={`poly-execute ${side === 'YES' ? 'yes' : 'no'}`}
                                        disabled={trading}
                                        onClick={handleDFlowTrade}
                                    >
                                        {trading ? 'Trading via DFlow...' : `${direction} ${side} on Kalshi`}
                                    </button>
                                </>
                            )
                        ) : (
                            /* Polymarket markets - Require MetaMask */
                            !metamaskConnected ? (
                                <button
                                    className="poly-execute connect-wallet metamask"
                                    onClick={connectMetamask}
                                    style={{ background: 'linear-gradient(135deg, #f6851b 0%, #e2761b 100%)' }}
                                >
                                    🦊 Connect MetaMask to Trade
                                </button>
                            ) : !usdcApproved ? (
                                <button
                                    className="poly-execute approve-usdc"
                                    disabled={approvingUsdc || checkingApprovals}
                                    onClick={handleApproveUSDC}
                                >
                                    {approvingUsdc ? 'Approving USDC...' : checkingApprovals ? 'Checking...' : '✓ Approve USDC'}
                                </button>
                            ) : direction === 'SELL' && !ctfApproved ? (
                                <button
                                    className="poly-execute approve-ctf"
                                    disabled={approvingCtf || checkingApprovals}
                                    onClick={handleApproveCTF}
                                >
                                    {approvingCtf ? 'Approving CTF...' : checkingApprovals ? 'Checking...' : '✓ Approve CTF'}
                                </button>
                            ) : (
                                <button
                                    className={`poly-execute ${side === 'YES' ? 'yes' : 'no'}`}
                                    disabled={trading}
                                    onClick={handleTrade}
                                >
                                    {trading ? 'Placing Order...' : `${direction} ${side}`}
                                </button>
                            )
                        )}
                    </div>
                </div>
            </div>

            {tradeSuccess && <div className="poly-toast">{tradeSuccess}</div>}

            <TradeModal
                isOpen={showTradeModal}
                onClose={() => setShowTradeModal(false)}
                event={event}
                initialSide={side}
                vaultId={selectedVaultId}
                marketSource={marketService.getSource()}
            />

            <WalletModal
                isOpen={showWalletModal}
                onClose={() => setShowWalletModal(false)}
                onSelect={handleWalletSelect}
            />

            {/* FIXED DEBUG PANEL for EventDetail */}
            <div style={{
                position: 'fixed',
                bottom: '10px',
                right: '10px',
                width: '320px',
                zIndex: 999999,
                padding: '10px',
                background: 'rgba(0,0,0,0.95)',
                border: '1px solid #444',
                borderRadius: '8px',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#ccc',
                maxHeight: '250px',
                overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#fff', borderBottom: '1px solid #444', paddingBottom: '4px' }}>📡 DEBUGGER (INLINE TRADE)</div>
                {debugLogs.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>Waiting for network activity...</div>}
                {debugLogs.map((log, i) => (
                    <div key={i} style={{ borderBottom: '1px solid #222', padding: '4px 0', display: 'flex', alignItems: 'center' }}>
                        <span style={{
                            color: log.status === 'Success' ? '#4CAF50' : log.status === 'Failed' ? '#F44336' : '#FFC107',
                            fontWeight: 'bold', minWidth: '70px'
                        }}>
                            [{log.status}]
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '5px', flex: 1, minWidth: 0 }}>
                            <span style={{ color: '#fff' }}>{log.method} {log.type || ''}</span>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#888' }} title={log.url}>
                                {log.url && log.url.includes('/') ? log.url.split('/').pop().split('?')[0] : log.url}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* DFlow Order Confirmation Modal */}
            {showDFlowConfirmation && pendingDFlowOrder && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="modal-content" style={{
                        background: '#1a1a2e', padding: '24px', borderRadius: '12px', maxWidth: '400px', width: '90%',
                        border: '1px solid #333'
                    }}>
                        <h3 style={{ color: '#fff', marginBottom: '16px', fontSize: '18px' }}>Confirm Trade</h3>

                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#888' }}>
                                <span>Direction:</span>
                                <span style={{ color: pendingDFlowOrder.direction === 'BUY' ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                                    {pendingDFlowOrder.direction} {pendingDFlowOrder.side}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#888' }}>
                                <span>Amount:</span>
                                <span style={{ color: '#fff', fontWeight: 'bold' }}>${pendingDFlowOrder.usdcAmount}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#888' }}>
                                <span>Est. Price:</span>
                                <span style={{ color: '#fff' }}>{(pendingDFlowOrder.marketPrice * 100).toFixed(1)}¢</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#888' }}>
                                <span>Slippage:</span>
                                <span style={{ color: '#fbbf24' }}>{(pendingDFlowOrder.slippageBps / 100).toFixed(1)}%</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => { setShowDFlowConfirmation(false); setPendingDFlowOrder(null); }}
                                style={{
                                    flex: 1, padding: '12px', border: '1px solid #333', background: 'transparent',
                                    borderRadius: '8px', cursor: 'pointer', color: '#888'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeDFlowTrade}
                                style={{
                                    flex: 1, padding: '12px', border: 'none',
                                    background: pendingDFlowOrder.side === 'YES' ? '#10b981' : '#ef4444',
                                    borderRadius: '8px', cursor: 'pointer', color: '#fff', fontWeight: 'bold'
                                }}
                            >
                                Confirm Trade
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default EventDetail
