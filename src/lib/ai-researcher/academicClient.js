// =====================
// SEMANTIC SCHOLAR CLIENT - Academic Papers
// =====================

const SEMANTIC_SCHOLAR_API = 'https://api.semanticscholar.org/graph/v1';

/**
 * Search academic papers on Semantic Scholar
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Promise<Array>} Array of paper results
 */
export async function searchPapers(query, options = {}) {
    const {
        limit = 10,
        fields = 'title,abstract,year,citationCount,url,authors,venue',
        yearStart = null,
    } = options;

    const params = new URLSearchParams({
        query: query,
        limit: limit.toString(),
        fields: fields,
    });

    if (yearStart) {
        params.append('year', `${yearStart}-`);
    }

    const response = await fetch(`${SEMANTIC_SCHOLAR_API}/paper/search?${params}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
        },
    });

    if (!response.ok) {
        // Semantic Scholar may rate limit - gracefully handle
        if (response.status === 429) {
            console.warn('Semantic Scholar rate limited, returning empty results');
            return [];
        }
        const error = await response.text();
        throw new Error(`Semantic Scholar API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // Transform results to our format
    return (data.data || []).map((paper, index) => ({
        id: `ss-${paper.paperId || index}-${Date.now()}`,
        title: paper.title || 'Untitled',
        url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
        content: paper.abstract || '',
        source: paper.venue || 'Academic Paper',
        publishedDate: paper.year ? `${paper.year}-01-01` : null,
        citationCount: paper.citationCount || 0,
        authors: (paper.authors || []).map(a => a.name).join(', '),
        type: 'academic',
    }));
}

/**
 * Search for papers relevant to a prediction market question
 * @param {string} marketQuestion - The prediction market question
 */
export async function searchMarketPapers(marketQuestion) {
    // Extract key terms from the question
    const cleanedQuery = marketQuestion
        .replace(/^(will|can|should|does|is|are|has|have|did|do)\s+/i, '')
        .replace(/\?$/, '')
        .trim();

    // Search for relevant papers
    const results = await searchPapers(cleanedQuery, {
        limit: 8,
        yearStart: new Date().getFullYear() - 3, // Last 3 years
    });

    return results;
}

// =====================
// ARXIV CLIENT - Backup Academic Source
// =====================

const ARXIV_API = 'http://export.arxiv.org/api/query';

/**
 * Search arXiv papers (backup for Semantic Scholar)
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum results
 * @returns {Promise<Array>} Array of paper results
 */
export async function searchArxiv(query, maxResults = 5) {
    const params = new URLSearchParams({
        search_query: `all:${query}`,
        start: '0',
        max_results: maxResults.toString(),
        sortBy: 'relevance',
        sortOrder: 'descending',
    });

    const response = await fetch(`${ARXIV_API}?${params}`);

    if (!response.ok) {
        console.warn('arXiv search failed, returning empty results');
        return [];
    }

    const xmlText = await response.text();

    // Simple XML parsing (arXiv returns Atom format)
    const papers = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xmlText)) !== null) {
        const entry = match[1];

        const title = extractXmlTag(entry, 'title')?.replace(/\s+/g, ' ').trim();
        const summary = extractXmlTag(entry, 'summary')?.replace(/\s+/g, ' ').trim();
        const id = extractXmlTag(entry, 'id');
        const published = extractXmlTag(entry, 'published');

        if (title) {
            papers.push({
                id: `arxiv-${papers.length}-${Date.now()}`,
                title: title,
                url: id || 'https://arxiv.org',
                content: summary || '',
                source: 'arXiv',
                publishedDate: published ? published.split('T')[0] : null,
                citationCount: null, // arXiv doesn't provide this
                type: 'academic',
            });
        }
    }

    return papers;
}

function extractXmlTag(xml, tag) {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
    const match = regex.exec(xml);
    return match ? match[1] : null;
}

export default { searchPapers, searchMarketPapers, searchArxiv };
