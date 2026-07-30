// ===== PIPELINE MATCHING FUNCTIONS =====[cite: 1]

// 1. Normalization & Indexing Helpers
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

async function runComprehensiveMatching() {
  console.log("Running comprehensive pipeline match...");

  let pipelineStock = [];
  let pipelineBuyers = [];

  try {
    // 2. Pull stock directly from Firebase[cite: 1]
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

    // 3. Grab buyers directly from buyers.js global data[cite: 1]
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

  const allProcessedMatches = [];

  // 4. Evaluate and include all stock for all buyers, sorted strictly by true turnover descending
  pipelineBuyers.forEach(buyer => {
    const buyerName = buyer.name || buyer.buyerName || buyer.companyName || 'Unknown Buyer';
    
    // Extract actual turnover cleanly from all potential buyer object properties
    const turnoverVal = Number(
      buyer.turnover || 
      buyer.totalSpent || 
      buyer.revenue || 
      buyer.historicalTotal || 
      buyer.totalTurnover || 
      buyer.spend || 
      0
    );

    const buyerCommodityMap = {};

    // Map all floor stock items directly to ensure every product and commodity appears
    pipelineStock.forEach(stockItem => {
      const itemComm = stockItem.commodity || stockItem.comm || stockItem.variety || stockItem.item || stockItem.description || 'Produce Item';
      const commodityKey = normalizeString(itemComm + '_' + (stockItem.variety || '') + '_' + (stockItem.grade || '') + '_' + (stockItem.size || ''));
      const stockQty = Number(stockItem.count !== undefined ? stockItem.count : (stockItem.qty_rec || stockItem.qty_sort || 1));

      if (!buyerCommodityMap[commodityKey]) {
        buyerCommodityMap[commodityKey] = {
          ...stockItem,
          _matchedCommodityName: itemComm,
          _sortQty: stockQty
        };
      }
    });

    const uniqueBuyerStockItems = Object.values(buyerCommodityMap);
    if (uniqueBuyerStockItems.length > 0) {
      allProcessedMatches.push({
        buyerName: buyerName,
        turnover: turnoverVal,
        stockItems: uniqueBuyerStockItems
      });
    }
  });

  // 5. Rank ALL buyers strictly by Turnover descending (Highest turnover like FLM at the top, down to the lowest)
  allProcessedMatches.sort((a, b) => b.turnover - a.turnover);

  console.log("Ranked buyers with matches:", allProcessedMatches.length);
  renderPipelineMatches(allProcessedMatches);
}

function runAIFromPipeline() {
  console.log("runAIFromPipeline invoked");
  runComprehensiveMatching();
}

function renderPipelineMatches(rankedBuyers) {
  const el = document.getElementById('pipeline-results');
  if (!el) return;

  if (!rankedBuyers || !rankedBuyers.length) {
    el.innerHTML = '<div class="empty">No matching pipeline results found based on commodity filters.</div>';
    return;
  }

  let htmlOutput = '';

  rankedBuyers.forEach((buyerData, idx) => {
    const dropdownId = `buyer-dropdown-${idx}`;
    const formattedTurnover = `R ${buyerData.turnover.toLocaleString()}`;

    htmlOutput += `
      <div style="background:#fff;border-radius:10px;margin-bottom:10px;border:1.5px solid var(--border);overflow:hidden;">
        <div onclick="toggleBuyerDropdown('${dropdownId}')" style="padding:14px 16px;background:#f8f9fa;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:800;font-size:15px;color:var(--moss);">
            ${buyerData.buyerName} 
            <span style="font-size:12px;color:var(--muted);font-weight:normal;margin-left:8px;">(Turnover: ${formattedTurnover})</span>
          </div>
          <div style="font-size:12px;color:var(--muted);font-weight:bold;display:flex;align-items:center;gap:8px;">
            <span>${buyerData.stockItems.length} Products</span>
            <span>▼</span>
          </div>
        </div>
        <div id="${dropdownId}" style="display:none;padding:12px 16px;border-top:1px solid var(--border);background:#fff;">
    `;

    buyerData.stockItems.forEach(stock => {
      const commodityName = stock._matchedCommodityName || stock.commodity || stock.variety || 'Produce Item';
      const variety = stock.variety && stock.variety !== commodityName ? ` - ${stock.variety}` : '';
      const producer = stock.producer ? ` | Producer: ${stock.producer}` : '';
      const grade = stock.grade ? `Grade ${stock.grade}` : '';
      const size = stock.size ? `Size: ${stock.size}` : '';
      const availableQty = stock.count !== undefined ? stock.count : (stock.qty_rec || stock.qty_sort || 'N/A');

      htmlOutput += `
        <div style="padding:8px 0;border-bottom:1px solid #eee;">
          <div style="font-size:13px;font-weight:700;color:#333;">${commodityName}${variety} (${grade}, ${size})${producer}</div>
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

// Helper function to handle opening/closing the dropdown accordions
function toggleBuyerDropdown(id) {
  const dropdown = document.getElementById(id);
  if (dropdown) {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  }
}
