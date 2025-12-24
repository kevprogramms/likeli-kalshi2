// =====================
// BAYESIAN MATH - Probability Aggregation
// =====================

/**
 * Evidence type caps for log-likelihood ratios
 */
const TYPE_CAPS = {
    A: 2.0,  // Primary sources
    B: 1.6,  // High-quality secondary
    C: 0.8,  // Standard secondary
    D: 0.3,  // Weak/speculative
};

/**
 * Calculate log-likelihood ratio for a piece of evidence
 * @param {number} pYes - P(evidence | YES is true)
 * @param {number} pNo - P(evidence | NO is true)
 * @returns {number} Log-likelihood ratio
 */
export function calculateLLR(pYes, pNo) {
    // Clamp to avoid log(0) or division by zero
    const safeYes = Math.max(0.001, Math.min(0.999, pYes));
    const safeNo = Math.max(0.001, Math.min(0.999, pNo));

    return Math.log(safeYes / safeNo);
}

/**
 * Apply evidence type cap to LLR
 * @param {number} llr - Raw log-likelihood ratio
 * @param {string} type - Evidence type (A, B, C, D)
 * @returns {number} Capped LLR
 */
export function capLLR(llr, type) {
    const cap = TYPE_CAPS[type] || TYPE_CAPS.D;
    return Math.sign(llr) * Math.min(Math.abs(llr), cap);
}

/**
 * Apply correlation adjustment for clustered evidence
 * @param {number} cappedLLR - Capped log-likelihood ratio
 * @param {number} groupSize - Number of similar evidence pieces
 * @returns {number} Adjusted LLR
 */
export function adjustForCorrelation(cappedLLR, groupSize) {
    if (groupSize <= 1) return cappedLLR;
    return cappedLLR / Math.sqrt(groupSize);
}

/**
 * Convert log-odds to probability
 * @param {number} logOdds - Log odds value
 * @returns {number} Probability between 0 and 1
 */
export function logOddsToProbability(logOdds) {
    return 1 / (1 + Math.exp(-logOdds));
}

/**
 * Convert probability to log-odds
 * @param {number} probability - Probability between 0 and 1
 * @returns {number} Log odds value
 */
export function probabilityToLogOdds(probability) {
    const safeP = Math.max(0.001, Math.min(0.999, probability));
    return Math.log(safeP / (1 - safeP));
}

/**
 * Aggregate evidence into final probability
 * @param {Array} evidenceAnalysis - Array of evidence with LLR values
 * @param {number} priorProbability - Starting probability (default 0.5)
 * @returns {object} Final probability and statistics
 */
export function aggregateEvidence(evidenceAnalysis, priorProbability = 0.5) {
    if (!evidenceAnalysis || evidenceAnalysis.length === 0) {
        return {
            finalProbability: priorProbability,
            totalLLR: 0,
            evidenceCount: 0,
            yesEvidence: 0,
            noEvidence: 0,
        };
    }

    let totalLLR = 0;
    let yesEvidence = 0;
    let noEvidence = 0;

    // Group evidence by domain for correlation adjustment
    const domainGroups = {};

    for (const evidence of evidenceAnalysis) {
        const domain = evidence.source || 'unknown';
        if (!domainGroups[domain]) {
            domainGroups[domain] = [];
        }
        domainGroups[domain].push(evidence);
    }

    // Calculate adjusted LLR for each piece
    for (const domain of Object.keys(domainGroups)) {
        const group = domainGroups[domain];
        const groupSize = group.length;

        for (const evidence of group) {
            const rawLLR = evidence.logLikelihoodRatio ||
                calculateLLR(evidence.pEvidenceGivenYes, evidence.pEvidenceGivenNo);

            const capped = evidence.cappedLLR || capLLR(rawLLR, evidence.type);
            const adjusted = adjustForCorrelation(capped, groupSize);

            totalLLR += adjusted;

            if (adjusted > 0) yesEvidence++;
            else if (adjusted < 0) noEvidence++;
        }
    }

    // Convert prior to log-odds, add evidence, convert back
    const priorLogOdds = probabilityToLogOdds(priorProbability);
    const posteriorLogOdds = priorLogOdds + totalLLR;
    const finalProbability = logOddsToProbability(posteriorLogOdds);

    return {
        finalProbability: Math.round(finalProbability * 1000) / 1000,
        totalLLR: Math.round(totalLLR * 1000) / 1000,
        evidenceCount: evidenceAnalysis.length,
        yesEvidence,
        noEvidence,
        priorProbability,
    };
}

/**
 * Calculate confidence interval based on evidence quality
 * @param {number} probability - Central probability estimate
 * @param {Array} evidenceAnalysis - Evidence with quality scores
 * @returns {object} Low and high bounds
 */
export function calculateConfidenceInterval(probability, evidenceAnalysis) {
    if (!evidenceAnalysis || evidenceAnalysis.length === 0) {
        return { low: 0.25, high: 0.75 }; // Maximum uncertainty
    }

    // Average verifiability across all evidence
    const avgVerifiability = evidenceAnalysis.reduce(
        (sum, e) => sum + (e.verifiability || 0.5), 0
    ) / evidenceAnalysis.length;

    // More evidence = tighter interval
    const evidenceFactor = Math.min(1, evidenceAnalysis.length / 20);

    // Base interval width (narrower with higher quality)
    const intervalWidth = 0.4 * (1 - avgVerifiability * 0.5) * (1 - evidenceFactor * 0.5);

    const low = Math.max(0.01, probability - intervalWidth / 2);
    const high = Math.min(0.99, probability + intervalWidth / 2);

    return {
        low: Math.round(low * 1000) / 1000,
        high: Math.round(high * 1000) / 1000,
    };
}

/**
 * Analyze source diversity
 * @param {Array} evidenceAnalysis - Evidence array
 * @returns {object} Diversity metrics
 */
export function analyzeSourceDiversity(evidenceAnalysis) {
    if (!evidenceAnalysis || evidenceAnalysis.length === 0) {
        return {
            totalSources: 0,
            uniqueDomains: 0,
            dominantDomain: null,
            dominantDomainPercent: 0,
            echoCharmberWarning: false,
        };
    }

    const domainCounts = {};
    for (const evidence of evidenceAnalysis) {
        const domain = evidence.source || 'unknown';
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }

    const domains = Object.keys(domainCounts);
    const sortedDomains = domains.sort((a, b) => domainCounts[b] - domainCounts[a]);

    const dominantDomain = sortedDomains[0];
    const dominantCount = domainCounts[dominantDomain];
    const dominantPercent = Math.round((dominantCount / evidenceAnalysis.length) * 100);

    return {
        totalSources: evidenceAnalysis.length,
        uniqueDomains: domains.length,
        dominantDomain: dominantPercent > 30 ? dominantDomain : null,
        dominantDomainPercent: dominantPercent,
        echoCharmberWarning: dominantPercent > 30,
    };
}

export default {
    calculateLLR,
    capLLR,
    adjustForCorrelation,
    logOddsToProbability,
    probabilityToLogOdds,
    aggregateEvidence,
    calculateConfidenceInterval,
    analyzeSourceDiversity,
    TYPE_CAPS,
};
