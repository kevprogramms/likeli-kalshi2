import { NavLink } from 'react-router-dom'
import './Sidebar.css'

const menuItems = [
    { path: '/markets', label: 'Markets', icon: '◬' },
    { path: '/vaults', label: 'Vaults', icon: '◈' },
    { path: '/etf-baskets', label: 'ETF Baskets', icon: '▣' },
    { path: '/leaderboard', label: 'Leaderboard', icon: '◉' },
    { path: '/portfolio', label: 'Portfolio', icon: '◐' },
    { path: '/ai-researcher', label: 'AI Researcher', icon: '⬢' },
    { path: '/rivals', label: 'Rivals', icon: '⬡', disabled: true },
    { path: '/hedging', label: 'Hedging', icon: '◇', disabled: true },
    { path: '/parlay', label: 'Parlay', icon: '◎', disabled: true },
]


function Sidebar({ isOpen }) {
    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar-content">
                <nav className="sidebar-nav">
                    {menuItems.map((item) => (
                        item.disabled ? (
                            <div key={item.path} className="sidebar-link disabled">
                                <span className="sidebar-icon">{item.icon}</span>
                                <span className="sidebar-label">{item.label}</span>
                                <span className="coming-soon">Soon</span>
                            </div>
                        ) : (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                            >
                                <span className="sidebar-icon">{item.icon}</span>
                                <span className="sidebar-label">{item.label}</span>
                            </NavLink>
                        )
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-stats">
                        <div className="stat-item">
                            <span className="stat-label">Platform TVL</span>
                            <span className="stat-value">$429.4M</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">24h Volume</span>
                            <span className="stat-value">$12.8M</span>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    )
}

export default Sidebar
