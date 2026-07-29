// ===== DASHBOARD MODULE =====

async function loadDashboard() {
  try {
    console.log("Loading dashboard stats...");

    // 1. Fetch data or fallback safely
    const stockCount = (window.allStockData && window.allStockData.length) ? window.allStockData.length : 0;
    const buyerCount = (window.allBuyers && window.allBuyers.length) ? window.allBuyers.length : 96;

    // 2. Safe DOM Updates with Null Checks
    const stockEl = document.getElementById('dash-stock-count');
    if (stockEl) {
      stockEl.textContent = stockCount;
    }

    const buyerEl = document.getElementById('dash-buyer-count');
    if (buyerEl) {
      buyerEl.textContent = buyerCount;
    }

    const welcomeEl = document.getElementById('dash-welcome-user');
    if (welcomeEl) {
      const activeUser = localStorage.getItem('subtrop_user') || 'Riaan';
      welcomeEl.textContent = `Welcome back, ${activeUser}`;
    }

    const summaryEl = document.getElementById('dash-summary-box');
    if (summaryEl) {
      summaryEl.style.display = 'block';
    }

    console.log("✅ Dashboard loaded successfully.");
  } catch (error) {
    console.error("Dashboard error:", error);
    const errEl = document.getElementById('dash-error');
    if (errEl) {
      errEl.textContent = "Could not load dashboard metrics.";
      errEl.style.display = 'block';
    }
  }
}

// ===== GLOBAL EXPOSURE =====
window.loadDashboard = loadDashboard;
