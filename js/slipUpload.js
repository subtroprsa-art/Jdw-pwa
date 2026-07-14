// ===== SLIP UPLOAD - CAMERA FUNCTIONS =====

let stream = null;
let capturedImageData = null;

function startCamera() {
  const video = document.getElementById('video');
  const preview = document.getElementById('photo-preview');
  const status = document.getElementById('upload-status');
  
  // Hide preview if visible
  preview.style.display = 'none';
  status.textContent = '📷 Opening camera...';
  
  // Check if camera is supported
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    status.textContent = '❌ Camera not supported on this device.';
    status.style.color = 'var(--red)';
    return;
  }
  
  // Start camera
  navigator.mediaDevices.getUserMedia({ 
    video: { facingMode: 'environment' },  // Use back camera
    audio: false 
  })
  .then(s => {
    stream = s;
    video.srcObject = s;
    video.style.display = 'block';
    video.play();
    status.textContent = '📸 Point camera at slip and tap Capture';
    status.style.color = 'var(--sage)';
    
    // Show/hide buttons
    document.getElementById('take-photo-btn').style.display = 'none';
    document.getElementById('capture-btn').style.display = 'block';
    document.getElementById('cancel-btn').style.display = 'block';
    document.getElementById('upload-photo-btn').style.display = 'none';
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
  const status = document.getElementById('upload-status');
  
  // Capture frame
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  
  // Save image data for upload
  capturedImageData = canvas.toDataURL('image/jpeg', 0.9);
  
  // Show preview
  preview.src = capturedImageData;
  preview.style.display = 'block';
  status.textContent = '✅ Photo captured! Tap "Upload to CRM" to process.';
  status.style.color = 'var(--sage)';
  
  // Stop camera
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  video.style.display = 'none';
  
  // Show/hide buttons
  document.getElementById('capture-btn').style.display = 'none';
  document.getElementById('cancel-btn').style.display = 'none';
  document.getElementById('upload-photo-btn').style.display = 'block';
  document.getElementById('take-photo-btn').style.display = 'none';
}

function cancelCamera() {
  // Stop camera
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  
  // Reset UI
  document.getElementById('video').style.display = 'none';
  document.getElementById('photo-preview').style.display = 'none';
  document.getElementById('upload-status').textContent = '';
  document.getElementById('capture-btn').style.display = 'none';
  document.getElementById('cancel-btn').style.display = 'none';
  document.getElementById('upload-photo-btn').style.display = 'none';
  document.getElementById('take-photo-btn').style.display = 'block';
}

async function uploadSlipPhoto() {
  const status = document.getElementById('upload-status');
  const preview = document.getElementById('photo-preview');
  
  if (!capturedImageData) {
    status.textContent = '❌ No photo captured. Take a photo first.';
    status.style.color = 'var(--red)';
    return;
  }
  
  status.textContent = '📤 Uploading to server...';
  status.style.color = 'var(--muted)';
  
  try {
    // Convert base64 to blob
    const response = await fetch(capturedImageData);
    const blob = await response.blob();
    
    // Create FormData
    const formData = new FormData();
    formData.append('image', blob, 'slip_photo.jpg');
    formData.append('secret', CONFIG.TRIGGER_SECRET || 'jdw-trigger-2026');
    
    // Send to Render
    const uploadResponse = await fetch(CONFIG.SYNC_URL + '/process-slip-photo', {
      method: 'POST',
      body: formData
    });
    
    const result = await uploadResponse.json();
    
    if (result.success) {
      status.textContent = '✅ Slip processed! ' + result.count + ' transactions found.';
      status.style.color = 'var(--sage)';
      
      // Refresh data
      loadBuyersFromFirebase();
      loadAllStockForMatcher();
      
      // Reset after 3 seconds
      setTimeout(() => {
        preview.style.display = 'none';
        document.getElementById('upload-photo-btn').style.display = 'none';
        document.getElementById('take-photo-btn').style.display = 'block';
        status.textContent = '';
        capturedImageData = null;
      }, 3000);
    } else {
      status.textContent = '❌ Error: ' + (result.error || 'Unknown error');
      status.style.color = 'var(--red)';
    }
  } catch (err) {
    status.textContent = '❌ Error: ' + err.message;
    status.style.color = 'var(--red)';
  }
}
