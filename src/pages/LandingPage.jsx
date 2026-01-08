import { useEffect, useRef, useState } from 'react';
import './LandingPage.css';

function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate parallax and opacity based on scroll
  const heroOpacity = Math.max(1 - scrollY / 600, 0);
  const heroScale = Math.max(1 - scrollY / 3000, 0.95);

  return (
    <div className="likeli-landing-wrapper" ref={containerRef}>
      {/* Hero Section - Fullscreen */}
      <section className="hero-section-full">
        <div className="hero-bg-gradient"></div>
        <div className="hero-grid-lines"></div>

        <div
          className="hero-container"
          style={{
            opacity: heroOpacity,
            transform: `scale(${heroScale})`
          }}
        >
          {/* Logo */}
          <div className="brand-logo">
            <div className="logo-shape">
              <span>L</span>
            </div>
            <span className="brand-name">LIKELI</span>
          </div>

          {/* Hero Content */}
          <div className="hero-text-container">
            <div className="hero-badge">NON-CUSTODIAL TRADING PLATFORM</div>
            <h1 className="hero-title">
              <span className="title-line">Multi-Chain Vaults</span>
              <span className="title-line gradient-text">Without Custody Risk</span>
            </h1>
            <p className="hero-subtitle">
              Execute across Solana, Base, Polygon, and Hyperliquid through independent
              smart contract sleeves. Your funds, your control, zero trust required.
            </p>

            <div className="hero-cta-group">
              <a href="/markets" className="btn-primary">
                <span>Launch App</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              <a href="#features" className="btn-secondary">
                <span>Learn More</span>
              </a>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-value">$24M+</div>
              <div className="stat-label">Total Value Locked</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-value">4</div>
              <div className="stat-label">Chains Supported</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-value">0%</div>
              <div className="stat-label">Custody Risk</div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="scroll-indicator-modern">
          <div className="scroll-line"></div>
          <span>SCROLL</span>
        </div>
      </section>

      {/* Section: Architecture */}
      <section className="section-architecture" id="features">
        <div className="section-container">
          <SectionHeader
            badge="ARCHITECTURE"
            title="Independent Sleeves"
            subtitle="Multi-Chain Execution"
            description="Each sleeve is an isolated smart contract vault on its native chain. Managers execute trades through allowlisted protocols but cannot withdraw principal."
          />

          <div className="vault-grid">
            <VaultCard
              title="Solana Sleeve"
              chain="Solana"
              protocols={["Orca", "Raydium", "Kalshi via dFlow"]}
              tvl="$8.2M"
              apy="+18.4%"
              color="linear-gradient(135deg, #14F195 0%, #00D4AA 100%)"
              delay={0}
            />
            <VaultCard
              title="Base Sleeve"
              chain="Base"
              protocols={["Aerodrome", "Uniswap V3"]}
              tvl="$6.8M"
              apy="+22.1%"
              color="linear-gradient(135deg, #0052FF 0%, #4D94FF 100%)"
              delay={0.1}
            />
            <VaultCard
              title="Polygon Sleeve"
              chain="Polygon"
              protocols={["Polymarket CLOB"]}
              tvl="$5.4M"
              apy="+16.8%"
              color="linear-gradient(135deg, #8247E5 0%, #A67EFF 100%)"
              delay={0.2}
            />
            <VaultCard
              title="Hyperliquid"
              chain="Hyperliquid"
              protocols={["Native Vaults", "Perpetuals"]}
              tvl="$3.8M"
              apy="+28.3%"
              color="linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 100%)"
              delay={0.3}
            />
          </div>

          {/* Security Features */}
          <div className="security-grid">
            <SecurityFeature
              icon={<LockIcon />}
              title="Non-Custodial"
              description="Funds locked in smart contracts, never accessible by managers"
            />
            <SecurityFeature
              icon={<ShieldIcon />}
              title="Trade-Only Access"
              description="Managers execute through allowlisted protocols, withdrawals blocked"
            />
            <SecurityFeature
              icon={<ExitIcon />}
              title="Instant Exit"
              description="Redeem vault shares for underlying assets anytime, no lockups"
            />
          </div>
        </div>
      </section>

      {/* Section: Multi-Chain */}
      <section className="section-chains-visual">
        <div className="section-container">
          <SectionHeader
            badge="MULTI-CHAIN"
            title="Unified Portfolio View"
            subtitle="Cross-Chain Execution"
            description="Trade across prediction markets, DEXs, and perpetual futures—all unified in one portfolio view with real-time P&L tracking."
          />

          <div className="chains-showcase">
            <ChainNode
              name="Solana"
              icon="SOL"
              position={{ top: '20%', left: '10%' }}
              delay={0}
            />
            <ChainNode
              name="Base"
              icon="BASE"
              position={{ top: '60%', left: '15%' }}
              delay={0.15}
            />
            <ChainNode
              name="Polygon"
              icon="MATIC"
              position={{ top: '30%', right: '15%' }}
              delay={0.3}
            />
            <ChainNode
              name="Hyperliquid"
              icon="HYPE"
              position={{ top: '70%', right: '10%' }}
              delay={0.45}
            />

            {/* Center Hub */}
            <div className="hub-center">
              <div className="hub-pulse"></div>
              <div className="hub-core">
                <span>LIKELI</span>
              </div>
            </div>

            {/* Connection Lines */}
            <svg className="connection-lines" viewBox="0 0 1000 800">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#E63946" stopOpacity="0.1" />
                  <stop offset="50%" stopColor="#E63946" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#E63946" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <line x1="150" y1="160" x2="500" y2="400" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="5,5" className="animated-line" />
              <line x1="180" y1="480" x2="500" y2="400" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="5,5" className="animated-line" />
              <line x1="850" y1="240" x2="500" y2="400" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="5,5" className="animated-line" />
              <line x1="850" y1="560" x2="500" y2="400" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="5,5" className="animated-line" />
            </svg>
          </div>
        </div>
      </section>

      {/* Section: Social Trading */}
      <section className="section-social-trading">
        <div className="section-container">
          <div className="social-content-grid">
            <div className="social-text-col">
              <SectionHeader
                badge="SOCIAL TRADING"
                title="Vault Rivalries"
                subtitle="Compete & Predict"
                description="Challenge rival vault managers to performance battles. Community prediction markets settle based on NAV per share. Discover leaders via Sharpe ratio and AUM leaderboards."
              />

              <div className="features-list">
                <FeatureItem
                  number="01"
                  title="Leader Profiles"
                  description="Track performance history, strategies, and track records of top vault managers"
                />
                <FeatureItem
                  number="02"
                  title="Performance Challenges"
                  description="Time-bound NAV competitions between vaults with transparent tracking"
                />
                <FeatureItem
                  number="03"
                  title="Prediction Markets"
                  description="Bet on rivalry outcomes with on-chain settlement and verified results"
                />
              </div>
            </div>

            <div className="social-visual-col">
              <RivalryCard />
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section-final-cta">
        <div className="cta-container">
          <div className="cta-glow"></div>
          <h2 className="cta-title">Ready to trade without custody risk?</h2>
          <p className="cta-description">
            Join Likeli and access non-custodial vaults across Solana, Base, Polygon, and Hyperliquid.
          </p>
          <a href="/markets" className="btn-cta-large">
            <span>Launch Application</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </section>
    </div>
  );
}

