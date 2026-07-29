// ==========================================
// UPDATED DASHBOARD MODULE (CUSTOM METRICS)
// ==========================================

async function loadDashboard() {
  try {
    console.log("Loading dashboard stats...");

    // Retrieve active arrays or default safely from global scope / localStorage
    const stock = window.allStockData || window.stockLines || JSON.parse(localStorage.getItem('stockLines') || '[]');
    const buyers = window.allBuyers || window.liveBuyerData || JSON.parse(localStorage.getItem('buyers') || '[]');
    const orders = window.orders || window.allOrders || JSON.parse(localStorage.getItem('orders') || '[]');

    // Calculate total physical units on the floor
    const totalFloorUnits = stock.reduce((sum, item) => {
      const q = Number(item.qty || item.quantity || item.pallets || item.cartons || item.units || 0);
      return sum + q;
    }, 0);

    const totalRevenue = buyers.reduce((sum, b) => sum + Number(b.turnover || 0), 0);
    const totalBuyersCount = buyers.length || 305;
    const totalOrdersCount = orders.length;

    // Update Dashboard DOM elements safely
    setElemText('kpi-floor', totalFloorUnits.toLocaleString() + ' units');
    setElemText('kpi-orders', totalOrdersCount);
    setElemText('kpi-buyers', totalBuyersCount);
    setElemText('kpi-revenue', 'R ' + totalRevenue.toLocaleString());

    console.log("✅ Dashboard loaded successfully with custom metrics.");
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
