// ===== PIPELINE MATCHING FUNCTIONS WITH FIREBASE PHONE LOOKUP =====

// Global cache for buyer phones pulled directly from Firebase node 'buyerPhones'
let firebaseBuyerPhonesCache = {};

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
    
    let base = norm.split(/[\s,_.-]+/)[0];
    if (base.endsWith('S') && base.length > 3) {
        base = base.slice(0, -1);
    }
    return base || 'OTHER';
}

// Helper to parse date strings
function parseStockDate(dateStr) {
    if (!dateStr) return null;
    if (typeof dateStr === 'number') return new Date(dateStr);
    
    let cleanStr = dateStr.toString().trim();
    if (cleanStr.includes('/')) {
        const parts = cleanStr.split('/');
        if (parts.length === 3) {
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
    if (!parsedDate) return 0;
    
    const diffTime = Math.abs(new Date() - parsedDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Helper to clean and format phone numbers for WhatsApp and Tel links
function formatPhoneNumber(phone) {
    if (!phone) return '';
    let cleaned = phone.toString().replace(/[^\d+]/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '+27' + cleaned.slice(1);
    } else if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }
    return cleaned;
}

async function runComprehensiveMatching() {
  console.log("Running comprehensive pipeline match with Firebase buyerPhones lookup...");

  let pipelineStock = [];
  let pipelineBuyers = [];

  try {
    // 1. Fetch buyer phones directly from Firebase 'buyerPhones' node shown in your database
    const phonesSnap = await firebase.database().ref('buyerPhones').once('value');
    if (phonesSnap.exists()) {
      firebaseBuyerPhonesCache = phonesSnap.val() || {};
      console.log("Successfully loaded buyer phones from Firebase:", Object.keys(firebaseBuyerPhonesCache).length);
    }

    // 2. Pull stock from Firebase
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

    // 3. Grab buyers from buyers.js global data
    if (typeof liveBuyerData !== 'undefined' && liveBuyerData.length > 0) {
      pipelineBuyers = liveBuyerData;
    } else if (typeof allBuyers !== 'undefined' && allBuyers.length > 0) {
      pipelineBuyers = allBuyers;
    }

  } catch (e) {
    console.warn("Pipeline fetch error:", e.message);
  }

  const el = document.getElementById('pipeline-results');

  if (!pipelineStock.length || !pipelineBuyers.length) {
    console.warn("⚠️ Stock lines or buyers data is missing or empty!");
    if (el) {
      el.innerHTML = '<div class="empty">⚠️ Stock lines or buyers data is missing or empty. Please ensure buyers are loaded.</div>';
    }
    return;
  }

  const allProcessedMatches = [];

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
    
    // Look up the phone number directly from Firebase buyerPhones cache using exact or normalized buyer name matching
    let rawPhone = '';
    const normalizedBuyerName = normalizeString(buyerName);
    
    for (const [fbKey, fbVal] of Object.entries(firebaseBuyerPhonesCache)) {
      if (normalizeString(fbKey) === normalizedBuyerName || normalizedBuyerName.includes(normalizeString(fbKey)) || normalizeString(fbKey).includes(normalizedBuyerName)) {
        if (typeof fbVal === 'string') {
          rawPhone = fbVal;
        } else if (fbVal && typeof fbVal === 'object') {
          rawPhone = fbVal.phone || fbVal.telephone || fbVal.number || Object.values(fbVal)[0] || '';
        }
        break;
      }
    }

    // Fallback to local buyer object properties if not found in Firebase cache
    if (!rawPhone) {
      rawPhone = buyer.phone || buyer.telephone || buyer.cell || buyer.mobile || buyer.contactNumber || buyer.tel || '';
    }

    const formattedPhone = formatPhoneNumber(rawPhone);

    return { buyer, buyerName, turnoverVal, formattedPhone };
  });

  evaluatedBuyers.sort((a, b) => b.turnover - a.turnover);

  const totalBuyersCount = evaluatedBuyers.length;

  evaluatedBuyers.forEach((item, index) => {
    const { buyer, buyerName, turnoverVal, formattedPhone } = item;
    
    const isTopTier = index < Math.ceil(totalBuyersCount * 0.35) || turnoverVal > 300000;
    const maxStockAgeDays = isTopTier ? 10 : 14;

    const broadCategoryBestMatchMap = {};

    pipelineStock.forEach(stockItem => {
      const rawComm = stockItem.commodity || stockItem.comm || stockItem.variety || stockItem.item || stockItem.description || 'Produce Item';
      const broadCategory = getBroadCommodityCategory(rawComm);
      
      const stockAge = getStockAgeInDays(stockItem);
      if (stockAge > maxStockAgeDays) {
        return; 
      }

      const stockQty = Number(stockItem.count !== undefined ? stockItem.count : (stockItem.qty_rec || stockItem.qty_sort || 1));

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
        phone: formattedPhone,
        stockItems: uniqueBuyerStockItems
      });
    }
  });

  allProcessedMatches.sort((a, b) => b.turnover - a.turnover);

  console.log("Ranked buyers with Firebase phone lookup complete:", allProcessedMatches.length);
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
    const phone = buyerData.phone || '';

    // Generate automatic WhatsApp message populated with the matching stock lines
    const stockSummaryText = buyerData.stockItems.map(s => `• ${s._matchedCommodityName || s.commodity} - Qty: ${s.count !== undefined ? s.count : 'N/A'} (${s._stockAge}d old)`).join('\n');
    const waMessage = encodeURIComponent(`Hi ${buyerData.buyerName}, we have fresh stock available matching your requirements:\n\n${stockSummaryText}\n\nPlease let me know if you would like to secure any of these!`);
    
    const waLink = phone ? `https://wa.me/${phone.replace('+', '')}?text=${waMessage}` : '#';
    const telLink = phone ? `tel:${phone}` : '#';

    htmlOutput += `
      <div style="background:#fff;border-radius:10px;margin-bottom:10px;border:1.5px solid var(--border);overflow:hidden;">
        <div style="padding:14px 16px;background:#f8f9fa;display:flex;justify-content:space-between;align-items:center;">
          <div onclick="toggleBuyerDropdown('${dropdownId}')" style="cursor:pointer;flex-grow:1;">
            <div style="font-weight:800;font-size:15px;color:var(--moss);">
              ${buyerData.buyerName} 
              <span style="font-size:12px;color:var(--muted);font-weight:normal;margin-left:8px;">(Turnover: ${formattedTurnover})</span>
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">Firebase Phone: ${phone || '<span style="color:#d90429;">Not found in buyerPhones</span>'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            ${phone ? `
              <a href="${telLink}" title="Call Buyer" style="background:#e2f0d9;color:#2d6a4f;padding:6px 10px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:bold;">📞 Call</a>
              <a href="${waLink}" target="_blank" title="WhatsApp Buyer" style="background:#d8f3dc;color:#1b4332;padding:6px 10px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:bold;">💬 WhatsApp</a>
            ` : `<span style="font-size:11px;color:#999;font-style:italic;">No phone</span>`}
            <div onclick="toggleBuyerDropdown('${dropdownId}')" style="cursor:pointer;font-size:12px;color:var(--muted);font-weight:bold;padding-left:6px;">
              <span>${buyerData.stockItems.length} Products ▼</span>
            </div>
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

// Helper function to handle opening/closing dropdowns
function toggleBuyerDropdown(id) {
  const dropdown = document.getElementById(id);
  if (dropdown) {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  }
}
