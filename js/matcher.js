/**
 * Comprehensive Matching Engine
 * Matches all stock lines against buyer preferences and historical buying trends.
 */

function normalizeString(str) {
    if (!str) return '';
    return str.toString().trim().toUpperCase();
}

function runComprehensiveMatching(stockLines, buyers, historicalTrends = {}) {
    console.log(`--- Starting Comprehensive Match ---`);
    console.log(`Stock lines loaded: ${stockLines.length}`);
    console.log(`Buyers loaded: ${buyers.length}`);

    // 1. Build a robust lookup index for all stock lines by normalized commodity name
    const stockIndex = new Map();
    stockLines.forEach(stock => {
        const commKey = normalizeString(stock.commodity || stock.comm || stock.name);
        if (!stockIndex.has(commKey)) {
            stockIndex.set(commKey, []);
        }
        stockIndex.get(commKey).push(stock);
    });

    const matchResults = [];

    // 2. Iterate through every buyer and evaluate preferences and historical trends
    buyers.forEach(buyer => {
        const buyerName = buyer.name || buyer.buyerName;
        const preferences = buyer.preferences || [];

        preferences.forEach(pref => {
            const rawComm = pref.comm || pref.commodity;
            const mappedComm = pref.mapped || rawComm;
            const searchKey = normalizeString(mappedComm);

            console.log(`Checking preference for ${buyerName}: comm="${rawComm}" -> mapped="${mappedComm}"`);

            // Direct lookup from stock index
            let candidates = stockIndex.get(searchKey) || [];

            // Fallback: Fuzzy or partial match if exact key lookup yields nothing (handling plurals/variations like "Oranges" vs "ORANGES")
            if (candidates.length === 0) {
                stockIndex.forEach((stockArray, stockKey) => {
                    if (stockKey.includes(searchKey) || searchKey.includes(stockKey)) {
                        candidates = candidates.concat(stockArray);
                    }
                });
            }

            // 3. Incorporate historical trend weighting if available
            const buyerHistory = historicalTrends[buyerName] || {};
            const itemHistoryScore = buyerHistory[mappedComm] || buyerHistory[rawComm] || 1.0;

            console.log(`Candidates found for ${mappedComm}: ${candidates.length} (Historical Weight: ${itemHistoryScore})`);

            if (candidates.length > 0) {
                matchResults.push({
                    buyer: buyerName,
                    commodity: mappedComm,
                    candidates: candidates,
                    trendScore: itemHistoryScore
                });
            }
        });
    });

    console.log(`--- Matching Complete. Total successful match groups: ${matchResults.length} ---`);
    return matchResults;
}
