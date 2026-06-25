// ===== DASHBOARD FUNCTIONS =====

async function loadDashboard() {
  try {
    const stockRes = await fetch(FB_DB + '/stock.json?auth=' + FB_SECRET);
    if (stockRes.ok) {
      const stockRaw = await stockRes.json();
      const allStock = [];
      for (const uk in stockRaw || {}) {
        for (const ek in stockRaw[uk] || {}) {
          allStock.push({ ...firebaseToItem(stockRaw[uk][ek]), user: stockRaw[uk][ek].user || uk });
        }
      }
      allLiveStockData = allStock;

      const tf = allStock.reduce((s, e) => s + (Number(e.flr) || 0), 0);
      const tr = allStock.reduce((s, e) => s + (Number(e.rec) || 0), 0);
      const ts = allStock.reduce((s, e) => s + (Number(e.sold) || 0), 0);

      document.getElementById('kpi-floor').textContent = tf.toLocaleString();
      document.getElementById('kpi-floor-sub').textContent = 'units on floor';

      const cp = tr > 0 ? Math.round((ts / tr) * 100) : 0;
      document.getElementById('kpi-clearance').textContent = cp + '%';
      document.getElementById('kpi-clearance-sub').textContent = 'of all stock sold';

      renderStockChart(allStock);
    }
  } catch (e) {
    console.error('Dashboard error:', e.message);
  }
}

function renderStockChart(src) {
  src = src || (allLiveStockData && allLiveStockData.length ? allLiveStockData : []);
  const comms = ['AVOS', 'ORGS', 'LEMS', 'KIWI', 'FIGS', 'GVS', 'CLTM', 'NAAR', 'STRS', 'MANG', 'DRAG'];
  const commName = { AVOS: 'Avocados', LEMS: 'Lemons', ORGS: 'Oranges', KIWI: 'Kiwifruit', FIGS: 'Figs', GVS: 'Guavas', CLTM: 'Clementines', NAAR: 'Naartjies', STRS: 'Strawberries', MANG: 'Mangoes', DRAG: 'Dragon Fruit', GFT: 'Grapefruit', SATS: 'Satsumas' };

  document.getElementById('stock-chart').innerHTML = comms.map(c => {
    const items = src.filter(s => s.commodity === c);
    if (!items.length) return '';
    const rec = items.reduce((a, i) => a + (Number(i.rec) || 0), 0);
    const sold = items.reduce((a, i) => a + (Number(i.sold) || 0), 0);
    const flr = items.reduce((a, i) => a + (Number(i.flr) || 0), 0);
    if (!rec) return '';
    const pct = Math.round((sold / rec) * 100);
    const fc = pct > 80 ? 'pf-g' : pct > 40 ? 'pf-a' : 'pf-r';
    return `<div class="prog-wrap"><div class="prog-row"><span class="prog-name">${commName[c] || c}</span><span class="prog-meta">${pct}% · ${flr.toLocaleString()} left</span></div><div class="prog-bar"><div class="prog-fill ${fc}" style="width:${pct}%"></div></div></div>`;
  }).join('') || '<div class="empty">No stock data</div>';
}