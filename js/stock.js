// ==========================================
// FULLY REVISED STOCK FUNCTIONS (DEDICATED NODE READER)
// ==========================================

let liveStockData = [];

async function loadStockFromFirebase() {
  const el = document.getElementById('stock-list');
  if (el) el.innerHTML = '<div class="empty">Loading stock...</div>';

  try {
    // Read directly from the robust, backend-maintained UI stock node
    const snapshot = await firebase.database().ref('/ui_stock_balances').once('value');
    const d = snapshot.val();
    
    if (!d || !Array.isArray(d) || d.length === 0) { 
      if (el) el.innerHTML = '<div class="empty">No stock data available.</div>'; 
      return; 
    }
    
    liveStockData = d;
    populateStockFilter(liveStockData);
    filterStock();
    
    console.log("✅ Stock view loaded safely from /ui_stock_balances");
  } catch (e) {
    if (el) el.innerHTML = '<div class="empty">Could not load stock: ' + e.message + '</div>';
    console.error("Stock load error:", e);
  }
}

// Tabs are no longer needed since the backend node unifies all stock globally, 
// but we keep this function stubbed to prevent breaking any UI button onclick handlers.
function switchStockTab(user, btn) {
  document.querySelectorAll('.stock-tab').forEach(b => {
    if (b.id && b.id.startsWith('stab-')) b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');
  loadStockFromFirebase();
}

function filterStock() {
  const q = (document.getElementById('stock-search').value || '').toLowerCase().trim();
  const f = document.getElementById('stock-filter').value;
  let src = liveStockData;

  const data = src.filter(s => {
    if (f && s.commodity !== f) return false;
    if (!q) return true;
    const terms = q.split(' ');
    const searchStr = [
      s.producer || '',
      s.commodity || '',
      s.grn || '',
      String(s.balance || ''),
      String(s.pack || '')
    ].join(' ').toLowerCase();
    return terms.every(t => searchStr.includes(t));
  });

  renderStock(data);
}

function renderStock(data) {
  const el = document.getElementById('stock-list');
  const su = document.getElementById('stock-summary');
  if (!data || !data.length) { el.innerHTML = '<div class="empty">No stock entries found</div>'; if (su) su.textContent = ''; return; }

  data = [...data].sort((a, b) => {
    return (a.producer || '').localeCompare(b.producer || '');
  });

  if (su) su.textContent = data.length + ' lines - ' + new Set(data.map(s => s.producer)).size + ' producers';

  const byProd = {};
  data.forEach(s => {
    const p = s.producer || 'Unknown';
    if (!byProd[p]) byProd[p] = [];
    byProd[p].push(s);
  });

  el.innerHTML = Object.keys(byProd).sort().map(prod => {
    const lines = byProd[prod];
    const totalBal = lines.reduce((s, e) => s + (Number(e.balance) || 0), 0);
    const pid = 'st-' + prod.replace(/\s+/g, '-') + '-' + Math.random().toString(36).slice(2);

    const linesHTML = lines.map(s => {
      const bal = Number(s.balance) || 0;
      return `<div style="background:#fff;border-radius:10px;padding:10px 12px;margin-bottom:7px;border:1.5px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="background:var(--moss);color:#fff;font-weight:800;font-size:15px;padding:3px 10px;border-radius:8px">${s.commodity || 'PRODUCE'}</div>
            <div style="font-size:11px;color:var(--muted)">GRN ${s.grn || '-'} | Pack: ${s.pack || '-'}</div>
          </div>
          <div style="font-size:16px;font-weight:800;color:${bal === 0 ? 'var(--red)' : 'var(--moss)'}">${bal} <span style="font-size:10px;font-weight:600;color:var(--muted)">BAL</span></div>
        </div>
      </div>`;
    }).join('');

    return `<div style="background:var(--card);border-radius:14px;box-shadow:var(--shadow);margin-bottom:12px;overflow:hidden">
      <div onclick="toggleSection('${pid}')" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--moss);cursor:pointer">
        <div style="font-weight:800;font-size:14px;color:#fff">${prod}</div>
        <div style="color:#fff;font-weight:800">${totalBal.toLocaleString()} BAL</div>
      </div>
      <div id="${pid}" style="display:none;padding:10px">${linesHTML}</div>
    </div>`;
  }).join('');
}

function populateStockFilter(data) {
  const sel = document.getElementById('stock-filter');
  if (!sel) return;
  const current = sel.value;
  const codes = [...new Set((data || liveStockData).map(s => s.commodity).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">All commodities</option>' + codes.map(c => `<option value="${c}"${c === current ? ' selected' : ''}>${c}</option>`).join('');
}

// Auto-load on startup and listen for real-time updates from backend sync server
document.addEventListener('DOMContentLoaded', () => {
  loadStockFromFirebase();
  
  firebase.database().ref('/ui_stock_balances').on('value', () => {
    loadStockFromFirebase();
  });
});

window.loadStockFromFirebase = loadStockFromFirebase;
window.switchStockTab = switchStockTab;
window.filterStock = filterStock;
