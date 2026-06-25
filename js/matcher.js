// ===== DETERMINISTIC MATCHING ENGINE =====

const COMM_MAP = {
  'Avocados': 'AVOS',
  'Lemons': 'LEMS',
  'Figs': 'FIGS',
  'Kiwifruit': 'KIWI',
  'Oranges': 'ORGS',
  'Guavas': 'GVS',
  'Clementines': 'CLTM',
  'Naartjies': 'NAAR',
  'Strawberries': 'BERS',
  'Berries': 'BERS',
  'Dragon Fruit': 'DRAG',
  'Mangoes': 'MANG',
  'Grapefruit': 'GFT',
  'Satsumas': 'SATS',
  'Papino': 'PAPO'
};

function runDeterministicMatch(stock, buyers, todayDow) {
  const results = [];
  const PACK_NAMES = {
    '4KG TRAY': ['TR040'],
    '15KG CARTON': ['CTT150'],
    '500G PUNNET': ['PTB005'],
    '250G PUNNET': ['PTB002'],
    '160G PUNNET': ['PTB002'],
    '3KG POCKET': ['PC030']
  };

  function matchScore(s, pref) {
    if (s.commodity !== COMM_MAP[pref.comm]) return 'none';
    const pg = pref.cls === 'CL 1' ? '1' : pref.cls === 'CL 2' ? '2' : null;
    const packKeys = PACK_NAMES[pref.pack] || [];
    const packMatch = packKeys.some(k => s.pack.startsWith(k));
    const gradeMatch = !pg || s.grade === pg;
    const sizeMatch = pref.sizes.includes('*') || pref.sizes.includes(s.size);
    if (packMatch && gradeMatch && sizeMatch) return 'exact';
    if (packMatch && gradeMatch) return 'close';
    return 'none';
  }

  for (const buyer of buyers) {
    if (!buyer.prefs || !buyer.prefs.length) continue;
    const buysToday = !!(buyer.buyingDays && buyer.buyingDays[todayDow]);

    for (const pref of buyer.prefs) {
      const targetComm = COMM_MAP[pref.comm] || pref.comm;
      const candidates = stock.filter(s => s.commodity === targetComm && s.flr > 0);
      if (!candidates.length) continue;

      let best = null;
      let bestScore = -1;

      for (const s of candidates) {
        const ms = matchScore(s, pref);
        if (ms === 'none') continue;
        let score = ms === 'exact' ? 70 : 45;
        score += Math.min(15, Math.round((s.flr || 0) / 100));
        if (buysToday) score += 10;
        score += Math.min(10, Math.round((buyer.spend || 0) / 5000));
        if (s.inColdstore) score -= 5;
        score = Math.max(1, Math.min(100, score));

        if (score > bestScore) {
          bestScore = score;
          best = s;
        }
      }

      if (!best) continue;

      const exactness = matchScore(best, pref);
      const priority = bestScore >= 75 ? 'HIGH' : bestScore >= 50 ? 'MEDIUM' : 'LOW';
      const packLabel = best.pack;

      const stockLine = best.commodity + '|' + (packLabel || '') + '|' + best.variety + '|CL' + best.grade + '|sz' + best.size + '|' + best.flr + 'u|' + best.producer;

      const reasonParts = [];
      reasonParts.push(exactness === 'exact' ? 'Exact match on pack/grade/size for ' + pref.comm + '.' : 'Close match on pack/grade for ' + pref.comm + '.');
      if (buysToday) reasonParts.push(buyer.name + ' typically buys on this day.');
      reasonParts.push('Floor stock: ' + best.flr + ' units from ' + best.producer + '.');

      results.push({
        buyer: buyer.name,
        score: bestScore,
        commodity: best.commodity,
        stockLine: stockLine,
        reason: reasonParts.join(' '),
        tip: best.inColdstore ? 'Stock is in coldstore - arrange removal first.' : 'Mention freshness and current floor availability.',
        buysToday: buysToday,
        priority: priority,
        inColdstore: !!best.inColdstore
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  const seen = {};
  const deduped = results.filter(r => {
    const key = r.buyer + '|' + r.commodity;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });

  return deduped.slice(0, 20);
}