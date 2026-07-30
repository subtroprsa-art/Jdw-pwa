// ==========================================
// CORRECTED main.js FILE (COMPLETE CODE)
// ==========================================

// ===== MAIN INITIALIZATION & EVENT LISTENERS =====

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 JDW CRM Initialized');
  
  // Initialize Firebase connection check or listeners
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

  // Load initial stock and buyer data, then load the dashboard stats
  try {
    await Promise.all([
      typeof loadAllStockForMatcher === 'function' ? loadAllStockForMatcher() : Promise.resolve(),
      typeof loadBuyersFromFirebase === 'function' ? loadBuyersFromFirebase() : Promise.resolve(),
      typeof loadFloorFromFirebase === 'function' ? loadFloorFromFirebase('default_user') : Promise.resolve()
    ]);
  } catch (e) {
    console.error('Error loading initial data:', e);
  }

  // Finally, render the dashboard stats with the newly populated global arrays
  if (typeof loadDashboard === 'function') {
    loadDashboard();
    // Safe retry fallback in case Firebase data takes an extra moment to resolve asynchronously
    setTimeout(loadDashboard, 1000);
    setTimeout(loadDashboard, 3000);
  }
});