// Section Header Component
function SectionHeader({ badge, title, subtitle, description }) {
  return (
    <div className="section-header">
      <div className="section-badge">{badge}</div>
      <h2 className="section-title">
        {title}
        {subtitle && <span className="subtitle-line">{subtitle}</span>}
      </h2>
      <p className="section-description">{description}</p>
    </div>
  );
}

// Vault Card Component with Intersection Observer
function VaultCard({ title, chain, protocols, tvl, apy, color, delay }) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay * 1000);
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -100px 0px' }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={cardRef}
      className={`vault-card-modern ${isVisible ? 'visible' : ''}`}
    >
      <div className="card-gradient-bg" style={{ background: color }}></div>
      <div className="card-glass-layer">
        <div className="card-header-row">
          <div className="chain-badge">{chain}</div>
          <div className="status-dot"></div>
        </div>

        <h3 className="card-title">{title}</h3>

        <div className="protocols-list">
          {protocols.map((protocol, i) => (
            <span key={i} className="protocol-tag">{protocol}</span>
          ))}
        </div>

        <div className="card-stats-row">
          <div className="card-stat">
            <span className="stat-label-sm">TVL</span>
            <span className="stat-value-sm">{tvl}</span>
          </div>
          <div className="card-stat">
            <span className="stat-label-sm">APY</span>
            <span className="stat-value-sm positive">{apy}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Security Feature Component
function SecurityFeature({ icon, title, description }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`security-feature ${isVisible ? 'visible' : ''}`}>
      <div className="feature-icon-box">{icon}</div>
      <h4 className="feature-title-sm">{title}</h4>
      <p className="feature-desc-sm">{description}</p>
    </div>
  );
}

// Chain Node Component
function ChainNode({ name, icon, position, delay }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay * 1000);
        }
      },
      { threshold: 0.2 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`chain-node ${isVisible ? 'visible' : ''}`}
      style={position}
    >
      <div className="node-glow"></div>
      <div className="node-content">
        <span className="node-icon">{icon}</span>
        <span className="node-name">{name}</span>
      </div>
    </div>
  );
}

// Feature Item Component
function FeatureItem({ number, title, description }) {
  return (
    <div className="feature-list-item">
      <span className="feature-number">{number}</span>
      <div className="feature-content">
        <h4 className="feature-item-title">{title}</h4>
        <p className="feature-item-desc">{description}</p>
      </div>
    </div>
  );
}

// Rivalry Card Component
function RivalryCard() {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`rivalry-card-modern ${isVisible ? 'visible' : ''}`}>
      <div className="rivalry-header-bar">
        <span className="rivalry-title-sm">LIVE RIVALRY</span>
        <span className="live-pulse-dot"></span>
      </div>

      <div className="rivalry-competitors">
        <div className="competitor">
          <div className="competitor-avatar red-gradient">
            <span>AF</span>
          </div>
          <div className="competitor-info">
            <span className="competitor-name">Alpha Fund</span>
            <span className="competitor-perf positive">+24.3%</span>
          </div>
        </div>

        <div className="vs-divider">VS</div>

        <div className="competitor">
          <div className="competitor-avatar blue-gradient">
            <span>DV</span>
          </div>
          <div className="competitor-info">
            <span className="competitor-name">Delta Vault</span>
            <span className="competitor-perf positive">+19.8%</span>
          </div>
        </div>
      </div>

      <div className="market-prediction">
        <span className="market-label">PREDICTION MARKET</span>
        <div className="odds-row">
          <div className="odds-item yes">
            <span className="odds-label">YES</span>
            <span className="odds-value">67%</span>
          </div>
          <div className="odds-item no">
            <span className="odds-label">NO</span>
            <span className="odds-value">33%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Icon Components
function LockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L4 5v6.09c0 5.64 3.4 10.94 8 12.91 4.6-1.97 8-7.27 8-12.91V5l-8-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default LandingPage;
