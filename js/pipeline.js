// ===== PIPELINE FUNCTIONS =====

function loadPipelineState() {
  const state = JSON.parse(sessionStorage.getItem('pipeline-' + new Date().toISOString().slice(0, 10)) || '{}');
  for (let i = 1; i <= 6; i++) {
    if (state[i]) {
      const el = document.getElementById('ps' + i);
      const ch = document.getElementById('psc' + i);
      if (el) el.classList.add('done');
      if (ch) ch.textContent = 'v';
    }
  }
}

function resetPipeline() {
  sessionStorage.removeItem('pipeline-' + new Date().toISOString().slice(0, 10));
  for (let i = 1; i <= 6; i++) {
    const el = document.getElementById('ps' + i);
    const ch = document.getElementById('psc' + i);
    if (el) el.classList.remove('done');
    if (ch) ch.textContent = 'o';
  }
}

function runAIFromPipeline() {
  const el = document.getElementById('ps1');
  const ch = document.getElementById('psc1');
  if (el) el.classList.add('done');
  if (ch) { ch.textContent = '...'; }
  const si = document.getElementById('ai-status-inline');
  if (si) si.textContent = 'Matching...';
  const state = JSON.parse(sessionStorage.getItem('pipeline-' + new Date().toISOString().slice(0, 10)) || '{}');
  state[1] = true;
  sessionStorage.setItem('pipeline-' + new Date().toISOString().slice(0, 10), JSON.stringify(state));
  runAIMatch();
}

function goToOrders() {
  togglePipelineStep(3);
  goToPage('orders');
}

function togglePipelineStep(n) {
  const el = document.getElementById('ps' + n);
  const ch = document.getElementById('psc' + n);
  const state = JSON.parse(sessionStorage.getItem('pipeline-' + new Date().toISOString().slice(0, 10)) || '{}');
  if (el.classList.contains('done')) {
    el.classList.remove('done');
    if (ch) ch.textContent = 'o';
    delete state[n];
    if (n === 4) {
      const rb = document.getElementById('pipeline-reserve-banner');
      if (rb) rb.style.display = 'none';
    }
  } else {
    el.classList.add('done');
    if (ch) ch.textContent = 'v';
    state[n] = true;
    if (n === 4) {
      const rb = document.getElementById('pipeline-reserve-banner');
      if (rb) rb.style.display = 'block';
    }
  }
  sessionStorage.setItem('pipeline-' + new Date().toISOString().slice(0, 10), JSON.stringify(state));
}

function togglePipelineCallList() {
  const list = document.getElementById('pipeline-call-list');
  const btn = document.getElementById('psc2');
  const isOpen = list.style.display !== 'none';
  list.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? 'Show' : 'Hide';
  if (!isOpen) renderPipelineBuyers();
}

function togglePipelinePayment() {
  const list = document.getElementById('pipeline-payment-list');
  const btn = document.getElementById('psc5');
  const isOpen = list.style.display !== 'none';
  list.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? 'Show' : 'Hide';
  if (!isOpen) renderPipelineOrders('pipeline-orders', 'payment');
}

function togglePipelinePackers() {
  const list = document.getElementById('pipeline-packers-list');
  const btn = document.getElementById('psc6');
  const isOpen = list.style.display !== 'none';
  list.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? 'Show' : 'Hide';
  if (!isOpen) renderPipelineOrders('pipeline-packers', 'packers');
}

