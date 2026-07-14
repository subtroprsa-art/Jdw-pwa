// ===== SLIP UPLOAD - TESSERACT.JS OCR =====

let stream = null;
let capturedImageData = null;
let parsedSlipData = null;
let ocrWorker = null;

async function initTesseract() {
  if (!ocrWorker) {
    const status = document.getElementById('ocr-status');
    status.textContent = '⏳ Loading OCR engine...';
    status.style.color = 'var(--muted)';
    
    try {
      ocrWorker = await Tesseract.createWorker('eng', 1, {
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0/tesseract-core.wasm.js',
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const progress = Math.round(m.progress * 100);
            const bar = document.getElementById('progress-bar');
            if (bar) bar.style.width = progress + '%';
          }
        }
      });
      
      await ocrWorker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,-@/()*$%#:',
        tessedit_pageseg_mode: '6',
      });
      
      status.textContent = '✅ OCR engine ready';
      status.style.color = 'var(--sage)';
    } catch (err) {
      status.textContent = '❌ Failed to load OCR: ' + err.message;
      status.style.color = 'var(--red)';
      throw err;
    }
  }
  return ocrWorker;
}

function startCamera() {
  const video = document.getElementById('video');
  const preview = document.getElementById('photo-preview');
  const status = document.getElementById('ocr-status');
  
  preview.style.display = 'none';
  document.getElementById('parsed-data-preview').style.display = 'none';
  status.textContent = '📷 Opening camera...';
  status.style.color = 'var(--muted)';
  
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    status.textContent = '❌ Camera not supported on this device.';
    status.style.color = 'var(--red)';
    return;
  }
  
  navigator.mediaDevices.getUserMedia({ 
    video: { facingMode: 'environment' },
    audio: false 
  })
  .then(s => {
    stream = s;
    video.srcObject = s;
    video.style.display = 'block';
    video.play();
    status.textContent = '📸 Point camera at slip and tap Capture';
    status.style.color = 'var(--sage)';
    
    document.getElementById('take-photo-btn').style.display = 'none';
    document.getElementById('capture-btn').style.display = 'block';
    document.getElementById('cancel-btn').style.display = 'block';
  })
  .catch(err => {
    status.textContent = '❌ Could not access camera: ' + err.message;
    status.style.color = 'var(--red)';
  });
}

function capturePhoto() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const preview = document.getElementById('photo-preview');
  const status = document.getElementById('ocr-status');
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  
  capturedImageData = canvas.toDataURL('image/jpeg', 0.9);
  
  preview.src = capturedImageData;
  preview.style.display = 'block';
  status.textContent = '✅ Photo captured! Processing OCR...';
  status.style.color = 'var(--sage)';
  
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  video.style.display = 'none';
  
  document.getElementById('capture-btn').style.display = 'none';
  document.getElementById('cancel-btn').style.display = 'none';
  document.getElementById('take-photo-btn').style.display = 'none';
  
  performOCR(capturedImageData);
}

function cancelCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  
  document.getElementById('video').style.display = 'none';
  document.getElementById('photo-preview').style.display = 'none';
  document.getElementById('ocr-status').textContent = '';
  document.getElementById('capture-btn').style.display = 'none';
  document.getElementById('cancel-btn').style.display = 'none';
  document.getElementById('take-photo-btn').style.display = 'block';
  document.getElementById('progress-container').style.display = 'none';
  document.getElementById('parsed-data-preview').style.display = 'none';
}

