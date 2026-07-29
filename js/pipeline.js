// ==========================================
// PIPELINE MODULE (pipeline.js)
// ==========================================

function runAIFromPipeline(stockLines, buyers, historicalTrends = {}) {
    return runComprehensiveMatching(stockLines, buyers, historicalTrends);
}

function runComprehensiveMatching(stockLines, buyers, historicalTrends = {}) {
    console.log(`Running match...`);

    // Grab stock from direct arguments, window.all, or local variable `all` from stock.js
    let activeStock = [];
    if (Array.isArray(stockLines) && stockLines.length > 0) {
        activeStock = stockLines;
    } else if (typeof all !== 'undefined' && Array.isArray(all)) {
        activeStock = all;
    } else if (typeof window !== 'undefined' && window.all && Array.isArray(window.all)) {
        activeStock = window.all;
    } else if (typeof window !== 'undefined') {
        activeStock = window.stockLines || window.stock || window.floorStock || window.allStock || [];
    }

    // Grab buyers from arguments or global scope
    let activeBuyers = [];
    if (Array.isArray(buyers) && buyers.length > 0) {
        activeBuyers = buyers;
    } else if (typeof window !== 'undefined') {
        activeBuyers = window.buyers || window.allBuyers || window.loadedBuyers || [];
    }

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
