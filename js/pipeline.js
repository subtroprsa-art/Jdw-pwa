// ===== GLOBAL WINDOW ATTACHMENT =====
window.allLiveStockData = window.allLiveStockData || [];
window.liveBuyerData = window.liveBuyerData || [];

// ===== LIVE FIREBASE DATA SYNC =====
function syncPipelineData() {
  if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
    console.warn("⏳ Waiting for Firebase initialization...");
    setTimeout(syncPipelineData, 500);
    return;
  }

  console.log("🔄 Initializing Pipeline Data Listeners...");

  // Synchronize Live Stock Data
  firebase.database().ref('stock').on('value', snapshot => {
    const raw = snapshot.val() || {};
    let items = [];
    
    if (Array.isArray(raw)) {
      items = raw;
    } else if (typeof raw === 'object') {
      Object.keys(raw).forEach(key => {
        if (Array.isArray(raw[key])) {
          items = items.concat(raw[key]);
        } else if (typeof raw[key] === 'object') {
          items = items.concat(Object.values(raw[key]));
        }
      });
    }

    window.allLiveStockData = items;
    console.log("✅ Pipeline Live Stock Synced:", window.allLiveStockData.length, "lines");
  }, err => console.error("Stock sync error:", err));

  // Synchronize Live Buyer Data
  firebase.database().ref('buyers').on('value', snapshot => {
    const raw = snapshot.val() || {};
    let buyers = Array.isArray(raw) ? raw : Object.values(raw);
    
    window.liveBuyerData = buyers;
    console.log("✅ Pipeline Live Buyers Synced:", window.liveBuyerData.length, "buyers");
  }, err => console.error("Buyer sync error:", err));
}

// Start watching Firebase
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  syncPipelineData();
} else {
  document.addEventListener('DOMContentLoaded', syncPipelineData);
}

