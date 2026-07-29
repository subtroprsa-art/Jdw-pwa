// ==========================================
// 1. MATCHER MODULE (matcher.js)
// ==========================================

function normalizeString(str) {
    if (!str) return '';
    return str.toString().trim().toUpperCase();
}

function getBaseCommodity(str) {
    let norm = normalizeString(str);
    if (norm.endsWith('S') && norm.length > 3) {
        norm = norm.slice(0, -1);
    }
    return norm;
}

function createMatcher(stockLines, historicalTrends = {}) {
    // Build robust multi-tier lookup maps using explicit property checks
    const exactStockIndex = new Map();
    const baseStockIndex = new Map();

    const stockArray = Array.isArray(stockLines) ? stockLines : [];

    stockArray.forEach(stock => {
        const rawComm = stock.commodity || stock.comm || stock.name || stock.item || stock.description || stock.produce || '';
        const exactKey = normalizeString(rawComm);
        const baseKey = getBaseCommodity(rawComm);

        if (exactKey) {
            if (!exactStockIndex.has(exactKey)) exactStockIndex.set(exactKey, []);
            exactStockIndex.get(exactKey).push(stock);
        }
        if (baseKey) {
            if (!baseStockIndex.has(baseKey)) baseStockIndex.set(baseKey, []);
            baseStockIndex.get(baseKey).push(stock);
        }
    });

    return {
        matchBuyerPreferences(buyer) {
            const buyerName = buyer.name || buyer.buyerName || buyer.companyName || 'Unknown Buyer';
            const preferences = buyer.preferences || buyer.commPreferences || buyer.items || [];
            const matchedResults = [];

            preferences.forEach(pref => {
                const rawComm = pref.comm || pref.commodity || pref.name || '';
                const mappedComm = pref.mapped || pref.mappedCommodity || rawComm;
                
                const exactSearchKey = normalizeString(mappedComm);
                const baseSearchKey = getBaseCommodity(mappedComm);

                console.log(`Checking preference for ${buyerName}: comm="${rawComm}" -> mapped="${mappedComm}"`);

                // Tier 1: Exact match lookup
                let candidates = exactStockIndex.get(exactSearchKey) || [];

                // Tier 2: Singular/plural normalized match (e.g., Oranges vs ORANGE)
                if (candidates.length === 0) {
                    candidates = baseStockIndex.get(baseSearchKey) || [];
                }

                // Tier 3: Substring fallback matching across all indexed stock lines
                if (candidates.length === 0) {
                    exactStockIndex.forEach((stockArray, stockKey) => {
                        if (stockKey && exactSearchKey && (stockKey.includes(exactSearchKey) || exactSearchKey.includes(stockKey))) {
                            candidates = candidates.concat(stockArray);
                        }
                    });
                }

                console.log(`Candidates found for ${mappedComm}: ${candidates.length}`);

                const buyerHistory = historicalTrends[buyerName] || {};
                const itemHistoryScore = buyerHistory[mappedComm] || buyerHistory[rawComm] || 1.0;

                if (candidates.length > 0) {
                    matchedResults.push({
                        buyer: buyerName,
                        commodity: mappedComm,
                        candidates: candidates,
                        trendScore: itemHistoryScore
                    });
                }
            });

            return matchedResults;
        }
    };
}
