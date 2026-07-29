// ===== PIPELINE MATCHING FUNCTIONS =====

let livePipelineStock = [];
let livePipelineBuyers = [];

async function runComprehensiveMatching() {
  console.log("Running match...");
  
  let currentUser = 'CW';
  const activeTabBtn = document.querySelector('.floor-tab.active, .stock-tab.active, [id^="ftab-"].active, [id^="stab-"].active');
  if (activeTabBtn) {
    const text = activeTabBtn.textContent || activeTabBtn.innerText || '';
    if (text.trim()) currentUser = text.trim();
  }
  if (typeof currentLoginUser !== 'undefined' && currentLoginUser) {
    currentUser = currentLoginUser;
  }
  
  let dbKey = (currentUser === 'CDW') ? 'CW' : currentUser;

  try {
    const stockSnap = await firebase.database().ref('stock/' + dbKey).once('value');
    const stockVal = stockSnap.val();
    
    if (stockVal) {
      livePipelineStock = Object.values(stockVal);
    } else if (typeof liveStockData !== 'undefined' && liveStockData.length) {
      livePipelineStock = liveStockData;
    } else {
      const allStockSnap = await firebase.database().ref('stock').once('value');
      const allStockVal = allStockSnap.val();
      if (allStockVal) {
        livePipelineStock = [];
        for (const u in allStockVal) {
          for (const k in allStockVal[u]) {
            livePipelineStock.push(allStockVal[u][k]);
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
    } else if (typeof allBuyers !== 'undefined' && allBuyers.length) {
      livePipelineBuyers = allBuyers;
    }

  } catch (e) {
    console.warn("Pipeline fetch error:", e.message);
  }

  if (!livePipelineStock.length || !livePipelineBuyers.length) {
    console.warn("⚠️ Stock lines or buyers data is missing or empty!");
    const el = document.getElementById('pipeline-results');
    if (el) {
      el.innerHTML = '<div class="empty">⚠️ Stock lines or buyers data is missing or empty for user key: ' + dbKey + '.</div>';
    }
    return;
  }

  const matches = [];
  livePipelineStock.forEach(stockItem => {
    const stockBal = Number(stockItem.balance) || 0;
    if (stockBal <= 0) return; // Skip zero or negative stock

    livePipelineBuyers.forEach(buyer => {
      // Check if buyer has commodity interests and if it matches stock commodity
      const buyerComms = buyer.commodities || buyer.commodity || [];
      const stockComm = (stockItem.commodity || '').toLowerCase();
      
      let matchesCommodity = false;
      if (Array.isArray(buyerComms)) {
        matchesCommodity = buyerComms.some(c => String(c).toLowerCase().includes(stockComm) || stockComm.includes(String(c).toLowerCase()));
      } else if (typeof buyerComms === 'string') {
        matchesCommodity = buyerComms.toLowerCase().includes(stockComm) || stockComm.includes(buyerComms.toLowerCase());
      } else {
        // If buyer has no strict commodity restriction listed, allow general match or check preferences
        matchesCommodity = true; 
      }

      if (matchesCommodity) {
        matches.push({ stock: stockItem, buyer: buyer });
      }
    });
  });

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
    el.innerHTML = '<div class="empty">No matching pipeline results found. Check commodity configurations for buyers and stock.</div>';
    return;
  }

  el.innerHTML = matches.map((m, idx) => {
    return `<div style="background:#fff;border-radius:10px;padding:12px;margin-bottom:8px;border:1.5px solid var(--border)">
      <div style="font-weight:800;font-size:14px;color:var(--moss)">Match #${idx + 1}: ${m.stock.producer || 'Unknown'} (${m.stock.commodity || 'Item'}) -> ${m.buyer.name || m.buyer.company || 'Buyer'}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">Balance: ${m.stock.balance || 0} | Pack: ${m.stock.pack || '-'} | GRN: ${m.stock.grn || '-'}</div>
    </div>`;
  }).join('');
}
