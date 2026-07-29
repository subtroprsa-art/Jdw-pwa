// ===== PIPELINE MATCHING FUNCTIONS =====

async function runComprehensiveMatching() {
  console.log("Running match...");
  
  // Ensure we have stock data loaded, mapping CDW to CW for Firebase
  let stockSource = typeof liveStockData !== 'undefined' ? liveStockData : [];
  
  if (!stockSource.length && typeof firebase !== 'undefined') {
    try {
      let currentUser = typeof currentLoginUser !== 'undefined' ? currentLoginUser : 'CW';
      let dbKey = (currentUser === 'CDW') ? 'CW' : currentUser;
      
      const snapshot = await firebase.database().ref('stock/' + dbKey).once('value');
      const d = snapshot.val();
      if (d) {
        stockSource = Object.values(d);
      }
    } catch (e) {
      console.warn("Pipeline stock fetch error:", e.message);
    }
  }

  let buyersSource = typeof liveBuyersData !== 'undefined' ? liveBuyersData : [];
  if (!buyersSource.length && typeof allBuyers !== 'undefined') {
    buyersSource = allBuyers;
  }

  if (!stockSource.length || !buyersSource.length) {
    console.warn("⚠️ Stock lines or buyers data is missing or empty!");
    const el = document.getElementById('pipeline-results');
    if (el) {
      el.innerHTML = '<div class="empty">⚠️ Stock lines or buyers data is missing or empty! Check data loading for ' + (typeof currentLoginUser !== 'undefined' ? currentLoginUser : 'active user') + '.</div>';
    }
    return;
  }

  // Run matching logic against valid sources
  const matches = [];
  stockSource.forEach(stockItem => {
    buyersSource.forEach(buyer => {
      // Basic matching criteria evaluation
      if (stockItem.commodity && buyer.commodities && buyer.commodities.includes(stockItem.commodity)) {
        matches.push({ stock: stockItem, buyer: buyer });
      }
    });
  });

  renderPipelineMatches(matches);
}

function renderPipelineMatches(matches) {
  const el = document.getElementById('pipeline-results');
  if (!el) return;

  if (!matches || !matches.length) {
    el.innerHTML = '<div class="empty">No matching pipeline results found.</div>';
    return;
  }

  el.innerHTML = matches.map((m, idx) => {
    return `<div style="background:#fff;border-radius:10px;padding:12px;margin-bottom:8px;border:1.5px solid var(--border)">
      <div style="font-weight:800;font-size:14px;color:var(--moss)">Match #${idx + 1}: ${m.stock.producer || 'Unknown'} (${m.stock.commodity}) -> ${m.buyer.name || 'Buyer'}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">Balance: ${m.stock.balance || 0} | Pack: ${m.stock.pack || '-'}</div>
    </div>`;
  }).join('');
}
