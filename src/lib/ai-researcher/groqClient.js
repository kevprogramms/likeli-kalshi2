// =====================
// GROQ CLIENT - Llama 3.1 70B
// =====================

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Call Groq's Llama 3.1 70B model
 * @param {string} systemPrompt - System instructions
 * @param {string} userMessage - User's message with evidence
 * @param {string} apiKey - Groq API key
 * @returns {Promise<object>} Parsed JSON response
 */
export async function callGroq(systemPrompt, userMessage, apiKey) {
    if (!apiKey) {
        throw new Error('GROQ_API_KEY is required');
    }

    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'llama-3.1-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 4096,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('No content in Groq response');
    }

    try {
        return JSON.parse(content);
    } catch (e) {
        console.error('Failed to parse Groq JSON response:', content);
        throw new Error('Invalid JSON response from Groq');
    }
}

/**
 * Get the system prompt for the AI Researcher
 */
export function getResearcherSystemPrompt() {
    return `You are an expert prediction market research analyst. Your job is to analyze evidence and produce Bayesian probability estimates.

## Your Task
Given a prediction market question and collected evidence, you must:
1. Classify each piece of evidence by quality (Type A/B/C/D)
2. Score each evidence on Verifiability, Consistency, Independence, Recency
3. Estimate P(evidence|YES) and P(evidence|NO) for each
4. Calculate log-likelihood ratios
5. Aggregate into a final probability estimate
6. Identify key factors for YES and NO sides
7. Flag uncertainties and potential biases

## Evidence Classification
- Type A (Primary Sources): Official documents, press releases, regulatory filings. Cap: 2.0
- Type B (High-Quality Secondary): Reuters, Bloomberg, WSJ, peer-reviewed papers. Cap: 1.6
- Type C (Standard Secondary): Reputable news with citations, industry publications. Cap: 0.8
- Type D (Weak/Speculative): Social media, unverified claims, rumors. Cap: 0.3

## Quality Scoring (0.0 to 1.0)
- Verifiability: Can the claim be independently verified?
- Consistency: Internal logical coherence and alignment with known facts
- Independence: Truly independent sources (not citing each other)
- Recency: Days since publication (lower is better for time-sensitive markets)

## Output Format
You MUST respond with valid JSON in this exact structure:
{
  "marketQuestion": "string",
  "analysisTimestamp": "ISO date string",
  "finalProbability": 0.0-1.0,
  "confidenceInterval": { "low": 0.0-1.0, "high": 0.0-1.0 },
  "thesis": ["3 bullet points summarizing the prediction"],
  "topYesFactors": [{ "factor": "string", "strength": 0.0-1.0 }],
  "topNoFactors": [{ "factor": "string", "strength": 0.0-1.0 }],
  "uncertainties": ["key uncertainty 1", "key uncertainty 2"],
  "evidenceAnalysis": [{
    "id": "string",
    "title": "string",
    "source": "string",
    "url": "string",
    "type": "A|B|C|D",
    "verifiability": 0.0-1.0,
    "consistency": 0.0-1.0,
    "independence": 1-5,
    "recencyDays": integer,
    "pEvidenceGivenYes": 0.0-1.0,
    "pEvidenceGivenNo": 0.0-1.0,
    "logLikelihoodRatio": float,
    "cappedLLR": float,
    "summary": "1-2 sentence summary",
    "supportsSide": "YES|NO|NEUTRAL"
  }],
  "sourceDiversity": {
    "totalSources": integer,
    "uniqueDomains": integer,
    "dominantDomain": "string or null",
    "dominantDomainPercent": 0-100,
    "echoCharmberWarning": boolean
  },
  "biasCheck": {
    "potentialBiases": ["string"],
    "contraEvidence": ["evidence that contradicts the majority view"]
  }
}`;
}

export default { callGroq, getResearcherSystemPrompt };
