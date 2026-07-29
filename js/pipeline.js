// ===== PIPELINE MATCHING FUNCTIONS =====

let livePipelineStock = [];
let livePipelineBuyers = [];

async function runComprehensiveMatching() {
  console.log("Running match...");

  try {
    // Pull the entire stock tree across all user nodes, matching your app's loadAllStockData()
    const snapshot = await firebase.database().ref('stock').once('value');
    const d = snapshot.val();
    
    livePipelineStock = [];
    if (d) {
      for (const u in d) {
        for (const e in d[u]) {
          const item = d[u][e];
          if (item && typeof item === 'object') {
            livePipelineStock.push({ ...item, _nodeKey: u, _id: e });
          }
        }
      }
    }

    const buyersSnap = await firebase.database().ref('buyers').once('value');
    const buyersVal = buyersSnap.val();
    if (buyersVal) {
      livePipelineBuyers = Object.values(buyersVal);
    } else if (typeof liveBuyersData !== 'undefined' && liveBuyersData.length) {
      livePipelineBuyers = liveBuyersData;
    }

  } catch (e) {
    console.warn("Pipeline fetch error:", e.message);
  }

  console.log("Pipeline Loaded -> Total Stock count across all nodes:", livePipelineStock.length, "Buyers count:", livePipelineBuyers.length);

  if (!livePipelineStock.length || !livePipelineBuyers.length) {
    console.warn("⚠️ Stock lines or buyers data is missing or empty!");
    const el = document.getElementById('pipeline-results');
    if (el) {
      el.innerHTML = '<div class="empty">⚠️ Stock lines or buyers data is missing or empty.</div>';
    }
    return;
  }

  const matches = [];
  
  livePipelineStock.forEach(stockItem => {
    const stockBal = Number(stockItem.balance !== undefined ? stockItem.balance : 1);
    if (stockBal <= 0) return; // Skip zero or negative stock

    const stockComm = String(stockItem.commodity || stockItem.item || '').toLowerCase().trim();

    livePipelineBuyers.forEach(buyer => {
      const buyerComms = buyer.commodities || buyer.commodity || buyer.products || [];
      
      let isMatch = false;
      if (Array.isArray(buyerComms)) {
        isMatch = buyerComms.some(c => {
          const bc = String(c).toLowerCase().trim();
          return bc && (stockComm.includes(bc) || bc.includes(stockComm));
        });
      } else if (typeof buyerComms === 'string') {
        const bc = buyerComms.toLowerCase().trim();
        isMatch = bc && (stockComm.includes(bc) || bc.includes(stockComm));
      } else {
        isMatch = true;
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
      <div style="font-weight:800;font-size:14px;color:var(--moss)">Match #${idx + 1}: ${m.stock.producer || m.stock.item || 'Unknown'} (${m.stock.commodity || 'Item'}) -> ${m.buyer.name || m.buyer.company || 'Buyer'}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">Balance: ${m.stock.balance || 0} | Pack: ${m.stock.pack || '-'} | GRN: ${m.stock.grn || '-'}</div>
    </div>`;
  }).join('');
}