async function performOCR(imageData) {
  const status = document.getElementById('ocr-status');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  
  progressContainer.style.display = 'block';
  progressBar.style.width = '30%';
  
  // Use EasyOCR instead of Tesseract
  const text = await processWithEasyOCR(imageData);
  
  if (!text) {
    progressContainer.style.display = 'none';
    document.getElementById('take-photo-btn').style.display = 'block';
    return;
  }
  
  progressBar.style.width = '80%';
  
  // Parse the text
  const parsed = parseSlipText(text);
  
  progressBar.style.width = '100%';
  
  if (parsed && parsed.items && parsed.items.length > 0) {
    parsedSlipData = parsed;
    displayParsedData(parsed);
    status.textContent = '✅ Data extracted! Review and save.';
    status.style.color = 'var(--sage)';
  } else {
    status.textContent = '⚠️ Could not parse slip data. Try a clearer photo.';
    status.style.color = 'var(--gold)';
    progressContainer.style.display = 'none';
    document.getElementById('take-photo-btn').style.display = 'block';
  }
}
function displayParsedData(parsed) {
  const preview = document.getElementById('parsed-data-preview');
  const content = document.getElementById('parsed-content');
  
  let html = '';
  html += `<div style="background:#f0f8f0;padding:8px;border-radius:6px;margin-bottom:8px;">`;
  html += `<div><strong>Buyer:</strong> ${parsed.buyer || '❌ Not found'}</div>`;
  html += `<div><strong>GRN:</strong> ${parsed.grn || '❌ Not found'}</div>`;
  html += `<div><strong>Producer:</strong> ${parsed.producer || '❌ Not found'}</div>`;
  html += `<div><strong>Date:</strong> ${parsed.date || '❌ Not found'}</div>`;
  html += `</div>`;
  
  if (parsed.items && parsed.items.length > 0) {
    html += `<div style="margin-top:8px;"><strong>Items (${parsed.items.length}):</strong></div>`;
    parsed.items.forEach((item, idx) => {
      const total = item.qty * item.price;
      html += `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">`;
      html += `<span>${idx+1}. ${item.commodity} ${item.variety} x ${item.qty}</span>`;
      html += `<span>R${total.toFixed(2)}</span>`;
      html += `</div>`;
    });
    html += `<div style="margin-top:8px;font-weight:700;text-align:right;">Total: R${parsed.total.toFixed(2)}</div>`;
  } else {
    html += `<div style="color:var(--red);margin-top:8px;">⚠️ No items found.</div>`;
  }
  
  content.innerHTML = html;
  preview.style.display = 'block';
}

