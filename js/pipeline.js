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
    const stockArray = Array.isArray(stockLines) ? stockLines : [];

    return {
        matchBuyerPreferences(buyer) {
            const buyerName = buyer.name || buyer.buyerName || buyer.companyName || 'Unknown Buyer';
            const buyerTurnover = Number(buyer.turnover) || 0;
            
            const explicitPrefs = buyer.prefs || buyer.preferences || buyer.commPreferences || buyer.items || buyer.products || buyer.categories || buyer.buying || [];
            const buyerHistory = historicalTrends[buyerName] || {};
            const historyKeys = Object.keys(buyerHistory);
            
            const stockKeys = stockArray.map(s => s.commodity || s.comm || s.name || s.description).filter(Boolean);
            const allPrefsSet = new Set([...explicitPrefs, ...historyKeys, ...stockKeys]);
            const matchedResults = [];
            const processedCommodities = new Set();

            allPrefsSet.forEach(pref => {
                const rawComm = typeof pref === 'object' ? (pref.comm || pref.commodity || pref.name || '') : pref;
                const mappedComm = normalizeString(rawComm);
                if (!mappedComm) return;
                
                const baseSearchKey = getBaseCommodity(rawComm);
                if (processedCommodities.has(baseSearchKey)) return;

                let candidates = stockArray.filter(stock => {
                    const stockComm = normalizeString(stock.commodity || stock.comm || stock.name || stock.description || '');
                    return stockComm && (stockComm.includes(mappedComm) || mappedComm.includes(stockComm) || (baseSearchKey && stockComm.includes(baseSearchKey)));
                });

                if (candidates.length > 0) {
                    processedCommodities.add(baseSearchKey);

                    candidates.sort((a, b) => {
                        const qtyA = Number(a.qty || a.quantity || a.pallets || a.cartons || 0);
                        const qtyB = Number(b.qty || b.quantity || b.pallets || b.cartons || 0);
                        return qtyB - qtyA;
                    });

                    const topCandidate = candidates[0];

                    matchedResults.push({
                        buyer: buyerName,
                        buyerTurnover: buyerTurnover,
                        commodity: rawComm,
                        candidates: [topCandidate],
                        trendScore: buyerHistory[rawComm] || 1.0
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
        
        const matchesHtml = group.matches.map(m => {
            const stock = m.candidates[0];
            const desc = stock.description || stock.name || stock.comm || stock.commodity || m.commodity;
            const farmer = stock.farmer || stock.supplier || stock.grower || stock.producer || 'Unknown Farmer';
            const seqNr = stock.seq || stock.seqNr || stock.id || stock.code || 'N/A';
            const qty = stock.qty || stock.quantity || stock.pallets || stock.cartons || '';
            const size = stock.size || stock.count || '';

            return `
                <div style="background:var(--paper, #f8fafc); border-radius:8px; padding:10px; margin-bottom:8px; border:1.5px solid var(--border, #e2e8f0); display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                    <div>
                        <div style="font-weight:700; color:var(--moss, #1e4d2b); margin-bottom:2px;">
                            ${desc} ${size ? `(${size})` : ''} ${qty ? `- ${qty}` : ''}
                        </div>
                        <div style="color:var(--muted, #64748b); font-size:11px;">
                            Farmer: <span style="font-weight:600; color:#1e293b;">${farmer}</span> | Seq Nr: <span style="font-weight:600; color:#0f172a;">${seqNr}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div style="background:#fff; border-radius:12px; box-shadow:var(--shadow, 0 1px 3px rgba(0,0,0,0.05)); margin-bottom:10px; overflow:hidden; border:1.5px solid var(--border, #e2e8f0);">
                <div onclick="const el=document.getElementById('${dropdownId}'); el.style.display = el.style.display==='none'?'block':'none';" style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; cursor:pointer; background:#fff;">
                    <div>
                        <div style="font-weight:800; font-size:15px; color:#0f172a;">${group.buyer}</div>
                        <div style="font-size:11px; color:var(--muted, #64748b); margin-top:2px;">${group.matches.length} matching commodity line(s)</div>
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
