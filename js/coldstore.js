// ==========================================
// CLEANED COLDSTORE SCRIPT
// ==========================================

let allColdstoreData = [];
let currentColdstoreSalesman = 'ALL';

async function loadColdstoreStock() {
  const el = document.getElementById('coldstore-results') || document.getElementById('list-coldstore');
  if (!el) return; // Safely exit if not currently on the coldstore view
  el.innerHTML = '<div class="empty" style="padding:20px;text-align:center;color:#64748b;">Loading coldstore stock...</div>';

  try {
    const snapshot = await firebase.database().ref('stock').once('value');
    const raw = snapshot.val();
    allColdstoreData = [];

    if (raw) {
      for (const salesmanKey in raw) {
        for (const itemKey in raw[salesmanKey]) {
          const item = raw[salesmanKey][itemKey];
          if (item && typeof item === 'object') {
            const isColdstore = (item.coldstore || item.store || item.location || '').toString().toUpperCase().includes('COLD') || 
                                item.isColdstore === true || 
                                item.coldstore === 'YES' || 
                                item.coldstore === '1';

            if (isColdstore) {
              allColdstoreData.push({
                ...item,
                _nodeKey: salesmanKey.toLowerCase(),
                _id: itemKey
              });
            }
          }
        }
      }
    }

    renderColdstoreView();
  } catch (e) {
    console.error('Error loading coldstore stock:', e);
    if (el) el.innerHTML = '<div class="empty" style="padding:20px;text-align:center;color:#d90429;">Error loading coldstore data.</div>';
  }
}

function switchColdstoreTab(salesman) {
  currentColdstoreSalesman = salesman;
  
  ['rj', 'cdw', 'pot', 'all', 'ALL'].forEach(s => {
    const btn = document.getElementById(`coldstore-btn-${s}`) || document.getElementById(`btn-coldstore-${s}`);
    if (btn) {
      if (s.toLowerCase() === salesman.toLowerCase()) {
        btn.style.background = '#1b4332';
        btn.style.color = '#fff';
      } else {
        btn.style.background = '#e2f0d9';
        btn.style.color = '#2d6a4f';
      }
    }
  });

  renderColdstoreView();
}

function renderColdstoreView() {
  const el = document.getElementById('coldstore-results') || document.getElementById('list-coldstore');
  if (!el) return;

  const filtered = allColdstoreData.filter(item => {
    if (currentColdstoreSalesman !== 'ALL' && item._nodeKey !== currentColdstoreSalesman.toLowerCase()) {
      return false;
    }
    return true;
  });

  if (!filtered.length) {
    el.innerHTML = '<div class="empty" style="padding:20px;text-align:center;color:#64748b;">No coldstore stock found for <strong>' + currentColdstoreSalesman.toUpperCase() + '</strong>.</div>';
    return;
  }

  el.innerHTML = filtered.map(item => {
    const commName = item.commodity || item.comm || item.variety || 'Produce Item';
    const qty = item.count !== undefined ? item.count : (item.qty_rec || item.qty_sort || '0');
    const pack = item.pack || item.size || '-';
    const salesmanBadge = item._nodeKey ? item._nodeKey.toUpperCase() : '';

    return `
      <div style="background:#fff;border-radius:10px;padding:12px 16px;margin-bottom:8px;border:1.5px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:800;font-size:14px;color:#0f172a;display:flex;align-items:center;">
            ${commName} <span style="background:#1e3a8a;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px;">Coldstore</span>
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">
            Salesman: <strong>${salesmanBadge}</strong> · Pack: ${pack} · Grade: ${item.grade || '—'}
          </div>
        </div>
        <div style="background:#1e3a8a;border-radius:8px;padding:6px 12px;text-align:center;">
          <div style="font-size:14px;font-weight:800;color:#fff;">${qty} BAL</div>
        </div>
      </div>
    `;
  }).join('');
}

window.loadColdstoreStock = loadColdstoreStock;
window.switchColdstoreTab = switchColdstoreTab;
window.renderColdstoreView = renderColdstoreView;
