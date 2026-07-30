// ==========================================
// FULLY REVISED PIPELINE SCRIPT (STRICTLY NO DATES & NO OBJECT LEFTOVERS)
// ==========================================

function getFriendlyProductName(rawName) {
    if (!rawName) return 'Produce';
    let clean = rawName.toString().split(',')[0].replace(/\d{1,2}[\/\-]\w{3}[\/\-]\d{4}/g, '').trim();
    const upper = clean.toUpperCase();
    
    if (upper.includes('ORG') || upper.includes('ORANGE')) return 'Oranges';
    if (upper.includes('AVO') || upper.includes('AVOCADO')) return 'Avos';
    if (upper.includes('LEM') || upper.includes('LEMON')) return 'Lemons';
    if (upper.includes('NOV')) return 'Nova';
    if (upper.includes('BER')) return 'Berries';
    if (upper.includes('NUT')) return 'Nuts';
    if (upper.includes('COAL')) return 'Coal';
    if (upper.includes('APP') || upper.includes('APPLE')) return 'Apples';
    return clean || 'Produce';
}

function renderPipelineMatches(rankedBuyers) {
  const el = document.getElementById('pipeline-results');
  if (!el) return;

  if (!rankedBuyers || !rankedBuyers.length) {
    el.innerHTML = '<div class="empty">No matching pipeline results found.</div>';
    return;
  }

  let htmlOutput = '';

  rankedBuyers.forEach((buyerData, idx) => {
    const dropdownId = `buyer-dropdown-${idx}`;
    const formattedTurnover = `R ${buyerData.turnover.toLocaleString()}`;
    const phone = buyerData.phone || '';

    // STRICTLY STRIP DATES: Clean bullet points containing ONLY name and pack/size
    const stockSummaryText = buyerData.stockItems.map(s => {
      const rawComm = s._matchedCommodityName || s.commodity || s.variety || 'Produce';
      const friendlyName = getFriendlyProductName(rawComm);
      const packInfo = s.pack ? s.pack : (s.size ? `${s.size}kg` : '');
      const displayPart = packInfo ? `${friendlyName} ${packInfo}` : `${friendlyName}`;
      return `• ${displayPart} available`;
    }).join('\n');

    const messageString = `Hi ${buyerData.buyerName}, we have fresh stock available matching your requirements:\n\n${stockSummaryText}\n\nPlease let me know if you would like to secure any of these!`;
    const waMessage = encodeURIComponent(messageString);
    
    const waLink = phone ? `https://wa.me/${phone.replace('+', '')}?text=${waMessage}` : '#';
    const telLink = phone ? `tel:${phone}` : '#';

    htmlOutput += `
      <div style="background:#fff;border-radius:10px;margin-bottom:10px;border:1.5px solid var(--border);overflow:hidden;">
        <div style="padding:14px 16px;background:#f8f9fa;display:flex;justify-content:space-between;align-items:center;">
          <div onclick="toggleBuyerDropdown('${dropdownId}')" style="cursor:pointer;flex-grow:1;">
            <div style="font-weight:800;font-size:15px;color:var(--moss);">
              ${buyerData.buyerName} 
              <span style="font-size:12px;color:var(--muted);font-weight:normal;margin-left:8px;">(Turnover: ${formattedTurnover})</span>
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">Phone: ${phone || '<span style="color:#d90429;">Not found</span>'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            ${phone ? `
              <a href="${telLink}" title="Call" style="background:#e2f0d9;color:#2d6a4f;padding:6px 10px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:bold;">📞 Call</a>
              <a href="${waLink}" target="_blank" title="WhatsApp" style="background:#d8f3dc;color:#1b4332;padding:6px 10px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:bold;">💬 WhatsApp</a>
            ` : `<span style="font-size:11px;color:#999;font-style:italic;">No phone</span>`}
            <div onclick="toggleBuyerDropdown('${dropdownId}')" style="cursor:pointer;font-size:12px;color:var(--muted);font-weight:bold;padding-left:6px;">
              <span>${buyerData.stockItems.length} Products ▼</span>
            </div>
          </div>
        </div>
        <div id="${dropdownId}" style="display:none;padding:12px 16px;border-top:1px solid var(--border);background:#fff;">
    `;

    buyerData.stockItems.forEach(stock => {
      const commodityName = stock._matchedCommodityName || stock.commodity || stock.variety || 'Produce Item';
      const variety = stock.variety && stock.variety !== commodityName ? ` - ${stock.variety}` : '';
      const grade = stock.grade ? `Grade ${stock.grade}` : '';
      const size = stock.size ? `Size: ${stock.size}` : '';
      const availableQty = stock.count !== undefined ? stock.count : (stock.qty_rec || stock.qty_sort || 'N/A');

      htmlOutput += `
        <div style="padding:8px 0;border-bottom:1px solid #eee;">
          <div style="font-size:13px;font-weight:700;color:#333;">${commodityName}${variety} (${grade}, ${size})</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">Qty: <strong>${availableQty}</strong> | Pack: ${stock.pack || '-'}</div>
        </div>
      `;
    });

    htmlOutput += `
        </div>
      </div>
    `;
  });

  el.innerHTML = htmlOutput;
}
