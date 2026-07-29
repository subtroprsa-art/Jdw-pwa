// ==========================================
// 2. PIPELINE MODULE (pipeline.js)
// ==========================================

// Bridge function referenced by UI/buttons
function runAIFromPipeline(stockLines, buyers, historicalTrends = {}) {
    return runComprehensiveMatching(stockLines, buyers, historicalTrends);
}

function runComprehensiveMatching(stockLines, buyers, historicalTrends = {}) {
    console.log(`Running match...`);

    // Resolve active datasets via direct arguments or reliable global scope lookups
    const activeStock = (Array.isArray(stockLines) && stockLines.length > 0) ? stockLines : 
        (window.stockLines || window.stock || window.floorStock || window.allStock || window.stockData || []);
    
    const activeBuyers = (Array.isArray(buyers) && buyers.length > 0) ? buyers : 
        (window.buyers || window.allBuyers || window.loadedBuyers || window.buyerData || []);

    console.log(`Stock lines for matching: ${activeStock.length}`);
    console.log(`Buyers for matching: ${activeBuyers.length}`);

    if (activeStock.length === 0 || activeBuyers.length === 0) {
        console.warn("⚠️ Stock lines or buyers data is missing or empty!");
        return [];
    }

    // Initialize the matcher engine with the loaded stock lines
    const matcher = createMatcher(activeStock, historicalTrends);
    
    let totalMatchesFound = 0;
    const matchResults = [];

    // Process all buyers through the matcher engine
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
