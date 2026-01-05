// =====================
// TAVILY CLIENT - Web/News Search
// =====================

const TAVILY_API_URL = 'https://api.tavily.com/search';

/**
 * Search web/news sources using Tavily AI
 * @param {string} query - Search query
 * @param {string} apiKey - Tavily API key
 * @param {object} options - Search options
 * @returns {Promise<Array>} Array of search results
 */
export async function searchTavily(query, apiKey, options = {}) {
    if (!apiKey) {
        throw new Error('TAVILY_API_KEY is required');
    }

    const {
        searchDepth = 'advanced',
        maxResults = 10,
        includeDomains = [],
        excludeDomains = [],
    } = options;

    const response = await fetch(TAVILY_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            api_key: apiKey,
            query: query,
            search_depth: searchDepth,
            include_domains: includeDomains.length > 0 ? includeDomains : undefined,
            exclude_domains: excludeDomains.length > 0 ? excludeDomains : undefined,
            max_results: maxResults,
            include_answer: false,
            include_raw_content: false,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Tavily API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // Transform results to our format
    return (data.results || []).map((result, index) => ({
        id: `tavily-${index}-${Date.now()}`,
        title: result.title || 'Untitled',
        url: result.url,
        content: result.content || '',
        source: extractDomain(result.url),
        publishedDate: result.published_date || null,
        score: result.score || 0,
        type: 'web',
    }));
}

/**
 * Search for prediction market related news
 * @param {string} marketQuestion - The prediction market question
 * @param {string} apiKey - Tavily API key
 */
export async function searchMarketNews(marketQuestion, apiKey) {
    // Priority domains for financial/political news
    const priorityDomains = [
        'reuters.com',
        'bloomberg.com',
        'wsj.com',
        'ft.com',
        'cnbc.com',
        'bbc.com',
        'nytimes.com',
        'apnews.com',
        'politico.com',
    ];

    // Run two searches: one focused, one broad
    const [focusedResults, broadResults] = await Promise.all([
        searchTavily(marketQuestion, apiKey, {
            includeDomains: priorityDomains,
            maxResults: 5,
        }),
        searchTavily(marketQuestion, apiKey, {
            excludeDomains: ['twitter.com', 'reddit.com', 'facebook.com'],
            maxResults: 5,
        }),
    ]);

    // Merge and deduplicate by URL
    const seen = new Set();
    const merged = [];

    for (const result of [...focusedResults, ...broadResults]) {
        if (!seen.has(result.url)) {
            seen.add(result.url);
            merged.push(result);
        }
    }

    return merged;
}

/**
 * Extract domain from URL
 */
function extractDomain(url) {
    try {
        const domain = new URL(url).hostname.replace('www.', '');
        return domain;
    } catch {
        return 'unknown';
    }
}

export default { searchTavily, searchMarketNews };
