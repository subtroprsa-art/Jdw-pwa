// ===== STOCK FUNCTIONS =====

let allLiveStockData = [];
let liveStockData = [];

async function loadStockFromFirebase(user) {
  try {
    const r = await fetch(FB_DB + '/stock/' + user + '.json?auth=' + FB_SECRET);
    if (!r.ok) throw new Error('failed');
    const d = await r.json();
    liveStockData = Object.values(d || {}).map(firebaseToItem);
    filterStock();
  } catch (e) {
    const el = document.getElementById('stock-list');
    if (el) el.innerHTML = '<div class="empty">Could not load stock.</div>';
  }
}

function filterStock() {
  const q = document.getElementById('stock-search').value.toLowerCase().trim();
  const f = document.getElementById('stock-filter').value;
  const src = allLiveStockData.length ? allLiveStockData : liveStockData;
  const CN = { AVOS: 'avocados', LEMS: 'lemons', ORGS: 'oranges', KIWI: 'kiwifruit', FIGS: 'figs', GVS: 'guavas', CLTM: 'clementines', NAAR: 'naartjies', STRS: 'strawberries', MANG: 'mangoes', DRAG: 'dragon fruit', GFT: 'grapefruit', SATS: 'satsumas' };
  const VN = { AF: 'fuerte', AH: 'hass', AK: 'pinkerton', MA: 'maluma', MAH: 'maluma', MD: 'mendez', NV: 'navel', AX: 'mixed' };

  const filtered = src.filter(s => {
    if (f && s.commodity !== f) return false;
    if (!q) return true;
    const terms = q.split(' ');
    const searchStr = [s.producer, CN[s.commodity] || s.commodity, VN[s.variety] || s.variety || '', s.size || '', s.pack || '', s.grn || ''].join(' ').toLowerCase();
    return terms.every(t => searchStr.includes(t));
  });
  renderStock(filtered);
}

function renderStock(data) {
  const el = document.getElementById('stock-list');
  if (!data || !data.length) { el.innerHTML = '<div class="empty">No stock found</div>'; return; }

  const COMM_NAMES = { AVOS: 'Avocados', LEMS: 'Lemons', ORGS: 'Oranges', KIWI: 'Kiwifruit', FIGS: 'Figs', GVS: 'Guavas', CLTM: 'Clementines', NAAR: 'Naartjies', STRS: 'Strawberries', MANG: 'Mangoes', DRAG: 'Dragon Fruit', GFT: 'Grapefruit', SATS: 'Satsumas' };
  const PACK_NAMES = { TR040: '4KG Tray', BG150: '15KG Bag', CTT150: '15KG Carton', PTB005: '500G Punnet', PTB002: '160G Punnet', DL076: 'DL 076 Carton', PC030: '3KG Pocket', PC060: '6KG Pocket', CO100: '10KG Carton' };
  const VARIETY_NAMES = { AF: 'Fuerte', AH: 'Hass', AK: 'Pinkerton', MA: 'Maluma', MAH: 'Maluma', MD: 'Mendez', NV: 'Navel', CN: 'Cara Cara', AX: 'Mixed', LR: 'Leanri', HM: 'Honey Murcott', M1: 'Mandarin', NAR: 'Nardocott' };

  const byC = {};
  data.forEach(s => {
    const c = s.commodity || 'UNK';
    const p = s.producer || 'Unknown';
    if (!byC[c]) byC[c] = {};
    if (!byC[c][p]) byC[c][p] = [];
    byC[c][p].push(s);
  });

  const sC = Object.keys(byC).sort((a, b) => (COMM_NAMES[a] || a).localeCompare(COMM_NAMES[b] || b));

  el.innerHTML = sC.map(comm => {
    const cl = COMM_NAMES[comm] || comm;
    const prods = byC[comm];
    const sP = Object.keys(prods).sort();
    const tf = sP.reduce((s, p) => s + prods[p].reduce((x, e) => x + (Number(e.flr) || 0), 0), 0);
    const cid = 'c-' + comm + '-' + Math.random().toString(36).slice(2);

    const ph = sP.map(prod => {
      const lines = prods[prod];
      const pf = lines.reduce((s, e) => s + (Number(e.flr) || 0), 0);
      const pid = 'p-' + prod.replace(/\s+/g, '-') + '-' + Math.random().toString(36).slice(2);
      const lh = lines.sort((a, b) => (Number(b.flr) || 0) - (Number(a.flr) || 0)).map(s => {
        const days = daysOnFloor(s.arrived || s.date || '');
        const ob = s.flr > 0 && days >= 14 ? `<span class="b br">⚠️ ${days}d</span>` : '';
        return `<div style="background:#fff;border-radius:10px;padding:11px 13px;margin-bottom:8px;border:1.5px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px">
            <div style="font-size:11px;color:var(--muted)">GRN ${s.grn} · ${fmtArrived(s.arrived || s.date || '')}</div>
            <span class="b ${s.flr === 0 ? 'br' : 'bg'}">${s.flr === 0 ? 'Cleared' : 'In Stock'}</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
            <span class="b bb">${PACK_NAMES[s.pack] || s.pack}</span>
            <span class="b ${s.grade === '1' ? 'bg' : 'ba'}">CL ${s.grade}</span>
            ${s.size && s.size !== '*' ? `<span class="b bt">sz ${s.size}</span>` : ''}
            ${s.variety && s.variety !== '*' ? `<span class="b" style="background:#f0f4f0;color:var(--muted)">${VARIETY_NAMES[s.variety] || s.variety}</span>` : ''}
            ${ob}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
            <div style="background:var(--paper);border-radius:8px;padding:6px;text-align:center"><div style="font-size:9px;font-weight:600;text-transform:uppercase;color:var(--muted);margin-bottom:2px">Rec</div><div style="font-size:16px;font-weight:800;color:var(--blue)">${s.rec}</div></div>
            <div style="background:var(--paper);border-radius:8px;padding:6px;text-align:center"><div style="font-size:9px;font-weight:600;text-transform:uppercase;color:var(--muted);margin-bottom:2px">Sold</div><div style="font-size:16px;font-weight:800;color:var(--sage)">${s.sold}</div></div>
            <div style="background:var(--paper);border-radius:8px;padding:6px;text-align:center"><div style="font-size:9px;font-weight:600;text-transform:uppercase;color:var(--muted);margin-bottom:2px">Floor</div><div style="font-size:16px;font-weight:800;color:${s.flr === 0 ? 'var(--red)' : s.flr < 20 ? 'var(--gold)' : 'var(--moss)'}">${s.flr}</div></div>
          </div>
        </div>`;
      }).join('');

      return `<div style="border:1.5px solid var(--border);border-radius:11px;margin-bottom:8px;overflow:hidden">
        <div onclick="toggleSection('${pid}')" style="display:flex;justify-content:space-between;align-items:center;padding:11px 14px;background:var(--paper);cursor:pointer">
          <div><div style="font-weight:700;font-size:13.5px">${prod}</div><div style="font-size:11px;color:var(--muted);margin-top:1px">${lines.length} line${lines.length > 1 ? 's' : ''} · ${lines.reduce((x, e) => x + (Number(e.rec) || 0), 0).toLocaleString()} rec</div></div>
          <div style="display:flex;align-items:center;gap:10px"><div style="text-align:right"><div style="font-size:18px;font-weight:800;color:var(--moss)">${pf.toLocaleString()}</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase">floor</div></div><div id="arr-${pid}" style="color:var(--muted);font-size:14px;transition:transform .2s">▼</div></div>
        </div>
        <div id="${pid}" style="display:none;padding:10px 10px 2px">${lh}</div>
      </div>`;
    }).join('');

    return `<div style="background:var(--card);border-radius:14px;box-shadow:var(--shadow);margin-bottom:14px;overflow:hidden">
      <div onclick="toggleSection('${cid}')" style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:var(--moss);cursor:pointer">
        <div><div style="font-weight:800;font-size:16px;color:#fff">${cl}</div><div style="font-size:11px;color:rgba(255,255,255,0.65);margin-top:2px">${sP.length} producer${sP.length > 1 ? 's' : ''}</div></div>
        <div style="display:flex;align-items:center;gap:10px"><div style="background:rgba(255,255,255,0.2);border-radius:10px;padding:6px 12px;text-align:center"><div style="font-size:20px;font-weight:800;color:#fff;line-height:1">${tf.toLocaleString()}</div><div style="font-size:9px;color:rgba(255,255,255,0.7);text-transform:uppercase">on floor</div></div><div id="arr-${cid}" style="color:#fff;font-size:14px;transition:transform .2s">▼</div></div>
      </div>
      <div id="${cid}" style="display:none;padding:10px">${ph}</div>
    </div>`;
  }).join('');
}

