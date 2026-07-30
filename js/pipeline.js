// ===== PIPELINE MATCHING FUNCTIONS =====[cite: 1]

async function runComprehensiveMatching() {
  console.log("Running comprehensive pipeline match...");

  let pipelineStock = [];
  let pipelineBuyers = [];

  try {
    // 1. Pull stock directly from Firebase[cite: 1]
    const stockSnap = await firebase.database().ref('stock').once('value');
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

    // 2. Grab the buyers directly from the global array buyers.js already loaded[cite: 1]
    if (typeof liveBuyerData !== 'undefined' && liveBuyerData.length > 0) {
      pipelineBuyers = liveBuyerData;
    } else if (typeof allBuyers !== 'undefined' && allBuyers.length > 0) {
      pipelineBuyers = allBuyers;
    }

  } catch (e) {
    console.warn("Pipeline fetch error:", e.message);
  }

  console.log("Pipeline Loaded -> Stock count:", pipelineStock.length, "Buyers count:", pipelineBuyers.length);

  const el = document.getElementById('pipeline-results');

  if (!pipelineStock.length || !pipelineBuyers.length) {
    console.warn("⚠️ Stock lines or buyers data is missing or empty!");
    if (el) {
      el.innerHTML = '<div class="empty">⚠️ Stock lines or buyers data is missing or empty. Please ensure buyers are loaded.</div>';
    }
    return;
  }

  const matches = [];
  
  pipelineStock.forEach(stockItem => {
    const stockBal = Number(stockItem.balance !== undefined ? stockItem.balance : 1);
    if (stockBal <= 0) return; // Skip zero or negative stock[cite: 1]

    const stockComm = String(stockItem.commodity || stockItem.item || '').toLowerCase().trim();

    pipelineBuyers.forEach(buyer => {
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

function runAIFromPipeline() {
  console.log("runAIFromPipeline invoked");
  runComprehensiveMatching();
}

function renderPipelineMatches(matches) {
  const el = document.getElementById('pipeline-results');
  if (!el) return;

  if (!matches || !matches.length) {
    el.innerHTML = '<div class="empty">No matching pipeline results found based on commodity filters.</div>';
    return;
  }

  // Filter out any matches with 0 or negative balance
  const validMatches = matches.filter(m => Number(m.stock.balance || 0) > 0);

  if (!validMatches.length) {
    el.innerHTML = '<div class="empty">No stock with available balance found for these matches.</div>';
    return;
  }

  el.innerHTML = validMatches.slice(0, 50).map((m, idx) => {
    // Pull readable properties from your stock object instead of raw index arrays
    const productName = m.stock.item || m.stock.commodity || m.stock.variety || 'Produce Item';
    const variety = m.stock.variety ? ` - ${m.stock.variety}` : '';
    const classGrade = m.stock.grade ? `Class ${m.stock.grade}` : '';
    const sizeMark = m.stock.size ? `Size: ${m.stock.size}` : '';

    return `<div style="background:#fff;border-radius:10px;padding:12px;margin-bottom:8px;border:1.5px solid var(--border)">
      <div style="font-weight:800;font-size:14px;color:var(--moss)">Match #${idx + 1}: ${m.buyer.name}</div>
      <div style="font-size:12px;font-weight:700;color:#333;margin-top:2px">${productName}${variety} (${classGrade}, ${sizeMark})</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">Balance: <strong>${m.stock.balance}</strong> | Pack: ${m.stock.pack || '-'} | GRN: ${m.stock.grn || '-'}</div>
    </div>`;
  }).join('');
}
