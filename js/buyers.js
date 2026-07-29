// ===== BUYER FUNCTIONS =====

let liveBuyerData = [];

async function loadBuyersFromFirebase() {
  const el = document.getElementById('list-buyers');
  if (!el) return;
  el.innerHTML = '<div class="empty">Loading buyers…</div>';
  try {
    const snapshot = await firebase.database().ref('jdw/history').once('value');
    const raw = snapshot.val();
    if (!raw) { renderBuyers([]); return; }
    const hist = Array.isArray(raw) ? raw : Object.values(raw);
    liveBuyerData = buildBuyerProfiles(hist);
    renderBuyers(liveBuyerData);
    console.log('Buyers loaded:', liveBuyerData.length);
  } catch (e) {
    console.error('loadBuyers error:', e.message);
    liveBuyerData = [];
    const el = document.getElementById('list-buyers');
    if (el) el.innerHTML = '<div class="empty">Error loading buyers: ' + e.message + '</div>';
  }
}

function buildBuyerProfiles(history) {
  const map = {};
  const CN = { AVOS: 'Avocados', LEMS: 'Lemons', NAAR: 'Naartjies', ORGS: 'Oranges', CLTM: 'Clementines', KIWI: 'Kiwifruit', STRS: 'Strawberries', FIGS: 'Figs', GVS: 'Guavas', DRAG: 'Dragon Fruit', MANG: 'Mangoes', GFT: 'Grapefruit', UNK: 'Unknown', SATS: 'Satsumas', PAPO: 'Papino', BERS: 'Berries' };
  const PG = { AVOS: '4KG TRAY', KIWI: '500G PUNNET', STRS: '250G PUNNET', LEMS: '15KG CARTON', ORGS: '15KG CARTON', NAAR: '10KG CARTON', FIGS: '160G PUNNET', GVS: '4KG TRAY', MANG: '4KG TRAY' };

  for (const h of history) {
    if (!h.buyer || h.buyer === 'UNKNOWN') continue;
    const nm = h.buyer;
    if (!map[nm]) map[nm] = { name: nm, acc: h.account || '', txns: 0, turnover: 0, prefs: {}, lastDate: '', dates: [] };
    const b = map[nm];
    
    const lt = Number(h.pricesSum) || Number(h.total) || Number(h.revenue) || (Number(h.price || 0) * Number(h.qty || 0)) || 0;
    
    b.txns++;
    b.turnover += lt;
    if (h.date) b.dates.push(h.date);
    if (!b.acc && h.account) b.acc = h.account;
    if (!b.lastDate || h.date > b.lastDate) b.lastDate = h.date;
    const comm = h.commodity || 'UNK';
    if (!b.prefs[comm]) b.prefs[comm] = { comm: CN[comm] || comm, pack: PG[comm] || '', cls: 'CL ' + (h.cls || '1'), sizes: new Set(), txns: 0, totalQty: 0, revenue: 0 };
    const p = b.prefs[comm];
    p.txns++;
    p.totalQty += Number(h.qty) || 0;
    p.revenue += lt;
    if (h.size && h.size !== '*') p.sizes.add(h.size);
  }

  return Object.values(map).map(b => ({
    name: b.name,
    acc: b.acc,
    txns: b.txns,
    turnover: Math.round(b.turnover),
    lastDate: b.lastDate,
    avgFreq: 0,
    buyingDays: [],
    prefs: Object.values(b.prefs).sort((a, c) => c.revenue - a.revenue).map(p => ({
      comm: p.comm,
      pack: p.pack,
      cls: p.cls,
      sizes: p.sizes.size > 0 ? [...p.sizes].sort() : ['*'],
      revenue: Math.round(p.revenue),
      note: p.txns + ' txn' + (p.txns > 1 ? 's' : '') + ' · avg ' + Math.round(p.totalQty / p.txns) + ' units'
    }))
  })).sort((a, b) => b.turnover - a.turnover);
}

function renderBuyers(data) {
  const el = document.getElementById('list-buyers');
  if (!el) return;
  
  const displayData = data || liveBuyerData;
  if (!displayData || !displayData.length) { 
    el.innerHTML = '<div class="empty" style="text-align:center; padding:20px; color:#94a3b8;">No buyers found</div>'; 
    return; 
  }

  el.innerHTML = displayData.map(b => {
    const bid = 'b-' + b.name.replace(/\W/g, '-');
    return `<div style="background:#fff; border-radius:10px; padding:14px; margin-bottom:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:800; font-size:15px; color:#0f172a;">${b.name}</div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">Account: ${b.acc || '—'} · ${b.txns} txn${b.txns > 1 ? 's' : ''}</div>
        </div>
        <div style="background:#1e4d2b; border-radius:8px; padding:6px 10px; text-align:center;">
          <div style="font-size:14px; font-weight:800; color:#fff;">R ${(b.turnover || 0).toLocaleString()}</div>
          <div style="font-size:8px; color:rgba(255,255,255,0.8); text-transform:uppercase;">total turnover</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterBuyers() {
  const searchInput = document.getElementById('search-buyers');
  if (!searchInput) return;
  const q = searchInput.value.toLowerCase();
  renderBuyers(liveBuyerData.filter(b => b.name.toLowerCase().includes(q) || (b.acc && b.acc.toLowerCase().includes(q))));
}
