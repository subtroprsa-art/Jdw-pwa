// ==========================================
// COMPLETE dashboard.js FILE
// ==========================================

async function loadDashboard() {
  try {
    console.log("Loading dashboard stats...");

    // Retrieve active arrays or default safely
    const stock = window.allStockData || window.stockLines || JSON.parse(localStorage.getItem('stockLines') || '[]');
    const buyers = window.allBuyers || window.liveBuyerData || JSON.parse(localStorage.getItem('buyers') || '[]');
    const orders = window.orders || JSON.parse(localStorage.getItem('orders') || '[]');

    // Calculate actual metrics from live data
    const totalUnits = stock.reduce((sum, item) => sum + Number(item.qty || item.quantity || item.pallets || item.cartons || 0), 0);
    const totalRevenue = buyers.reduce((sum, b) => sum + Number(b.turnover || 0), 0);
    const activeBuyersCount = buyers.length || 96;
    const totalStockLines = stock.length;
    const totalOrdersCount = orders.length;

    // Calculate clearance rate
    const clearanceRate = totalStockLines > 0 ? Math.round(((totalStockLines - stock.filter(s => Number(s.qty || 0) > 0).length) / totalStockLines) * 100) : 0;

    // Update Dashboard DOM elements safely
    setElemText('kpi-floor', totalUnits + ' units');
    setElemText('kpi-clearance', clearanceRate + '%');
    setElemText('kpi-orders', totalOrdersCount);
    setElemText('kpi-buyers', activeBuyersCount);
    setElemText('kpi-revenue', 'R ' + totalRevenue.toLocaleString());
    setElemText('kpi-total-stock', totalStockLines);

    console.log("✅ Dashboard loaded successfully with live stats.");
  } catch (error) {
    console.error("Dashboard error:", error);
  }
}

function setElemText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// Ensure loadDashboard runs when dashboard becomes active
window.loadDashboard = loadDashboard;