async function saveParsedData() {
  if (!parsedSlipData) return;
  
  const status = document.getElementById('ocr-status');
  status.textContent = '💾 Saving to CRM...';
  status.style.color = 'var(--muted)';
  
  try {
    const record = {
      ...parsedSlipData,
      imported: new Date().toISOString(),
      source: 'mobile_photo_tesseract'
    };
    
    const response = await fetch(CONFIG.FIREBASE_DATABASE_URL + '/jdw/history.json?auth=' + CONFIG.FIREBASE_SECRET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    
    if (!response.ok) throw new Error('Failed to save');
    
    status.textContent = '✅ Saved successfully!';
    status.style.color = 'var(--sage)';
    
    if (typeof loadBuyersFromFirebase === 'function') loadBuyersFromFirebase();
    if (typeof loadAllStockForMatcher === 'function') loadAllStockForMatcher();
    
    setTimeout(() => {
      resetSlipUpload();
    }, 2000);
    
  } catch (err) {
    console.error('Save Error:', err);
    status.textContent = '❌ Error saving: ' + err.message;
    status.style.color = 'var(--red)';
  }
}

function resetSlipUpload() {
  document.getElementById('parsed-data-preview').style.display = 'none';
  document.getElementById('photo-preview').style.display = 'none';
  document.getElementById('ocr-status').textContent = '';
  document.getElementById('progress-container').style.display = 'none';
  document.getElementById('take-photo-btn').style.display = 'block';
  document.getElementById('capture-btn').style.display = 'none';
  document.getElementById('cancel-btn').style.display = 'none';
  parsedSlipData = null;
}

function parseSlipText(text) {
  const result = {
    buyer: '',
    grn: '',
    producer: '',
    date: '',
    items: [],
    total: 0
  };
  
  const fullText = text;
  console.log('📄 Full OCR Text:', fullText);
  
  // --- Extract Buyer ---
  const buyerMatch = fullText.match(/BUYER\s*[:;]\s*([^\n]+)/i);
  if (buyerMatch) {
    result.buyer = buyerMatch[1].trim();
    console.log('✅ Buyer found:', result.buyer);
  }
  
  // --- Extract GRN ---
  let grnMatch = fullText.match(/GRN\s*[:;]\s*(\d+)/i);
  if (!grnMatch) {
    grnMatch = fullText.match(/GRN\s+(\d+)/i);
  }
  if (grnMatch) {
    result.grn = grnMatch[1];
    console.log('✅ GRN found:', result.grn);
  } else {
    console.log('❌ GRN not found');
  }
  
  // --- Extract Producer ---
  const producerMatch = fullText.match(/PRODUCER\s*[:;]\s*([^\n]+)/i);
  if (producerMatch) {
    result.producer = producerMatch[1].trim();
    console.log('✅ Producer found:', result.producer);
  }
  
  // --- Extract Date ---
  const dateMatch = fullText.match(/DATE\s*[:;]\s*([^\n]+)/i);
  if (dateMatch) {
    result.date = dateMatch[1].trim();
    console.log('✅ Date found:', result.date);
  }
  
  // --- Extract SALE line ---
  // Format: "SALE    104 @    50.00    5,200.00"
  let saleMatch = fullText.match(/SALE\s+([\d,]+)\s*[@]\s*([\d,.]+)\s+([\d,.]+)/i);
  if (!saleMatch) {
    saleMatch = fullText.match(/SALE\s+([\d,]+)\s+([\d,.]+)\s+([\d,.]+)/i);
  }
  if (!saleMatch) {
    saleMatch = fullText.match(/SALE\s+([\d,]+)\s*[@]\s*([\d,.]+)/i);
  }
  
  if (saleMatch) {
    console.log('✅ SALE line found:', saleMatch[0]);
    
    const qty = parseInt(saleMatch[1].replace(/,/g, ''));
    const price = parseFloat(saleMatch[2].replace(/,/g, ''));
    let total = 0;
    if (saleMatch[3]) {
      total = parseFloat(saleMatch[3].replace(/,/g, ''));
    } else {
      total = qty * price;
    }
    
    console.log('Qty:', qty, 'Price:', price, 'Total:', total);
    
    // Determine commodity from the text
    let commodity = 'UNK';
    const commMap = {
      'AVOCADO': 'AVOS', 'AVOCADOS': 'AVOS',
      'LEMON': 'LEMS', 'LEMONS': 'LEMS',
      'ORANGE': 'ORGS', 'ORANGES': 'ORGS',
      'KIWI': 'KIWI', 'KIWIFRUIT': 'KIWI',
      'CLEMENTINE': 'CLTM', 'CLEMENTINES': 'CLTM',
      'NAARTJIE': 'NAAR', 'NAARTJIES': 'NAAR',
      'STRAWBERRY': 'STRS', 'STRAWBERRIES': 'STRS',
      'MANGO': 'MANG', 'MANGOES': 'MANG',
      'FIG': 'FIGS', 'FIGS': 'FIGS',
      'GUAVA': 'GVS', 'GUAVAS': 'GVS',
      'GRAPEFRUIT': 'GFT',
      'SATSUMA': 'SATS', 'SATSUMAS': 'SATS',
      'PAPINO': 'PAPO'
    };
    
    for (const [name, code] of Object.entries(commMap)) {
      if (fullText.toUpperCase().includes(name)) {
        commodity = code;
        break;
      }
    }
    console.log('Commodity:', commodity);
    
    // Determine variety
    let variety = '*';
    const varieties = ['NAR', 'AF', 'AH', 'AK', 'MA', 'MAH', 'MD', 'NV', 'CN', 'AX', 'LR', 'HM', 'M1'];
    for (const v of varieties) {
      if (fullText.toUpperCase().includes(v)) {
        variety = v;
        break;
      }
    }
    console.log('Variety:', variety);
    
    // Determine pack
    let pack = '';
    const packs = ['TR040', 'BG150', 'BG160', 'CTT150', 'PTB005', 'PTB002', 'DL076', 'PC030', 'PC060', 'CO100'];
    for (const p of packs) {
      if (fullText.toUpperCase().includes(p)) {
        pack = p;
        break;
      }
    }
    console.log('Pack:', pack);
    
    result.items.push({
      commodity: commodity,
      variety: variety,
      pack: pack,
      grade: '1',
      size: '*',
      qty: qty,
      price: price,
      total: total
    });
    
    result.total = total;
    console.log('✅ Item added:', result.items[0]);
    
  } else {
    console.log('❌ SALE line not found');
    console.log('Full text for debugging:', fullText);
  }
  
  console.log('📄 Final result:', result);
  return result;
}
