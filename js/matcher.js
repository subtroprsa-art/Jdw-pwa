// ===== SIMPLIFIED DETERMINISTIC MATCHING ENGINE =====
// Matches on: COMMODITY + VARIETY + PACK SIZE only

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

const VARIETY_NAMES = {
  'AF': 'Fuerte',
  'AH': 'Hass',
  'AK': 'Pinkerton',
  'MA': 'Maluma',
  'MAH': 'Maluma',
  'MD': 'Mendez',
  'NV': 'Navel',
  'CN': 'Cara Cara',
  'AX': 'Mixed',
  'LR': 'Leanri',
  'HM': 'Honey Murcott',
  'M1': 'Mandarin',
  'NAR': 'Nardocott',
  '*': 'Any'
};

const PACK_NAMES = {
  'TR040': '4KG Tray',
  'TR060': '6KG Tray',
  'BG150': '15KG Bag',
  'BG160': '16KG Bag',
  'CTT150': '15KG Carton',
  'PTB005': '500G Punnet',
  'PTB025': '250G Punnet',
  'PTB002': '160G Punnet',
  'DL076': 'DL076 Carton',
  'PC030': '3KG Pocket',
  'PC060': '6KG Pocket',
  'CO100': '10KG Carton',
  'CO150': '15KG Carton',
  'SP170': '17KG Sack',
  'EC020': '20KG Box'
};

function runDeterministicMatch(stock, buyers, todayDow) {
  const results = [];

  for (const buyer of buyers) {
    if (!buyer.prefs || !buyer.prefs.length) continue;
    const buysToday = !!(buyer.buyingDays && buyer.buyingDays[todayDow]);

    for (const pref of buyer.prefs) {
      const targetComm = COMM_MAP[pref.comm] || pref.comm;
      const targetVariety = pref.variety || '*';
      const targetPack = pref.pack || '';

      // Find stock that matches: commodity + variety + pack
      const candidates = stock.filter(s => {
        // Must match commodity
        if (s.commodity !== targetComm) return false;
        
        // Must match variety (if buyer specified one)
        if (targetVariety !== '*' && s.variety !== targetVariety) return false;
        
        // Must match pack (if buyer specified one)
        if (targetPack && s.pack !== targetPack) return false;
        
        return s.flr > 0;
      });

      if (!candidates.length) continue;

      // Find the best match (highest floor stock)
      let best = null;
      let bestScore = -1;

      for (const s of candidates) {
        let score = 60; // Base score for matching all three criteria
        
        // Bonus: more stock available
        score += Math.min(20, Math.round((s.flr || 0) / 50));
        
        // Bonus: buyer buys today
        if (buysToday) score += 15;
        
        // Bonus: high spending buyer
        score += Math.min(10, Math.round((buyer.spend || 0) / 10000));
        
        // Penalty: stock in coldstore
        if (s.inColdstore) score -= 5;
        
        score = Math.max(1, Math.min(100, score));

        if (score > bestScore) {
          bestScore = score;
          best = s;
        }
      }

      if (!best) continue;

      const priority = bestScore >= 70 ? 'HIGH' : bestScore >= 50 ? 'MEDIUM' : 'LOW';
      
      // Build a clean stock line description
      const varietyDisplay = best.variety && best.variety !== '*' ? (VARIETY_NAMES[best.variety] || best.variety) : '';
      const packDisplay = PACK_NAMES[best.pack] || best.pack || '';
      const commDisplay = pref.comm || best.commodity;
      
      let stockLine = commDisplay;
      if (varietyDisplay) stockLine += ' ' + varietyDisplay;
      if (packDisplay) stockLine += ' (' + packDisplay + ')';
      stockLine += ' | ' + best.flr + ' units | ' + best.producer;

      // Build the reason
      const reasonParts = [];
      let matchDesc = commDisplay;
      if (varietyDisplay) matchDesc += ' ' + varietyDisplay;
      if (packDisplay) matchDesc += ' (' + packDisplay + ')';
      reasonParts.push(`Matches ${matchDesc}`);
      if (buysToday) reasonParts.push(`${buyer.name} typically buys today.`);
      reasonParts.push(`${best.flr} units available from ${best.producer}.`);

      results.push({
        buyer: buyer.name,
        score: bestScore,
        commodity: best.commodity,
        variety: best.variety,
        pack: best.pack,
        stockLine: stockLine,
        reason: reasonParts.join(' '),
        tip: best.inColdstore ? 'Stock is in coldstore - arrange removal first.' : `Contact ${buyer.name} about ${matchDesc} available.`,
        buysToday: buysToday,
        priority: priority,
        inColdstore: !!best.inColdstore,
        producer: best.producer,
        flr: best.flr
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  
  // Deduplicate: keep only the best match per buyer
  const seen = {};
  const deduped = results.filter(r => {
    const key = r.buyer + '|' + r.commodity + '|' + r.variety + '|' + r.pack;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });

  return deduped.slice(0, 20);
}
