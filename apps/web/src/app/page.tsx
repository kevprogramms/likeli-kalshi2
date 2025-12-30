import Link from 'next/link'
import styles from './page.module.css'

export default function Home() {
    return (
        <div className={styles.dashboard}>
            <div className={styles.header}>
                <h1 className="gradient-text">Dashboard</h1>
                <p className={styles.subtitle}>Your prediction market portfolio overview</p>
            </div>

            <div className={styles.statsGrid}>
                <div className={`${styles.statCard} glass animate-fade-in-up`}>
                    <span className={styles.statLabel}>Portfolio Value</span>
                    <span className={styles.statValue}>$124,532.50</span>
                    <span className={`${styles.statChange} ${styles.positive}`}>+12.4%</span>
                </div>
                <div className={`${styles.statCard} glass animate-fade-in-up`} style={{ animationDelay: '50ms' }}>
                    <span className={styles.statLabel}>Total Profit</span>
                    <span className={styles.statValue}>$24,532.50</span>
                    <span className={`${styles.statChange} ${styles.positive}`}>+$4,231</span>
                </div>
                <div className={`${styles.statCard} glass animate-fade-in-up`} style={{ animationDelay: '100ms' }}>
                    <span className={styles.statLabel}>Active Positions</span>
                    <span className={styles.statValue}>12</span>
                    <span className={`${styles.statChange} ${styles.positive}`}>+3</span>
                </div>
                <div className={`${styles.statCard} glass animate-fade-in-up`} style={{ animationDelay: '150ms' }}>
                    <span className={styles.statLabel}>Win Rate</span>
                    <span className={styles.statValue}>68%</span>
                    <span className={`${styles.statChange} ${styles.positive}`}>+2.1%</span>
                </div>
            </div>

            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2>Quick Actions</h2>
                </div>
                <div className={styles.actionsGrid}>
                    <Link href="/vaults" className={`${styles.actionCard} glass`}>
                        <span className={styles.actionIcon}>◈</span>
                        <span className={styles.actionTitle}>Explore Vaults</span>
                        <span className={styles.actionDesc}>Deposit into managed strategies</span>
                    </Link>
                    <Link href="/vaults/create" className={`${styles.actionCard} glass`}>
                        <span className={styles.actionIcon}>+</span>
                        <span className={styles.actionTitle}>Create Vault</span>
                        <span className={styles.actionDesc}>Start your own vault</span>
                    </Link>
                    <Link href="/markets" className={`${styles.actionCard} glass`}>
                        <span className={styles.actionIcon}>◎</span>
                        <span className={styles.actionTitle}>Browse Markets</span>
                        <span className={styles.actionDesc}>View prediction markets</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}
