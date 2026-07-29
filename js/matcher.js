// ===== FLEXIBLE DETERMINISTIC MATCHING ENGINE =====
// Matches on: COMMODITY + (VARIETY OR PACK) - whichever fits best

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

  // Create reverse map lookup for bidirectional commodity matching
  const REVERSE_COMM_MAP = Object.fromEntries(Object.entries(COMM_MAP).map(([k, v]) => [v, k.toUpperCase()]));

  for (const buyer of buyers) {
    if (!buyer.prefs || !buyer.prefs.length) continue;
    const buysToday = !!(buyer.buyingDays && buyer.buyingDays[todayDow]);

    for (const pref of buyer.prefs) {
      const rawComm = pref.comm || '';
      const targetComm = (COMM_MAP[rawComm] || rawComm).toUpperCase();
      const targetCommName = (REVERSE_COMM_MAP[targetComm] || rawComm).toUpperCase();
      
      const targetVariety = (pref.variety || '*').toUpperCase();
      const targetPack = (pref.pack || '').toUpperCase();

      let candidates = stock.filter(s => {
        if (!s.commodity || (s.flr || 0) <= 0) return false;
        const sComm = s.commodity.toUpperCase();
        
        return sComm === targetComm || 
               sComm === targetCommName || 
               targetComm.includes(sComm) || 
               sComm.includes(targetComm) || 
               targetCommName.includes(sComm);
      });

      if (!candidates.length) continue;

      let best = null;
      let bestScore = -1;

      for (const s of candidates) {
        const stockVariety = (s.variety || '*').toUpperCase();
        const stockPack = (s.pack || '').toUpperCase();

        let score = 40;
        
        if (targetVariety !== '*' && stockVariety === targetVariety) {
          score += 25;
        } else if (targetVariety === '*' || stockVariety === '*') {
          score += 10;
        }
        
        if (targetPack && stockPack === targetPack) {
          score += 25;
        } else if (!targetPack) {
          score += 5;
        }
        
        score += Math.min(15, Math.round((s.flr || 0) / 50));
        
        if (buysToday) score += 10;
        
        const buyerTurnover = buyer.turnover || buyer.spend || 0;
        score += Math.min(10, Math.round(buyerTurnover / 100000));
        
        if (s.inColdstore) score -= 5;
        
        score = Math.max(1, Math.min(100, score));

        if (score > bestScore) {
          bestScore = score;
          best = s;
        }
      }

      if (!best) continue;

      const priority = bestScore >= 65 ? 'HIGH' : bestScore >= 45 ? 'MEDIUM' : 'LOW';
      
      const bestVarKey = (best.variety || '').toUpperCase();
      const bestPackKey = (best.pack || '').toUpperCase();

      const varietyDisplay = best.variety && best.variety !== '*' 
        ? (VARIETY_NAMES[bestVarKey] || best.variety) 
        : '';
      const packDisplay = PACK_NAMES[bestPackKey] || best.pack || '';
      const commDisplay = pref.comm || best.commodity;
      
      let stockLine = commDisplay;
      if (varietyDisplay) stockLine += ' ' + varietyDisplay;
      if (packDisplay) stockLine += ' (' + packDisplay + ')';
      stockLine += ' | ' + best.flr + ' units | ' + (best.producer || 'Unknown');

      const reasonParts = [];
      let matchDesc = commDisplay;
      const varietyMatch = targetVariety !== '*' && bestVarKey === targetVariety;
      const packMatch = targetPack && bestPackKey === targetPack;
      
      if (varietyMatch) matchDesc += ' ' + varietyDisplay;
      else if (varietyDisplay) matchDesc += ' ' + varietyDisplay + ' (close)';
      
      if (packMatch) matchDesc += ' (' + packDisplay + ')';
      else if (packDisplay) matchDesc += ' (' + packDisplay + ' - close)';
      
      reasonParts.push('Matches ' + matchDesc + '.');
      if (buysToday) reasonParts.push(buyer.name + ' typically buys today.');
      reasonParts.push(best.flr + ' units available from ' + (best.producer || 'Unknown') + '.');

      results.push({
        buyer: buyer.name,
        score: bestScore,
        commodity: best.commodity,
        variety: best.variety,
        pack: best.pack,
        stockLine: stockLine,
        reason: reasonParts.join(' '),
        tip: best.inColdstore 
          ? 'Stock is in coldstore - arrange removal first.' 
          : 'Contact ' + buyer.name + ' about ' + commDisplay + ' available.',
        buysToday: buysToday,
        priority: priority,
        inColdstore: !!best.inColdstore,
        producer: best.producer || 'Unknown',
        flr: best.flr
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  
  const seen = new Set();
  const deduped = results.filter(r => {
    const key = r.buyer + '|' + r.commodity;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.slice(0, 20);
}
```[cite: 3]
