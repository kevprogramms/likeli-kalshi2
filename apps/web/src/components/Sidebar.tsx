'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Sidebar.module.css'

const menuItems = [
    { path: '/', label: 'Dashboard', icon: '◐' },
    { path: '/vaults', label: 'Vaults', icon: '◈' },
    { path: '/markets', label: 'Markets', icon: '◎' },
    { path: '/leaderboard', label: 'Leaderboard', icon: '◉' },
    { path: '/rivals', label: 'Rivals', icon: '⬡', disabled: true },
    { path: '/hedging', label: 'Hedging', icon: '◇', disabled: true },
    { path: '/parlay', label: 'Parlay', icon: '▣', disabled: true },
]

export default function Sidebar() {
    const pathname = usePathname()

    return (
        <aside className={styles.sidebar}>
            <nav className={styles.nav}>
                {menuItems.map((item) => (
                    item.disabled ? (
                        <div key={item.path} className={`${styles.link} ${styles.disabled}`}>
                            <span className={styles.icon}>{item.icon}</span>
                            <span className={styles.label}>{item.label}</span>
                            <span className={styles.soon}>Soon</span>
                        </div>
                    ) : (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={`${styles.link} ${pathname === item.path ? styles.active : ''}`}
                        >
                            <span className={styles.icon}>{item.icon}</span>
                            <span className={styles.label}>{item.label}</span>
                        </Link>
                    )
                ))}
            </nav>

            <div className={styles.footer}>
                <div className={styles.stat}>
                    <span className={styles.statLabel}>Platform TVL</span>
                    <span className={styles.statValue}>$429.4M</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statLabel}>24h Volume</span>
                    <span className={styles.statValue}>$12.8M</span>
                </div>
            </div>
        </aside>
    )
}
