// ==========================================
// CORRECTED main.js FILE (COMPLETE CODE)
// ==========================================

// ===== MAIN INITIALIZATION & EVENT LISTENERS =====

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 JDW CRM Initialized');
  
  if (typeof firebase !== 'undefined') {
    console.log('🔥 Firebase SDK detected');
  }

  // Bind UI event listeners if elements exist
  const takePhotoBtn = document.getElementById('take-photo-btn');
  if (takePhotoBtn) {
    takePhotoBtn.addEventListener('click', startCamera);
  }

  const captureBtn = document.getElementById('capture-btn');
  if (captureBtn) {
    captureBtn.addEventListener('click', capturePhoto);
  }

  const cancelBtn = document.getElementById('cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', cancelCamera);
  }

  // Load baseline buyers if the function exists
  try {
    if (typeof loadBuyersFromFirebase === 'function') {
      await loadBuyersFromFirebase();
    }
  } catch (e) {
    console.error('Error loading initial buyer data:', e);
  }

  // Initialize decoupled dashboard and stock views from our pre-calculated nodes
  if (typeof loadDashboard === 'function') {
    loadDashboard();
  }
  
  if (typeof loadStockFromFirebase === 'function') {
    loadStockFromFirebase();
  }
});
