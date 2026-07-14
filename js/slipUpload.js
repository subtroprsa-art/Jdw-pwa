// ===== SLIP UPLOAD - TESSERACT.JS OCR =====

let stream = null;
let capturedImageData = null;
let parsedSlipData = null;

// Tesseract.js worker
let ocrWorker = null;

async function initTesseract() {
  if (!ocrWorker) {
    const status = document.getElementById('ocr-status');
    status.textContent = '⏳ Loading OCR engine (first time may take a few seconds)...';
    status.style.color = 'var(--muted)';
    
    try {
      // Use the CDN version with a specific language
      ocrWorker = await Tesseract.createWorker('eng', 1, {
        // Use the latest model
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0/tesseract-core.wasm.js',
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const progress = Math.round(m.progress * 100);
            document.getElementById('progress-bar').style.width = progress + '%';
          }
        }
      });
      
      // Optimize for thermal receipts
      await ocrWorker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,-@/()*$%#:',
        tessedit_pageseg_mode: '6', // Assume a single uniform text block
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
  
  // Start OCR
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
      status.textContent = '❌ No text detected. Try a better photo (good lighting, straight angle).';
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
  } finally {
    if (ocrWorker) {
      // Keep worker alive for next use
      ocrWorker.setParameters({
        tessedit_pageseg_mode: '6'
      });
    }
  }
}

function displayParsedData(parsed) {
  const preview = document.getElementById('parsed-data-preview');
  const content = document.getElementById('parsed-content');
  
  let html = '';
  
  if (parsed.buyer) {
    html += `<div><strong>Buyer:</strong> ${parsed.buyer}</div>`;
  }
  if (parsed.grn) {
    html += `<div><strong>GRN:</strong> ${parsed.grn}</div>`;
  }
  if (parsed.producer) {
    html += `<div><strong>Producer:</strong> ${parsed.producer}</div>`;
  }
  if (parsed.date) {
    html += `<div><strong>Date:</strong> ${parsed.date}</div>`;
  }
  if (parsed.items && parsed.items.length > 0) {
    html += `<div style="margin-top:8px;"><strong>Items:</strong></div>`;
    parsed.items.forEach(item => {
      html += `<div style="font-size:11px;color:var(--muted);padding-left:8px;">`;
      html += `${item.commodity} ${item.variety} x ${item.qty} @ R${item.price} = R${(item.qty * item.price).toFixed(2)}`;
      if (item.pack) html += ` (${item.pack})`;
      html += `</div>`;
    });
  }
  if (parsed.total) {
    html += `<div style="margin-top:4px;"><strong>Total:</strong> R${parsed.total.toFixed(2)}</div>`;
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
    // Add metadata
    const record = {
      ...parsedSlipData,
      imported: new Date().toISOString(),
      source: 'mobile_photo_tesseract'
    };
    
    // Save to Firebase
    const response = await fetch(FB_DB + '/jdw/history.json?auth=' + FB_SECRET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    
    if (!response.ok) throw new Error('Failed to save');
    
    status.textContent = '✅ Saved successfully!';
    status.style.color = 'var(--sage)';
    
    // Refresh buyer data
    loadBuyersFromFirebase();
    loadAllStockForMatcher();
    
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

// Parse function - extracts data from OCR text
function parseSlipText(text) {
  const result = {
    buyer: '',
    grn: '',
    producer: '',
    date: '',
    items: [],
    total: 0
  };
  
  // Look for buyer
  const buyerMatch = text.match(/BUYER\s*[:;]\s*([^\n]+)/i);
  if (buyerMatch) {
    result.buyer = buyerMatch[1].trim();
  }
  
  // Look for GRN
  const grnMatch = text.match(/GRN\s*[:;]\s*(\d+)/i);
  if (grnMatch) {
    result.grn = grnMatch[1];
  }
  
  // Look for producer
  const producerMatch = text.match(/PRODUCER\s*[:;]\s*([^\n]+)/i);
  if (producerMatch) {
    result.producer = producerMatch[1].trim();
  }
  
  // Look for date
  const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (dateMatch) {
    result.date = dateMatch[1];
  }
  
  // Commodity mapping
  const commMap = {
    'AVOCADO': 'AVOS',
    'AVOCADOS': 'AVOS',
    'LEMON': 'LEMS',
    'LEMONS': 'LEMS',
    'ORANGE': 'ORGS',
    'ORANGES': 'ORGS',
    'KIWI': 'KIWI',
    'KIWIFRUIT': 'KIWI',
    'CLEMENTINE': 'CLTM',
    'CLEMENTINES': 'CLTM',
    'NAARTJIE': 'NAAR',
    'NAARTJIES': 'NAAR',
    'STRAWBERRY': 'STRS',
    'STRAWBERRIES': 'STRS',
    'MANGO': 'MANG',
    'MANGOES': 'MANG',
    'FIG': 'FIGS',
    'FIGS': 'FIGS',
    'GUAVA': 'GVS',
    'GUAVAS': 'GVS',
    'GRAPEFRUIT': 'GFT'
  };
  
  // Look for product lines
  // Pattern: AVOS AF TR040 50 70.00 3500.00
  // Or: AVOCADOS, 4KG TRAY, AF;CL 1;*;14;*;4 KG/L
  
  const lines = text.split('\n');
  for (const line of lines) {
    const upper = line.toUpperCase();
    
    // Try to find commodity code or name
    let commodity = null;
    let variety = '*';
    let pack = '';
    let qty = 0;
    let price = 0;
    
    // Check for commodity codes
    const commCodes = ['AVOS', 'LEMS', 'ORGS', 'KIWI', 'FIGS', 'GVS', 'CLTM', 'NAAR', 'STRS', 'MANG', 'DRAG', 'GFT', 'SATS', 'PAPO'];
    for (const code of commCodes) {
      if (upper.includes(code)) {
        commodity = code;
        break;
      }
    }
    
    // Check for commodity names
    if (!commodity) {
      for (const [name, code] of Object.entries(commMap)) {
        if (upper.includes(name)) {
          commodity = code;
          break;
        }
      }
    }
    
    if (!commodity) continue;
    
    // Try to extract variety
    const varieties = ['AF', 'AH', 'AK', 'MA', 'MAH', 'MD', 'NV', 'CN', 'AX', 'LR', 'HM', 'M1', 'NAR'];
    for (const varCode of varieties) {
      if (upper.includes(varCode)) {
        variety = varCode;
        break;
      }
    }
    
    // Try to extract pack
    const packCodes = ['TR040', 'BG150', 'BG160', 'CTT150', 'PTB005', 'PTB002', 'DL076', 'PC030', 'PC060', 'CO100'];
    for (const packCode of packCodes) {
      if (upper.includes(packCode)) {
        pack = packCode;
        break;
      }
    }
    
    // Extract numbers - look for qty and price patterns
    const numbers = line.match(/\d+\.?\d*/g);
    if (numbers && numbers.length >= 2) {
      const nums = numbers.map(n => parseFloat(n));
      
      // Try to identify qty (usually a whole number) and price (has decimal)
      if (nums[0] && nums[1]) {
        if (nums[0] % 1 === 0) {
          qty = nums[0];
          price = nums[1];
        } else {
          qty = nums[1];
          price = nums[0];
        }
      }
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
  
  // Calculate total
  result.total = result.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  
  return result;
}
