import { useState, useEffect } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { marketService } from '../lib/marketService'
import { useLiveEvent, formatLastUpdated } from '../lib/useLiveMarkets'
import { useDemo } from '../lib/DemoContext'
import { getYesPrice, getNoPrice, resetMarket, executeBuy } from '../lib/amm'
import { polymarketTrader } from '../lib/polymarket'
import TradeModal from '../components/TradeModal'
import WalletModal from '../components/WalletModal'
import './EventDetail.css'

function EventDetail() {
    const { id } = useParams()
    const [searchParams] = useSearchParams()
    const { userVaults, executeTrade, walletBalance, setWalletBalance, STAGE } = useDemo()

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
    const [chartView, setChartView] = useState('Both')
    const [timeFilter, setTimeFilter] = useState('1D')
    const [userPositions, setUserPositions] = useState([]) // Track individual positions

    // Wallet state for real Polymarket trading
    const [walletConnected, setWalletConnected] = useState(false)
    const [trading, setTrading] = useState(false)
    const [showWalletModal, setShowWalletModal] = useState(false)

    // Order type and custom price
    const [orderType, setOrderType] = useState('MARKET') // 'MARKET' or 'LIMIT'
    const [customPrice, setCustomPrice] = useState('')

    // Approval state
    const [usdcApproved, setUsdcApproved] = useState(false)
    const [ctfApproved, setCtfApproved] = useState(false)
    const [checkingApprovals, setCheckingApprovals] = useState(false)
    const [approvingUsdc, setApprovingUsdc] = useState(false)
    const [approvingCtf, setApprovingCtf] = useState(false)

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

            // Place real order on Polymarket CLOB
            const orderTypeStr = orderType === 'LIMIT' ? 'GTC' : 'FOK' // FOK = Fill-Or-Kill for market orders
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

    // Handle wallet selection from modal
    const handleWalletSelect = async (walletType) => {
        try {
            const walletName = walletType === 'metamask' ? 'MetaMask' : walletType === 'phantom' ? 'Phantom' : 'wallet'
            setTradeSuccess(`Connecting ${walletName}...`)

            if (walletType === 'metamask' || walletType === 'phantom') {
                // Pass walletType so correct provider is used
                await polymarketTrader.connectWallet(walletType)
                await polymarketTrader.initialize()
                setWalletConnected(true)
                setTradeSuccess(`✅ ${walletName} connected! Ready to trade.`)
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
        };
        checkWalletAndApprovals();
    }, [])

    // Check approval status
    const checkApprovalStatus = async () => {
        setCheckingApprovals(true);
        try {
            const approvals = await polymarketTrader.checkAllApprovals(currentMarket?.negRisk || false);
            setUsdcApproved(approvals.usdcApproved || false);
            setCtfApproved(approvals.ctfApproved || false);
        } catch (error) {
            console.error('Failed to check approvals:', error);
        } finally {
            setCheckingApprovals(false);
        }
    };

    // Handle USDC approval
    const handleApproveUSDC = async () => {
        setApprovingUsdc(true);
        setTradeSuccess('Approving USDC...');
        try {
            await polymarketTrader.approveUSDC();
            setUsdcApproved(true);
            setTradeSuccess('✅ USDC approved!');
            setTimeout(() => setTradeSuccess(''), 3000);
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
                        {['Market', 'BTC', 'Both'].map(v => (
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

                {/* Chart Area */}
                <div className="poly-chart">
                    <div className="poly-y-left">
                        <span>100¢</span>
                        <span>{yesCents}¢</span>
                        <span>0¢</span>
                    </div>

                    <div className="poly-chart-area">
                        <svg viewBox="0 0 1000 200" preserveAspectRatio="none">
                            <path
                                d={`M0,${200 - yesPrice * 200} C50,${200 - yesPrice * 180} 100,${200 - yesPrice * 220} 200,${200 - yesPrice * 190} C300,${200 - yesPrice * 160} 400,${200 - yesPrice * 200} 500,${200 - yesPrice * 180} C600,${200 - yesPrice * 150} 700,${200 - yesPrice * 170} 800,${200 - yesPrice * 140} C900,${200 - yesPrice * 120} 950,${200 - yesPrice * 140} 1000,${200 - yesPrice * 130}`}
                                fill="none"
                                stroke="#E63946"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            {(chartView === 'Both' || chartView === 'BTC') && (
                                <path
                                    d="M0,120 C50,125 80,115 120,130 C160,145 200,120 250,115 C300,110 350,130 400,125 C450,120 500,90 550,100 C600,110 650,80 700,90 C750,100 800,60 850,70 C900,80 950,55 1000,60"
                                    fill="none"
                                    stroke="#00D4FF"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            )}
                        </svg>
                        <div className="poly-legend">
                            <span className="legend-red">— Market</span>
                            {(chartView === 'Both' || chartView === 'BTC') && <span className="legend-blue">— BTC</span>}
                        </div>
                    </div>

                    <div className="poly-y-right">
                        <span>$85,437</span>
                        <span>$85,360</span>
                        <span>$85,156</span>
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

                        {!walletConnected ? (
                            <button
                                className="poly-execute connect-wallet"
                                onClick={() => setShowWalletModal(true)}
                            >
                                Connect Wallet
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
        </div>
    )
}

export default EventDetail
