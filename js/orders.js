// ===== ORDER FUNCTIONS =====

async function loadOrders() {
  const el = document.getElementById('orders-list');
  el.innerHTML = '<div class="empty">Loading...</div>';
  try {
    const snapshot = await firebase.database().ref('orders').once('value');
    const raw = snapshot.val();
    if (!raw) { el.innerHTML = '<div class="empty">No open orders</div>'; document.getElementById('orders-count').textContent = '0'; return; }

    const orders = Object.entries(raw).map(([id, o]) => ({ id, ...o })).filter(o => o.status === 'open').sort((a, b) => {
      const da = a.collectDate || '9999';
      const db = b.collectDate || '9999';
      return da !== db ? da.localeCompare(db) : new Date(b.createdAt) - new Date(a.createdAt);
    });

    document.getElementById('orders-count').textContent = orders.length;

    if (!orders.length) { el.innerHTML = '<div class="empty">No open orders</div>'; return; }

    const COMM_NAMES = { AVOS: 'Avocados', LEMS: 'Lemons', ORGS: 'Oranges', KIWI: 'Kiwifruit', FIGS: 'Figs', GVS: 'Guavas', CLTM: 'Clementines', NAAR: 'Naartjies', STRS: 'Strawberries', MANG: 'Mangoes', DRAG: 'Dragon Fruit', GFT: 'Grapefruit', SATS: 'Satsumas' };
    const PACK_NAMES = { TR040: '4KG Tray', BG150: '15KG Bag', CTT150: '15KG Carton', PTB005: '500G Punnet', PTB002: '160G Punnet', DL076: 'DL076', PC030: '3KG Pocket' };

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const grp = { today: [], tomorrow: [], later: [], nodate: [] };

    orders.forEach(o => {
      if (!o.collectDate) grp.nodate.push(o);
      else if (o.collectDate === today) grp.today.push(o);
      else if (o.collectDate === tomorrow) grp.tomorrow.push(o);
      else grp.later.push(o);
    });

    function card(o) {
      const cf = COMM_NAMES[o.commodity] || o.commodity;
      const pf = PACK_NAMES[o.pack] || o.pack || 'Any';
      const fl = o.flagged;
      let cs = o.collectDate ? new Date(o.collectDate + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }) : 'No date';
      if (o.collectTime) cs += ' @ ' + o.collectTime;

      return `<div style="border-radius:12px;margin-bottom:10px;overflow:hidden;border:${fl ? '2px solid var(--gold)' : '1.5px solid var(--border)'}">
        <div style="padding:12px 14px;background:${fl ? 'var(--gold-light)' : 'var(--paper)'}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1;min-width:0">${fl ? '<div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:3px">STOCK AVAILABLE!</div>' : ''}<div style="font-weight:700;font-size:14px;word-break:break-word">${o.buyer}</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Collect: ${cs}</div></div>
            <div style="text-align:right;flex-shrink:0"><div style="font-weight:800;font-size:15px;color:var(--moss)">${cf}</div><div style="font-size:11px;color:var(--muted)">${o.qty || '?'} units</div></div>
          </div>
        </div>
        <div style="padding:10px 14px;background:#fff;border-top:1px solid var(--border)">
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px"><span class="b bb">${pf}</span>${o.grade ? '<span class="b bg">CL ' + o.grade + '</span>' : ''}${o.size && o.size !== '*' ? '<span class="b bt">sz ' + o.size + '</span>' : ''}${o.price ? '<span class="b" style="background:#f0f0f0;color:var(--muted)">R ' + o.price + '/u</span>' : ''}</div>
          ${o.notes ? '<div style="font-size:12px;color:var(--muted);font-style:italic;margin-bottom:8px">' + o.notes + '</div>' : ''}
          <div style="display:flex;gap:8px"><button onclick="fulfillOrder(this.dataset.id)" data-id="${o.id}" style="flex:1;padding:9px;border:none;border-radius:8px;background:var(--moss);color:#fff;font-family:inherit;font-weight:700;font-size:12px;cursor:pointer">Fulfilled</button><button onclick="cancelOrder(this.dataset.id)" data-id="${o.id}" style="flex:1;padding:9px;border:1.5px solid var(--border);border-radius:8px;background:#fff;color:var(--muted);font-family:inherit;font-weight:700;font-size:12px;cursor:pointer">Cancel</button></div>
        </div>
      </div>`;
    }

    function sec(label, color, items) {
      if (!items.length) return '';
      return `<div style="font-size:12px;font-weight:700;text-transform:uppercase;color:${color};margin:12px 0 8px;display:flex;align-items:center;gap:8px">${label} <span style="background:${color};color:#fff;border-radius:20px;padding:1px 8px;font-size:10px">${items.length}</span><span style="flex:1;height:1px;background:var(--border)"></span></div>` + items.map(card).join('');
    }

    el.innerHTML = sec('Due Today', '#c9882a', grp.today) + sec('Due Tomorrow', '#1e4d2b', grp.tomorrow) + sec('Later', '#6b7c6c', grp.later) + sec('No Date', '#aaa', grp.nodate);
  } catch (e) {
    el.innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }
}

