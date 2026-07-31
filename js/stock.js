// ==========================================
// COMPLETE STOCK SCRIPT WITH SALESMAN TOGGLES & COLDSTORE FILTER
// ==========================================

let allLiveStockData = [];
let currentSalesmanFilter = 'ALL';
let currentCommodityFilter = 'All commodities';
let currentColdstoreFilter = false;

async function loadStockFromFirebase() {
  const el = document.getElementById('list-stock') || document.getElementById('stock-results');
  if (!el) return;
  el.innerHTML = '<div class="empty">Loading stock...</div>';

  try {
    const snapshot = await firebase.database().ref('stock').once('value');
    const raw = snapshot.val();
    allLiveStockData = [];

    if (raw) {
      for (const salesmanKey in raw) {
        for (const itemKey in raw[salesmanKey]) {
          const item = raw[salesmanKey][itemKey];
          if (item && typeof item === 'object') {
            // Determine coldstore flag from item properties
            const isColdstore = (item.coldstore || item.store || item.location || '').toString().toUpperCase().includes('COLD') || 
                                item.isColdstore === true || 
                                item.coldstore === 'YES' || 
                                item.coldstore === '1';

            allLiveStockData.push({
              ...item,
              _nodeKey: salesmanKey.toLowerCase(),
              _id: itemKey,
              _isColdstore: isColdstore
            });
          }
        }
      }
    }

    // Expose globally for pipeline matcher
    window.allLiveStockData = allLiveStockData;

    renderStockView();
  } catch (e) {
    console.error('Error loading stock:', e);
    if (el) el.innerHTML = '<div class="empty">Error loading stock data.</div>';
  }
}

function filterStockBySalesman(salesman) {
  currentSalesmanFilter = salesman;
  
  // Highlight active salesman button if they exist in UI
  ['rj', 'cdw', 'pot', 'all'].forEach(s => {
    const btn = document.getElementById(`btn-salesman-${s}`);
    if (btn) {
      if (s === salesman.toLowerCase()) {
        btn.style.background = '#1b4332';
        btn.style.color = '#fff';
      } else {
        btn.style.background = '#e2f0d9';
        btn.style.color = '#2d6a4f';
      }
    }
  });

  renderStockView();
}

function toggleColdstoreFilter() {
  currentColdstoreFilter = !currentColdstoreFilter;
  const btn = document.getElementById('coldstore-toggle-btn');
  if (btn) {
    if (currentColdstoreFilter) {
      btn.style.background = '#1b4332';
      btn.style.color = '#fff';
      btn.style.borderColor = '#1b4332';
    } else {
      btn.style.background = '#f8f9fa';
      btn.style.color = '#2d6a4f';
      btn.style.borderColor = '#2d6a4f';
    }
  }
  renderStockView();
}

function renderStockView() {
  const el = document.getElementById('list-stock') || document.getElementById('stock-results');
  if (!el) return;

  if (!allLiveStockData.length) {
    el.innerHTML = '<div class="empty">No stock records found. Waiting for sync...</div>';
    return;
  }

  // Filter stock based on selected salesman, commodity, and coldstore toggle
  const filtered = allLiveStockData.filter(item => {
    if (currentSalesmanFilter !== 'ALL' && item._nodeKey !== currentSalesmanFilter.toLowerCase()) {
      return false;
    }
    if (currentColdstoreFilter && !item._isColdstore) {
      return false;
    }
    const comm = item.commodity || item.comm || item.variety || '';
    if (currentCommodityFilter && currentCommodityFilter !== 'All commodities' && comm !== currentCommodityFilter) {
      return false;
    }
    return true;
  });

  if (!filtered.length) {
    el.innerHTML = '<div class="empty">No stock matches current filters.</div>';
    return;
  }

  el.innerHTML = filtered.map(item => {
    const commName = item.commodity || item.comm || item.variety || 'Produce Item';
    const qty = item.count !== undefined ? item.count : (item.qty_rec || item.qty_sort || '0');
    const pack = item.pack || item.size || '-';
    const salesmanBadge = item._nodeKey ? item._nodeKey.toUpperCase() : '';
    const coldstoreTag = item._isColdstore ? '<span style="background:#1e3a8a;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px;">Coldstore</span>' : '';

    return `
      <div style="background:#fff;border-radius:10px;padding:12px 16px;margin-bottom:8px;border:1.5px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:800;font-size:14px;color:#0f172a;display:flex;align-items:center;">
            ${commName} ${coldstoreTag}
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">
            Salesman: <strong>${salesmanBadge}</strong> · Pack: ${pack} · Grade: ${item.grade || '—'}
          </div>
        </div>
        <div style="background:#1e4d2b;border-radius:8px;padding:6px 12px;text-align:center;">
          <div style="font-size:14px;font-weight:800;color:#fff;">${qty} BAL</div>
        </div>
      </div>
    `;
  }).join('');
}

window.loadStockFromFirebase = loadStockFromFirebase;
window.filterStockBySalesman = filterStockBySalesman;
window.toggleColdstoreFilter = toggleColdstoreFilter;
window.renderStockView = renderStockView;
