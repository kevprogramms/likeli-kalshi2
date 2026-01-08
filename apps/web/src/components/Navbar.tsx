'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import styles from './Navbar.module.css'

export default function Navbar() {
    const pathname = usePathname()
    const { connected, publicKey } = useWallet()

    return (
        <nav className={styles.navbar}>
            <div className={styles.left}>
                <Link href="/" className={styles.logo}>
                    <span className={styles.logoIcon}>◈</span>
                    <span className={styles.logoText}>likeli</span>
                </Link>
            </div>

            <div className={styles.center}>
                <Link
                    href="/"
                    className={`${styles.navLink} ${pathname === '/' ? styles.active : ''}`}
                >
                    Dashboard
                </Link>
                <Link
                    href="/vaults"
                    className={`${styles.navLink} ${pathname.startsWith('/vaults') ? styles.active : ''}`}
                >
                    Vaults
                </Link>
                <Link
                    href="/markets"
                    className={`${styles.navLink} ${pathname.startsWith('/markets') ? styles.active : ''}`}
                >
                    Markets
                </Link>
                <Link
                    href="/leaderboard"
                    className={`${styles.navLink} ${pathname === '/leaderboard' ? styles.active : ''}`}
                >
                    Leaderboard
                </Link>
            </div>

            <div className={styles.right}>
                <WalletMultiButton />
            </div>
        </nav>
    )
}
