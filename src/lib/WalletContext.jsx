import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { polymarketTrader } from './polymarket'

/**
 * WalletContext - Manages wallet connections for both Phantom (Solana) and MetaMask (Polygon)
 * 
 * Phantom → DFlow/Kalshi markets (Solana)
 * MetaMask → Polymarket (Polygon)
 */

const WalletContext = createContext(null)

export function WalletProvider({ children }) {
    // Phantom (Solana) state
    const [phantomConnected, setPhantomConnected] = useState(false)
    const [phantomAddress, setPhantomAddress] = useState(null)

    // MetaMask (Polygon) state
    const [metamaskConnected, setMetamaskConnected] = useState(false)
    const [metamaskAddress, setMetamaskAddress] = useState(null)

    // UI state
    const [connecting, setConnecting] = useState(false)
    const [error, setError] = useState(null)

    // Check existing connections on mount
    useEffect(() => {
        // Check Phantom
        if (window.solana?.isPhantom && window.solana.isConnected) {
            setPhantomConnected(true)
            setPhantomAddress(window.solana.publicKey?.toString() || null)
        }

        // Check MetaMask via polymarketTrader
        if (polymarketTrader.isConnected()) {
            setMetamaskConnected(true)
            setMetamaskAddress(polymarketTrader.funder || null)
        }

        // Listen for Phantom disconnect
        const handlePhantomDisconnect = () => {
            console.log('[Wallet] Phantom disconnected')
            setPhantomConnected(false)
            setPhantomAddress(null)
        }

        if (window.solana) {
            window.solana.on('disconnect', handlePhantomDisconnect)
        }

        return () => {
            if (window.solana) {
                window.solana.off('disconnect', handlePhantomDisconnect)
            }
        }
    }, [])

    // Connect Phantom (Solana)
    const connectPhantom = useCallback(async () => {
        setConnecting(true)
        setError(null)

        try {
            if (!window.solana?.isPhantom) {
                throw new Error('Phantom wallet not found. Install from phantom.app')
            }

            // Connect with { onlyIfTrusted: false } to always prompt
            const response = await window.solana.connect()
            const address = response.publicKey.toString()

            setPhantomConnected(true)
            setPhantomAddress(address)
            console.log('[Wallet] Phantom connected:', address)

            return address
        } catch (err) {
            console.error('[Wallet] Phantom connection failed:', err)
            setError(err.message)
            throw err
        } finally {
            setConnecting(false)
        }
    }, [])

    // Connect MetaMask (Polygon)
    const connectMetamask = useCallback(async () => {
        setConnecting(true)
        setError(null)

        try {
            await polymarketTrader.connectWallet('metamask')
            await polymarketTrader.initialize()

            const address = polymarketTrader.funder
            setMetamaskConnected(true)
            setMetamaskAddress(address)
            console.log('[Wallet] MetaMask connected:', address)

            return address
        } catch (err) {
            console.error('[Wallet] MetaMask connection failed:', err)
            setError(err.message)
            throw err
        } finally {
            setConnecting(false)
        }
    }, [])

    // Disconnect Phantom
    const disconnectPhantom = useCallback(async () => {
        try {
            if (window.solana) {
                await window.solana.disconnect()
            }
            setPhantomConnected(false)
            setPhantomAddress(null)
        } catch (err) {
            console.error('[Wallet] Phantom disconnect failed:', err)
        }
    }, [])

    // Disconnect MetaMask (just clear state, MetaMask doesn't really disconnect)
    const disconnectMetamask = useCallback(() => {
        setMetamaskConnected(false)
        setMetamaskAddress(null)
        // Note: MetaMask doesn't have a true disconnect API
    }, [])

    // Get appropriate wallet for market source
    const getWalletForSource = useCallback((source) => {
        if (source === 'dflow' || source === 'kalshi') {
            return {
                type: 'phantom',
                connected: phantomConnected,
                address: phantomAddress,
                connect: connectPhantom,
                disconnect: disconnectPhantom
            }
        } else {
            // polymarket or default
            return {
                type: 'metamask',
                connected: metamaskConnected,
                address: metamaskAddress,
                connect: connectMetamask,
                disconnect: disconnectMetamask
            }
        }
    }, [phantomConnected, phantomAddress, metamaskConnected, metamaskAddress, connectPhantom, connectMetamask, disconnectPhantom, disconnectMetamask])

    // Format address for display
    const formatAddress = (addr) => {
        if (!addr) return ''
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`
    }

    const value = {
        // Phantom
        phantomConnected,
        phantomAddress,
        connectPhantom,
        disconnectPhantom,

        // MetaMask
        metamaskConnected,
        metamaskAddress,
        connectMetamask,
        disconnectMetamask,

        // Helpers
        connecting,
        error,
        getWalletForSource,
        formatAddress,

        // Any wallet connected
        isAnyWalletConnected: phantomConnected || metamaskConnected
    }

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    )
}

export function useWallet() {
    const context = useContext(WalletContext)
    if (!context) {
        throw new Error('useWallet must be used within a WalletProvider')
    }
    return context
}

export default WalletContext
