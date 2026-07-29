// ===== FLOOR BALANCE FUNCTIONS =====

let liveFloorData = [];
let allLiveFloorData = [];

async function loadFloorFromFirebase(user) {
  const el = document.getElementById('floor-list');
  if (el) el.innerHTML = '<div class="empty">Loading...</div>';

  // Define possible key variations for Firebase lookups
  const possibleKeys = [user];
  if (user === 'CDW') {
    possibleKeys.push('christoff.dewet', 'Christoff', 'cdw', 'Christoff de Wet');
  } else if (user === 'RJ') {
    possibleKeys.push('riaan.joubert', 'Riaan', 'rj', 'Riaan Joubert');
  } else if (user === 'POT') {
    possibleKeys.push('potgieter', 'pot', 'Potgieter');
  }

  let d = null;
  let activeKey = user;

  for (const key of possibleKeys) {
    try {
      const snapshot = await firebase.database().ref('floorBalance/' + key).once('value');
      const val = snapshot.val();
      if (val) {
        d = val;
        activeKey = key;
        break;
      }
    } catch (err) {
      // Ignore invalid path errors on individual iterations and continue trying fallbacks
    }
  }

  if (!d) {
    if (el) el.innerHTML = '<div class="empty">No floor balance data for ' + user + ' (checked keys: ' + possibleKeys.join(', ') + ').</div>';
    return;
  }

  liveFloorData = Object.values(d);
  allLiveFloorData = [];
  populateFloorFilter(liveFloorData);
  filterFloor();
}

