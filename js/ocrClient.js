// ===== OCR CLIENT - Calls Tesseract OCR on Render =====

async function processWithTesseractServer(imageData) {
  const status = document.getElementById('ocr-status');
  
  if (status) {
    status.textContent = '📤 Sending to OCR server...';
    status.style.color = 'var(--muted)';
  }
  
  try {
    const response = await fetch('https://jdw-sync.onrender.com/ocr', { ... });
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image: imageData })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    const text = result.text;
    
    if (!text || text.trim().length < 10) {
      if (status) {
        status.textContent = '❌ No text detected. Try a better photo.';
        status.style.color = 'var(--red)';
      }
      return null;
    }
    
    console.log('📄 OCR Output:', text);
    
    if (status) {
      status.textContent = '✅ OCR complete! Parsing data...';
      status.style.color = 'var(--sage)';
    }
    
    return text;
    
  } catch (err) {
    console.error('OCR Server Error:', err);
    if (status) {
      status.textContent = '❌ OCR Error: ' + err.message;
      status.style.color = 'var(--red)';
    }
    return null;
  }
}