async function fulfillOrder(id) {
  await firebase.database().ref('orders/' + id).update({
    status: 'fulfilled',
    fulfilledAt: new Date().toISOString()
  });
  loadOrders();
}

async function cancelOrder(id) {
  await firebase.database().ref('orders/' + id).update({
    status: 'cancelled',
    cancelledAt: new Date().toISOString()
  });
  loadOrders();
}

function populateBuyerSuggestions() {
  const dl = document.getElementById('buyer-suggestions');
  if (!dl || !liveBuyerData.length) return;
  dl.innerHTML = liveBuyerData.map(b => `<option value="${b.name}">`).join('');
}

function initOrderCommodityDropdown() {
  const sel = document.getElementById('order-commodity');
  if (!sel) return;
  const stock = allLiveStockData.length ? allLiveStockData : [];
  const CN = { AVOS: 'Avocados', LEMS: 'Lemons', ORGS: 'Oranges', KIWI: 'Kiwifruit', FIGS: 'Figs', GVS: 'Guavas', CLTM: 'Clementines', NAAR: 'Naartjies', STRS: 'Strawberries', MANG: 'Mangoes', DRAG: 'Dragon Fruit', GFT: 'Grapefruit', SATS: 'Satsumas', NOVA: 'Nova', POME: 'Pomegranate', PAPO: 'Papino' };
  const codes = [...new Set(stock.filter(s => s.flr > 0).map(s => s.commodity))].sort((a, b) => (CN[a] || a).localeCompare(CN[b] || b));
  sel.innerHTML = '<option value="">Select commodity...</option>' + codes.map(c => `<option value="${c}">${CN[c] || c}</option>`).join('');
}

