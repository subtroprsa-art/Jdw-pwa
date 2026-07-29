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
            
            const explicitPrefs = buyer.prefs || buyer.preferences || buyer.commPreferences || buyer.items || [];
            const buyerHistory = historicalTrends[buyerName] || {};
            const historyKeys = Object.keys(buyerHistory);
            
            // Combine all potential commodities this buyer cares about
            const allPrefsSet = new Set([...explicitPrefs, ...historyKeys]);
            const matchedResults = [];

            allPrefsSet.forEach(pref => {
                const rawComm = typeof pref === 'object' ? (pref.comm || pref.commodity || pref.name || '') : pref;
                const mappedComm = normalizeString(rawComm);
                if (!mappedComm) return;
                
                const exactSearchKey = mappedComm;
                const baseSearchKey = getBaseCommodity(rawComm);

                let candidates = [];
                const seenStockIds = new Set();

                // 1. Exact match check
                if (exactStockIndex.has(exactSearchKey)) {
                    exactStockIndex.get(exactSearchKey).forEach(s => {
                        const sId = s.id || s.code || JSON.stringify(s);
                        if (!seenStockIds.has(sId)) {
                            seenStockIds.add(sId);
                            candidates.push(s);
                        }
                    });
                }

                // 2. Base match check
                if (baseStockIndex.has(baseSearchKey)) {
                    baseStockIndex.get(baseSearchKey).forEach(s => {
                        const sId = s.id || s.code || JSON.stringify(s);
                        if (!seenStockIds.has(sId)) {
                            seenStockIds.add(sId);
                            candidates.push(s);
                        }
                    });
                }

                // 3. Substring / keyword match check across all stock lines
                if (exactSearchKey.length > 2) {
                    stockArray.forEach(stock => {
                        const stockComm = normalizeString(stock.commodity || stock.comm || stock.name || stock.description || '');
                        const sId = stock.id || stock.code || JSON.stringify(stock);
                        if (stockComm && (stockComm.includes(exactSearchKey) || exactSearchKey.includes(stockComm) ||
                            (baseSearchKey && stockComm.includes(baseSearchKey)))) {
                            if (!seenStockIds.has(sId)) {
                                seenStockIds.add(sId);
                                candidates.push(stock);
                            }
                        }
                    });
                }

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

function runAIFromPipeline(stockLines, buyers, historicalTrends = {}) {
    const results = runComprehensiveMatching(stockLines, buyers, historicalTrends);
    renderMatchResults(results);
    return results;
}

function runComprehensiveMatching(stockLines, buyers, historicalTrends = {}) {
    console.log(`Running match...`);

    const activeStock = (Array.isArray(stockLines) && stockLines.length > 0) ? stockLines : (window.stockLines || []);
    const activeBuyers = (Array.isArray(buyers) && buyers.length > 0) ? buyers : (window.allBuyers || window.liveBuyerData || []);

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

    matchResults.sort((a, b) => b.buyerTurnover - a.buyerTurnover);

    console.log(`Matches found: ${totalMatchesFound}`);
    console.log(`--- Matching Complete. Total match groups: ${matchResults.length} (Sorted by Highest Value) ---`);
    return matchResults;
}

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
        // Deduplicate commodities per buyer to ensure every matched category lists cleanly
        const existingMatch = buyerMap[res.buyer].matches.find(m => m.commodity.toUpperCase() === res.commodity.toUpperCase());
        if (!existingMatch) {
            buyerMap[res.buyer].matches.push(res);
        }
    });

    const sortedBuyers = Object.values(buyerMap).sort((a, b) => b.turnover - a.turnover);

    let container = document.getElementById('pipeline-buyers') || document.getElementById('match-results-container');
    if (!container) {
        console.warn("⚠️ Element with id 'pipeline-buyers' not found in DOM.");
        return;
    }

    const callListSection = document.getElementById('pipeline-call-list');
    if (callListSection) {
        callListSection.style.display = 'block';
    }

    if (sortedBuyers.length === 0) {
        container.innerHTML = '<div class="empty">No matches found.</div>';
        return;
    }

    container.innerHTML = sortedBuyers.map((group, index) => {
        const dropdownId = 'match-dropdown-' + index;
        
        const matchesHtml = group.matches.map(m => `
            <div style="background:var(--paper, #f8fafc); border-radius:8px; padding:10px; margin-bottom:8px; border:1.5px solid var(--border, #e2e8f0);">
                <div style="font-weight:700; font-size:13px; color:var(--moss, #1e4d2b); margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                    <span>Commodity Preference: ${m.commodity}</span>
                    <span style="font-size:11px; background:#e2e8f0; padding:2px 6px; border-radius:4px; color:#475569;">${m.candidates.length} available</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    ${m.candidates.map(stock => {
                        const desc = stock.description || stock.name || stock.comm || stock.commodity || 'Stock Line';
                        const farmer = stock.farmer || stock.supplier || stock.grower || stock.producer || '';
                        const qty = stock.qty || stock.quantity || stock.pallets || stock.cartons || '';
                        const price = stock.price || stock.rate || '';

                        return `
                            <div style="background:#fff; padding:8px 10px; border-radius:6px; border:1.5px solid var(--border, #cbd5e1); display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                                <div>
                                    <span style="font-weight:700; color:#0f172a;">${desc}</span>
                                    ${farmer ? `<div style="font-size:11px; color:var(--muted, #64748b);">Farmer/Grower: <span style="font-weight:600; color:#1e293b;">${farmer}</span></div>` : ''}
                                </div>
                                <div style="text-align:right;">
                                    ${qty ? `<div style="font-weight:700; color:var(--moss);">${qty} units</div>` : ''}
                                    ${price ? `<div style="font-size:11px; color:var(--muted);">R ${price}</div>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `).join('');

        return `
            <div style="background:#fff; border-radius:12px; box-shadow:var(--shadow, 0 1px 3px rgba(0,0,0,0.05)); margin-bottom:10px; overflow:hidden; border:1.5px solid var(--border, #e2e8f0);">
                <div onclick="const el=document.getElementById('${dropdownId}'); el.style.display = el.style.display==='none'?'block':'none';" style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; cursor:pointer; background:#fff;">
                    <div>
                        <div style="font-weight:800; font-size:15px; color:#0f172a;">${group.buyer}</div>
                        <div style="font-size:11px; color:var(--muted, #64748b); margin-top:2px;">${group.matches.length} matching commodity category(ies)</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="background:var(--moss, #1e4d2b); border-radius:8px; padding:6px 12px; text-align:center;">
                            <div style="font-size:14px; font-weight:800; color:#fff;">R ${group.turnover.toLocaleString()}</div>
                            <div style="font-size:8px; color:rgba(255,255,255,0.8); text-transform:uppercase;">historical value</div>
                        </div>
                        <div style="color:var(--muted, #64748b); font-size:14px;">▼</div>
                    </div>
                </div>
                <div id="${dropdownId}" style="display:none; padding:12px; background:var(--card, #fff); border-top:1px solid var(--border, #e2e8f0);">
                    ${matchesHtml}
                </div>
            </div>
        `;
    }).join('');
}
