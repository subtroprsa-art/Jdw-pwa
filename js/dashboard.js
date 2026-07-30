// ==========================================
// CORRECTED dashboard.js FILE (COMPLETE CODE)
// ==========================================

async function loadDashboard() {
  try {
    console.log("Loading dashboard stats from application globals...");

    // 1. Grab buyers from the global variables populated by buyers.js
    const buyers = window.allBuyers || window.liveBuyerData || [];
    
    // 2. Grab stock/floor units using stockLines (.flr) or liveFloorData (.balance)
    const stockItems = window.stockLines || window.liveFloorData || window.allLiveFloorData || [];

    // Calculate total floor stock units using the correct property (.flr or .balance)
    const totalFloorUnits = stockItems.reduce((sum, item) => {
      const q = Number(item.flr !== undefined ? item.flr : (item.balance || item.qty || 0));
      return sum + q;
    }, 0);

    // Calculate total revenue from buyer turnover (.turnover)
    const totalRevenue = buyers.reduce((sum, b) => sum + Number(b.turnover || 0), 0);
    const totalBuyersCount = buyers.length;

    // Update Dashboard DOM elements safely
    setElemText('kpi-floor', totalFloorUnits.toLocaleString() + ' units');
    setElemText('kpi-buyers', totalBuyersCount);
    setElemText('kpi-revenue', 'R ' + totalRevenue.toLocaleString());

    console.log("✅ Dashboard stats loaded successfully: Revenue =", totalRevenue, "Floor Units =", totalFloorUnits);
  } catch (error) {
    console.error("Dashboard error:", error);
  }
}

function setElemText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

window.loadDashboard = loadDashboard;

// Safe listener to ensure it triggers if loaded independently
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadDashboard, 500);
});
