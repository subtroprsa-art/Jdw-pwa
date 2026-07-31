// ==========================================
// COMPLETE DASHBOARD SCRIPT WITH CUSTOM KPI CARDS & THRESHOLDS
// ==========================================

async function loadDashboard() {
  try {
    console.log("Calculating live dashboard KPIs...");

    const stockSnap = await firebase.database().ref('stock').once('value');
    const historySnap = await firebase.database().ref('jdw/history').once('value');
    const buyersSnap = await firebase.database().ref('buyers').once('value'); // or liveBuyerData

    const stockVal = stockSnap.val() || {};
    const historyVal = historySnap.val() || {};
    
    let totalFloorUnits = 0;
    let coldstoreUnits = 0;
    let totalStockReceived = 0;
    let totalStockSold = 0;

    // 1. Process Stock
    for (const salesmanKey in stockVal) {
      for (const itemKey in stockVal[salesmanKey]) {
        const item = stockVal[salesmanKey][itemKey];
        if (item && typeof item === 'object') {
          const qty = Number(item.count !== undefined ? item.count : (item.qty_rec || item.qty_sort || 0));
          const isColdstore = (item.coldstore || item.store || item.location || '').toString().toUpperCase().includes('COLD') || 
                              item.isColdstore === true || item.coldstore === 'YES' || item.coldstore === '1';

          if (!isNaN(qty)) {
            totalFloorUnits += qty;
            totalStockReceived += qty; // Baseline for intake
            if (isColdstore) {
              coldstoreUnits += qty;
            }
          }
        }
      }
    }

    // 2. Process History / Clearance Rate
    const histArray = Array.isArray(historyVal) ? historyVal : Object.values(historyVal);
    const uniqueBuyers = new Set();
    const recentBuyers = new Set();
    
    const todayStr = new Date().toISOString().split('T')[0];

    histArray.forEach(h => {
      if (h.buyer && h.buyer !== 'UNKNOWN') {
        uniqueBuyers.add(h.buyer);
        // Check if buyer was added recently (e.g. today or last sync)
        if (h.date && h.date >= todayStr) {
          recentBuyers.add(h.buyer);
        }
      }
      const soldQty = Number(h.qty) || Number(h.soldQty) || 0;
      totalStockSold += soldQty;
    });

    const totalBuyersCount = uniqueBuyers.size;
    const newBuyersCount = recentBuyers.size;
    const newBuyerPercentage = totalBuyersCount > 0 ? Math.round((newBuyersCount / totalBuyersCount) * 100) : 0;

    // Clearance Rate Calculation: (Sold / Total Available Pool) * 100
    const totalPool = totalStockSold + totalFloorUnits;
    const clearanceRate = totalPool > 0 ? Math.round((totalStockSold / totalPool) * 100) : 0;

    // Render to DOM
    setElemText('kpi-floor', totalFloorUnits.toLocaleString() + ' units');
    setElemText('kpi-coldstore', coldstoreUnits.toLocaleString() + ' units');
    setElemText('kpi-buyers', totalBuyersCount.toLocaleString());

    // Clearance Rate Card Styling & Text
    const clearanceEl = document.getElementById('kpi-clearance') || document.getElementById('kpi-orders');
    if (clearanceEl) {
      clearanceEl.textContent = clearanceRate + '%';
      clearanceEl.style.fontWeight = 'bold';
      if (clearanceRate < 35) {
        clearanceEl.style.color = '#d90429'; // Red
      } else if (clearanceRate <= 50) {
        clearanceEl.style.color = '#f59e0b'; // Yellow / Amber
      } else {
        clearanceEl.style.color = '#2d6a4f'; // Green
      }
    }

    // Buyers Card New Buyer Alert Indicator
    const buyersEl = document.getElementById('kpi-buyers');
    if (buyersEl && newBuyersCount > 0) {
      buyersEl.innerHTML = `${totalBuyersCount.toLocaleString()} <span style="background:#d8f3dc;color:#1b4332;font-size:11px;padding:2px 6px;border-radius:4px;margin-left:6px;">+${newBuyerPercentage}% new</span>`;
    }

    console.log("✅ Custom Dashboard KPIs updated successfully.");

  } catch (error) {
    console.error("Dashboard KPI calculation error:", error);
  }
}

function setElemText(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}

window.loadDashboard = loadDashboard;

window.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
});