function renderPipelineBuyers() {
  const el = document.getElementById('pipeline-buyers');
  const todayKey = 'pipeline-calls-' + new Date().toISOString().slice(0, 10);
  const called = JSON.parse(localStorage.getItem(todayKey) || '{}');
  const buyers = liveBuyerData || [];
  const todayDow = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();

  if (!buyers.length) {
    el.innerHTML = '<div style="color:var(--muted)">No buyer data - go to Buyers tab first.</div>';
    return;
  }

  const stock = allLiveStockData || [];
  const scored = buyers.map(b => {
    let he = 0;
    if (b.prefs) b.prefs.forEach(p => {
      const targetComm = p.comm;
      const sf = stock.filter(s => s.commodity === targetComm && s.flr > 0);
      if (sf.length > 0) he++;
    });
    const mp = he > 0 ? 3 : 0;
    const bt = b.buyingDays && b.buyingDays[todayDow] ? 1 : 0;
    return { ...b, _sort: mp * 100000 + (b.spend || 0) / 100 + bt * 10, _match: mp };
  }).sort((a, b) => b._sort - a._sort).slice(0, 20);

  el.innerHTML = scored.map((b, i) => {
    const isCalled = !!called[b.name];
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);opacity:${isCalled ? '0.4' : '1'}">
      <div data-bname="${b.name}" onclick="togglePipelineCall(this)" style="width:24px;height:24px;border-radius:6px;border:2px solid ${isCalled ? 'var(--sage)' : 'var(--border)'};background:${isCalled ? 'var(--sage)' : '#fff'};display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:13px">${isCalled ? 'v' : ''}</div>
      <div style="width:20px;height:20px;border-radius:50%;background:var(--moss);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:10px;flex-shrink:0">${i + 1}</div>
      <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;${isCalled ? 'text-decoration:line-through;color:var(--muted);' : ''}word-break:break-word">${b.name}${b.buyingDays && b.buyingDays[todayDow] ? ' (Today)' : ''}</div></div>
      <div style="font-size:11px;color:var(--muted);flex-shrink:0">R ${(b.spend || 0).toLocaleString()}</div>
    </div>`;
  }).join('');
}

function togglePipelineCall(el) {
  const name = el.getAttribute('data-bname');
  const todayKey = 'pipeline-calls-' + new Date().toISOString().slice(0, 10);
  const called = JSON.parse(localStorage.getItem(todayKey) || '{}');
  called[name] = !called[name];
  localStorage.setItem(todayKey, JSON.stringify(called));
  renderPipelineBuyers();
}

async function renderPipelineOrders(elId, mode) {
  const el = document.getElementById(elId);
  el.innerHTML = 'Loading...';
  try {
    const res = await fetch(FB_DB + '/orders.json?auth=' + FB_SECRET);
    const raw = await res.json();
    if (!raw) { el.innerHTML = '<div style="color:var(--muted)">No open orders.</div>'; return; }
    const orders = Object.entries(raw).map(e => ({ id: e[0], ...e[1] })).filter(o => o.status === 'open');
    if (!orders.length) { el.innerHTML = '<div style="color:var(--muted)">No open orders.</div>'; return; }

    const paidKey = 'pipeline-paid-' + new Date().toISOString().slice(0, 10);
    const packedKey = 'pipeline-packed-' + new Date().toISOString().slice(0, 10);
    const paidMap = JSON.parse(localStorage.getItem(paidKey) || '{}');
    const packedMap = JSON.parse(localStorage.getItem(packedKey) || '{}');

    el.innerHTML = orders.map(o => {
      const cf = o.commodity || '';
      const isPaid = !!paidMap[o.id];
      const isPacked = !!packedMap[o.id];
      const isChecked = mode === 'payment' ? isPaid : isPacked;
      const sk = mode === 'payment' ? paidKey : packedKey;
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);opacity:${isChecked ? '0.4' : '1'}">
        <div data-oid="${o.id}" data-skey="${sk}" onclick="togglePipelineOrderState(this)" style="width:24px;height:24px;border-radius:6px;border:2px solid ${isChecked ? 'var(--sage)' : 'var(--border)'};background:${isChecked ? 'var(--sage)' : '#fff'};display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:13px">${isChecked ? 'v' : ''}</div>
        <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;${isChecked ? 'text-decoration:line-through;color:var(--muted);' : ''}word-break:break-word">${o.buyer}</div><div style="font-size:11px;color:var(--muted)">${cf} - ${o.qty || '?'} units${o.collectDate ? ' - ' + o.collectDate : ''}</div></div>
        ${mode === 'payment' ? `<div style="font-size:11px;color:${isPaid ? 'var(--sage)' : 'var(--red)'};font-weight:700;flex-shrink:0">${isPaid ? 'PAID' : 'UNPAID'}</div>` : ''}
        ${mode === 'packers' ? `<div style="font-size:11px;color:${isPacked ? 'var(--sage)' : 'var(--gold)'};font-weight:700;flex-shrink:0">${isPacked ? 'PACKED' : 'PENDING'}</div>` : ''}
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = '<div style="color:var(--red)">Error: ' + e.message + '</div>';
  }
}

function togglePipelineOrderState(el) {
  const orderId = el.getAttribute('data-oid');
  const stateKey = el.getAttribute('data-skey');
  const map = JSON.parse(localStorage.getItem(stateKey) || '{}');
  map[orderId] = !map[orderId];
  localStorage.setItem(stateKey, JSON.stringify(map));
  if (stateKey.includes('paid')) renderPipelineOrders('pipeline-orders', 'payment');
  if (stateKey.includes('packed')) renderPipelineOrders('pipeline-packers', 'packers');
}

function runAIMatch() {
  console.log('Running match...');
  const btn = document.getElementById('ai-match-btn');
  const ld = document.getElementById('ai-loading');
  const se = document.getElementById('ai-summary');
  const st = document.getElementById('ai-summary-text');
  const err = document.getElementById('ai-error');
  const rd = document.getElementById('ai-results');
  const md = document.getElementById('manual-match');

  if (btn) { btn.disabled = true; btn.textContent = 'Matching...'; }
  if (ld) ld.style.display = 'block';
  if (se) se.style.display = 'none';
  if (err) err.style.display = 'none';
  if (rd) rd.style.display = 'none';

  const stock = allLiveStockData ? allLiveStockData.filter(s => s.flr > 0) : [];
  const buyers = liveBuyerData || [];

  console.log('Stock lines for matching:', stock.length);
  console.log('Buyers for matching:', buyers.length);

  if (!stock.length) {
    if (err) {
      err.textContent = 'No stock on floor. Please load stock data first.';
      err.style.display = 'block';
    }
    resetMatchButton();
    return;
  }

  if (!buyers.length) {
    if (err) {
      err.textContent = 'No buyer data. Please go to the Buyers tab first.';
      err.style.display = 'block';
    }
    resetMatchButton();
    return;
  }

  const todayDow = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();

  const matches = runDeterministicMatch(stock, buyers, todayDow);

  console.log('Matches found:', matches.length);

  if (!matches.length) {
    if (st) st.textContent = 'No matches found between current floor stock and buyer history.';
    if (se) se.style.display = 'block';
  } else {
    const topComms = [...new Set(matches.slice(0, 3).map(m => m.commodity))];
    if (st) st.textContent = matches.length + ' matches found across ' + topComms.length + ' commodities, ranked by stock fit and buying pattern.';
    if (se) se.style.display = 'block';
  }

  if (md) md.style.display = 'none';

  const si = document.getElementById('ai-status-inline');
  const ch2 = document.getElementById('psc1');
  if (ch2) { ch2.textContent = 'v'; ch2.style.background = 'var(--sage)'; }
  if (si) si.textContent = matches.length + ' matches found';

  try {
    localStorage.setItem('ai-results-' + new Date().toISOString().slice(0, 10), JSON.stringify({ summary: st ? st.textContent : '', matches: matches }));
  } catch (e) {}

  renderAICallList(matches, st ? st.textContent : '');

  const list = document.getElementById('pipeline-call-list');
  const btnEl = document.getElementById('psc2');
  if (list) list.style.display = 'block';
  if (btnEl) btnEl.textContent = 'Hide';

  resetMatchButton();
}

function resetMatchButton() {
  const btn = document.getElementById('ai-match-btn');
  const ld = document.getElementById('ai-loading');
  if (btn) { btn.disabled = false; btn.textContent = 'Run Match'; }
  if (ld) ld.style.display = 'none';
}

function renderAICallList(matches, summary) {
  const el = document.getElementById('pipeline-buyers');
  if (!el) return;

  const todayKey = 'pipeline-calls-' + new Date().toISOString().slice(0, 10);
  const called = JSON.parse(localStorage.getItem(todayKey) || '{}');

  if (!matches || !matches.length) {
    el.innerHTML = '<div style="color:var(--muted)">No matches found.</div>';
    return;
  }

  const byBuyer = {};
  const order = [];
  for (const m of matches) {
    if (!byBuyer[m.buyer]) { byBuyer[m.buyer] = []; order.push(m.buyer); }
    byBuyer[m.buyer].push(m);
  }

  let html = '';
  if (summary) {
    html += '<div style="background:var(--sage-light);border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:12px;color:#1a5c2a;border-left:3px solid var(--sage)">' + summary + '</div>';
  }

  html += order.map((buyer, i) => {
    const items = byBuyer[buyer];
    const isCalled = !!called[buyer];
    const top = items[0];
    const pl = top.priority || 'LOW';
    const pb = pl === 'HIGH' ? 'var(--gold-light)' : pl === 'MEDIUM' ? 'var(--sage-light)' : '#f0f0f0';
    const pc = pl === 'HIGH' ? '#8a5a00' : pl === 'MEDIUM' ? '#1a5c2a' : '#888';
    const sc = Number(top.score) || 0;
    const buysToday = items.some(m => m.buysToday);

    const rid = 'aic-' + i + '-' + Math.random().toString(36).slice(2);

    const itemsHTML = items.map((m) => {
      return '<div style="margin-bottom:6px">' +
        (m.reason ? '<div style="font-size:12px;background:var(--paper);border-radius:8px;padding:8px 10px;margin-bottom:4px;border-left:3px solid var(--sage)"><b>' + m.stockLine + '</b><br>' + m.reason + '</div>' : '') +
        (m.inColdstore ? '<div style="margin-bottom:4px"><span class="b" style="background:#e3f2fd;color:#1565c0;font-size:10px">❄️ In Coldstore</span></div>' : '') +
        (m.tip ? '<div style="font-size:11px;color:var(--muted)">💡 ' + m.tip + '</div>' : '') +
        '</div>';
    }).join('');

    return '<div style="border-bottom:1px solid var(--border);opacity:' + (isCalled ? '0.4' : '1') + '">' +
      '<div style="display:flex;align-items:flex-start;gap:8px;padding:9px 0;cursor:pointer" onclick="toggleSection(\'' + rid + '\')">' +
      '<div data-bname="' + buyer + '" onclick="event.stopPropagation();togglePipelineCall(this)" style="width:22px;height:22px;border-radius:6px;border:2px solid ' + (isCalled ? 'var(--sage)' : 'var(--border)') + ';background:' + (isCalled ? 'var(--sage)' : '#fff') + ';display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:12px;margin-top:1px">' + (isCalled ? 'v' : '') + '</div>' +
      '<div style="width:18px;height:18px;border-radius:50%;background:var(--moss);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:9px;flex-shrink:0;margin-top:2px">' + (i + 1) + '</div>' +
      '<div style="flex:1;min-width:0;overflow:hidden">' +
      '<div style="font-weight:700;font-size:13px;' + (isCalled ? 'text-decoration:line-through;color:var(--muted);' : '') + 'word-break:break-word">' + buyer + (buysToday ? ' <span style="background:var(--sage-light);color:#1a5c2a;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;white-space:nowrap">Today</span>' : '') + (items.length > 1 ? ' <span style="background:var(--blue-light);color:var(--blue);font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;white-space:nowrap">' + items.length + ' items</span>' : '') + '</div>' +
      '<div style="font-size:11px;color:var(--muted);margin-top:2px;word-break:break-word">' + items.map(m => m.stockLine).join(', ') + '</div>' +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0">' +
      '<span style="background:' + pb + ';color:' + pc + ';font-size:9px;font-weight:700;padding:2px 6px;border-radius:5px;display:block;margin-bottom:3px;white-space:nowrap">' + pl + '</span>' +
      '<span style="font-size:12px;font-weight:800;color:var(--moss)">' + sc + '</span>' +
      '</div>' +
      '</div>' +
      '<div id="' + rid + '" style="display:none;padding:0 0 12px 30px">' + itemsHTML + '</div>' +
      '</div>';
  }).join('');

  el.innerHTML = html || '<div style="color:var(--muted)">No matches found.</div>';
}
