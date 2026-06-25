// ===== HELPER FUNCTIONS =====

function daysOnFloor(dateStr) {
  if (!dateStr) return 0;
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let d;
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const p = dateStr.slice(0, 10).split('-');
      d = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const p = dateStr.split('/');
      d = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
    } else if (/^\d{2}\/\d{2}$/.test(dateStr)) {
      const p = dateStr.split('/');
      d = new Date(now.getFullYear(), parseInt(p[1]) - 1, parseInt(p[0]));
      if (d > now) d.setFullYear(now.getFullYear() - 1);
    } else return 0;
    d.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((now - d) / 86400000));
  } catch (e) { return 0; }
}

function fmtArrived(d) {
  if (!d) return '—';
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(5).replace('-', '/');
  return d;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const p = dateStr.split('/');
      return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const p = dateStr.slice(0, 10).split('-');
      return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
    }
  } catch (e) {}
  return null;
}

function calcBuyingDays(dates) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dates) {
    const dt = parseDate(d);
    if (!dt) continue;
    let dow = dt.getDay();
    dow = dow === 0 ? 6 : dow - 1;
    counts[dow]++;
  }
  const max = Math.max(...counts) || 1;
  return counts.map(x => x > 0 && (x / max) >= 0.2);
}

function calcAvgFreq(dates) {
  if (!dates || dates.length < 2) return null;
  const parsed = dates.map(d => parseDate(d)).filter(Boolean).sort((a, b) => a - b);
  if (parsed.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < parsed.length; i++) {
    const g = Math.round((parsed[i] - parsed[i - 1]) / 86400000);
    if (g > 0 && g <= 30) gaps.push(g);
  }
  if (!gaps.length) return null;
  return Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
}

function renderDayBadges(active) {
  const td = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return '<div class="day-row">' + DAYS.map((l, i) =>
    `<span class="day-badge ${i === td ? 'day-today' : active[i] ? 'day-active' : 'day-inactive'}">${l}</span>`
  ).join('') + '</div>';
}

function firebaseToItem(e) {
  const comm = (e.commodity || '').split(',')[0] || '';
  const rec = Number(e.qtyRec) || Number(e.qty_rec) || 0;
  const flr = Number(e.qtyFlr) || Number(e.qty_sort) || 0;
  const sold = Number(e.qtySold) || Math.max(0, rec - flr);
  const pd = {
    AVOS: 'TR040', LEMS: 'CTT150', ORGS: 'CTT150',
    KIWI: 'PTB005', FIGS: 'PTB002', GVS: 'TR040',
    CLTM: 'DL076', NAAR: 'CTT150', STRS: 'PTB005',
    MANG: 'TR040', DRAG: 'TR040', GFT: 'CTT150'
  }[comm] || '*';
  return {
    producer: e.producer || '',
    grn: String(e.grn || ''),
    commodity: comm,
    pack: e.pack || pd,
    variety: e.variety || '*',
    grade: String(e.grade || e.cls || '1'),
    size: String(e.size || e.count || '*'),
    arrived: e.arriveDate || e.date || '',
    rec, sold, flr,
    user: e.user || ''
  };
}

function toggleSection(id) {
  const el = document.getElementById(id);
  const arr = document.getElementById('arr-' + id);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  if (arr) arr.style.transform = isOpen ? '' : 'rotate(180deg)';
}

function toggleReportsMenu() {
  const m = document.getElementById('reports-menu');
  m.style.display = m.style.display === 'none' ? 'block' : 'none';
}