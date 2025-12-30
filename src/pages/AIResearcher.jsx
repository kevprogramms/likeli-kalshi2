import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { marketService } from '../lib/marketService';
import './AIResearcher.css';

/**
 * Demo/mock research for testing without API keys
 */
function runDemoResearch(market) {
    const marketQuestion = market.title || market.question || 'Demo Market';

    return {
        marketQuestion,
        analysisTimestamp: new Date().toISOString(),
        finalProbability: 0.72,
        confidenceInterval: { low: 0.65, high: 0.79 },
        thesis: [
            'Strong momentum indicators suggest YES outcome likely',
            'Historical precedents favor positive resolution',
            'Key deadline approaching may accelerate outcome',
        ],
        topYesFactors: [
            { factor: 'Official statements support positive outcome', strength: 0.85 },
            { factor: 'Market consensus trending upward', strength: 0.72 },
            { factor: 'Recent policy changes favorable', strength: 0.68 },
        ],
        topNoFactors: [
            { factor: 'Economic headwinds could delay resolution', strength: 0.45 },
            { factor: 'Opposition voices gaining traction', strength: 0.38 },
            { factor: 'Historical reversals in similar situations', strength: 0.32 },
        ],
        uncertainties: [
            'Timing of final decision unclear',
            'External factors could shift dynamics',
            'Limited recent data available',
        ],
        evidenceAnalysis: [
            {
                id: 'demo-1',
                title: 'Reuters: Key Development in Market Outcome',
                source: 'reuters.com',
                url: 'https://reuters.com/example',
                type: 'B',
                verifiability: 0.9,
                consistency: 0.85,
                independence: 3,
                recencyDays: 2,
                pEvidenceGivenYes: 0.85,
                pEvidenceGivenNo: 0.25,
                logLikelihoodRatio: 1.22,
                cappedLLR: 1.22,
                summary: 'Major development supports favorable outcome based on official sources.',
                supportsSide: 'YES',
            },
            {
                id: 'demo-2',
                title: 'Academic Analysis of Similar Historical Cases',
                source: 'semanticscholar.org',
                url: 'https://semanticscholar.org/example',
                type: 'A',
                verifiability: 0.95,
                consistency: 0.9,
                independence: 1,
                recencyDays: 45,
                pEvidenceGivenYes: 0.7,
                pEvidenceGivenNo: 0.4,
                logLikelihoodRatio: 0.56,
                cappedLLR: 0.56,
                summary: 'Peer-reviewed analysis of historical precedents shows 68% similar outcomes resolved positively.',
                supportsSide: 'YES',
            },
            {
                id: 'demo-3',
                title: 'Bloomberg: Contrarian View on Market Dynamics',
                source: 'bloomberg.com',
                url: 'https://bloomberg.com/example',
                type: 'B',
                verifiability: 0.8,
                consistency: 0.75,
                independence: 2,
                recencyDays: 5,
                pEvidenceGivenYes: 0.35,
                pEvidenceGivenNo: 0.6,
                logLikelihoodRatio: -0.54,
                cappedLLR: -0.54,
                summary: 'Analysis suggests potential obstacles that could prevent favorable resolution.',
                supportsSide: 'NO',
            },
        ],
        sourceDiversity: {
            totalSources: 3,
            uniqueDomains: 3,
            dominantDomain: null,
            dominantDomainPercent: 33,
            echoCharmberWarning: false,
        },
        biasCheck: {
            potentialBiases: ['Pro-resolution bias in mainstream coverage'],
            contraEvidence: ['Bloomberg analysis provides contrary perspective'],
        },
        metadata: {
            marketId: market.id,
            marketQuestion,
            priorProbability: 0.5,
            analysisTime: 1234,
            webEvidenceCount: 2,
            academicEvidenceCount: 1,
            errors: null,
            isDemo: true,
        },
    };
}

