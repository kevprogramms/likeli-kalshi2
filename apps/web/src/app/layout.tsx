import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Likeli | Institutional Prediction Markets',
    description: 'Institutional layer for prediction markets. Vaults, DeFi, and more.',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <Providers>
                    <div className="app">
                        <Navbar />
                        <div className="app-body">
                            <Sidebar />
                            <main className="main-content">
                                {children}
                            </main>
                        </div>
                    </div>
                </Providers>
            </body>
        </html>
    )
}
