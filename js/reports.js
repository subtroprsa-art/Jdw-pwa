// ===== REPORT FUNCTIONS =====

function printUrgentStock() {
  if (!allLiveStockData.length) { alert('No stock data loaded yet.'); return; }
  const CN = { AVOS: 'Avocados', LEMS: 'Lemons', ORGS: 'Oranges', KIWI: 'Kiwifruit', FIGS: 'Figs', GVS: 'Guavas', CLTM: 'Clementines', NAAR: 'Naartjies', STRS: 'Strawberries', MANG: 'Mangoes', DRAG: 'Dragon Fruit', GFT: 'Grapefruit', SATS: 'Satsumas' };
  const urgent = allLiveStockData.filter(s => s.flr > 0 && daysOnFloor(s.arrived || s.date || '') >= 14).sort((a, b) => daysOnFloor(b.arrived || b.date || '') - daysOnFloor(a.arrived || a.date || ''));
  if (!urgent.length) { alert('No urgent stock.'); return; }

  const now = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const rows = urgent.map((s, i) => {
    const days = daysOnFloor(s.arrived || s.date || '');
    return `<tr><td>${i + 1}</td><td style="font-weight:600">${s.producer}</td><td>${CN[s.commodity] || s.commodity}</td><td>${s.variety || '-'}</td><td>${s.grade}</td><td>${s.size}</td><td style="text-align:right">${s.flr}</td><td style="text-align:right;color:#c0392b;font-weight:700">${days}d</td><td>${s.user}</td></tr>`;
  }).join('');

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Urgent Stock</title><style>body{font-family:Arial,sans-serif;font-size:12px;padding:16px}h1{font-size:18px;color:#c0392b}table{width:100%;border-collapse:collapse}th{background:#c0392b;color:#fff;padding:7px 8px;text-align:left}tr:nth-child(even){background:#fdf0f0}</style></head><body><h1>Urgent Stock - 14+ days</h1><p>${now} - ${urgent.length} lines</p><table><thead><tr><th>#</th><th>Producer</th><th>Commodity</th><th>Variety</th><th>Grade</th><th>Size</th><th style="text-align:right">Floor</th><th style="text-align:right">Days</th><th>SM</th></tr></thead><tbody>${rows}</tbody></table><button onclick="window.print()" style="background:#c0392b;color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:14px;cursor:pointer;font-weight:700;margin-top:16px">Print</button></body></html>`);
  win.document.close();
  win.focus();
}

function printSalesReport(period) { alert('Print Sales Report - ' + period); }
function printBuyersReport(period) { alert('Print Buyers Report - ' + period); }
function printWeeklyReport() { alert('Print Weekly Report'); }
function printOrders() { alert('Print Orders - A4'); }
function printThermalOrders() { alert('Print Orders - Thermal'); }