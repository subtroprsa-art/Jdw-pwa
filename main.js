// ===== MAIN INITIALIZATION & EVENT LISTENERS =====

document.addEventListener('DOMContentLoaded', () => {
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

  // Load initial stock or buyer data if functions are available
  if (typeof loadAllStockForMatcher === 'function') {
    loadAllStockForMatcher();
  }
  
  if (typeof loadBuyersFromFirebase === 'function') {
    loadBuyersFromFirebase();
  }
});