function onOrderCommodityChange() {
  const comm = document.getElementById('order-commodity').value;
  const stock = allLiveStockData.filter(s => s.commodity === comm && s.flr > 0);
  ['order-variety-row', 'order-pack-row', 'order-class-row', 'order-size-row', 'order-stock-info'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.getElementById('order-variety').innerHTML = '<option value="">Select variety...</option>';
  if (!comm || !stock.length) return;
  const varieties = [...new Set(stock.map(s => s.variety))].sort();
  const VN = { AF: 'Fuerte', AH: 'Hass', AK: 'Pinkerton', MA: 'Maluma', MAH: 'Maluma', MD: 'Mendez', NV: 'Navel', CN: 'Cara Cara', AX: 'Mixed' };
  document.getElementById('order-variety').innerHTML = '<option value="">Select variety...</option>' + varieties.map(v => `<option value="${v}">${VN[v] || v}</option>`).join('');
  document.getElementById('order-variety-row').style.display = 'block';
}

function onOrderVarietyChange() {
  const comm = document.getElementById('order-commodity').value;
  const variety = document.getElementById('order-variety').value;
  const stock = allLiveStockData.filter(s => s.commodity === comm && s.variety === variety && s.flr > 0);
  ['order-pack-row', 'order-class-row', 'order-size-row', 'order-stock-info'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  if (!variety || !stock.length) return;
  const packs = [...new Set(stock.map(s => s.pack))].sort();
  const PN = { TR040: '4KG Tray', BG150: '15KG Bag', BG160: '16KG Bag', CTT150: '15KG Carton', PTB005: '500G Punnet', PTB025: '250G Punnet', PTB002: '160G Punnet', DL076: 'DL076 Carton', PC030: '3KG Pocket', PC060: '6KG Pocket', CO100: '10KG Carton', CO150: '15KG Carton', SP170: '17KG Sack' };
  document.getElementById('order-pack').innerHTML = '<option value="">Select pack...</option>' + packs.map(p => `<option value="${p}">${PN[p] || p}</option>`).join('');
  document.getElementById('order-pack-row').style.display = 'block';
}

function onOrderPackChange() {
  const comm = document.getElementById('order-commodity').value;
  const variety = document.getElementById('order-variety').value;
  const pack = document.getElementById('order-pack').value;
  const stock = allLiveStockData.filter(s => s.commodity === comm && s.variety === variety && s.pack === pack && s.flr > 0);
  ['order-class-row', 'order-size-row', 'order-stock-info'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  if (!pack || !stock.length) return;
  const grades = [...new Set(stock.map(s => s.grade))].sort();
  document.getElementById('order-grade').innerHTML = '<option value="">Select class...</option>' + grades.map(g => `<option value="${g}">CL ${g}</option>`).join('');
  document.getElementById('order-class-row').style.display = 'block';
}

function onOrderGradeChange() {
  const comm = document.getElementById('order-commodity').value;
  const variety = document.getElementById('order-variety').value;
  const pack = document.getElementById('order-pack').value;
  const grade = document.getElementById('order-grade').value;
  const stock = allLiveStockData.filter(s => s.commodity === comm && s.variety === variety && s.pack === pack && s.grade === grade && s.flr > 0);
  document.getElementById('order-size-row').style.display = 'none';
  document.getElementById('order-stock-info').style.display = 'none';
  if (!grade || !stock.length) return;
  const sizes = [...new Set(stock.map(s => s.size && s.size !== '*' ? s.size : 'Any'))].sort();
  document.getElementById('order-size').innerHTML = '<option value="">Select size...</option>' + sizes.map(s => `<option value="${s}">${s}</option>`).join('');
  document.getElementById('order-size-row').style.display = 'block';
  const totalFlr = stock.reduce((a, s) => a + (Number(s.flr) || 0), 0);
  const producers = [...new Set(stock.map(s => s.producer))].join(', ');
  document.getElementById('order-stock-info').innerHTML = 'OK ' + totalFlr + ' units on floor - ' + producers;
  document.getElementById('order-stock-info').style.display = 'block';
}

async function saveOrder() {
  const buyer = document.getElementById('order-buyer').value.trim().toUpperCase();
  const commodity = document.getElementById('order-commodity').value;
  const pack = document.getElementById('order-pack').value;
  const size = document.getElementById('order-size').value.trim() || '*';
  const grade = document.getElementById('order-grade').value;
  const qty = parseInt(document.getElementById('order-qty').value) || 0;
  const price = parseFloat(document.getElementById('order-price').value) || 0;
  const notes = document.getElementById('order-notes').value.trim();
  const collectDate = document.getElementById('order-collect-date').value;
  const collectTime = document.getElementById('order-collect-time').value;
  const stat = document.getElementById('order-status');

  if (!buyer || !commodity) { stat.style.color = 'var(--red)'; stat.textContent = '⚠ Buyer name and commodity required'; return; }

  stat.textContent = 'Saving…';
  stat.style.color = 'var(--muted)';
  try {
    const newRef = firebase.database().ref('orders').push();
    await newRef.set({ buyer, commodity, pack, size, grade, qty, price, notes, collectDate: collectDate || null, collectTime: collectTime || null, status: 'open', createdAt: new Date().toISOString(), flagged: false, matchedStock: null });
    stat.style.color = 'var(--sage)';
    stat.textContent = '✅ Order saved!';
    ['order-buyer', 'order-size', 'order-qty', 'order-price', 'order-notes', 'order-collect-date'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('order-commodity').value = '';
    document.getElementById('order-pack').value = '';
    document.getElementById('order-grade').value = '1';
    document.getElementById('order-collect-time').value = '';
    setTimeout(() => { stat.textContent = ''; }, 2000);
    loadOrders();
  } catch (e) {
    stat.style.color = 'var(--red)';
    stat.textContent = '⚠ ' + e.message;
  }
}

async function saveManualOrder() {
  const buyer = document.getElementById('m-order-buyer').value.trim().toUpperCase();
  const commodity = document.getElementById('m-order-commodity').value;
  const variety = document.getElementById('m-order-variety').value.trim();
  const pack = document.getElementById('m-order-pack').value.trim();
  const grade = document.getElementById('m-order-grade').value;
  const size = document.getElementById('m-order-size').value.trim() || '*';
  const qty = parseInt(document.getElementById('m-order-qty').value) || 0;
  const price = parseFloat(document.getElementById('m-order-price').value) || 0;
  const notes = document.getElementById('m-order-notes').value.trim();
  const collectDate = document.getElementById('m-order-collect-date').value;
  const stat = document.getElementById('m-order-status');

  if (!buyer || !commodity) { stat.style.color = 'var(--red)'; stat.textContent = 'Buyer and commodity required'; return; }

  stat.textContent = 'Saving...';
  stat.style.color = 'var(--muted)';
  try {
    const newRef = firebase.database().ref('orders').push();
    await newRef.set({ buyer, commodity, pack, variety, size, grade, qty, price, notes, collectDate: collectDate || null, collectTime: null, status: 'open', manual: true, createdAt: new Date().toISOString(), flagged: false, matchedStock: null });
    stat.style.color = 'var(--sage)';
    stat.textContent = 'Manual order saved!';
    ['m-order-buyer', 'm-order-variety', 'm-order-pack', 'm-order-size', 'm-order-qty', 'm-order-price', 'm-order-notes', 'm-order-collect-date'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('m-order-commodity').value = '';
    document.getElementById('m-order-grade').value = '1';
    setTimeout(() => { stat.textContent = ''; }, 2000);
    loadOrders();
  } catch (e) {
    stat.style.color = 'var(--red)';
    stat.textContent = 'Error: ' + e.message;
  }
}
