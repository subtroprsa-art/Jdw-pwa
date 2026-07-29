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
            const buyerTurnover = Number(buyer.turnover) || 0;
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
                        buyerTurnover: buyerTurnover,
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
    const results = runComprehensiveMatching(stockLines, buyers, historicalTrends);
    renderMatchResults(results);
    return results;
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

    // SORT MATCH GROUPS: Highest buyer historical turnover/value first
    matchResults.sort((a, b) => b.buyerTurnover - a.buyerTurnover);

    console.log(`Matches found: ${totalMatchesFound}`);
    console.log(`--- Matching Complete. Total match groups: ${matchResults.length} (Sorted by Highest Value) ---`);
    return matchResults;
}

// RENDER MATCH RESULTS TO DASHBOARD UI
function renderMatchResults(matchResults) {
    const buyerMap = {};
    matchResults.forEach(res => {
        if (!buyerMap[res.buyer]) {
            buyerMap[res.buyer] = {
                buyer: res.buyer,
                turnover: res.buyerTurnover || 0,
                matches: []
            };
        }
        buyerMap[res.buyer].matches.push(res);
    });

    const sortedBuyers = Object.values(buyerMap).sort((a, b) => b.turnover - a.turnover);

    let container = document.getElementById('match-results-container');
    if (!container) {
        console.warn("⚠️ Element with id 'match-results-container' not found in DOM.");
        return;
    }

    if (sortedBuyers.length === 0) {
        container.innerHTML = '<div class="empty">No matches found.</div>';
        return;
    }

    container.innerHTML = sortedBuyers.map((group, index) => {
        const dropdownId = 'match-dropdown-' + index;
        
        const matchesHtml = group.matches.map(m => `
            <div style="background:var(--paper, #f8fafc); border-radius:8px; padding:10px; margin-bottom:8px; border:1px solid var(--border, #e2e8f0);">
                <div style="font-weight:700; font-size:13px; color:var(--moss, #1e4d2b); margin-bottom:6px;">
                    Commodity Preference: ${m.commodity}
                </div>
                <div style="font-size:12px; color:var(--muted, #64748b);">
                    ${m.candidates.length} stock candidate(s) available on floor.
                </div>
            </div>
        `).join('');

        return `
            <div style="background:#fff; border-radius:12px; box-shadow:var(--shadow, 0 1px 3px rgba(0,0,0,0.05)); margin-bottom:10px; overflow:hidden; border:1.5px solid var(--border, #e2e8f0);">
                <div onclick="toggleSection('${dropdownId}')" style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; cursor:pointer; background:#fff;">
                    <div>
                        <div style="font-weight:800; font-size:15px; color:#0f172a;">${group.buyer}</div>
                        <div style="font-size:11px; color:var(--muted, #64748b); margin-top:2px;">${group.matches.length} matching commodity category(ies)</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="background:var(--moss, #1e4d2b); border-radius:8px; padding:6px 12px; text-align:center;">
                            <div style="font-size:14px; font-weight:800; color:#fff;">R ${group.turnover.toLocaleString()}</div>
                            <div style="font-size:8px; color:rgba(255,255,255,0.8); text-transform:uppercase;">historical value</div>
                        </div>
                        <div id="arr-${dropdownId}" style="color:var(--muted, #64748b); font-size:14px; transition:transform .2s;">▼</div>
                    </div>
                </div>
                <div id="${dropdownId}" style="display:none; padding:12px; background:var(--card, #fff); border-top:1px solid var(--border, #e2e8f0);">
                    ${matchesHtml}
                </div>
            </div>
        `;
    }).join('');
}
