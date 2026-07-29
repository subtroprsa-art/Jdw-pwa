// ===== PIPELINE MATCHING FUNCTIONS =====

async function runComprehensiveMatching() {
  console.log("Running match...");

  let pipelineStock = [];
  let pipelineBuyers = [];

  try {
    // 1. Pull stock and history data simultaneously from Firebase
    const [stockSnap, historySnap] = await Promise.all([
      firebase.database().ref('stock').once('value'),
      firebase.database().ref('jdw/history').once('value') //[cite: 1]
    ]);

    // Process Stock
    const stockVal = stockSnap.val();
    if (stockVal) {
      for (const u in stockVal) {
        for (const e in stockVal[u]) {
          const item = stockVal[u][e];
          if (item && typeof item === 'object') {
            pipelineStock.push({ ...item, _nodeKey: u, _id: e });
          }
        }
      }
    }

    if (!pipelineStock.length && typeof allLiveStockData !== 'undefined' && allLiveStockData.length) {
      pipelineStock = allLiveStockData;
    }

    // Process Buyers using the exact history path and builder logic from buyers.js[cite: 1]
    const rawHistory = historySnap.val();
    if (rawHistory) {
      const hist = Array.isArray(rawHistory) ? rawHistory : Object.values(rawHistory);
      pipelineBuyers = buildPipelineBuyerProfiles(hist);
    } else if (typeof liveBuyerData !== 'undefined' && liveBuyerData.length > 0) {
      pipelineBuyers = liveBuyerData;
    }

  } catch (e) {
    console.warn("Pipeline fetch error:", e.message);
  }

  console.log("Pipeline Loaded -> Stock count:", pipelineStock.length, "Buyers count:", pipelineBuyers.length);

  if (!pipelineStock.length || !pipelineBuyers.length) {
    console.warn("⚠️ Stock lines or buyers data is missing or empty!");
    const el = document.getElementById('pipeline-results');
    if (el) {
      el.innerHTML = '<div class="empty">⚠️ Stock lines or buyers data is missing or empty.</div>';
    }
    return;
  }

  const matches = [];
  
  pipelineStock.forEach(stockItem => {
    const stockBal = Number(stockItem.balance !== undefined ? stockItem.balance : 1);
    if (stockBal <= 0) return; // Skip zero or negative stock

    const stockComm = String(stockItem.commodity || stockItem.item || '').toLowerCase().trim();

    pipelineBuyers.forEach(buyer => {
      // Check buyer preferences mapped from history
      const buyerPrefs = buyer.prefs || [];
      
      let isMatch = false;
      if (Array.isArray(buyerPrefs)) {
        isMatch = buyerPrefs.some(pref => {
          const bc = String(pref.comm || '').toLowerCase().trim();
          return bc && (stockComm.includes(bc) || bc.includes(stockComm));
        });
      }

      if (isMatch) {
        matches.push({ stock: stockItem, buyer: buyer });
      }
    });
  });

  console.log("Filtered pipeline matches:", matches.length);
  renderPipelineMatches(matches);
}

// Helper mirroring buildBuyerProfiles from buyers.js to format history into buyer profiles[cite: 1]
function buildPipelineBuyerProfiles(history) {
  const map = {};
  const CN = { AVOS: 'Avocados', LEMS: 'Lemons', NAAR: 'Naartjies', ORGS: 'Oranges', CLTM: 'Clementines', KIWI: 'Kiwifruit', STRS: 'Strawberries', FIGS: 'Figs', GVS: 'Guavas', DRAG: 'Dragon Fruit', MANG: 'Mangoes', GFT: 'Grapefruit', UNK: 'Unknown', SATS: 'Satsumas', PAPO: 'Papino', BERS: 'Berries' };

  for (const h of history) {
    if (!h.buyer || h.buyer === 'UNKNOWN') continue;
    const nm = h.buyer;
    if (!map[nm]) map[nm] = { name: nm, acc: h.account || '', txns: 0, turnover: 0, prefs: {} };
    const b = map[nm];
    
    const lt = Number(h.pricesSum) || Number(h.total) || Number(h.revenue) || (Number(h.price || 0) * Number(h.qty || 0)) || 0;
    
    b.txns++;
    b.turnover += lt;
    if (!b.acc && h.account) b.acc = h.account;
    const comm = h.commodity || 'UNK';
    if (!b.prefs[comm]) b.prefs[comm] = { comm: CN[comm] || comm, revenue: 0 };
    b.prefs[comm].revenue += lt;
  }

  return Object.values(map).map(b => ({
    name: b.name,
    acc: b.acc,
    txns: b.txns,
    turnover: Math.round(b.turnover),
    prefs: Object.values(b.prefs)
  }));
}

function runAIFromPipeline() {
  console.log("runAIFromPipeline invoked");
  if (typeof runComprehensiveMatching === 'function') {
    runComprehensiveMatching();
  } else {
    console.warn("runComprehensiveMatching is not available.");
  }
}

function renderPipelineMatches(matches) {
  const el = document.getElementById('pipeline-results');
  if (!el) return;

  if (!matches || !matches.length) {
    el.innerHTML = '<div class="empty">No matching pipeline results found based on commodity filters.</div>';
    return;
  }

  el.innerHTML = matches.slice(0, 50).map((m, idx) => {
    return `<div style="background:#fff;border-radius:10px;padding:12px;margin-bottom:8px;border:1.5px solid var(--border)">
      <div style="font-weight:800;font-size:14px;color:var(--moss)">Match #${idx + 1}: ${m.stock.producer || m.stock.item || 'Unknown'} (${m.stock.commodity || 'Item'}) -> ${m.buyer.name}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">Balance: ${m.stock.balance || 0} | Pack: ${m.stock.pack || '-'} | GRN: ${m.stock.grn || '-'}</div>
    </div>`;
  }).join('');
}
