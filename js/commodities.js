// ===== COMMODITIES FUNCTIONS =====

function buildCommoditySummary() {
  const map = {};
  const COMM_NAMES = { AVOS: 'Avocados', LEMS: 'Lemons', ORGS: 'Oranges', KIWI: 'Kiwifruit', FIGS: 'Figs', GVS: 'Guavas', CLTM: 'Clementines', NAAR: 'Naartjies', STRS: 'Strawberries', MANG: 'Mangoes', DRAG: 'Dragon Fruit', GFT: 'Grapefruit', SATS: 'Satsumas', NOVA: 'Nova', POME: 'Pomegranate', PAPO: 'Papino' };

  for (const e of allLiveStockData) {
    const code = e.commodity || 'UNK';
    if (!map[code]) map[code] = { code, name: COMM_NAMES[code] || code, flr: 0, rec: 0, lines: [], users: new Set() };
    map[code].flr += Number(e.flr) || 0;
    map[code].rec += Number(e.rec) || 0;
    map[code].lines.push(e);
    if (e.user) map[code].users.add(e.user);
  }
  return Object.values(map).sort((a, b) => b.flr - a.flr);
}

function renderCommodities(data) {
  const el = document.getElementById('comm-summary-list');
  if (!el) return;
  if (!data || !data.length) { el.innerHTML = '<div class="empty">No stock data.</div>'; return; }
  el.innerHTML = data.map(c => `<div class="comm-card" onclick="showCommodityDetail('${c.code}')"><div><div class="comm-name">${c.name}</div><div class="comm-code">${c.code} · ${c.lines.length} lines · ${[...c.users].join(', ')}</div><div class="comm-meta">Received: ${c.rec.toLocaleString()} units</div></div><div style="text-align:right"><div class="comm-flr">${c.flr.toLocaleString()}</div><div class="comm-flr-label">ON FLOOR</div></div></div>`).join('');
}

function filterCommodities() {
  const q = document.getElementById('comm-search').value.toLowerCase();
  renderCommodities(buildCommoditySummary().filter(c => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)));
}

function showCommodityDetail(code) {
  const lines = allLiveStockData.filter(e => e.commodity === code);
  const COMM_NAMES = { AVOS: 'Avocados', LEMS: 'Lemons', ORGS: 'Oranges', KIWI: 'Kiwifruit', FIGS: 'Figs', GVS: 'Guavas', CLTM: 'Clementines', NAAR: 'Naartjies', STRS: 'Strawberries', MANG: 'Mangoes', DRAG: 'Dragon Fruit', GFT: 'Grapefruit', SATS: 'Satsumas' };
  const name = COMM_NAMES[code] || code;
  const flr = lines.reduce((s, e) => s + (Number(e.flr) || 0), 0);
  const rec = lines.reduce((s, e) => s + (Number(e.rec) || 0), 0);
  const users = [...new Set(lines.map(e => e.user).filter(Boolean))];

  document.getElementById('comm-detail-title').textContent = name + ' (' + code + ')';
  document.getElementById('comm-detail-stats').innerHTML = `<div class="comm-stat-box"><div class="comm-stat-val">${flr.toLocaleString()}</div><div class="comm-stat-lbl">On Floor</div></div><div class="comm-stat-box"><div class="comm-stat-val">${rec.toLocaleString()}</div><div class="comm-stat-lbl">Received</div></div><div class="comm-stat-box"><div class="comm-stat-val">${lines.length}</div><div class="comm-stat-lbl">Lines</div></div><div class="comm-stat-box"><div class="comm-stat-val">${users.join('/')}</div><div class="comm-stat-lbl">Salesmen</div></div>`;
  document.getElementById('comm-detail-lines').innerHTML = [...lines].sort((a, b) => (Number(b.flr) || 0) - (Number(a.flr) || 0)).map(e => `<div class="comm-line"><div class="comm-line-top"><span>${e.producer || e.grn || '—'}</span><span style="color:var(--moss)">${(Number(e.flr) || 0).toLocaleString()} FLR</span></div><div class="comm-line-bot"><span class="comm-badge">${e.user || ''}</span>GRN ${e.grn || '—'} · Arrived ${e.arrived || e.date || '—'} · Rec ${(Number(e.rec) || 0)}</div></div>`).join('');
  document.getElementById('comm-summary-list').style.display = 'none';
  document.getElementById('comm-detail').style.display = 'block';
}

function closeCommodityDetail() {
  document.getElementById('comm-summary-list').style.display = 'block';
  document.getElementById('comm-detail').style.display = 'none';
}