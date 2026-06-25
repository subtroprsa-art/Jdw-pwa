// ===== BUYER FUNCTIONS =====

let liveBuyerData = [];

async function loadBuyersFromFirebase() {
  const el = document.getElementById('buyer-list');
  if (el) el.innerHTML = '<div class="empty">Loading buyers…</div>';
  try {
    const r = await fetch(FB_DB + '/jdw/history.json?auth=' + FB_SECRET);
    if (!r.ok) throw new Error('fetch failed');
    const raw = await r.json();
    if (!raw) { renderBuyers([]); return; }
    const hist = Array.isArray(raw) ? raw : Object.values(raw);
    liveBuyerData = buildBuyerProfiles(hist);
    renderBuyers(liveBuyerData);
    console.log('Buyers loaded:', liveBuyerData.length);
  } catch (e) {
    console.error('loadBuyers error:', e.message);
    liveBuyerData = [];
    const el = document.getElementById('buyer-list');
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
    if (!map[nm]) map[nm] = { name: nm, acc: h.account || '', txns: 0, spend: 0, prefs: {}, lastDate: '', dates: [] };
    const b = map[nm];
    const lt = Number(h.total) || (Number(h.price || 0) * Number(h.qty || 0)) || 0;
    b.txns++;
    b.spend += lt;
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
    spend: Math.round(b.spend),
    lastDate: b.lastDate,
    avgFreq: calcAvgFreq(b.dates),
    buyingDays: calcBuyingDays(b.dates),
    prefs: Object.values(b.prefs).sort((a, c) => c.revenue - a.revenue).map(p => ({
      comm: p.comm,
      pack: p.pack,
      cls: p.cls,
      sizes: p.sizes.size > 0 ? [...p.sizes].sort() : ['*'],
      revenue: Math.round(p.revenue),
      note: p.txns + ' txn' + (p.txns > 1 ? 's' : '') + ' · avg ' + Math.round(p.totalQty / p.txns) + ' units'
    }))
  })).sort((a, b) => b.spend - a.spend);
}

function renderBuyers(data) {
  const el = document.getElementById('buyer-list');
  if (!data || !data.length) { el.innerHTML = '<div class="empty">No buyers found</div>'; return; }

  const td = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();

  el.innerHTML = data.map(b => {
    const bid = 'b-' + b.name.replace(/\W/g, '-') + '-' + Math.random().toString(36).slice(2);
    const bt = b.buyingDays && b.buyingDays[td] ? '<span class="b bg" style="font-size:10px;margin-top:4px;display:inline-flex">🛒 Buys today</span>' : '';
    const ph = b.prefs.map(p => {
      const pid = 'p-' + Math.random().toString(36).slice(2);
      return `<div style="border:1.5px solid var(--border);border-radius:10px;margin-bottom:7px;overflow:hidden">
        <div onclick="toggleSection('${pid}')" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--paper);cursor:pointer">
          <div><div style="font-weight:700;font-size:13px;color:var(--moss)">${p.comm}</div><div style="font-size:11px;color:var(--muted);margin-top:2px">${p.note}</div></div>
          <div style="display:flex;align-items:center;gap:8px"><div style="text-align:right"><div style="font-size:15px;font-weight:800;color:var(--moss)">R ${p.revenue.toLocaleString()}</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase">revenue</div></div><div id="arr-${pid}" style="color:var(--muted);font-size:13px;transition:transform .2s">▼</div></div>
        </div>
        <div id="${pid}" style="display:none;padding:10px 12px;border-top:1px solid var(--border)">
          <div style="display:flex;flex-wrap:wrap;gap:6px"><span class="b bb">${p.pack || '—'}</span><span class="b ${p.cls === 'CL 1' ? 'bg' : 'ba'}">${p.cls}</span><span class="b bt">sz ${p.sizes.join(', ')}</span></div>
        </div>
      </div>`;
    }).join('');

    return `<div style="background:var(--card);border-radius:14px;box-shadow:var(--shadow);margin-bottom:12px;overflow:hidden">
      <div onclick="toggleSection('${bid}')" style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:var(--moss);cursor:pointer">
        <div><div style="font-weight:800;font-size:15px;color:#fff">${b.name}</div><div style="font-size:11px;color:rgba(255,255,255,0.65);margin-top:2px">Acc ${b.acc || '—'} · ${b.txns} txn${b.txns > 1 ? 's' : ''}${b.lastDate ? ' · ' + b.lastDate : ''}</div></div>
        <div style="display:flex;align-items:center;gap:10px"><div style="background:rgba(255,255,255,0.2);border-radius:10px;padding:6px 12px;text-align:center"><div style="font-size:18px;font-weight:800;color:#fff;line-height:1">R ${(b.spend || 0).toLocaleString()}</div><div style="font-size:9px;color:rgba(255,255,255,0.7);text-transform:uppercase">total spend</div></div><div id="arr-${bid}" style="color:#fff;font-size:14px;transition:transform .2s">▼</div></div>
      </div>
      <div id="${bid}" style="display:none;padding:10px">${b.buyingDays ? renderDayBadges(b.buyingDays) : ''}${bt ? '<div style="margin:6px 0 10px">' + bt + '</div>' : ''}${ph}</div>
    </div>`;
  }).join('');
}

function filterBuyers() {
  const q = document.getElementById('buyer-search').value.toLowerCase();
  renderBuyers(liveBuyerData.filter(b => b.name.toLowerCase().includes(q) || (b.acc && b.acc.includes(q))));
}