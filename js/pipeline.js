// ==========================================
// PIPELINE SCRIPT WITH REAL-TIME DAILY SYNCED CONTACT STATE
// ==========================================

let firebaseBuyerPhonesCache = {};
let currentContactedMap = {};
let lastRankedBuyers = [];

function normalizeString(str) {
    if (!str) return '';
    return str.toString().trim().toUpperCase();
}

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

function getFriendlyProductName(rawName) {
    if (!rawName) return 'Produce';
    let clean = rawName.toString().split(',')[0].replace(/\d{1,2}[\/\-]\w{3}[\/\-]\d{4}/g, '').trim();
    const upper = clean.toUpperCase();
    
    if (upper.includes('ORG') || upper.includes('ORANGE')) return 'Oranges';
    if (upper.includes('AVO') || upper.includes('AVOCADO')) return 'Avos';
    if (upper.includes('LEM') || upper.includes('LEMON')) return 'Lemons';
    if (upper.includes('NOV')) return 'Nova';
    if (upper.includes('BER')) return 'Berries';
    if (upper.includes('NUT')) return 'Nuts';
    if (upper.includes('COAL')) return 'Coal';
    if (upper.includes('APP') || upper.includes('APPLE')) return 'Apples';
    return clean || 'Produce';
}

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

function getStockAgeInDays(stockItem) {
    const dateVal = stockItem.date || stockItem.pack || stockItem.intakeDate || stockItem.createdAt || stockItem.timestamp;
    const parsedDate = parseStockDate(dateVal);
    if (!parsedDate) return 0;
    
    const diffTime = Math.abs(new Date() - parsedDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

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

// Get today's date key for daily resetting (e.g., "2026-07-31")
function getTodayPipelineKey() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

// Fetch contacted status for today from Firebase in real-time
function loadContactedBuyersState() {
  const dateKey = getTodayPipelineKey();
  firebase.database().ref(`pipeline_contacted/${dateKey}`).on('value', snapshot => {
    currentContactedMap = snapshot.val() || {};
    if (lastRankedBuyers.length > 0) {
      renderPipelineMatches(lastRankedBuyers);
    }
  });
}

// Toggle or mark a buyer as contacted/messaged in Firebase
async function markBuyerContacted(buyerName, type) {
  const dateKey = getTodayPipelineKey();
  const safeName = buyerName.replace(/[.#$[\]]/g, '_');
  
  const ref = firebase.database().ref(`pipeline_contacted/${dateKey}/${safeName}`);
  const snapshot = await ref.once('value');
  const current = snapshot.val() || { called: false, whatsapp: false };

  if (type === 'call') current.called = !current.called;
  if (type === 'whatsapp') current.whatsapp = !current.whatsapp;
  current.timestamp = Date.now();

  await ref.set(current);
}

// Initialize real-time sync listener on startup
document.addEventListener('DOMContentLoaded', () => {
  loadContactedBuyersState();
});

async function runComprehensiveMatching() {
  console.log("Running comprehensive pipeline match...");

  let pipelineStock = [];
  let pipelineBuyers = [];

  try {
    const phonesSnap = await firebase.database().ref('buyerPhones').once('value');
    if (phonesSnap.exists()) {
      firebaseBuyerPhonesCache = phonesSnap.val() || {};
    }

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

      const stockQty = Number(stockItem.count !== undefined ? stockItem.count : (stockItem.qty_rec || stockItem.qty_sort || '*'));

      if (!broadCategoryBestMatchMap[broadCategory] || stockQty > broadCategoryBestMatchMap[broadCategory]._sortQty) {
        broadCategoryBestMatchMap[broadCategory] = {
          ...stockItem,
          _matchedCommodityName: rawComm,
          _sortQty: stockQty === '*' ? 0 : stockQty,
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
  renderPipelineMatches(allProcessedMatches);
}

function runAIFromPipeline() {
  runComprehensiveMatching();
}

window.runAIFromPipeline = runAIFromPipeline;
window.runComprehensiveMatching = runComprehensiveMatching;

function renderPipelineMatches(rankedBuyers) {
  lastRankedBuyers = rankedBuyers;
  const el = document.getElementById('pipeline-results');
  if (!el) return;

  if (!rankedBuyers || !rankedBuyers.length) {
    el.innerHTML = '<div class="empty">No matching pipeline results found.</div>';
    return;
  }

  let htmlOutput = '';

  rankedBuyers.forEach((buyerData, idx) => {
    const dropdownId = `buyer-dropdown-${idx}`;
    const formattedTurnover = `R ${buyerData.turnover.toLocaleString()}`;
    const phone = buyerData.phone || '';
    
    const safeName = buyerData.buyerName.replace(/[.#$[\]]/g, '_');
    const buyerStatus = currentContactedMap[safeName] || { called: false, whatsapp: false };
    
    const isDone = buyerStatus.called || buyerStatus.whatsapp;
    const cardBg = isDone ? '#f0fdf4' : '#fff';
    const cardBorder = isDone ? '#bbf7d0' : 'var(--border)';

    const stockSummaryText = buyerData.stockItems.map(s => {
      const rawComm = s._matchedCommodityName || s.commodity || s.variety || 'Produce';
      const friendlyName = getFriendlyProductName(rawComm);
      const packInfo = s.pack ? s.pack : (s.size ? `${s.size}kg` : '');
      const displayPart = packInfo ? `${friendlyName} ${packInfo}` : `${friendlyName}`;
      return `• ${displayPart} available`;
    }).join('\n');

    const messageString = `Hi ${buyerData.buyerName}, we have fresh stock available matching your requirements:\n\n${stockSummaryText}\n\nPlease let me know if you would like to secure any of these!`;
    const waMessage = encodeURIComponent(messageString);
    
    const waLink = phone ? `https://wa.me/${phone.replace('+', '')}?text=${waMessage}` : '#';
    const telLink = phone ? `tel:${phone}` : '#';

    htmlOutput += `
      <div style="background:${cardBg};border-radius:10px;margin-bottom:10px;border:1.5px solid ${cardBorder};overflow:hidden;transition:all 0.2s ease;">
        <div style="padding:14px 16px;background:${isDone ? '#f6fdf9' : '#f8f9fa'};display:flex;justify-content:space-between;align-items:center;">
          <div onclick="toggleBuyerDropdown('${dropdownId}')" style="cursor:pointer;flex-grow:1;">
            <div style="font-weight:800;font-size:15px;color:var(--moss);display:flex;align-items:center;gap:8px;">
              ${buyerData.buyerName} 
              ${isDone ? '<span style="background:#2d6a4f;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;">✓ Contacted Today</span>' : ''}
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">Turnover: ${formattedTurnover} · Phone: ${phone || '<span style="color:#d90429;">Not found</span>'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            ${phone ? `
              <a href="${telLink}" onclick="markBuyerContacted('${buyerData.buyerName.replace(/'/g, "\\'")}', 'call')" title="Call" style="background:${buyerStatus.called ? '#2d6a4f' : '#e2f0d9'};color:${buyerStatus.called ? '#fff' : '#2d6a4f'};padding:6px 10px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:bold;">📞 ${buyerStatus.called ? 'Called ✓' : 'Call'}</a>
              <a href="${waLink}" target="_blank" onclick="markBuyerContacted('${buyerData.buyerName.replace(/'/g, "\\'")}', 'whatsapp')" title="WhatsApp" style="background:${buyerStatus.whatsapp ? '#1b4332' : '#d8f3dc'};color:${buyerStatus.whatsapp ? '#fff' : '#1b4332'};padding:6px 10px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:bold;">💬 ${buyerStatus.whatsapp ? 'Sent ✓' : 'WhatsApp'}</a>
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
      const grade = stock.grade ? `Grade ${stock.grade}` : '';
      const size = stock.size ? `Size: ${stock.size}` : '';
      const availableQty = stock.count !== undefined ? stock.count : (stock.qty_rec || stock.qty_sort || 'N/A');

      htmlOutput += `
        <div style="padding:8px 0;border-bottom:1px solid #eee;">
          <div style="font-size:13px;font-weight:700;color:#333;">${commodityName}${variety} (${grade}, ${size})</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">Qty: <strong>${availableQty}</strong> | Pack: ${stock.pack || '-'}</div>
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

function toggleBuyerDropdown(id) {
  const dropdown = document.getElementById(id);
  if (dropdown) {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  }
}

window.toggleBuyerDropdown = toggleBuyerDropdown;
```[cite: 4]
