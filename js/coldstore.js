// ===== COLDSTORE FUNCTIONS =====

let liveColdstoreData = [];

async function loadColdstore() {
  const el = document.getElementById('coldstore-list');
  if (el) el.innerHTML = '<div class="empty">Loading...</div>';
  try {
    const snapshot = await firebase.database().ref('coldstore').once('value');
    const raw = snapshot.val();
    if (!raw) { el.innerHTML = '<div class="empty">No coldstore stock</div>'; liveColdstoreData = []; return; }
    const all = Object.entries(raw).map(([id, item]) => ({ id, ...item }));
    liveColdstoreData = all.filter(s => s.status !== 'removed');
    renderColdstore(liveColdstoreData);
  } catch (e) {
    if (el) el.innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }
}

function renderColdstore(data) {
  const el = document.getElementById('coldstore-list');
  const su = document.getElementById('coldstore-summary');
  if (!data || !data.length) {
    if (el) el.innerHTML = '<div class="empty">No stock in coldstore</div>';
    if (su) su.textContent = '';
    return;
  }

  const CN = { AVOS: 'Avocados', LEMS: 'Lemons', ORGS: 'Oranges', KIWI: 'Kiwifruit', FIGS: 'Figs', GVS: 'Guavas', CLTM: 'Clementines', NAAR: 'Naartjies', STRS: 'Strawberries', MANG: 'Mangoes', DRAG: 'Dragon Fruit', GFT: 'Grapefruit', SATS: 'Satsumas', NOVA: 'Nova', POME: 'Pomegranate', PAPO: 'Papino' };

  data = data.slice().sort((a, b) => {
    const ao = coldstoreOverdue(a) ? 1 : 0;
    const bo = coldstoreOverdue(b) ? 1 : 0;
    if (ao !== bo) return bo - ao;
    return daysInColdstore(b) - daysInColdstore(a);
  });

  const overdueCount = data.filter(coldstoreOverdue).length;
  const pendingCount = data.filter(s => s.status === 'in_transit' || s.status === 'withdrawal_pending').length;
  if (su) su.textContent = data.length + ' lines · ' + overdueCount + ' overdue' + (pendingCount ? ' · ' + pendingCount + ' awaiting confirmation' : '');

  const activeHTML = data.map(s => {
    const days = daysInColdstore(s);
    const ripening = isRipeningRoom(s.toLocation);
    const maxDays = ripening ? 3 : 7;
    const overdue = coldstoreOverdue(s);
    const comm = CN[s.commodity] || s.commodity || '';
    const pending = s.status === 'in_transit' || s.status === 'withdrawal_pending';
    const dayColor = overdue ? 'var(--red)' : days >= (maxDays - 1) ? 'var(--gold)' : 'var(--sage)';
    const bgColor = overdue ? 'var(--red-light)' : pending ? '#fffbf0' : '#fff';
    const borderColor = overdue ? 'var(--red)' : pending ? 'var(--gold)' : 'var(--border)';

    const stepIndex = { in_transit: 1, active: 2, withdrawal_pending: 3, removed: 4 }[s.status] || 2;
    const stepLabels = ['Transfer', 'Deposited', 'Withdrawal Req', 'Back on Floor'];
    const stepsHTML = '<div style="display:flex;gap:3px;margin-bottom:10px">' + stepLabels.map((lbl, i) => {
      const n = i + 1;
      const done = n < stepIndex;
      const current = n === stepIndex;
      const bg = done ? 'var(--sage)' : current ? 'var(--gold)' : '#e8e8e8';
      const fg = done || current ? '#fff' : '#999';
      return `<div style="flex:1;text-align:center"><div style="height:5px;background:${bg};border-radius:3px;margin-bottom:3px"></div><div style="font-size:8px;font-weight:700;color:${done || current ? 'var(--ink)' : '#bbb'};text-transform:uppercase;letter-spacing:.02em">${lbl}</div></div>`;
    }).join('') + '</div>';

    const statusBadge = s.status === 'in_transit' ? `<span class="b ba">⏳ Awaiting deposit confirmation</span>` : s.status === 'withdrawal_pending' ? `<span class="b ba">⏳ Awaiting floor confirmation</span>` : '';

    return `<div style="background:${bgColor};border-radius:12px;border:1.5px solid ${borderColor};padding:12px 14px;margin-bottom:10px">
      ${stepsHTML}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div><div style="font-weight:800;font-size:14px;color:var(--ink)">${s.producer || 'Unknown'}</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Deposit: ${s.depositNo || '—'} · GRN: ${s.grn || '—'}${s.withdrawalNo ? ' · Withdrawal: ' + s.withdrawalNo : ''}</div></div>
        ${pending ? '' : `<div style="text-align:right"><div style="font-size:22px;font-weight:800;color:${dayColor}">${days}d</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase">in store</div></div>`}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
        <span class="b bg">${comm}</span>
        ${s.variety ? `<span class="b" style="background:#f0f4f0;color:var(--muted)">${s.variety}</span>` : ''}
        ${s.grade ? `<span class="b ${s.grade === 'CL 1' || s.grade === '1' ? 'bg' : 'ba'}">${s.grade}</span>` : ''}
        ${s.count && s.count !== '*' ? `<span class="b bt">${s.count}ct</span>` : s.size && s.size !== '*' ? `<span class="b bt">sz ${s.size}</span>` : ''}
        <span class="b" style="background:${ripening ? '#fff3e0' : '#e3f2fd'};color:${ripening ? '#e65100' : '#1565c0'}">${ripening ? '🍑 Ripening' : '❄️ Cold Room'}</span>
        ${statusBadge}
        ${overdue ? '<span class="b br">⚠️ REMOVE NOW</span>' : ''}
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">📍 ${s.toLocation || '—'} · ${s.qty || '?'} units · ${s.salesman || '—'}</div>
      <div style="display:flex;gap:8px">
        ${s.status === 'active' ? `<button data-id="${s.id}" onclick="manualMarkWithdrawalRequested(this)" style="flex:1;padding:9px;border:1.5px solid var(--gold);border-radius:8px;background:#fff;color:#8a5a00;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer">Mark Withdrawal Requested</button>` : ''}
        <button data-id="${s.id}" data-producer="${s.producer || 'this item'}" onclick="deleteColdstoreItem(this)" style="padding:9px 14px;border:1.5px solid var(--red);border-radius:8px;background:#fff;color:var(--red);font-family:inherit;font-weight:700;font-size:13px;cursor:pointer">🗑️</button>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = activeHTML;
}

function daysInColdstore(item) {
  const anchor = item.depositedAt || item.transferSlipAt || item.date;
  if (!anchor) return 0;
  const d = new Date(anchor);
  const now = new Date();
  return Math.max(0, Math.floor((now - d) / 86400000));
}

function isRipeningRoom(location) {
  if (!location) return false;
  return location.toLowerCase().includes('ripen');
}

function coldstoreOverdue(item) {
  if (item.status === 'in_transit' || item.status === 'withdrawal_pending') return false;
  const days = daysInColdstore(item);
  const maxDays = isRipeningRoom(item.toLocation) ? 3 : 7;
  return days >= maxDays;
}

function filterColdstore() {
  const f = document.getElementById('coldstore-filter').value;
  let data = liveColdstoreData;
  if (f === 'overdue') data = data.filter(coldstoreOverdue);
  else if (f === 'ripening') data = data.filter(s => isRipeningRoom(s.toLocation));
  else if (f === 'coldroom') data = data.filter(s => !isRipeningRoom(s.toLocation));
  else if (f === 'pending') data = data.filter(s => s.status === 'in_transit' || s.status === 'withdrawal_pending');
  renderColdstore(data);
}

async function deleteColdstoreItem(btn) {
  const id = btn.dataset.id;
  const producer = btn.dataset.producer;
  if (!confirm('Delete coldstore record for ' + producer + '? This cannot be undone.')) return;
  try {
    await firebase.database().ref('coldstore/' + id).remove();
    loadColdstore();
  } catch (e) { alert('Error: ' + e.message); }
}

async function manualMarkWithdrawalRequested(btn) {
  const id = btn.dataset ? btn.dataset.id : btn;
  if (!confirm('Mark this stock as withdrawal requested?')) return;
  try {
    await firebase.database().ref('coldstore/' + id).update({
      status: 'withdrawal_pending',
      withdrawalRequestedAt: new Date().toISOString()
    });
    loadColdstore();
  } catch (e) { alert('Error: ' + e.message); }
}
