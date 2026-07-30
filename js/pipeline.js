// ===== PIPELINE MATCHING FUNCTIONS =====[cite: 1]

// 1. Normalization & Indexing Helpers
function normalizeString(str) {
    if (!str) return '';
    return str.toString().trim().toUpperCase();
}

// Extract base commodity category (e.g., AVOS, LEMS, ORGS, NOVA from any product name string)
function getBroadCommodityCategory(str) {
    const norm = normalizeString(str);
    if (norm.includes('AVO') || norm.includes('AVOCADO')) return 'AVOS';
    if (norm.includes('LEM') || norm.includes('LEMON')) return 'LEMS';
    if (norm.includes('ORG') || norm.includes('ORANGE') || norm.includes('CITRUS')) return 'ORGS';
    if (norm.includes('NOV')) return 'NOVA';
    if (norm.includes('BER') || norm.includes('BERRY')) return 'BERS';
    if (norm.includes('NUT')) return 'NUTPS';
    
    // Fallback to first token or base string
    let base = norm.split(/[\s,_.-]+/)[0];
    if (base.endsWith('S') && base.length > 3) {
        base = base.slice(0, -1);
    }
    return base || 'OTHER';
}

// Helper to parse date strings (handling formats like YYYY/MM/DD, DD/MM/YYYY, or timestamps)
function parseStockDate(dateStr) {
    if (!dateStr) return null;
    if (typeof dateStr === 'number') return new Date(dateStr);
    
    let cleanStr = dateStr.toString().trim();
    // Handle DD/MM/YYYY format commonly used in local packhouses
    if (cleanStr.includes('/')) {
        const parts = cleanStr.split('/');
        if (parts.length === 3) {
            // Check if format is DD/MM/YYYY
            if (parts[0].length <= 2 && parts[2].length === 4) {
                return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
        }
    }
    const d = new Date(cleanStr);
    return isNaN(d.getTime()) ? null : d;
}

// Calculate age of stock in days relative to current date (2026)
function getStockAgeInDays(stockItem) {
    const dateVal = stockItem.date || stockItem.pack || stockItem.intakeDate || stockItem.createdAt || stockItem.timestamp;
    const parsedDate = parseStockDate(dateVal);
    if (!parsedDate) return 0; // Default to fresh if unparseable
    
    const diffTime = Math.abs(new Date() - parsedDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

async function runComprehensiveMatching() {
  console.log("Running comprehensive pipeline match with strict product grouping and age constraints...");

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

  // First, sort buyers by turnover descending to determine tier rankings
  const evaluatedBuyers = pipelineBuyers.map(buyer => {
    const buyerName = buyer.name || buyer.buyerName || buyer.companyName || 'Unknown Buyer';
    const turnoverVal = Number(
      buyer.turnover || 
      buyer.totalSpent || 
      buyer.revenue || 
      buyer.historicalTotal || 
      buyer.totalTurnover || 
      buyer.spend || 
      0
    );
    return { buyer, buyerName, turnoverVal };
  });

  evaluatedBuyers.sort((a, b) => b.turnover - a.turnover);

  // Divide buyers into tiers based on ranking index (Top tier = top 30% or top spenders)
  const totalBuyersCount = evaluatedBuyers.length;

  evaluatedBuyers.forEach((item, index) => {
    const { buyer, buyerName, turnoverVal } = item;
    
    // Define Top Tier vs Lower Tier (Top 35% or buyers with > R300,000 turnover are top tier)
    const isTopTier = index < Math.ceil(totalBuyersCount * 0.35) || turnoverVal > 300000;
    const maxStockAgeDays = isTopTier ? 10 : 14;

    const broadCategoryBestMatchMap = {};

    pipelineStock.forEach(stockItem => {
      const rawComm = stockItem.commodity || stockItem.comm || stockItem.variety || stockItem.item || stockItem.description || 'Produce Item';
      const broadCategory = getBroadCommodityCategory(rawComm);
      
      // Check stock age constraint
      const stockAge = getStockAgeInDays(stockItem);
      if (stockAge > maxStockAgeDays) {
        return; // Skip stock that is older than the allowed threshold for this buyer tier
      }

      const stockQty = Number(stockItem.count !== undefined ? stockItem.count : (stockItem.qty_rec || stockItem.qty_sort || 1));

      // Keep strictly ONE single best match line per broad commodity category (e.g., one best line for Lems, one for Avos, one for Orgs, etc.)
      if (!broadCategoryBestMatchMap[broadCategory] || stockQty > broadCategoryBestMatchMap[broadCategory]._sortQty) {
        broadCategoryBestMatchMap[broadCategory] = {
          ...stockItem,
          _matchedCommodityName: rawComm,
          _sortQty: stockQty,
          _stockAge: stockAge
        };
      }
    });

    const uniqueBuyerStockItems = Object.values(broadCategoryBestMatchMap);
    if (uniqueBuyerStockItems.length > 0) {
      allProcessedMatches.push({
        buyerName: buyerName,
        turnover: turnoverVal,
        stockItems: uniqueBuyerStockItems
      });
    }
  });

  // 5. Ensure final rendered list is strictly ordered by Turnover descending
  allProcessedMatches.sort((a, b) => b.turnover - a.turnover);

  console.log("Ranked buyers with clean single-line commodity matches:", allProcessedMatches.length);
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
    el.innerHTML = '<div class="empty">No matching pipeline results found based on age and commodity filters.</div>';
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
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">Count/Qty: <strong>${availableQty}</strong> | Age: ${stock._stockAge !== undefined ? stock._stockAge + ' days' : 'Fresh'} | Pack: ${stock.pack || '-'} | GRN: ${stock.grn || '-'}</div>
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