// Helper function to safely read available quantity across different payload structures
function getStockQty(s) {
  if (!s) return 0;
  return Number(s.flr || s.qty || s.pallets || s.available || s.total || 0);
}

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
  if (typeof goToPage === 'function') goToPage('orders');
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
  if (!el) return;
  
  const todayKey = 'pipeline-calls-' + new Date().toISOString().slice(0, 10);
  const called = JSON.parse(localStorage.getItem(todayKey) || '{}');
  const buyers = (window.allBuyers && window.allBuyers.length) ? window.allBuyers : (window.liveBuyerData || []);
  const todayDow = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();

  if (!buyers.length) {
    el.innerHTML = '<div style="color:var(--muted)">No buyer data loaded yet.</div>';
    return;
  }

  const stock = (window.allStockData && window.allStockData.length) ? window.allStockData : (window.allLiveStockData || []);
  const scored = buyers.map(b => {
    let he = 0;
    if (b.prefs) b.prefs.forEach(p => {
      const targetComm = String(p.comm || '').trim().toUpperCase();
      const sf = stock.filter(s => {
        const stockComm = String(s.commodity || '').trim().toUpperCase();
        const matchesComm = stockComm.includes(targetComm) || targetComm.includes(stockComm);
        return matchesComm && getStockQty(s) > 0;
      });
      if (sf.length > 0) he++;
    });
    const mp = he > 0 ? 3 : 0;
    const bt = b.buyingDays && b.buyingDays[todayDow] ? 1 : 0;
    return { ...b, _sort: mp * 100000 + (b.spend || 0) / 100 + bt * 10, _match: mp };
  }).sort((a, b) => b._sort - a._sort).slice(0, 20);

  el.innerHTML = scored.map((b, i) => {
    const isCalled = !!called[b.name];
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);opacity:${isCalled ? '0.4' : '1'}">
      <div data-bname="${b.name}" onclick="togglePipelineCall(this, event)" style="width:24px;height:24px;border-radius:6px;border:2px solid ${isCalled ? 'var(--sage)' : 'var(--border)'};background:${isCalled ? 'var(--sage)' : '#fff'};display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:13px">${isCalled ? 'v' : ''}</div>
      <div style="width:20px;height:20px;border-radius:50%;background:var(--moss);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:10px;flex-shrink:0">${i + 1}</div>
      <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;${isCalled ? 'text-decoration:line-through;color:var(--muted);' : ''}word-break:break-word">${b.name}${b.buyingDays && b.buyingDays[todayDow] ? ' (Today)' : ''}</div></div>
      <div style="font-size:11px;color:var(--muted);flex-shrink:0">R ${(b.spend || 0).toLocaleString()}</div>
    </div>`;
  }).join('');
}

function togglePipelineCall(el, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const name = el.getAttribute('data-bname');
  const todayKey = 'pipeline-calls-' + new Date().toISOString().slice(0, 10);
  const callsRef = firebase.database().ref('pipelineCalls/' + todayKey + '/' + name);

  callsRef.once('value').then(snapshot => {
    const current = snapshot.val() || false;
    callsRef.set(!current).then(() => {
      const todayMatchKey = 'ai-results-' + new Date().toISOString().slice(0, 10);
      const saved = JSON.parse(localStorage.getItem(todayMatchKey) || '{}');
      if (saved && saved.matches && saved.matches.length > 0) {
        renderAICallList(saved.matches, saved.summary);
      } else {
        renderPipelineBuyers();
      }
    });
  }).catch(err => {
    console.error('Error toggling call:', err);
  });
}

async function renderPipelineOrders(elId, mode) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = 'Loading...';
  try {
    const snapshot = await firebase.database().ref('orders').once('value');
    const raw = snapshot.val();
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

async function runAIMatch() {
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

  // Brief safety pause loop to ensure modular global variables have fully bound
  let attempts = 0;
  while (
    ((!window.allStockData || !window.allStockData.length) && (!window.allLiveStockData || !window.allLiveStockData.length)) ||
    ((!window.allBuyers || !window.allBuyers.length) && (!window.liveBuyerData || !window.liveBuyerData.length))
  ) {
    if (attempts > 10) break;
    attempts++;
    await new Promise(r => setTimeout(r, 100));
  }

  // 1. Gather Stock (Prioritize modular window.allStockData, then fallback to window.allLiveStockData)
  let rawStock = [];
  if (typeof window.allStockData !== 'undefined' && window.allStockData.length) {
    rawStock = window.allStockData;
  } else if (window.allLiveStockData && window.allLiveStockData.length) {
    rawStock = window.allLiveStockData;
  }
  let stock = rawStock.filter(s => getStockQty(s) > 0);

  // 2. Gather Buyers (Prioritize modular window.allBuyers, then fallback to window.liveBuyerData)
  let buyers = [];
  if (typeof window.allBuyers !== 'undefined' && window.allBuyers.length) {
    buyers = window.allBuyers;
  } else if (window.liveBuyerData && window.liveBuyerData.length) {
    buyers = window.liveBuyerData;
  }

  // Fallback direct Firebase fetch if arrays are still empty
  if (!stock.length && typeof firebase !== 'undefined') {
    try {
      const stockSnap = await firebase.database().ref('stock').once('value');
      const raw = stockSnap.val() || {};
      let items = [];
      if (Array.isArray(raw)) items = raw;
      else Object.keys(raw).forEach(key => {
        if (Array.isArray(raw[key])) items = items.concat(raw[key]);
        else if (typeof raw[key] === 'object') items = items.concat(Object.values(raw[key]));
      });
      stock = items.filter(s => getStockQty(s) > 0);
    } catch (e) {
      console.error('Fallback stock fetch error:', e);
    }
  }

  if (!buyers.length && typeof firebase !== 'undefined') {
    try {
      const buyerSnap = await firebase.database().ref('buyers').once('value');
      const rawB = buyerSnap.val() || {};
      buyers = Array.isArray(rawB) ? rawB : Object.values(rawB);
    } catch (e) {
      console.error('Fallback buyer fetch error:', e);
    }
  }

  console.log('Stock lines for matching:', stock.length);
  console.log('Buyers for matching:', buyers.length);

  if (!stock.length) {
    if (err) {
      err.textContent = 'No stock available. Please ensure stock data is synced.';
      err.style.display = 'block';
    }
    resetMatchButton();
    return;
  }

  if (!buyers.length) {
    if (err) {
      err.textContent = 'No buyer data available. Please ensure buyer data is synced.';
      err.style.display = 'block';
    }
    resetMatchButton();
    return;
  }

  const todayDow = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();

  const matches = (typeof runDeterministicMatch === 'function') 
    ? runDeterministicMatch(stock, buyers, todayDow) 
    : [];

  console.log('Matches found:', matches.length);

  if (!matches.length) {
    if (st) st.textContent = 'No matches found between current floor stock and buyer preferences.';
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

async function renderAICallList(matches, summary) {
  const el = document.getElementById('pipeline-buyers');
  if (!el) return;

  const todayKey = 'pipeline-calls-' + new Date().toISOString().slice(0, 10);
  let called = {};
  try {
    const snapshot = await firebase.database().ref('pipelineCalls/' + todayKey).once('value');
    called = snapshot.val() || {};
  } catch (e) {
    console.warn('Could not load calls from Firebase:', e);
    called = {};
  }

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

  if (matches && matches.length) {
    html += '<div style="margin-top:10px;padding:10px;background:#f0faf0;border-radius:8px;border:1px solid #25D366;display:flex;gap:8px;flex-wrap:wrap">';
    html += '<button onclick="sendWhatsAppToAllMatches()" style="padding:10px 20px;background:#25D366;color:#fff;border:none;border-radius:8px;font-family:inherit;font-weight:700;font-size:14px;cursor:pointer">📱 WhatsApp All Matches</button>';
    html += '<span style="font-size:12px;color:#666;align-self:center">Opens WhatsApp for each match (you send manually)</span>';
    html += '</div>';
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
      const waMsg = 'Hi ' + m.buyer + ', we have ' + m.stockLine + ' available for you today. Are you interested?';
      const escapedMsg = waMsg.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      return '<div style="margin-bottom:6px">' +
        (m.reason ? '<div style="font-size:12px;background:var(--paper);border-radius:8px;padding:8px 10px;margin-bottom:4px;border-left:3px solid var(--sage)"><b>' + m.stockLine + '</b><br>' + m.reason + '</div>' : '') +
        (m.inColdstore ? '<div style="margin-bottom:4px"><span class="b" style="background:#e3f2fd;color:#1565c0;font-size:10px">❄️ In Coldstore</span></div>' : '') +
        (m.tip ? '<div style="font-size:11px;color:var(--muted)">💡 ' + m.tip + '</div>' : '') +
        '<button onclick="sendWhatsAppToBuyer(\'' + m.buyer + '\', \'' + escapedMsg + '\')" style="margin-top:6px;padding:6px 14px;background:#25D366;color:#fff;border:none;border-radius:8px;font-family:inherit;font-weight:600;font-size:12px;cursor:pointer">📱 WhatsApp ' + m.buyer + '</button>' +
        '</div>';
    }).join('');

    return '<div style="border-bottom:1px solid var(--border);opacity:' + (isCalled ? '0.4' : '1') + '">' +
      '<div style="display:flex;align-items:flex-start;gap:8px;padding:9px 0;cursor:pointer" onclick="toggleSection(\'' + rid + '\')">' +
      '<div data-bname="' + buyer + '" onclick="togglePipelineCall(this, event)" style="width:22px;height:22px;border-radius:6px;border:2px solid ' + (isCalled ? 'var(--sage)' : 'var(--border)') + ';background:' + (isCalled ? 'var(--sage)' : '#fff') + ';display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:12px;margin-top:1px">' + (isCalled ? 'v' : '') + '</div>' +
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

function sendWhatsAppToBuyer(buyerName, message) {
  const phoneRef = firebase.database().ref('buyerPhones/' + buyerName);
  
  phoneRef.once('value').then(snapshot => {
    const phone = snapshot.val();
    if (!phone) {
      alert('No phone number found for ' + buyerName + '. Please add it to buyerPhones in Firebase.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const url = 'https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(message);
    window.open(url, '_blank');
  }).catch(err => {
    console.error('Error getting phone:', err);
    alert('Error: Could not get phone number.');
  });
}

function sendWhatsAppToAllMatches() {
  const todayKey = 'ai-results-' + new Date().toISOString().slice(0, 10);
  const saved = JSON.parse(localStorage.getItem(todayKey) || '{}');
  const matches = saved.matches || [];
  
  if (!matches || !matches.length) {
    alert('No matches found. Run the matching first.');
    return;
  }
  
  let msg = '📱 WhatsApp All Matches\n\n';
  msg += matches.slice(0, 10).map((m, i) => {
    return (i+1) + '. ' + m.buyer + ' → ' + m.stockLine;
  }).join('\n');
  if (matches.length > 10) msg += '\n... and ' + (matches.length - 10) + ' more';
  
  if (!confirm(msg + '\n\nSend WhatsApp to all ' + matches.length + ' buyers?')) return;
  
  let index = 0;
  
  function sendNext() {
    if (index >= matches.length) {
      alert('✅ All WhatsApp messages sent!');
      return;
    }
    
    const m = matches[index];
    const message = 'Hi ' + m.buyer + ', we have ' + m.stockLine + ' available for you today. Are you interested?';
    
    firebase.database().ref('buyerPhones/' + m.buyer).once('value').then(snapshot => {
      const phone = snapshot.val();
      
      if (!phone) {
        alert('❌ No phone number for ' + m.buyer + '. Skipping...');
        index++;
        setTimeout(sendNext, 1000);
        return;
      }
      
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const url = 'https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(message);
      window.open(url, '_blank');
      
      setTimeout(() => {
        index++;
        if (index < matches.length) {
          if (confirm('✅ Sent to ' + m.buyer + '. Send next to ' + matches[index].buyer + '?')) {
            sendNext();
          } else {
            alert('⏹️ Stopped at ' + matches[index].buyer);
          }
        } else {
          alert('✅ All done!');
        }
      }, 3000);
    }).catch(err => {
      console.error('Error:', err);
      index++;
      setTimeout(sendNext, 1000);
    });
  }
  
  sendNext();
}

function exportPipelineMatchesToPDF() {
  const matchesContainer = document.getElementById('pipeline-buyers');
  
  if (!matchesContainer || matchesContainer.textContent.includes('No matches found') || matchesContainer.textContent.includes('No buyer data')) {
    alert("Please run 'Match Stock to Buyers' (Step 1) and wait for matches to compile first.");
    return;
  }

  const todayKey = 'ai-results-' + new Date().toISOString().slice(0, 10);
  const saved = JSON.parse(localStorage.getItem(todayKey) || '{}');
  const matches = saved.matches || [];
  const summary = saved.summary || '';

  if (!matches.length) {
    alert("No matches found to export.");
    return;
  }

  const todayRaw = new Date();
  const todayFormatted = todayRaw.toLocaleDateString('en-ZA', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const fileDate = todayRaw.getDate().toString().padStart(2, '0') + '-' + 
                   (todayRaw.getMonth() + 1).toString().padStart(2, '0') + '-' + 
                   todayRaw.getFullYear();
  const filename = `SubTrop_Matches_${fileDate}.pdf`;

  const byBuyer = {};
  const order = [];
  for (const m of matches) {
    if (!byBuyer[m.buyer]) { 
      byBuyer[m.buyer] = []; 
      order.push(m.buyer); 
    }
    byBuyer[m.buyer].push(m);
  }

  const tempContainer = document.createElement('div');
  tempContainer.style.fontFamily = "'Outfit', -apple-system, sans-serif";
  tempContainer.style.color = '#1a1a1a';
  tempContainer.style.padding = '20px';
  tempContainer.style.background = '#fff';

  let pdfHtml = `
    <div style="border-bottom: 3px solid #1e4d2b; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <h1 style="font-size: 24px; font-weight: 800; color: #1e4d2b; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">DAILY SALES PIPELINE</h1>
        <div style="font-size: 11px; color: #555; margin-top: 3px; font-weight: 600;">SubTrop CRM Market Agents</div>
      </div>
      <div style="font-size: 13px; color: #666; font-weight: 600;">${todayFormatted}</div>
    </div>
  `;

  if (summary) {
    pdfHtml += `
      <div style="background:#f0faf0; border-radius:8px; padding:10px 12px; margin-bottom: 20px; font-size:12px; color:#1a5c2a; border-left:4px solid #1e4d2b; font-weight: 500;">
        ${summary}
      </div>
    `;
  }

  pdfHtml += order.map((buyer, i) => {
    const items = byBuyer[buyer];
    const top = items[0];
    const pl = top.priority || 'LOW';
    const pb = pl === 'HIGH' ? '#fdf6e2' : pl === 'MEDIUM' ? '#f0faf0' : '#f5f5f5';
    const pc = pl === 'HIGH' ? '#8a5a00' : pl === 'MEDIUM' ? '#1a5c2a' : '#666';
    const sc = Number(top.score) || 0;

    const itemsMatchedHtml = items.map(m => `
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #eee;">
        <div style="font-size: 13px; font-weight: 700; color: #1e4d2b;">${m.stockLine}</div>
        ${m.reason ? `<div style="font-size: 11px; color: #444; margin-top: 2px;">${m.reason}</div>` : ''}
        ${m.tip ? `<div style="font-size: 10px; color: #666; font-style: italic; margin-top: 2px;">💡 ${m.tip}</div>` : ''}
      </div>
    `).join('');

    return `
      <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; page-break-inside: avoid; background: #fafafa;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 18px; height: 18px; border-radius: 50%; background: #1e4d2b; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 10px;">${i + 1}</div>
            <span style="font-weight: 800; font-size: 14px; color: #111;">${buyer}</span>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <span style="background: ${pb}; color: ${pc}; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">${pl}</span>
            <span style="font-size: 12px; font-weight: 800; color: #1e4d2b;">Score: ${sc}</span>
          </div>
        </div>
        <div>
          ${itemsMatchedHtml}
        </div>
      </div>
    `;
  }).join('');

  tempContainer.innerHTML = pdfHtml;

  const opt = {
    margin:       [15, 15, 15, 15], 
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true }, 
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(opt).from(tempContainer).save();
  } else {
    alert("html2pdf library is not loaded.");
  }
}

// ===== GLOBAL EXPOSURE FOR HTML ONCLICK HANDLERS =====
window.syncPipelineData = syncPipelineData;
window.getStockQty = getStockQty;
window.loadPipelineState = loadPipelineState;
window.resetPipeline = resetPipeline;
window.runAIFromPipeline = runAIFromPipeline;
window.goToOrders = goToOrders;
window.togglePipelineStep = togglePipelineStep;
window.togglePipelineCallList = togglePipelineCallList;
window.togglePipelinePayment = togglePipelinePayment;
window.togglePipelinePackers = togglePipelinePackers;
window.renderPipelineBuyers = renderPipelineBuyers;
window.togglePipelineCall = togglePipelineCall;
window.renderPipelineOrders = renderPipelineOrders;
window.togglePipelineOrderState = togglePipelineOrderState;
window.runAIMatch = runAIMatch;
window.resetMatchButton = resetMatchButton;
window.renderAICallList = renderAICallList;
window.sendWhatsAppToBuyer = sendWhatsAppToBuyer;
window.sendWhatsAppToAllMatches = sendWhatsAppToAllMatches;
window.exportPipelineMatchesToPDF = exportPipelineMatchesToPDF;
