// ===== ADVANCED HISTORICAL AFFINITY MATCHING ENGINE =====

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
  'AF': 'Fuerte', 'AH': 'Hass', 'AK': 'Pinkerton', 'MA': 'Maluma', 'MAH': 'Maluma',
  'MD': 'Mendez', 'NV': 'Navel', 'CN': 'Cara Cara', 'AX': 'Mixed', 'LR': 'Leanri',
  'HM': 'Honey Murcott', 'M1': 'Mandarin', 'NAR': 'Nardocott', '*': 'Any'
};

const PACK_NAMES = {
  'TR040': '4KG Tray', 'TR060': '6KG Tray', 'BG150': '15KG Bag', 'BG160': '16KG Bag',
  'CTT150': '15KG Carton', 'PTB005': '500G Punnet', 'PTB025': '250G Punnet',
  'PTB002': '160G Punnet', 'DL076': 'DL076 Carton', 'PC030': '3KG Pocket',
  'PC060': '6KG Pocket', 'CO100': '10KG Carton', 'CO150': '15KG Carton',
  'SP170': '17KG Sack', 'EC020': '20KG Box'
};

function runDeterministicMatch(stock, buyers, todayDow) {
  const results = [];
  const REVERSE_COMM_MAP = Object.fromEntries(Object.entries(COMM_MAP).map(([k, v]) => [v, k.toUpperCase()]));
  const today = new Date();

  for (const buyer of buyers) {
    if (!buyer.prefs || !buyer.prefs.length) continue;
    
    // Check buying day schedule & calculate recency/activity penalty
    const buysToday = !!(buyer.buyingDays && buyer.buyingDays[todayDow]);
    let recencyPenalty = 0;
    if (buyer.lastDate) {
      const lastTxnDate = new Date(buyer.lastDate);
      const daysSinceLast = Math.floor((today - lastTxnDate) / (1000 * 60 * 60 * 24));
      if (daysSinceLast > 30) recencyPenalty = Math.min(25, Math.floor((daysSinceLast - 30) / 5)); // Penalize inactive buyers
    }

    for (const pref of buyer.prefs) {
      const rawComm = pref.comm || '';
      const targetComm = (COMM_MAP[rawComm] || rawComm).toUpperCase();
      const targetCommName = (REVERSE_COMM_MAP[targetComm] || rawComm).toUpperCase();
      const targetPack = (pref.pack || '').toUpperCase();
      const targetSizes = pref.sizes || ['*'];

      // Find all active floor stock candidates matching commodity
      let candidates = stock.filter(s => {
        if (!s.commodity || (s.flr || 0) <= 0) return false;
        const sComm = s.commodity.toUpperCase();
        return sComm === targetComm || sComm === targetCommName || 
               targetComm.includes(sComm) || sComm.includes(targetComm) || targetCommName.includes(sComm);
      });

      if (!candidates.length) continue;

      let best = null;
      let bestScore = -1;

      for (const s of candidates) {
        const stockVariety = (s.variety || '*').toUpperCase();
        const stockPack = (s.pack || '').toUpperCase();
        const stockSize = (s.size || '*').toUpperCase();

        // Base structural score
        let score = 30;
        
        // 1. Historical Pack Size Affinity Match (High weight)
        if (targetPack && stockPack === targetPack) {
          score += 35;
        } else if (!targetPack) {
          score += 10;
        }

        // 2. Historical Size Affinity Match
        if (targetSizes.includes('*') || targetSizes.includes(stockSize)) {
          score += 15;
        }

        // 3. Volume and Turnover Tier Weighting
        score += Math.min(15, Math.round((s.flr || 0) / 40));
        const buyerTurnover = buyer.turnover || buyer.spend || 0;
        score += Math.min(15, Math.round(buyerTurnover / 75000));

        // 4. Schedule & Recency modifiers
        if (buysToday) score += 15;
        score -= recencyPenalty;

        // 5. Operational friction penalty
        if (s.inColdstore) score -= 5;
        
        score = Math.max(1, Math.min(100, score));

        if (score > bestScore) {
          bestScore = score;
          best = s;
        }
      }

      if (!best) continue;

      const priority = bestScore >= 70 ? 'HIGH' : bestScore >= 45 ? 'MEDIUM' : 'LOW';
      const bestVarKey = (best.variety || '').toUpperCase();
      const bestPackKey = (best.pack || '').toUpperCase();
      const varietyDisplay = best.variety && best.variety !== '*' ? (VARIETY_NAMES[bestVarKey] || best.variety) : '';
      const packDisplay = PACK_NAMES[bestPackKey] || best.pack || '';
      const commDisplay = pref.comm || best.commodity;
      
      let stockLine = commDisplay;
      if (varietyDisplay) stockLine += ' ' + varietyDisplay;
      if (packDisplay) stockLine += ' (' + packDisplay + ')';
      stockLine += ' | ' + best.flr + ' units | ' + (best.producer || 'Unknown');

      results.push({
        buyer: buyer.name,
        score: bestScore,
        commodity: best.commodity,
        variety: best.variety,
        pack: best.pack,
        stockLine: stockLine,
        reason: `Historical match for ${commDisplay}${packDisplay ? ' (' + packDisplay + ')' : ''}. ${buysToday ? buyer.name + ' buys on this day.' : ''}`,
        tip: best.inColdstore ? 'Stock is in coldstore.' : `Contact ${buyer.name} about available stock.`,
        buysToday: buysToday,
        priority: priority,
        inColdstore: !!best.inColdstore,
        producer: best.producer || 'Unknown',
        flr: best.flr
      });
    }
  }

  // Sort overall results by affinity score descending
  results.sort((a, b) => b.score - a.score);
  
  // Strict Buyer-Level Deduplication: Keep ONLY the single best matching line per unique buyer
  const seenBuyers = new Set();
  const deduped = results.filter(r => {
    if (seenBuyers.has(r.buyer)) return false;
    seenBuyers.add(r.buyer);
    return true;
  });

  return deduped.slice(0, 20);
}
