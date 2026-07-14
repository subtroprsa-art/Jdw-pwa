// ===== SLIP UPLOAD - TESSERACT.JS OCR =====

let stream = null;
let capturedImageData = null;
let parsedSlipData = null;
let ocrWorker = null;

async function initTesseract() {
  if (!ocrWorker) {
    const status = document.getElementById('ocr-status');
    status.textContent = '⏳ Loading OCR engine (first time may take a few seconds)...';
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
  progressBar.style.width = '0%';
  status.textContent = '🔍 OCR in progress...';
  status.style.color = 'var(--muted)';
  
  try {
    await initTesseract();
    
    const result = await ocrWorker.recognize(imageData);
    
    progressBar.style.width = '100%';
    
    const text = result.data.text;
    console.log('📄 OCR Output:', text);
    
    if (!text || text.trim().length < 10) {
      status.textContent = '❌ No text detected. Try a better photo.';
      status.style.color = 'var(--red)';
      progressContainer.style.display = 'none';
      document.getElementById('take-photo-btn').style.display = 'block';
      return;
    }
    
    status.textContent = '✅ OCR complete! Parsing data...';
    status.style.color = 'var(--sage)';
    
    const parsed = parseSlipText(text);
    
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
    
  } catch (err) {
    console.error('OCR Error:', err);
    status.textContent = '❌ OCR Error: ' + err.message;
    status.style.color = 'var(--red)';
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
      html += `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">`;
      html += `<span>${idx+1}. ${item.commodity} ${item.variety} x ${item.qty}</span>`;
      html += `<span>R${(item.qty * item.price).toFixed(2)}</span>`;
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
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const fullText = lines.join('\n');
  
  // --- Extract Buyer ---
  const buyerPatterns = [
    /BUYER\s*[:;]\s*([^\n]+)/i,
    /BUYER\s+([^\n]+)/i,
    /^([A-Z][A-Z\s]+)$/m,
  ];
  for (const pattern of buyerPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      result.buyer = match[1].trim().replace(/[^A-Za-z0-9\s\.\&\(\)\-]/g, '').trim();
      if (result.buyer.length > 2) break;
    }
  }
  
  // --- Extract GRN ---
  const grnMatch = fullText.match(/GRN\s*[:;]\s*(\d+)/i);
  if (grnMatch) result.grn = grnMatch[1];
  
  // --- Extract Producer ---
  const producerMatch = fullText.match(/PRODUCER\s*[:;]\s*([^\n]+)/i);
  if (producerMatch) {
    result.producer = producerMatch[1].trim().replace(/[^A-Za-z0-9\s\.\&\(\)\-]/g, '').trim();
  }
  
  // --- Extract Date ---
  const dateMatch = fullText.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (dateMatch) result.date = dateMatch[1];
  
  // --- Extract Items ---
  const commodities = ['AVOS', 'LEMS', 'ORGS', 'KIWI', 'FIGS', 'GVS', 'CLTM', 'NAAR', 'STRS', 'MANG', 'DRAG', 'GFT', 'SATS', 'PAPO'];
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
    'GRAPEFRUIT': 'GFT'
  };
  
  for (const line of lines) {
    if (line.length < 5) continue;
    if (/^(DATE|BUYER|PRODUCER|GRN|INVOICE|ACCOUNT|CARD|SALE|TOTAL)/i.test(line)) continue;
    
    const upper = line.toUpperCase();
    let commodity = null;
    
    for (const code of commodities) {
      if (upper.includes(code)) { commodity = code; break; }
    }
    if (!commodity) {
      for (const [name, code] of Object.entries(commMap)) {
        if (upper.includes(name)) { commodity = code; break; }
      }
    }
    if (!commodity) continue;
    
    let variety = '*';
    const varieties = ['AF', 'AH', 'AK', 'MA', 'MAH', 'MD', 'NV', 'CN', 'AX', 'LR', 'HM', 'M1', 'NAR'];
    for (const v of varieties) {
      if (upper.includes(v)) { variety = v; break; }
    }
    
    let pack = '';
    const packs = ['TR040', 'BG150', 'BG160', 'CTT150', 'PTB005', 'PTB002', 'DL076', 'PC030', 'PC060', 'CO100'];
    for (const p of packs) {
      if (upper.includes(p)) { pack = p; break; }
    }
    
    let qty = 0, price = 0;
    const numbers = line.match(/\d+\.?\d*/g);
    if (numbers && numbers.length >= 2) {
      const nums = numbers.map(n => parseFloat(n));
      const whole = nums.filter(n => n % 1 === 0);
      const decimal = nums.filter(n => n % 1 !== 0);
      if (whole.length > 0 && decimal.length > 0) {
        qty = whole[0];
        price = decimal[0];
      } else if (nums.length >= 2) {
        qty = nums[0];
        price = nums[1];
      }
    }
    
    const atMatch = line.match(/(\d+)\s*[@x]\s*([\d.]+)/i);
    if (atMatch) {
      qty = parseInt(atMatch[1]);
      price = parseFloat(atMatch[2]);
    }
    
    if (qty > 0 && price > 0) {
      result.items.push({
        commodity: commodity,
        variety: variety,
        pack: pack,
        grade: '1',
        size: '*',
        qty: qty,
        price: price,
        total: qty * price
      });
    }
  }
  
  result.total = result.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  return result;
}
