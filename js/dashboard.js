// ==========================================
// FULLY REVISED dashboard.js (DIRECT DOM REFRESH & SAFEGUARDED)
// ==========================================

async function loadDashboard() {
  try {
    console.log("Forcing direct refresh of dashboard stats...");

    // Grab buyers and floor stock directly from global storage or Firebase globals
    const buyers = window.allBuyers || window.liveBuyerData || window.buyersData || [];
    const stockItems = window.stockLines || window.liveFloorData || window.allLiveFloorData || window.floorData || [];

    // Compute totals safely
    const totalFloorUnits = stockItems.reduce((sum, item) => {
      const q = Number(item.flr !== undefined ? item.flr : (item.balance || item.qty || item.count || 0));
      return sum + (isNaN(q) ? 0 : q);
    }, 0);

    const totalRevenue = buyers.reduce((sum, b) => {
      const t = Number(b.turnover || b.totalSpent || b.revenue || b.totalTurnover || 0);
      return sum + (isNaN(t) ? 0 : t);
    }, 0);

    const totalBuyersCount = buyers.length;
    const totalOrdersCount = window.allOrders ? window.allOrders.length : (window.ordersCount || 0);

    // Directly target exact dashboard KPI element IDs from your screenshot
    setElemText('kpi-floor', totalFloorUnits.toLocaleString() + ' units');
    setElemText('kpi-buyers', totalBuyersCount.toLocaleString());
    setElemText('kpi-revenue', 'R ' + totalRevenue.toLocaleString());
    setElemText('kpi-orders', totalOrdersCount.toLocaleString());

    console.log("✅ Dashboard KPIs updated:", { totalFloorUnits, totalBuyersCount, totalRevenue, totalOrdersCount });
  } catch (error) {
    console.error("Dashboard calculation error:", error);
  }
}

function setElemText(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}

window.loadDashboard = loadDashboard;

// Auto-trigger on load and retry after async data syncs
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadDashboard, 400);
  setTimeout(loadDashboard, 1500);
  setTimeout(loadDashboard, 3500);
});
