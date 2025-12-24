// =====================
// AI RESEARCHER SERVICE - Main Orchestrator
// =====================

import { callGroq, getResearcherSystemPrompt } from './groqClient';
import { searchMarketNews } from './tavilyClient';
import { searchMarketPapers, searchArxiv } from './academicClient';
import { aggregateEvidence, calculateConfidenceInterval, analyzeSourceDiversity } from './bayesianMath';

/**
 * Configuration for the AI Researcher
 */
const CONFIG = {
    // API keys (should be set via environment or config)
    groqApiKey: null,
    tavilyApiKey: null,

    // Timeouts
    searchTimeout: 15000,
    analysisTimeout: 30000,

    // Limits
    maxWebResults: 10,
    maxAcademicResults: 8,
};

/**
 * Set API keys for the researcher
 * @param {object} keys - API keys
 */
export function setApiKeys(keys) {
    if (keys.groq) CONFIG.groqApiKey = keys.groq;
    if (keys.tavily) CONFIG.tavilyApiKey = keys.tavily;
}

/**
 * Run a full research analysis on a prediction market
 * @param {object} market - Market object with question, title, etc.
 * @param {object} options - Research options
 * @returns {Promise<object>} Complete research analysis
 */
export async function runResearch(market, options = {}) {
    const startTime = Date.now();

    const marketQuestion = market.title || market.question || 'Unknown market';
    const priorProbability = market.probability ?? options.prior ?? 0.5;

    console.log(`[AI Researcher] Starting analysis for: ${marketQuestion}`);

    // Step 1: Gather evidence from multiple sources in parallel
    let webEvidence = [];
    let academicEvidence = [];
    let errors = [];

    try {
        const searchPromises = [];

        // Web/News search (if API key available)
        if (CONFIG.tavilyApiKey) {
            searchPromises.push(
                searchMarketNews(marketQuestion, CONFIG.tavilyApiKey)
                    .then(results => { webEvidence = results; })
                    .catch(err => { errors.push(`Tavily: ${err.message}`); })
            );
        } else {
            errors.push('Tavily API key not configured');
        }

        // Academic search (no API key needed)
        searchPromises.push(
            searchMarketPapers(marketQuestion)
                .then(results => { academicEvidence = results; })
                .catch(async (err) => {
                    console.warn('Semantic Scholar failed, trying arXiv backup');
                    try {
                        academicEvidence = await searchArxiv(marketQuestion, 5);
                    } catch (arxivErr) {
                        errors.push(`Academic: ${err.message}`);
                    }
                })
        );

        // Wait for all searches
        await Promise.all(searchPromises);

    } catch (err) {
        errors.push(`Search error: ${err.message}`);
    }

    // Combine all evidence
    const allEvidence = [...webEvidence, ...academicEvidence];

    console.log(`[AI Researcher] Collected ${allEvidence.length} evidence pieces`);

    // Step 2: Use AI to analyze evidence (if we have any)
    let analysis = null;

    if (allEvidence.length > 0 && CONFIG.groqApiKey) {
        try {
            const systemPrompt = getResearcherSystemPrompt();
            const userMessage = buildAnalysisPrompt(marketQuestion, allEvidence, priorProbability);

            analysis = await callGroq(systemPrompt, userMessage, CONFIG.groqApiKey);

        } catch (err) {
            errors.push(`AI Analysis: ${err.message}`);
            console.error('[AI Researcher] Groq analysis failed:', err);
        }
    } else if (!CONFIG.groqApiKey) {
        errors.push('Groq API key not configured');
    }

    // Step 3: If AI analysis failed, build a basic result from raw evidence
    if (!analysis) {
        analysis = buildFallbackAnalysis(marketQuestion, allEvidence, priorProbability);
    }

    // Step 4: Augment with our own calculations
    const sourceDiversity = analyzeSourceDiversity(analysis.evidenceAnalysis || []);
    const confidenceInterval = calculateConfidenceInterval(
        analysis.finalProbability || 0.5,
        analysis.evidenceAnalysis || []
    );

    return {
        ...analysis,
        sourceDiversity: analysis.sourceDiversity || sourceDiversity,
        confidenceInterval: analysis.confidenceInterval || confidenceInterval,
        metadata: {
            marketId: market.id,
            marketQuestion,
            priorProbability,
            analysisTime: Date.now() - startTime,
            webEvidenceCount: webEvidence.length,
            academicEvidenceCount: academicEvidence.length,
            errors: errors.length > 0 ? errors : null,
        },
    };
}

/**
 * Build the user message for AI analysis
 */
function buildAnalysisPrompt(marketQuestion, evidence, priorProbability) {
    const evidenceList = evidence.map((e, i) => `
### Evidence ${i + 1}
- **Title**: ${e.title}
- **Source**: ${e.source}
- **Type**: ${e.type === 'academic' ? 'Academic Paper' : 'News/Web'}
- **URL**: ${e.url}
- **Published**: ${e.publishedDate || 'Unknown'}
- **Content**: ${truncate(e.content, 500)}
`).join('\n');

    return `## Market Question
"${marketQuestion}"

## Prior Probability
${priorProbability} (${Math.round(priorProbability * 100)}%)

## Collected Evidence
${evidenceList}

## Instructions
Analyze ALL the evidence above and produce a complete JSON analysis following the schema in your system prompt. Be rigorous about:
1. Classifying each evidence piece (Type A/B/C/D)
2. Scoring quality dimensions (verifiability, consistency, independence, recency)
3. Estimating P(evidence|YES) and P(evidence|NO)
4. Identifying the strongest factors for each side
5. Flagging key uncertainties and potential biases

Respond ONLY with the JSON object.`;
}

/**
 * Build a basic analysis when AI is unavailable
 */
function buildFallbackAnalysis(marketQuestion, evidence, priorProbability) {
    const evidenceAnalysis = evidence.map((e, i) => ({
        id: e.id || `evidence-${i}`,
        title: e.title,
        source: e.source,
        url: e.url,
        type: e.type === 'academic' ? 'B' : 'C',
        verifiability: 0.5,
        consistency: 0.5,
        independence: 1,
        recencyDays: calculateRecencyDays(e.publishedDate),
        pEvidenceGivenYes: 0.5,
        pEvidenceGivenNo: 0.5,
        logLikelihoodRatio: 0,
        cappedLLR: 0,
        summary: truncate(e.content, 200),
        supportsSide: 'NEUTRAL',
    }));

    return {
        marketQuestion,
        analysisTimestamp: new Date().toISOString(),
        finalProbability: priorProbability,
        confidenceInterval: { low: 0.3, high: 0.7 },
        thesis: [
            'AI analysis unavailable - showing raw evidence',
            `${evidence.length} sources found`,
            'Manual review recommended',
        ],
        topYesFactors: [],
        topNoFactors: [],
        uncertainties: ['AI analysis could not be performed'],
        evidenceAnalysis,
    };
}

/**
 * Calculate days since publication
 */
function calculateRecencyDays(dateString) {
    if (!dateString) return 365;
    try {
        const published = new Date(dateString);
        const now = new Date();
        return Math.floor((now - published) / (1000 * 60 * 60 * 24));
    } catch {
        return 365;
    }
}

/**
 * Truncate text to max length
 */
function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

/**
 * Demo/mock research for testing without API keys
 */
export function runDemoResearch(market) {
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

export default {
    setApiKeys,
    runResearch,
    runDemoResearch,
};
