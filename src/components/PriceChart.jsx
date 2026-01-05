import { useState, useEffect, useRef, useCallback } from 'react';
import {
    getPriceHistory,
    calculatePriceStats,
    formatPrice,
    formatTimestamp,
    TIME_RANGES,
} from '../lib/priceHistoryService';
import './PriceChart.css';

/**
 * Interactive Price Chart Component
 *
 * Displays historical price data with hover tooltips and time range selector.
 * Supports real-time data from Polymarket and simulated data fallback.
 */
function PriceChart({
    tokenId,
    currentPrice = 0.5,
    source = 'polymarket',
    width = 300,
    height = 150,
    showTimeSelector = true,
    showTooltip = true,
    showStats = true,
    initialTimeRange = '24h',
    color = 'auto', // 'auto', 'green', 'red', or custom hex
    animate = true,
    className = '',
    onTimeRangeChange,
}) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState(initialTimeRange);
    const [hoverData, setHoverData] = useState(null);
    const [stats, setStats] = useState(null);
    const svgRef = useRef(null);
    const containerRef = useRef(null);

    // Padding for chart
    const padding = { top: 10, right: 10, bottom: 20, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Fetch price history when tokenId or timeRange changes
    useEffect(() => {
        let mounted = true;

        async function fetchData() {
            setLoading(true);
            try {
                const data = await getPriceHistory(tokenId, timeRange, currentPrice, source);
                if (mounted && data) {
                    setHistory(data);
                    setStats(calculatePriceStats(data));
                }
            } catch (error) {
                console.error('Error fetching price history:', error);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        fetchData();

        return () => {
            mounted = false;
        };
    }, [tokenId, timeRange, currentPrice, source]);

    // Handle time range change
    const handleTimeRangeChange = useCallback((newRange) => {
        setTimeRange(newRange);
        setHoverData(null);
        onTimeRangeChange?.(newRange);
    }, [onTimeRangeChange]);

    // Calculate scales for SVG coordinates
    const getScales = useCallback(() => {
        if (!history || history.length === 0) {
            return { xScale: () => 0, yScale: () => 0, minPrice: 0, maxPrice: 1 };
        }

        const prices = history.map(h => h.price);
        const minPrice = Math.min(...prices) * 0.95;
        const maxPrice = Math.max(...prices) * 1.05;
        const priceRange = maxPrice - minPrice || 0.1;

        const minTime = history[0].timestamp;
        const maxTime = history[history.length - 1].timestamp;
        const timeRange = maxTime - minTime || 1;

        const xScale = (timestamp) => {
            return padding.left + ((timestamp - minTime) / timeRange) * chartWidth;
        };

        const yScale = (price) => {
            return padding.top + (1 - (price - minPrice) / priceRange) * chartHeight;
        };

        return { xScale, yScale, minPrice, maxPrice };
    }, [history, chartWidth, chartHeight, padding]);

    // Generate SVG path for the line
    const getLinePath = useCallback(() => {
        if (!history || history.length < 2) return '';

        const { xScale, yScale } = getScales();

        const points = history.map((point, i) => {
            const x = xScale(point.timestamp);
            const y = yScale(point.price);
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        });

        return points.join(' ');
    }, [history, getScales]);

    // Generate SVG path for the area fill
    const getAreaPath = useCallback(() => {
        if (!history || history.length < 2) return '';

        const { xScale, yScale } = getScales();
        const firstX = xScale(history[0].timestamp);
        const lastX = xScale(history[history.length - 1].timestamp);
        const bottomY = padding.top + chartHeight;

        const linePath = getLinePath();
        return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
    }, [history, getScales, getLinePath, chartHeight, padding]);

    // Handle mouse move for tooltip
    const handleMouseMove = useCallback((e) => {
        if (!showTooltip || !history || history.length === 0) return;

        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left - padding.left;
        const xRatio = x / chartWidth;

        if (xRatio < 0 || xRatio > 1) {
            setHoverData(null);
            return;
        }

        // Find closest data point
        const index = Math.round(xRatio * (history.length - 1));
        const point = history[Math.max(0, Math.min(history.length - 1, index))];

        if (point) {
            const { xScale, yScale } = getScales();
            setHoverData({
                price: point.price,
                timestamp: point.timestamp,
                x: xScale(point.timestamp),
                y: yScale(point.price),
            });
        }
    }, [showTooltip, history, chartWidth, padding, getScales]);

    const handleMouseLeave = useCallback(() => {
        setHoverData(null);
    }, []);

    // Determine chart color based on price trend
    const getChartColor = () => {
        if (color === 'auto') {
            return stats && stats.change >= 0 ? '#22c55e' : '#ef4444';
        } else if (color === 'green') {
            return '#22c55e';
        } else if (color === 'red') {
            return '#ef4444';
        }
        return color || '#22c55e';
    };

    const chartColor = getChartColor();

    // Generate grid lines
    const getGridLines = () => {
        const lines = [];
        const { yScale, minPrice, maxPrice } = getScales();
        const priceRange = maxPrice - minPrice;

        // Horizontal grid lines (3 lines)
        for (let i = 0; i <= 2; i++) {
            const price = minPrice + (priceRange * i) / 2;
            const y = yScale(price);
            lines.push({
                y,
                label: formatPrice(price),
            });
        }

        return lines;
    };

    const gridLines = getGridLines();

    return (
        <div
            ref={containerRef}
            className={`price-chart ${animate ? 'animate' : ''} ${className}`}
            style={{ width, height }}
        >
            {/* Time Range Selector */}
            {showTimeSelector && (
                <div className="time-selector">
                    {Object.entries(TIME_RANGES).map(([key, config]) => (
                        <button
                            key={key}
                            className={`time-btn ${timeRange === key ? 'active' : ''}`}
                            onClick={() => handleTimeRangeChange(key)}
                        >
                            {config.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Price Stats */}
            {showStats && stats && (
                <div className="price-stats">
                    <span
                        className={`price-change ${stats.change >= 0 ? 'positive' : 'negative'}`}
                    >
                        {stats.change >= 0 ? '+' : ''}
                        {stats.changePercent.toFixed(1)}%
                    </span>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="chart-loading">
                    <div className="loading-spinner" />
                </div>
            )}

            {/* SVG Chart */}
            <svg
                ref={svgRef}
                width={width}
                height={height}
                className="chart-svg"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                {/* Gradient Definition */}
                <defs>
                    <linearGradient id={`gradient-${tokenId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartColor} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={chartColor} stopOpacity="0.05" />
                    </linearGradient>
                </defs>

                {/* Grid Lines */}
                <g className="grid-lines">
                    {gridLines.map((line, i) => (
                        <g key={i}>
                            <line
                                x1={padding.left}
                                y1={line.y}
                                x2={width - padding.right}
                                y2={line.y}
                                stroke="rgba(255,255,255,0.08)"
                                strokeDasharray="4 4"
                            />
                            <text
                                x={padding.left - 5}
                                y={line.y + 3}
                                textAnchor="end"
                                className="y-axis-label"
                            >
                                {line.label}
                            </text>
                        </g>
                    ))}
                </g>

                {/* Area Fill */}
                {history.length > 1 && (
                    <path
                        d={getAreaPath()}
                        fill={`url(#gradient-${tokenId})`}
                        className={animate ? 'chart-area animate' : 'chart-area'}
                    />
                )}

                {/* Line */}
                {history.length > 1 && (
                    <path
                        d={getLinePath()}
                        fill="none"
                        stroke={chartColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={animate ? 'chart-line animate' : 'chart-line'}
                    />
                )}

                {/* Hover Elements */}
                {hoverData && (
                    <>
                        {/* Vertical line */}
                        <line
                            x1={hoverData.x}
                            y1={padding.top}
                            x2={hoverData.x}
                            y2={height - padding.bottom}
                            stroke="rgba(255,255,255,0.3)"
                            strokeDasharray="2 2"
                        />
                        {/* Hover dot */}
                        <circle
                            cx={hoverData.x}
                            cy={hoverData.y}
                            r="5"
                            fill={chartColor}
                            stroke="white"
                            strokeWidth="2"
                        />
                    </>
                )}
            </svg>

            {/* Tooltip */}
            {showTooltip && hoverData && (
                <div
                    className="chart-tooltip"
                    style={{
                        left: Math.min(hoverData.x, width - 80),
                        top: hoverData.y - 45,
                    }}
                >
                    <div className="tooltip-price">{formatPrice(hoverData.price)}</div>
                    <div className="tooltip-time">
                        {formatTimestamp(hoverData.timestamp, timeRange)}
                    </div>
                </div>
            )}
        </div>
    );
}

export default PriceChart;