function AIResearcher() {
    const { marketId } = useParams();
    const navigate = useNavigate();

    // Analysis state
    const [selectedMarket, setSelectedMarket] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedEvidence, setExpandedEvidence] = useState({});
    const [evidenceFilter, setEvidenceFilter] = useState('all');
    const [evidenceSort, setEvidenceSort] = useState('strength');

    // Load market by ID if provided in URL
    useEffect(() => {
        const loadMarket = async () => {
            if (marketId) {
                setLoading(true);
                try {
                    // Fetch the market details
                    const event = await marketService.getEventById(marketId);

                    if (event) {
                        // Extract market data from event
                        const market = event.markets?.[0];
                        const outcomes = market?.outcomes || [];
                        const yesOutcome = outcomes.find(o => o.name === 'Yes') || outcomes[0];
                        const yesPrice = yesOutcome?.price || 0;

                        const marketData = {
                            id: event.id,
                            title: event.title,
                            category: event.category || 'Other',
                            probability: yesPrice,
                            source: event.source || 'polymarket'
                        };

                        setSelectedMarket(marketData);
                        await runAnalysis(marketData);
                    } else {
                        setError('Market not found');
                        setLoading(false);
                    }
                } catch (err) {
                    console.error('Failed to load market:', err);
                    setError('Failed to load market');
                    setLoading(false);
                }
            }
        };

        loadMarket();
    }, [marketId]);

    const runAnalysis = async (market) => {
        setLoading(true);
        setError(null);
        setAnalysis(null);

        try {
            // For demo, use mock data
            // In production: const result = await runResearch(market);
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
            const result = runDemoResearch(market);
            setAnalysis(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleEvidence = (id) => {
        setExpandedEvidence(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const getFilteredEvidence = () => {
        if (!analysis?.evidenceAnalysis) return [];

        let filtered = [...analysis.evidenceAnalysis];

        // Apply filter
        if (evidenceFilter === 'yes') {
            filtered = filtered.filter(e => e.supportsSide === 'YES');
        } else if (evidenceFilter === 'no') {
            filtered = filtered.filter(e => e.supportsSide === 'NO');
        }

        // Apply sort
        if (evidenceSort === 'strength') {
            filtered.sort((a, b) => Math.abs(b.cappedLLR) - Math.abs(a.cappedLLR));
        } else if (evidenceSort === 'recency') {
            filtered.sort((a, b) => a.recencyDays - b.recencyDays);
        } else if (evidenceSort === 'quality') {
            filtered.sort((a, b) => b.verifiability - a.verifiability);
        }

        return filtered;
    };

    const getProbabilityColor = (prob) => {
        if (prob >= 0.6) return 'var(--color-success)';
        if (prob <= 0.4) return 'var(--color-danger)';
        return 'var(--color-warning)';
    };

    // No market selected - show prompt to go to markets page
    if (!marketId) {
        return (
            <div className="ai-researcher animate-fade-in-up">
                <div className="researcher-header">
                    <div className="header-left">
                        <h1 className="page-title gradient-text">AI Researcher</h1>
                        <p className="page-subtitle">Bayesian analysis powered by multi-source research</p>
                    </div>
                </div>

                <div className="no-market-prompt glass">
                    <div className="prompt-icon">🔍</div>
                    <h2>Select a Market to Analyze</h2>
                    <p>
                        Choose any live market from Polymarket or DFlow to get AI-powered research,
                        evidence analysis, and probability predictions.
                    </p>
                    <Link to="/markets" className="select-market-btn">
                        Browse Markets →
                    </Link>

                    <div className="prompt-features">
                        <div className="feature-item">
                            <span className="feature-icon">📊</span>
                            <div className="feature-text">
                                <strong>Bayesian Analysis</strong>
                                <span>Evidence-weighted probability calculations</span>
                            </div>
                        </div>
                        <div className="feature-item">
                            <span className="feature-icon">📰</span>
                            <div className="feature-text">
                                <strong>Multi-Source Research</strong>
                                <span>News, academic papers, and expert opinions</span>
                            </div>
                        </div>
                        <div className="feature-item">
                            <span className="feature-icon">⚖️</span>
                            <div className="feature-text">
                                <strong>Bias Detection</strong>
                                <span>Source diversity and echo chamber warnings</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="ai-researcher animate-fade-in-up">
            {/* Header */}
            <div className="researcher-header">
                <div className="header-left">
                    <Link to="/markets" className="back-link">
                        ← Back to Markets
                    </Link>
                    <h1 className="page-title gradient-text">AI Researcher</h1>
                    <p className="page-subtitle">Bayesian analysis powered by multi-source research</p>
                </div>
                {selectedMarket && (
                    <button
                        className="refresh-btn"
                        onClick={() => runAnalysis(selectedMarket)}
                        disabled={loading}
                    >
                        {loading ? '⟳ Analyzing...' : '⟳ Refresh Analysis'}
                    </button>
                )}
            </div>

            {/* Loading State for Analysis */}
            {loading && (
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Analyzing market with AI...</p>
                    <p className="loading-sub">Gathering evidence from news, academic papers, and data sources</p>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="error-state glass">
                    <span className="error-icon">⚠️</span>
                    <p>{error}</p>
                    <Link to="/markets" className="select-market-btn">
                        Choose Another Market
                    </Link>
                </div>
            )}

            {/* Analysis Results */}
            {analysis && !loading && (
                <div className="analysis-layout">
                    {/* Left Panel - Summary */}
                    <div className="summary-panel glass">
                        {/* Selected Market Info */}
                        {selectedMarket && (
                            <div className="selected-market-info">
                                <Link to="/markets" className="change-market-btn">
                                    ← Change Market
                                </Link>
                                <h3>{selectedMarket.title}</h3>
                                <span className={`market-source-badge ${selectedMarket.source}`}>
                                    {selectedMarket.source === 'polymarket' ? 'Polymarket' : 'DFlow'}
                                </span>
                            </div>
                        )}

                        {/* Probability Gauge */}
                        <div className="probability-section">
                            <div className="probability-gauge">
                                <div
                                    className="gauge-fill"
                                    style={{
                                        width: `${analysis.finalProbability * 100}%`,
                                        background: getProbabilityColor(analysis.finalProbability)
                                    }}
                                />
                            </div>
                            <div className="probability-value" style={{ color: getProbabilityColor(analysis.finalProbability) }}>
                                {Math.round(analysis.finalProbability * 100)}%
                            </div>
                            <div className="confidence-range">
                                {Math.round(analysis.confidenceInterval.low * 100)}% - {Math.round(analysis.confidenceInterval.high * 100)}%
                            </div>
                            <div className="probability-label">AI Predicted Probability</div>
                        </div>

                        {/* Thesis */}
                        <div className="thesis-section">
                            <h3>📊 Thesis</h3>
                            <ul>
                                {analysis.thesis?.map((point, i) => (
                                    <li key={i}>{point}</li>
                                ))}
                            </ul>
                        </div>

                        {/* YES Factors */}
                        <div className="factors-section yes-factors">
                            <h3>✅ Top YES Factors</h3>
                            <ul>
                                {analysis.topYesFactors?.map((item, i) => (
                                    <li key={i}>
                                        <span className="factor-text">{item.factor}</span>
                                        <span className="factor-strength" style={{ color: 'var(--color-success)' }}>
                                            {Math.round(item.strength * 100)}%
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* NO Factors */}
                        <div className="factors-section no-factors">
                            <h3>❌ Top NO Factors</h3>
                            <ul>
                                {analysis.topNoFactors?.map((item, i) => (
                                    <li key={i}>
                                        <span className="factor-text">{item.factor}</span>
                                        <span className="factor-strength" style={{ color: 'var(--color-danger)' }}>
                                            {Math.round(item.strength * 100)}%
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Uncertainties */}
                        <div className="uncertainties-section">
                            <h3>⚠️ Key Uncertainties</h3>
                            <ul>
                                {analysis.uncertainties?.map((item, i) => (
                                    <li key={i}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Right Panel - Evidence Feed */}
                    <div className="evidence-panel">
                        <div className="evidence-header">
                            <h2>Evidence Feed</h2>
                            <div className="evidence-controls">
                                <select
                                    value={evidenceFilter}
                                    onChange={(e) => setEvidenceFilter(e.target.value)}
                                    className="filter-select"
                                >
                                    <option value="all">All Evidence</option>
                                    <option value="yes">YES Only</option>
                                    <option value="no">NO Only</option>
                                </select>
                                <select
                                    value={evidenceSort}
                                    onChange={(e) => setEvidenceSort(e.target.value)}
                                    className="filter-select"
                                >
                                    <option value="strength">Sort: Strength</option>
                                    <option value="recency">Sort: Recency</option>
                                    <option value="quality">Sort: Quality</option>
                                </select>
                            </div>
                        </div>

                        <div className="evidence-feed">
                            {getFilteredEvidence().map((evidence, i) => (
                                <div
                                    key={evidence.id}
                                    className={`evidence-card glass animate-fade-in-up stagger-${Math.min(i + 1, 6)}`}
                                >
                                    <div className="evidence-main" onClick={() => toggleEvidence(evidence.id)}>
                                        <div className="evidence-icon">
                                            {evidence.type === 'A' ? '📄' : evidence.type === 'B' ? '📰' : evidence.type === 'C' ? '📝' : '💬'}
                                        </div>
                                        <div className="evidence-content">
                                            <h4 className="evidence-title">{evidence.title}</h4>
                                            <div className="evidence-meta">
                                                <span className={`evidence-type type-${evidence.type}`}>Type {evidence.type}</span>
                                                <span className={`evidence-llr ${evidence.cappedLLR > 0 ? 'positive' : evidence.cappedLLR < 0 ? 'negative' : ''}`}>
                                                    {evidence.cappedLLR > 0 ? '+' : ''}{evidence.cappedLLR.toFixed(2)} LLR
                                                </span>
                                                <span className="evidence-age">{evidence.recencyDays}d ago</span>
                                            </div>
                                        </div>
                                        <button className="expand-btn">
                                            {expandedEvidence[evidence.id] ? '▲' : '▼'}
                                        </button>
                                    </div>

                                    {expandedEvidence[evidence.id] && (
                                        <div className="evidence-expanded">
                                            <p className="evidence-summary">{evidence.summary}</p>

                                            <div className="evidence-scores">
                                                <div className="score-item">
                                                    <span className="score-label">Verifiability</span>
                                                    <div className="score-bar">
                                                        <div className="score-fill" style={{ width: `${evidence.verifiability * 100}%` }} />
                                                    </div>
                                                    <span className="score-value">{(evidence.verifiability * 100).toFixed(0)}%</span>
                                                </div>
                                                <div className="score-item">
                                                    <span className="score-label">Consistency</span>
                                                    <div className="score-bar">
                                                        <div className="score-fill" style={{ width: `${evidence.consistency * 100}%` }} />
                                                    </div>
                                                    <span className="score-value">{(evidence.consistency * 100).toFixed(0)}%</span>
                                                </div>
                                                <div className="score-item">
                                                    <span className="score-label">Independence</span>
                                                    <span className="score-value">{evidence.independence} sources</span>
                                                </div>
                                            </div>

                                            <div className="evidence-probabilities">
                                                <div className="prob-item">
                                                    <span>P(E|YES)</span>
                                                    <span className="prob-value">{(evidence.pEvidenceGivenYes * 100).toFixed(0)}%</span>
                                                </div>
                                                <div className="prob-item">
                                                    <span>P(E|NO)</span>
                                                    <span className="prob-value">{(evidence.pEvidenceGivenNo * 100).toFixed(0)}%</span>
                                                </div>
                                            </div>

                                            <a
                                                href={evidence.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="evidence-link"
                                            >
                                                View Source →
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Panel - Context (when analysis is available) */}
            {analysis && !loading && (
                <div className="context-panel glass">
                    <div className="context-section">
                        <h3>📈 Source Diversity</h3>
                        <div className="context-stats">
                            <div className="stat">
                                <span className="stat-value">{analysis.sourceDiversity?.totalSources || 0}</span>
                                <span className="stat-label">Total Sources</span>
                            </div>
                            <div className="stat">
                                <span className="stat-value">{analysis.sourceDiversity?.uniqueDomains || 0}</span>
                                <span className="stat-label">Unique Domains</span>
                            </div>
                            {analysis.sourceDiversity?.echoCharmberWarning && (
                                <div className="stat warning">
                                    <span className="stat-value">⚠️</span>
                                    <span className="stat-label">Echo Chamber Risk</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="context-section">
                        <h3>🔍 What Would Change This?</h3>
                        <ul className="change-factors">
                            <li>Official announcement or policy change</li>
                            <li>New quantitative data release</li>
                            <li>Major stakeholder reversal</li>
                            <li>External shock event</li>
                        </ul>
                    </div>

                    {analysis.metadata?.isDemo && (
                        <div className="demo-notice">
                            <span>🧪 Demo Mode</span> - Connect API keys for real research
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default AIResearcher;
