// ==========================================
// FULLY REVISED dashboard.js (DEDICATED NODE READER)
// ==========================================

async function loadDashboard() {
  try {
    console.log("Fetching pre-calculated dashboard KPIs from dedicated backend node...");

    // Read directly from the robust backend-maintained node (Zero calculations, zero bugs)
    firebase.database().ref('/dashboard_kpis').once('value', snapshot => {
      const kpis = snapshot.val();
      
      if (!kpis) {
        console.warn("⚠️ /dashboard_kpis node is empty. Waiting for sync...");
        return;
      }

      const totalFloorUnits = kpis.total_floor_units || 0;
      const totalBuyersCount = kpis.total_buyers || 0;
      const totalRevenue = kpis.total_revenue || 0;
      const totalOrdersCount = kpis.total_orders || 0;

      // Directly target exact dashboard KPI element IDs
      setElemText('kpi-floor', totalFloorUnits.toLocaleString() + ' units');
      setElemText('kpi-buyers', totalBuyersCount.toLocaleString());
      setElemText('kpi-revenue', 'R ' + totalRevenue.toLocaleString());
      setElemText('kpi-orders', totalOrdersCount.toLocaleString());

      console.log("✅ Dashboard KPIs successfully updated from dedicated node:", kpis);
    });

  } catch (error) {
    console.error("Dashboard KPI fetch error:", error);
  }
}

function setElemText(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}

window.loadDashboard = loadDashboard;

// Auto-trigger on load and listen for real-time updates from backend sync
window.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  
  // Real-time listener so dashboard updates instantly whenever Jdw-sync pushes a new PDF
  firebase.database().ref('/dashboard_kpis').on('value', () => {
    loadDashboard();
  });
});
