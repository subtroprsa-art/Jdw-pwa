// ==========================================
// COMPLETE pipeline.js FILE
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
            // Target b.prefs which is what buyers.js actually outputs[cite: 2]
            const preferences = buyer.prefs || buyer.preferences || buyer.commPreferences || buyer.items || [];
            const matchedResults = [];

            preferences.forEach(pref => {
                const rawComm = typeof pref === 'object' ? (pref.comm || pref.commodity || pref.name || '') : pref;
                const mappedComm = normalizeString(rawComm);
                
                const exactSearchKey = mappedComm;
                const baseSearchKey = getBaseCommodity(rawComm);

                let candidates = exactStockIndex.get(exactSearchKey) || [];

                if (candidates.length === 0) {
                    candidates = baseStockIndex.get(baseSearchKey) || [];
                }

                if (candidates.length === 0) {
                    exactStockIndex.forEach((stockArray, stockKey) => {
                        if (stockKey && exactSearchKey && (stockKey.includes(exactSearchKey) || exactSearchKey.includes(stockKey))) {
                            candidates = candidates.concat(stockArray);
                        }
                    });
                }

                const buyerHistory = historicalTrends[buyerName] || {};
                const itemHistoryScore = buyerHistory[rawComm] || 1.0;

                if (candidates.length > 0) {
                    matchedResults.push({
                        buyer: buyerName,
                        commodity: rawComm,
                        candidates: candidates,
                        trendScore: itemHistoryScore
                    });
                }
            });

            return matchedResults;
        }
    };
}

// Bridge function called by your UI button
function runAIFromPipeline(stockLines, buyers, historicalTrends = {}) {
    return runComprehensiveMatching(stockLines, buyers, historicalTrends);
}

function runComprehensiveMatching(stockLines, buyers, historicalTrends = {}) {
    console.log(`Running match...`);

    const activeStock = (Array.isArray(stockLines) && stockLines.length > 0) ? stockLines : (window.stockLines || []);
    const activeBuyers = (Array.isArray(buyers) && buyers.length > 0) ? buyers : (window.allBuyers || window.liveBuyerData || []);

    console.log(`Stock lines for matching: ${activeStock.length}`);
    console.log(`Buyers for matching: ${activeBuyers.length}`);

    if (activeStock.length === 0 || activeBuyers.length === 0) {
        console.warn("⚠️ Stock lines or buyers data is missing or empty!");
        return [];
    }

    const matcher = createMatcher(activeStock, historicalTrends);
    
    let totalMatchesFound = 0;
    const matchResults = [];

    activeBuyers.forEach(buyer => {
        const results = matcher.matchBuyerPreferences(buyer);
        results.forEach(res => {
            totalMatchesFound += res.candidates.length;
            matchResults.push(res);
        });
    });

    console.log(`Matches found: ${totalMatchesFound}`);
    console.log(`--- Matching Complete. Total match groups: ${matchResults.length} ---`);
    return matchResults;
}
