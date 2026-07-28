function renderBuyers(data) {
  const el = document.getElementById('buyer-list');
  if (!el) return; // Safely exit if the buyers page view isn't active
  
  if (!data || !data.length) { 
    el.innerHTML = '<div class="empty">No buyers found</div>'; 
    return; 
  }

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
      <div onclick="toggleSection('${bid}')" style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:#fff;border-bottom:1px solid var(--border);cursor:pointer">
        <div>
          <div style="font-weight:800;font-size:15px;color:var(--text)">${b.name}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">Account: ${b.acc || '—'} · ${b.txns} txn${b.txns > 1 ? 's' : ''}${b.lastDate ? ' · Last: ' + b.lastDate : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="background:var(--moss);border-radius:10px;padding:6px 12px;text-align:center">
            <div style="font-size:15px;font-weight:800;color:#fff;line-height:1">R ${(b.turnover || 0).toLocaleString()}</div>
            <div style="font-size:9px;color:rgba(255,255,255,0.8);text-transform:uppercase">total turnover</div>
          </div>
          <div id="arr-${bid}" style="color:var(--text);font-size:14px;transition:transform .2s">▼</div>
        </div>
      </div>
      <div id="${bid}" style="display:none;padding:10px">${b.buyingDays ? renderDayBadges(b.buyingDays) : ''}${bt ? '<div style="margin:6px 0 10px">' + bt + '</div>' : ''}${ph}</div>
    </div>`;
  }).join('');
}
