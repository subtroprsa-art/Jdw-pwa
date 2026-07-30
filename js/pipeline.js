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

  const rawMatches = [];
  
  pipelineStock.forEach(stockItem => {
    const stockComm = String(stockItem.commodity || stockItem.variety || '').toLowerCase().trim();

    pipelineBuyers.forEach(buyer => {
      const buyerPrefs = buyer.prefs || buyer.history || [];
      
      let isMatch = false;
      if (Array.isArray(buyerPrefs)) {
        isMatch = buyerPrefs.some(pref => {
          const bc = String(pref.comm || pref.commodity || pref.name || '').toLowerCase().trim();
          return bc && (stockComm.includes(bc) || bc.includes(stockComm));
        });
      }

      if (isMatch) {
        rawMatches.push({ stock: stockItem, buyer: buyer });
      }
    });
  });

  console.log("Filtered pipeline matches:", rawMatches.length);
  renderPipelineMatches(rawMatches);
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

  // Group matches by Buyer and keep ONLY the single best match per commodity
  const buyerMap = {};

  matches.forEach(m => {
    const buyerName = m.buyer.name || 'Unknown Buyer';
    if (!buyerMap[buyerName]) {
      buyerMap[buyerName] = {
        buyerObj: m.buyer,
        turnover: Number(m.buyer.turnover || m.buyer.totalSpent || m.buyer.revenue || 0),
        commodities: {}
      };
    }

    const commodityKey = String(m.stock.commodity || m.stock.variety || 'Item').toLowerCase().trim();
    const stockQty = Number(m.stock.count !== undefined ? m.stock.count : (m.stock.qty_rec || m.stock.qty_sort || 0));

    // Keep only the highest quantity/best item per commodity if multiple exist
    if (!buyerMap[buyerName].commodities[commodityKey] || stockQty > buyerMap[buyerName].commodities[commodityKey]._sortQty) {
      buyerMap[buyerName].commodities[commodityKey] = {
        ...m.stock,
        _sortQty: stockQty
      };
    }
  });

  // Convert buyer map to an array and rank buyers by turnover descending (highest turnover first)
  const sortedBuyers = Object.keys(buyerMap).map(buyerName => {
    return {
      name: buyerName,
      turnover: buyerMap[buyerName].turnover,
      stockItems: Object.values(buyerMap[buyerName].commodities)
    };
  }).sort((a, b) => b.turnover - a.turnover);

  // Render collapsible dropdown container for each ranked buyer
  let htmlOutput = '';
  
  sortedBuyers.forEach((buyerData, idx) => {
    const dropdownId = `buyer-dropdown-${idx}`;
    const formattedTurnover = buyerData.turnover ? `R ${buyerData.turnover.toLocaleString()}` : 'R 0';

    htmlOutput += `
      <div style="background:#fff;border-radius:10px;margin-bottom:10px;border:1.5px solid var(--border);overflow:hidden;">
        <div onclick="toggleBuyerDropdown('${dropdownId}')" style="padding:14px 16px;background:#f8f9fa;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:800;font-size:15px;color:var(--moss);">
            ${buyerData.name} 
            <span style="font-size:12px;color:var(--muted);font-weight:normal;margin-left:8px;">(Turnover: ${formattedTrust(formattedTurnover)})</span>
          </div>
          <div style="font-size:12px;color:var(--muted);font-weight:bold;display:flex;align-items:center;gap:8px;">
            <span>${buyerData.stockItems.length} Products</span>
            <span>▼</span>
          </div>
        </div>
        <div id="${dropdownId}" style="display:none;padding:12px 16px;border-top:1px solid var(--border);background:#fff;">
    `;

    buyerData.stockItems.forEach(stock => {
      const variety = stock.variety || stock.commodity || 'Produce Item';
      const producer = stock.producer ? ` - ${stock.producer}` : '';
      const grade = stock.grade ? `Grade ${stock.grade}` : '';
      const size = stock.size ? `Size: ${stock.size}` : '';
      const availableQty = stock.count !== undefined ? stock.count : (stock.qty_rec || stock.qty_sort || 'N/A');

      htmlOutput += `
        <div style="padding:8px 0;border-bottom:1px solid #eee;">
          <div style="font-size:13px;font-weight:700;color:#333;">${variety}${producer} (${grade}, ${size})</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">Count/Qty: <strong>${availableQty}</strong> | Pack: ${stock.pack || '-'} | GRN: ${stock.grn || '-'}</div>
        </div>
      `;
    });

    htmlOutput += `
        </div>
      </div>
    `;
  });

  el.innerHTML = htmlOutput;
}

// Helper for formatting turnover text cleanly
function formattedTrust(val) {
  return val;
}

// Helper function to handle opening/closing the dropdown accordions
function toggleBuyerDropdown(id) {
  const dropdown = document.getElementById(id);
  if (dropdown) {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  }
}