async function loadAllStockForMatcher() {
  try {
    const r = await fetch(FB_DB + '/stock.json?auth=' + FB_SECRET);
    if (!r.ok) throw new Error();
    const d = await r.json();
    const all = [];
    for (const u in d || {}) {
      for (const e in d[u] || {}) {
        all.push(firebaseToItem(d[u][e]));
      }
    }
    allLiveStockData = all;
    console.log('Stock loaded for matcher:', all.length);
  } catch (e) {
    console.error('loadAllStockForMatcher error:', e);
  }
}

function switchStockTab(user, btn) {
  document.querySelectorAll('.stock-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  liveStockData = [];
  allLiveStockData = [];
  const el = document.getElementById('stock-list');
  if (el) el.innerHTML = '<div class="empty">Loading…</div>';
  loadStockFromFirebase(user);
}

async function doStockUpload(clearFirst) {
  const input = document.getElementById('stockFile');
  const file = input && input.files && input.files[0];
  const stat = document.getElementById('uploadStatus');
  if (!file) { stat.textContent = 'Please choose a PDF first.'; stat.style.color = 'var(--red)'; return; }
  stat.style.color = 'var(--muted)';
  stat.textContent = clearFirst ? 'Clearing & uploading…' : 'Uploading…';
  try {
    const form = new FormData();
    form.append('pdf', file, file.name);
    const r = await fetch(SYNC_URL + '/' + (clearFirst ? 'clear-and-upload' : 'upload-stock'), { method: 'POST', body: form });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error || 'Upload failed');
    stat.style.color = 'var(--sage)';
    stat.textContent = '✓ ' + result.count + ' entries loaded for ' + result.user;
    input.value = '';
    document.getElementById('stockFileName').textContent = 'No file chosen';
    loadStockFromFirebase(result.user);
    loadAllStockForMatcher();
  } catch (e) {
    stat.style.color = 'var(--red)';
    stat.textContent = '✗ ' + e.message;
  }
}