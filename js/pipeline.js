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

function runComprehensiveMatching(stockLines, buyers, historicalTrends = {}) {
    console.log(`Running match...`);
    console.log(`Stock lines for matching: ${stockLines ? stockLines.length : 0}`);
    console.log(`Buyers for matching: ${buyers ? buyers.length : 0}`);

    if (!stockLines || stockLines.length === 0 || !buyers || buyers.length === 0) {
        console.warn("⚠️ Stock lines or buyers data is missing or empty!");
        return [];
    }

    // Inspect the first item so you can see what keys your database is actually using in the console
    console.log("--- DEBUG INSPECT ---");
    console.log("First stock line sample:", stockLines[0]);
    console.log("First buyer sample:", buyers[0]);
    console.log("---------------------");

    // Build lookup indexes supporting multiple common property names
    const exactStockIndex = new Map();
    const baseStockIndex = new Map();

    stockLines.forEach(stock => {
        // Checking all potential field names where the commodity name might be stored
        const rawComm = stock.commodity || stock.comm || stock.name || stock.item || stock.description || stock.produce || '';
        const exactKey = normalizeString(rawComm);
        const baseKey = getBaseCommodity(rawComm);

        if (exactKey) {
            if (!exactStockIndex.has(exactKey)) {
                exactStockIndex.set(exactKey, []);
            }
            exactStockIndex.get(exactKey).push(stock);
        }

        if (baseKey) {
            if (!baseStockIndex.has(baseKey)) {
                baseStockIndex.set(baseKey, []);
            }
            baseStockIndex.get(baseKey).push(stock);
        }
    });

    const matchResults = [];
    let totalMatchesFound = 0;

    // Evaluate buyer preferences against stock indexes
    buyers.forEach(buyer => {
        const buyerName = buyer.name || buyer.buyerName || buyer.companyName || 'Unknown Buyer';
        const preferences = buyer.preferences || buyer.commPreferences || buyer.items || [];

        preferences.forEach(pref => {
            const rawComm = pref.comm || pref.commodity || pref.name || '';
            const mappedComm = pref.mapped || pref.mappedCommodity || rawComm;
            
            const exactSearchKey = normalizeString(mappedComm);
            const baseSearchKey = getBaseCommodity(mappedComm);

            console.log(`Checking preference for ${buyerName}: comm="${rawComm}" -> mapped="${mappedComm}"`);

            // Tier 1: Exact match
            let candidates = exactStockIndex.get(exactSearchKey) || [];

            // Tier 2: Singular/plural base match (e.g., Oranges vs ORANGE)
            if (candidates.length === 0) {
                candidates = baseStockIndex.get(baseSearchKey) || [];
            }

            // Tier 3: Substring fallback search
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
