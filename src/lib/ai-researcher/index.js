// =====================
// AI RESEARCHER - Module Exports
// =====================

export { callGroq, getResearcherSystemPrompt } from './groqClient';
export { searchTavily, searchMarketNews } from './tavilyClient';
export { searchPapers, searchMarketPapers, searchArxiv } from './academicClient';
export {
    calculateLLR,
    capLLR,
    adjustForCorrelation,
    logOddsToProbability,
    probabilityToLogOdds,
    aggregateEvidence,
    calculateConfidenceInterval,
    analyzeSourceDiversity,
    TYPE_CAPS,
} from './bayesianMath';
export { setApiKeys, runResearch, runDemoResearch } from './researchService';
