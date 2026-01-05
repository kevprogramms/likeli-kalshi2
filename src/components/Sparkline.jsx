import './Sparkline.css'

function Sparkline({ data = [], color = 'cyan', width = 80, height = 32 }) {
    if (!data || data.length < 2) {
        // Generate random data for demo
        data = Array.from({ length: 20 }, () => Math.random() * 100)
    }

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * width
        const y = height - ((value - min) / range) * height
        return `${x},${y}`
    }).join(' ')

    // Determine color based on trend
    const trend = data[data.length - 1] > data[0] ? 'up' : 'down'
    const strokeColor = color === 'auto'
        ? (trend === 'up' ? 'var(--color-success)' : 'var(--color-danger)')
        : `var(--color-${color === 'cyan' ? 'primary' : color})`

    return (
        <div className="sparkline" style={{ width, height }}>
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                <defs>
                    <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <polygon
                    points={`0,${height} ${points} ${width},${height}`}
                    fill={`url(#gradient-${color})`}
                />
                <polyline
                    points={points}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    )
}

export default Sparkline
