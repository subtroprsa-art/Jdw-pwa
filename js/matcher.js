/**
 * Final Production Matching Engine
 * Handles exact matching, case insensitivity, pluralization variations, 
 * and fallback parsing for fresh produce commodities.
 */

function normalizeString(str) {
    if (!str) return '';
    return str.toString().trim().toUpperCase();
}

// Clean up commodity names to bridge singular/plural gaps (e.g., ORANGE vs ORANGES)
function getBaseCommodity(str) {
    let norm = normalizeString(str);
    // Strip trailing 'S' if it exists to handle plurals vs singulars
    if (norm.endsWith('S') && norm.length > 3) {
        norm = norm.slice(0, -1);
    }
    return norm;
}

function runComprehensiveMatching(stockLines, buyers, historicalTrends = {}) {
    console.log(`--- Starting Production Match ---`);
    console.log(`Stock lines loaded: ${stockLines.length}`);
    console.log(`Buyers loaded: ${buyers.length}`);

    // 1. Build a multi-tier lookup index for stock lines
    const exactStockIndex = new Map();
    const baseStockIndex = new Map();

    stockLines.forEach(stock => {
        const rawComm = stock.commodity || stock.comm || stock.name || '';
        const exactKey = normalizeString(rawComm);
        const baseKey = getBaseCommodity(rawComm);

        if (!exactStockIndex.has(exactKey)) {
            exactStockIndex.set(exactKey, []);
        }
        exactStockIndex.get(exactKey).push(stock);

        if (!baseStockIndex.has(baseKey)) {
            baseStockIndex.set(baseKey, []);
        }
        baseStockIndex.get(baseKey).push(stock);
    });

    const matchResults = [];
    let totalMatchesFound = 0;

    // 2. Iterate through buyers and evaluate preferences against the stock indices
    buyers.forEach(buyer => {
        const buyerName = buyer.name || buyer.buyerName;
        const preferences = buyer.preferences || [];

        preferences.forEach(pref => {
            const rawComm = pref.comm || pref.commodity || '';
            const mappedComm = pref.mapped || rawComm;
            
            const exactSearchKey = normalizeString(mappedComm);
            const baseSearchKey = getBaseCommodity(mappedComm);

            // Tier 1: Exact match on mapped/preferred name
            let candidates = exactStockIndex.get(exactSearchKey) || [];

            // Tier 2: Match using base commodity (handles singular/plural like Oranges vs ORANGE)
            if (candidates.length === 0) {
                candidates = baseStockIndex.get(baseSearchKey) || [];
            }

            // Tier 3: Substring fallback search across all stock items
            if (candidates.length === 0) {
                exactStockIndex.forEach((stockArray, stockKey) => {
                    if (stockKey.includes(exactSearchKey) || exactSearchKey.includes(stockKey)) {
                        candidates = candidates.concat(stockArray);
                    }
                });
            }

            const buyerHistory = historicalTrends[buyerName] || {};
            const itemHistoryScore = buyerHistory[mappedComm] || buyerHistory[rawComm] || 1.0;

            if (candidates.length > 0) {
                totalMatchesFound += candidates.length;
                matchResults.push({
                    buyer: buyerName,
                    commodity: mappedComm,
                    candidates: candidates,
                    trendScore: itemHistoryScore
                });
            }
        });
    });

    console.log(`Matches found: ${totalMatchesFound}`);
    console.log(`--- Matching Complete. Total match groups: ${matchResults.length} ---`);
    return matchResults;
}
