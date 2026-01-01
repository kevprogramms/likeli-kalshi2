import { useState, useEffect } from 'react'
import { useDemo } from '../lib/DemoContext'
import { marketService } from '../lib/marketService'
import { polymarketTrader } from '../lib/polymarket'
import Button from './Button'
import './TradeModal.css'

function TradeModal({ isOpen, onClose, event, initialSide = 'YES', vaultId, marketSource = 'dflow' }) {
    const { userVaults, executeTrade, getVault } = useDemo()
    const [side, setSide] = useState(initialSide)
    const [amount, setAmount] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)

    // Wallet connection state
    const [walletConnected, setWalletConnected] = useState(false)
    const [walletAddress, setWalletAddress] = useState('')
    const [connectingWallet, setConnectingWallet] = useState(false)

    // Order state for Polymarket
    const [orderResult, setOrderResult] = useState(null)

    // Approval and balance state (for real Polymarket trading)
    const [usdcBalance, setUsdcBalance] = useState(0)
    const [maticBalance, setMaticBalance] = useState(0)
    const [needsApproval, setNeedsApproval] = useState(false)
    const [approvalsStatus, setApprovalsStatus] = useState(null)
    const [approving, setApproving] = useState(false)
    const [checkingApprovals, setCheckingApprovals] = useState(false)

    // Debug State
    const [debugLogs, setDebugLogs] = useState([])

    // Listen for Relayer Debug events
    useEffect(() => {
        const handleDebug = (e) => {
            setDebugLogs(prev => [e.detail, ...prev].slice(0, 10))
        }
        window.addEventListener('RELAYER_DEBUG', handleDebug)
        return () => window.removeEventListener('RELAYER_DEBUG', handleDebug)
    }, [])

    // Reset side when modal opens with new initialSide
    useEffect(() => {
        setSide(initialSide)
    }, [initialSide, isOpen])

    // Check wallet connection and approvals when modal opens
    useEffect(() => {
        const checkWalletAndApprovals = async () => {
            if (!isOpen) return;

            const isPolymarketEvent = marketSource === 'polymarket' || event?.source === 'polymarket';
            if (!isPolymarketEvent) return;

            // Check if wallet is connected
            const connected = polymarketTrader.isConnected();
            setWalletConnected(connected);

            if (connected && polymarketTrader.funder) {
                setWalletAddress(polymarketTrader.funder);

                // Fetch balances and approvals
                setCheckingApprovals(true);
                try {
                    const [balance, matic, approvals] = await Promise.all([
                        polymarketTrader.getUSDCBalance(),
                        polymarketTrader.getMaticBalance(),
                        polymarketTrader.checkAllApprovals(event?.markets?.[0]?.negRisk || false)
                    ]);

                    setUsdcBalance(balance);
                    setMaticBalance(matic);
                    setApprovalsStatus(approvals);
                    setNeedsApproval(!approvals.allApproved);
                } catch (err) {
                    console.error('Error checking approvals:', err);
                } finally {
                    setCheckingApprovals(false);
                }
            }
        };

        checkWalletAndApprovals();
    }, [marketSource, isOpen, event])

    if (!isOpen || !event) return null

    const vault = getVault(vaultId)
    const vaultBalance = vault?.vaultUsdc || vault?.tvl || 0
    const market = event.markets?.[0]
    const outcomes = market?.outcomes || []

    // Check if this is a Polymarket event with trading data
    const isPolymarket = marketSource === 'polymarket' || event.source === 'polymarket'
    const hasTokenId = market?.clobTokenIds?.length > 0

    // Get price and token for selected side
    const sideIndex = side === 'YES' ? 0 : 1
    const selectedOutcome = outcomes[sideIndex] || outcomes[0]
    const price = selectedOutcome?.price || 0.5
    const tokenId = selectedOutcome?.tokenId || market?.clobTokenIds?.[sideIndex]

    const handleConnectWallet = async () => {
        setConnectingWallet(true)
        setError('')

        try {
            // Route to correct wallet based on market source
            if (isPolymarket) {
                // Polymarket → MetaMask (Polygon)
                const result = await polymarketTrader.connectWallet()
                setWalletAddress(result.address)

                // Initialize CLOB client
                await polymarketTrader.initialize()
                setWalletConnected(true)

                // Fetch balances and approvals after connecting
                try {
                    const [balance, matic, approvals] = await Promise.all([
                        polymarketTrader.getUSDCBalance(),
                        polymarketTrader.getMaticBalance(),
                        polymarketTrader.checkAllApprovals(market?.negRisk || false)
                    ]);

                    setUsdcBalance(balance);
                    setMaticBalance(matic);
                    setApprovalsStatus(approvals);
                    setNeedsApproval(!approvals.allApproved);
                } catch (balanceErr) {
                    console.error('Error fetching balances:', balanceErr);
                }
            } else {
                // DFlow/Kalshi → Phantom (Solana)
                if (!window.solana || !window.solana.isPhantom) {
                    setError('Phantom wallet not installed. Download from https://phantom.app')
                    setConnectingWallet(false)
                    return
                }

                const resp = await window.solana.connect()
                setWalletAddress(resp.publicKey.toString())
                setWalletConnected(true)

                console.log(`[Phantom] Connected: ${resp.publicKey.toString()}`)
            }
        } catch (err) {
            setError(err.message || 'Failed to connect wallet')
        } finally {
            setConnectingWallet(false)
        }
    }

    const handleApprove = async () => {
        setApproving(true)
        setError('')

        try {
            const results = await polymarketTrader.setAllApprovals(market?.negRisk || false)

            // Check if all approvals succeeded
            const allSuccess = Object.values(results).every(r => r.success)

            if (allSuccess) {
                setNeedsApproval(false)
                setApprovalsStatus({
                    usdcAllowance: Infinity,
                    ctfApproved: true,
                    allApproved: true
                })
                setSuccess('Approvals set successfully! You can now trade.')
                setTimeout(() => setSuccess(''), 3000)
            } else {
                const failedApprovals = Object.entries(results)
                    .filter(([_, r]) => !r.success)
                    .map(([name, r]) => `${name}: ${r.error}`)
                    .join(', ')
                setError(`Some approvals failed: ${failedApprovals}`)
            }
        } catch (err) {
            setError(err.message || 'Failed to set approvals')
        } finally {
            setApproving(false)
        }
    }

    const handleSubmit = async () => {
        setError('')
        setLoading(true)
        setOrderResult(null)

        const tradeAmount = parseFloat(amount)
        if (!tradeAmount || tradeAmount <= 0) {
            setError('Enter a valid amount')
            setLoading(false)
            return
        }
        if (tradeAmount > vaultBalance) {
            setError('Amount exceeds vault balance')
            setLoading(false)
            return
        }

        try {
            // Polymarket real trading
            if (isPolymarket && walletConnected && hasTokenId) {
                // Check USDC balance for real trading
                if (usdcBalance < tradeAmount) {
                    setError(`Insufficient USDC balance. You have $${usdcBalance.toFixed(2)} but need $${tradeAmount.toFixed(2)}`)
                    setLoading(false)
                    return
                }

                // Check MATIC for gas
                if (maticBalance < 0.01) {
                    setError(`Insufficient MATIC for gas. You have ${maticBalance.toFixed(4)} MATIC, need at least 0.01`)
                    setLoading(false)
                    return
                }

                // Check approvals
                if (needsApproval) {
                    setError('You need to approve USDC and CTF tokens first. Click "Approve" below.')
                    setLoading(false)
                    return
                }

                // Calculate size based on price
                const size = tradeAmount / price

                const result = await polymarketTrader.placeOrder(
                    tokenId,
                    'BUY',
                    price,
                    size,
                    {
                        tickSize: market?.tickSize || '0.01',
                        negRisk: market?.negRisk || false
                    }
                )

                if (result.success) {
                    setOrderResult(result)
                    setSuccess(`Order placed on Polymarket!\nOrder ID: ${result.orderId?.slice(0, 8)}...`)

                    // Also record in local vault for tracking
                    executeTrade(vaultId, event.id, event.title, side, tradeAmount, {
                        source: 'polymarket',
                        orderId: result.orderId,
                        tokenId,
                        price
                    })

                    setAmount('')
                    setTimeout(() => {
                        onClose()
                        setSuccess('')
                        setOrderResult(null)
                    }, 3000)
                } else {
                    setError(result.error || 'Failed to place order')
                }
            } else if (isPolymarket && !walletConnected) {
                // Polymarket requires wallet - no demo mode
                setError('Connect your wallet to trade on Polymarket. Real USDC required.')
            } else if (isPolymarket && !hasTokenId) {
                // Missing token ID - can't trade
                setError('This market does not have trading tokens. Unable to trade.')
            } else if (marketSource === 'dflow' || event.source === 'dflow') {
                // DFlow/Kalshi real trading via Solana
                // Check if Phantom wallet is installed
                if (!window.solana || !window.solana.isPhantom) {
                    setError('Phantom wallet not detected. Install Phantom to trade on Kalshi: https://phantom.app')
                    setLoading(false)
                    return
                }

                try {
                    // Connect to Phantom if not already connected
                    if (!window.solana.isConnected) {
                        await window.solana.connect()
                    }

                    const walletPublicKey = window.solana.publicKey.toString()
                    console.log(`[DFlow Trade] Connected wallet: ${walletPublicKey}`)

                    // TODO: Check USDC balance on Solana (requires SPL token program integration)
                    // For now, we'll proceed with the trade request

                    // Step 1: Request a quote from DFlow
                    console.log(`[DFlow Trade] Requesting quote for ${side} on ${market.id}`)

                    const quoteParams = {
                        marketId: market.id || event.id,
                        side: side.toLowerCase(), // 'yes' or 'no'
                        amount: tradeAmount,
                        walletAddress: walletPublicKey
                    }

                    const quote = await marketService.getTrader().requestQuote(quoteParams)

                    if (!quote || !quote.quoteId) {
                        setError('Failed to get quote from DFlow. Please try again.')
                        setLoading(false)
                        return
                    }

                    console.log(`[DFlow Trade] Quote received:`, quote)

                    // Step 2: Execute the trade with the quote
                    const executeParams = {
                        quoteId: quote.quoteId,
                        walletAddress: walletPublicKey,
                        // User needs to sign the transaction with Phantom
                        signature: null // Will be handled by DFlow SDK if needed
                    }

                    const tradeResult = await marketService.getTrader().executeTrade(executeParams)

                    if (tradeResult.success || tradeResult.transactionHash) {
                        setSuccess(`Trade executed on Kalshi!\\nTx: ${tradeResult.transactionHash?.slice(0, 8)}...`)

                        // Record in local vault for tracking
                        executeTrade(vaultId, event.id, event.title, side, tradeAmount, {
                            source: 'dflow',
                            transactionHash: tradeResult.transactionHash,
                            quoteId: quote.quoteId,
                            price
                        })

                        setAmount('')
                        setTimeout(() => {
                            onClose()
                            setSuccess('')
                        }, 3000)
                    } else {
                        setError(tradeResult.error || 'Failed to execute trade on DFlow')
                    }

                } catch (err) {
                    console.error('[DFlow Trade] Error:', err)

                    if (err.message.includes('User rejected')) {
                        setError('Transaction cancelled by user')
                    } else if (err.message.includes('Quote API error')) {
                        setError('DFlow API error: ' + err.message)
                    } else {
                        setError('Trade failed: ' + err.message)
                    }
                }
            } else {
                // Fallback demo trading for other sources
                const result = executeTrade(vaultId, event.id, event.title, side, tradeAmount)

                if (result.success) {
                    const pnlText = result.pnl >= 0 ? `+$${result.pnl.toFixed(2)}` : `-$${Math.abs(result.pnl).toFixed(2)}`
                    setSuccess(`Trade executed! ${side} on "${event.title}"\nP&L: ${pnlText}`)
                    setAmount('')
                    setTimeout(() => {
                        onClose()
                        setSuccess('')
                    }, 2500)
                } else {
                    setError(result.error)
                }
            }
        } catch (err) {
            setError('Trade failed: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        setError('')
        setSuccess('')
        setAmount('')
        setOrderResult(null)
        onClose()
    }

    // Calculate potential payout
    const potentialPayout = amount ? (parseFloat(amount) / price).toFixed(2) : '0.00'

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-container trade-modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={handleClose}>×</button>

                <h2>
                    {isPolymarket ? '🟣 Polymarket Trade' : 'Execute Trade'}
                </h2>

                {success ? (
                    <div className="success-message">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <path d="M22 4L12 14.01l-3-3" />
                        </svg>
                        <p>{success}</p>
                        {orderResult && (
                            <div className="order-details">
                                <span>View on Polygonscan →</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="trade-header">
                            <span className="trade-vault">From: {vault?.name}</span>
                            {isPolymarket && (
                                <span className="trade-source polymarket">
                                    {walletConnected ? '● Wallet Connected' : '○ Connect Wallet'}
                                </span>
                            )}
                        </div>

                        <div className="trade-market-info">
                            <span className="market-category">{event.category}</span>
                            <h3 className="market-title">{event.title}</h3>
                        </div>

                        {/* Wallet Connection for Polymarket */}
                        {isPolymarket && !walletConnected && (
                            <div className="wallet-connect-section">
                                <p className="wallet-info">
                                    🔐 <strong>Real Trading:</strong> Connect your Polygon wallet (MetaMask) to place live orders on Polymarket with real USDC.
                                </p>
                                <Button
                                    variant="secondary"
                                    fullWidth
                                    onClick={handleConnectWallet}
                                    disabled={connectingWallet}
                                >
                                    {connectingWallet ? 'Connecting...' : '🦊 Connect MetaMask (Polygon)'}
                                </Button>
                                <p className="wallet-note">
                                    Orders will appear in your Polymarket account
                                </p>
                            </div>
                        )}

                        {/* Wallet Connection for DFlow/Kalshi */}
                        {!isPolymarket && !walletConnected && (marketSource === 'dflow' || event.source === 'dflow') && (
                            <div className="wallet-connect-section">
                                <p className="wallet-info">
                                    🔐 <strong>Real Trading:</strong> Connect your Solana wallet (Phantom) to trade on Kalshi with real USDC.
                                </p>
                                <Button
                                    variant="secondary"
                                    fullWidth
                                    onClick={handleConnectWallet}
                                    disabled={connectingWallet}
                                >
                                    {connectingWallet ? 'Connecting...' : '👻 Connect Phantom (Solana)'}
                                </Button>
                                <p className="wallet-note">
                                    Trades execute on Kalshi via DFlow
                                </p>
                            </div>
                        )}

                        {/* Connected Wallet Info */}
                        {isPolymarket && walletConnected && (
                            <div className="wallet-connected-section">
                                <div className="wallet-status">
                                    <span className="status-dot connected">●</span>
                                    <span className="wallet-label">Polygon Wallet:</span>
                                    <span className="wallet-addr">
                                        {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                                    </span>
                                </div>

                                {/* Balance Display */}
                                <div className="wallet-balances">
                                    <div className="balance-item">
                                        <span className="balance-label">USDC:</span>
                                        <span className="balance-value">${usdcBalance.toFixed(2)}</span>
                                    </div>
                                    <div className="balance-item">
                                        <span className="balance-label">MATIC:</span>
                                        <span className="balance-value">{maticBalance.toFixed(4)}</span>
                                    </div>
                                </div>

                                {/* Approval Status */}
                                {checkingApprovals && (
                                    <p className="wallet-info">Checking approvals...</p>
                                )}

                                {needsApproval && !checkingApprovals && (
                                    <div className="approval-section">
                                        <p className="wallet-warning">
                                            ⚠️ You need to approve USDC and token contracts before trading
                                        </p>
                                        <Button
                                            variant="secondary"
                                            fullWidth
                                            onClick={handleApprove}
                                            disabled={approving}
                                        >
                                            {approving ? 'Approving... (confirm in wallet)' : '✓ Approve for Trading'}
                                        </Button>
                                    </div>
                                )}

                                {!needsApproval && !checkingApprovals && approvalsStatus?.allApproved && (
                                    <p className="wallet-success">✓ Ready to trade on Polymarket</p>
                                )}

                                {!hasTokenId && (
                                    <p className="wallet-warning">
                                        ⚠️ This market doesn't have trading tokens (using demo mode)
                                    </p>
                                )}
                            </div>
                        )}

                        {error && <div className="error-message">{error}</div>}

                        <div className="form-group">
                            <label>Side</label>
                            <div className="trade-sides">
                                <button
                                    className={`side-btn yes ${side === 'YES' ? 'active' : ''}`}
                                    onClick={() => setSide('YES')}
                                >
                                    YES {outcomes[0] && `@ ${Math.round(outcomes[0].price * 100)}¢`}
                                </button>
                                <button
                                    className={`side-btn no ${side === 'NO' ? 'active' : ''}`}
                                    onClick={() => setSide('NO')}
                                >
                                    NO {outcomes[1] && `@ ${Math.round(outcomes[1].price * 100)}¢`}
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Amount (USDC)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Enter amount"
                                min="1"
                                step="0.01"
                            />
                            <div className="form-balance">
                                <span>Vault balance:</span>
                                <span className="balance-value">${vaultBalance.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="trade-preview glass">
                            <div className="preview-row">
                                <span>Price:</span>
                                <span>{Math.round(price * 100)}¢</span>
                            </div>
                            <div className="preview-row">
                                <span>Shares:</span>
                                <span>{amount ? (parseFloat(amount) / price).toFixed(2) : '0.00'}</span>
                            </div>
                            <div className="preview-row">
                                <span>Potential Payout:</span>
                                <span className="payout-value">${potentialPayout}</span>
                            </div>
                            <div className="preview-row">
                                <span>Max Return:</span>
                                <span className="return-value">+{amount ? ((parseFloat(potentialPayout) - parseFloat(amount)) || 0).toFixed(2) : '0.00'} USDC</span>
                            </div>
                        </div>

                        <Button
                            variant="primary"
                            fullWidth
                            size="lg"
                            onClick={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? 'Executing...' : (
                                isPolymarket && walletConnected && hasTokenId
                                    ? `🟣 Place Order: Buy ${side} for $${amount || '0'}`
                                    : `Buy ${side} for $${amount || '0'}`
                            )}
                        </Button>

                        <p className="trade-disclaimer">
                            {isPolymarket && walletConnected && hasTokenId
                                ? '⚠️ This will place a REAL order on Polymarket via Polygon. Trades are irreversible.'
                                : 'This is a demo trade. Connect wallet for real Polymarket trading.'
                            }
                        </p>

                        {/* Relayer Debug Panel - Visual Feedback for User */}
                        <div style={{
                            position: 'fixed',
                            bottom: '10px',
                            right: '10px',
                            width: '300px',
                            zIndex: 100000,
                            padding: '10px',
                            background: '#000',
                            border: '1px solid #444',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            color: '#ccc',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            boxShadow: '0 0 10px rgba(0,0,0,0.5)'
                        }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#fff', borderBottom: '1px solid #444' }}>📡 NETWORK RELAYER LOGS:</div>
                            {debugLogs.length === 0 && <div style={{ color: '#666' }}>Waiting for network activity...</div>}
                            {debugLogs.map((log, i) => (
                                <div key={i} style={{ borderBottom: '1px solid #222', padding: '3px 0', display: 'flex', alignItems: 'center' }}>
                                    <span style={{
                                        color: log.status === 'Success' ? '#4CAF50' : log.status === 'Failed' ? '#F44336' : '#FFC107',
                                        fontWeight: 'bold', minWidth: '80px'
                                    }}>
                                        [{log.status}]
                                    </span>
                                    <span style={{ color: '#fff', marginRight: '5px' }}>{log.method}</span>
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }} title={log.url}>
                                        {log.url.split('clob.polymarket.com').pop()}
                                    </span>
                                    {log.error && <span style={{ color: '#F44336', marginLeft: '5px' }}>❌ {log.error}</span>}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default TradeModal