function switchFloorTab(user, btn) {
  document.querySelectorAll('.floor-tab').forEach(b => {
    if (b.id && b.id.startsWith('ftab-')) b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');
  liveFloorData = [];
  const el = document.getElementById('floor-list');
  if (el) el.innerHTML = '<div class="empty">Loading...</div>';
  loadFloorFromFirebase(user);
}

function filterFloor() {
  const q = (document.getElementById('floor-search').value || '').toLowerCase().trim();
  const f = document.getElementById('floor-filter').value;
  let src = liveFloorData;

  if (q && !allLiveFloorData.length) { loadAllFloorData().then(filterFloor); return; }
  if (q && allLiveFloorData.length) src = allLiveFloorData;

  const CN = { AVOS: 'avocados', LEMS: 'lemons', ORGS: 'oranges', KIWI: 'kiwifruit', FIGS: 'figs', GVS: 'guavas', CLTM: 'clementines', NAAR: 'naartjies', STRS: 'strawberries', MANG: 'mangoes', DRAG: 'dragon fruit', GFT: 'grapefruit', SATS: 'satsumas', NOVA: 'nova', POME: 'pomegranate', PAPO: 'papino' };
  const VN = { AF: 'fuerte', AH: 'hass', AK: 'pinkerton', MA: 'maluma', MAH: 'maluma', MD: 'mendez', NV: 'navel', CN: 'cara cara', AX: 'mixed', LR: 'leanri', HM: 'honey murcott', M1: 'mandarin', NAR: 'nardocott' };
  const PN = { TR040: '4kg tray', BG150: '15kg bag', CTT150: '15kg carton', PTB005: '500g punnet', PTB002: '160g punnet', DL076: 'dl076', PC030: '3kg pocket', PC060: '6kg pocket', CO150: '15kg carton' };

  const data = src.filter(s => {
    if (f && s.commodity !== f) return false;
    if (!q) return true;
    const terms = q.split(' ');
    const searchStr = [
      s.producer || '',
      CN[s.commodity] || s.commodity || '',
      VN[s.variety] || s.variety || '',
      s.variety || '',
      String(s.size || ''),
      String(s.count || ''),
      PN[s.pack] || s.pack || '',
      s.grade || '',
      s.grn || '',
      s.seq || '',
      String(s.balance || '')
    ].join(' ').toLowerCase();
    return terms.every(t => searchStr.includes(t));
  });

  renderFloor(data);
  const su = document.getElementById('floor-summary');
  if (su && data.length) su.textContent = data.length + ' lines - ' + new Set(data.map(s => s.producer)).size + ' producers';
}

function renderFloor(data) {
  const el = document.getElementById('floor-list');
  const su = document.getElementById('floor-summary');
  if (!data || !data.length) { el.innerHTML = '<div class="empty">No floor balance entries found</div>'; if (su) su.textContent = ''; return; }

  data = [...data].sort((a, b) => {
    const pa = (a.producer || '').localeCompare(b.producer || '');
    if (pa !== 0) return pa;
    return (Number(b.days) || 0) - (Number(a.days) || 0);
  });

  if (su) su.textContent = data.length + ' lines - ' + new Set(data.map(s => s.producer)).size + ' producers';

  const byProd = {};
  data.forEach(s => {
    const p = s.producer || 'Unknown';
    if (!byProd[p]) byProd[p] = [];
    byProd[p].push(s);
  });

  const CN = { AVOS: 'Avocados', LEMS: 'Lemons', ORGS: 'Oranges', KIWI: 'Kiwifruit', FIGS: 'Figs', GVS: 'Guavas', CLTM: 'Clementines', NAAR: 'Naartjies', STRS: 'Strawberries', MANG: 'Mangoes', DRAG: 'Dragon Fruit', GFT: 'Grapefruit', SATS: 'Satsumas', NOVA: 'Nova', POME: 'Pomegranate', PAPO: 'Papino' };
  const PN = { TR040: '4KG Tray', BG150: '15KG Bag', CTT150: '15KG Carton', PTB005: '500G Punnet', PTB002: '160G Punnet', DL076: 'DL076', PC030: '3KG Pocket', PC060: '6KG Pocket', CO100: '10KG Carton' };
  const VN = { AF: 'Fuerte', AH: 'Hass', AK: 'Pinkerton', MA: 'Maluma', MAH: 'Maluma', AX: 'Mixed', NV: 'Navel', CN: 'Cara Cara', MD: 'Mendez' };

  el.innerHTML = Object.keys(byProd).sort().map(prod => {
    const lines = byProd[prod];
    const totalBal = lines.reduce((s, e) => s + (Number(e.balance) || 0), 0);
    const pid = 'fp-' + prod.replace(/\s+/g, '-') + '-' + Math.random().toString(36).slice(2);
    const hasOld = lines.some(s => (Number(s.days) || 0) >= 14);

    const linesHTML = lines.map(s => {
      const days = Number(s.days) || 0;
      const bal = Number(s.balance) || 0;
      const comm = s.commodity || 'UNK';
      const pack = PN[s.pack] || s.pack || '-';
      const variety = s.variety && s.variety !== '*' ? (VN[s.variety] || s.variety) : '';
      const grade = s.grade || '';
      const size = (s.size && s.size !== '*') ? String(s.size) : (s.count ? String(s.count) : '');
      const oldBadge = days >= 14 ? `<span class="b br">${days}d</span>` : days >= 7 ? `<span class="b ba">${days}d</span>` : `<span class="b bt">${days}d</span>`;

      return `<div style="background:#fff;border-radius:10px;padding:10px 12px;margin-bottom:7px;border:1.5px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="background:var(--moss);color:#fff;font-weight:800;font-size:15px;padding:3px 10px;border-radius:8px">SEQ ${s.seq || '-'}</div>
            <div style="font-size:11px;color:var(--muted)">GRN ${s.grn || '-'}</div>
          </div>
          <div style="font-size:16px;font-weight:800;color:${bal === 0 ? 'var(--red)' : bal < 20 ? 'var(--gold)' : 'var(--moss)'}">${bal} <span style="font-size:10px;font-weight:600;color:var(--muted)">BAL</span></div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:5px">
          <span class="b bg">${CN[comm] || comm}</span>
          <span class="b bb">${pack}</span>
          ${variety ? `<span class="b" style="background:#f0f4f0;color:var(--muted)">${variety}</span>` : ''}
          ${grade ? `<span class="b ${grade === 'CL 1' ? 'bg' : grade === 'CL 2' ? 'ba' : 'bb'}">${grade}</span>` : ''}
          ${size ? `<span class="b bt">sz ${size}</span>` : ''}
          ${oldBadge}
          <button class="add-cart-btn" onclick="addToCartFromFloor('${s.seq}', '${comm}', '${s.producer || ''}')">➕ Add to Cart</button>
        </div>
        <div style="font-size:10px;color:var(--muted)">Arrived: ${s.arrived || '-'} Rec: ${s.received || '-'}</div>
      </div>`;
    }).join('');

    return `<div style="background:var(--card);border-radius:14px;box-shadow:var(--shadow);margin-bottom:12px;overflow:hidden">
      <div onclick="toggleSection('${pid}')" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--moss);cursor:pointer">
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:14px;color:#fff;word-break:break-word">${prod}${hasOld ? ' <span style="background:rgba(192,57,43,0.85);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;margin-left:6px">OLD</span>' : ''}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.65);margin-top:2px">${lines.length} line${lines.length > 1 ? 's' : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
          <div style="background:rgba(255,255,255,0.2);border-radius:10px;padding:5px 10px;text-align:center">
            <div style="font-size:18px;font-weight:800;color:#fff;line-height:1">${totalBal.toLocaleString()}</div>
            <div style="font-size:9px;color:rgba(255,255,255,0.7);text-transform:uppercase">balance</div>
          </div>
          <div id="arr-${pid}" style="color:#fff;font-size:14px;transition:transform .2s">v</div>
        </div>
      </div>
      <div id="${pid}" style="display:none;padding:10px">${linesHTML}</div>
    </div>`;
  }).join('');
}

function populateFloorFilter(data) {
  const sel = document.getElementById('floor-filter');
  if (!sel) return;
  const current = sel.value;
  const CN = { AVOS: 'Avocados', LEMS: 'Lemons', ORGS: 'Oranges', KIWI: 'Kiwifruit', FIGS: 'Figs', GVS: 'Guavas', CLTM: 'Clementines', NAAR: 'Naartjies', STRS: 'Strawberries', MANG: 'Mangoes', DRAG: 'Dragon Fruit', GFT: 'Grapefruit', SATS: 'Satsumas', NOVA: 'Nova', POME: 'Pomegranate', PAPO: 'Papino' };
  const src = allLiveFloorData.length ? allLiveFloorData : (data || liveFloorData);
  const codes = [...new Set(src.map(s => s.commodity).filter(Boolean))].sort((a, b) => (CN[a] || a).localeCompare(CN[b] || b));
  sel.innerHTML = '<option value="">All commodities</option>' + codes.map(c => `<option value="${c}"${c === current ? ' selected' : ''}>${CN[c] || c}</option>`).join('');
}

async function loadAllFloorData() {
  try {
    const snapshot = await firebase.database().ref('floorBalance').once('value');
    const d = snapshot.val();
    const all = [];
    for (const u in d || {}) {
      for (const e in d[u] || {}) {
        all.push(d[u][e]);
      }
    }
    allLiveFloorData = all;
  } catch (e) {
    console.warn('loadAllFloorData:', e.message);
  }
}
