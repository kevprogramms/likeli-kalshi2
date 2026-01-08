import { useState, useEffect, useCallback } from 'react';
import PriceChart from './PriceChart';
import { calculatePriceStats, formatPrice } from '../lib/priceHistoryService';
import './ChartModal.css';

/**
 * Chart Modal Component
 *
 * Displays an expanded view of the price chart when a market card is clicked.
 * Includes full chart with time range selector, market details, and trading options.
 */
function ChartModal({
    isOpen,
    onClose,
    event,
    market,
    source = 'polymarket',
    onTrade,
}) {
    const [timeRange, setTimeRange] = useState('24h');
    const [isClosing, setIsClosing] = useState(false);

    // Get primary outcome data
    const outcomes = market?.outcomes || [];
    const yesOutcome = outcomes.find(o => o.name === 'Yes') || outcomes[0];
    const noOutcome = outcomes.find(o => o.name === 'No') || outcomes[1];
    const yesPrice = yesOutcome?.price || 0.5;
    const noPrice = noOutcome?.price || 0.5;
    const tokenId = yesOutcome?.tokenId || market?.clobTokenIds?.[0];

    // Handle close with animation
    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, 200);
    }, [onClose]);

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                handleClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen || !event) return null;

    const handleTradeClick = (side) => {
        if (onTrade) {
            onTrade(event, market?.id, side);
        }
    };

    return (
        <div
            className={`chart-modal-overlay ${isClosing ? 'closing' : ''}`}
            onClick={handleClose}
        >
            <div
                className={`chart-modal ${isClosing ? 'closing' : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button className="modal-close-btn" onClick={handleClose}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>

                {/* Header */}
                <div className="chart-modal-header">
                    <div className="header-left">
                        {event.image && (
                            <img src={event.image} alt="" className="event-image" />
                        )}
                        <div className="header-info">
                            <span className="event-category">{event.category}</span>
                            <h2 className="event-title">{event.title}</h2>
                            {market?.title && market.title !== event.title && (
                                <span className="market-subtitle">{market.title}</span>
                            )}
                        </div>
                    </div>
                    <div className="header-right">
                        <div className="current-price">
                            <span className="price-label">Current</span>
                            <span className="price-value">{formatPrice(yesPrice)}</span>
                        </div>
                    </div>
                </div>

                {/* Main Chart */}
                <div className="chart-container">
                    <PriceChart
                        tokenId={tokenId}
                        currentPrice={yesPrice}
                        source={source}
                        width={600}
                        height={300}
                        showTimeSelector={true}
                        showTooltip={true}
                        showStats={true}
                        initialTimeRange={timeRange}
                        animate={true}
                        className="full"
                        onTimeRangeChange={setTimeRange}
                    />
                </div>

                {/* Market Stats */}
                <div className="market-stats">
                    <div className="stat-item">
                        <span className="stat-label">Volume</span>
                        <span className="stat-value">
                            ${(event.volume || 0).toLocaleString()}
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Yes Price</span>
                        <span className="stat-value yes">{formatPrice(yesPrice)}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">No Price</span>
                        <span className="stat-value no">{formatPrice(noPrice)}</span>
                    </div>
                    {event.endDate && (
                        <div className="stat-item">
                            <span className="stat-label">Closes</span>
                            <span className="stat-value">
                                {new Date(event.endDate).toLocaleDateString()}
                            </span>
                        </div>
                    )}
                </div>

                {/* Trade Buttons */}
                <div className="trade-buttons">
                    <button
                        className="trade-btn yes"
                        onClick={() => handleTradeClick('YES')}
                    >
                        <span className="btn-label">Buy Yes</span>
                        <span className="btn-price">{formatPrice(yesPrice)}</span>
                    </button>
                    <button
                        className="trade-btn no"
                        onClick={() => handleTradeClick('NO')}
                    >
                        <span className="btn-label">Buy No</span>
                        <span className="btn-price">{formatPrice(noPrice)}</span>
                    </button>
                </div>

                {/* Source Badge */}
                <div className="modal-footer">
                    <span className={`source-badge ${source}`}>
                        {source === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                    </span>
                    {event.polymarketUrl && (
                        <a
                            href={event.polymarketUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="external-link"
                        >
                            View on {source === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ChartModal;
