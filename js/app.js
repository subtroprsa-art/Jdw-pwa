// CONFIG is loaded from HTML - don't redeclare it!
const FB_DB = CONFIG.FIREBASE_DATABASE_URL;
const FB_SECRET = CONFIG.FIREBASE_SECRET;
const SYNC_URL = CONFIG.SYNC_URL;

if (!FB_SECRET) {
  console.warn('⚠️ Firebase secret not loaded.');
}

function loadPipelineState() {
  const state = JSON.parse(sessionStorage.getItem('pipeline-' + new Date().toISOString().slice(0, 10)) || '{}');
  for (let i = 1; i <= 6; i++) {
    if (state[i]) {
      const el = document.getElementById('ps' + i);
      const ch = document.getElementById('psc' + i);
      if (el) el.classList.add('done');
      if (ch) ch.textContent = 'v';
    }
  }
}

function showApp(name) {
  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.getElementById('app');
  const usernameEl = document.getElementById('hdr-username');
  const dateEl = document.getElementById('live-date');

  if (loginScreen) loginScreen.style.display = 'none';
  if (appContainer) appContainer.style.display = 'block';
  if (usernameEl) usernameEl.textContent = name;
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });

  if (typeof loadDashboard === 'function') loadDashboard();
  if (typeof loadBuyersFromFirebase === 'function') loadBuyersFromFirebase();
  if (typeof loadStockFromFirebase === 'function') loadStockFromFirebase('RJ');
  if (typeof loadAllStockForMatcher === 'function') loadAllStockForMatcher();
  if (typeof loadColdstore === 'function') loadColdstore();
}

function goToPage(id) {
  const pageNames = {
    dashboard: 'Home',
    pipeline: 'Pipeline',
    buyers: 'Buyers',
    stock: 'Stock',
    orders: 'Orders',
    floor: 'Floor Balance',
    coldstore: 'Coldstore',
    commodities: 'Commodities',
    scanslip: 'Google Drive Sync',
    analytics: 'Reports & Analytics'
  };

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('active');

  const homeBtn = document.getElementById('home-btn');
  if (homeBtn) homeBtn.style.display = 'block';

  const pageName = document.getElementById('hdr-page-name');
  if (pageName) pageName.textContent = pageNames[id] || id;

  window.scrollTo(0, 0);

  if (id === 'buyers' && typeof loadBuyersFromFirebase === 'function') loadBuyersFromFirebase();
  if (id === 'stock') {
    const at = document.querySelector('.stock-tab.active');
    if (typeof loadStockFromFirebase === 'function') loadStockFromFirebase(at ? at.id.replace('tab-', '') : 'RJ');
    if (typeof loadAllStockForMatcher === 'function') loadAllStockForMatcher();
  }
  if (id === 'pipeline') {
    if (typeof liveBuyerData !== 'undefined' && !liveBuyerData.length && typeof loadBuyersFromFirebase === 'function') loadBuyersFromFirebase();
    if (typeof loadAllStockForMatcher === 'function') loadAllStockForMatcher();
    loadPipelineState();
  }
  if (id === 'orders') {
    if (typeof loadOrders === 'function') loadOrders();
    if (typeof populateBuyerSuggestions === 'function') populateBuyerSuggestions();
    if (typeof initOrderCommodityDropdown === 'function') initOrderCommodityDropdown();
  }
  if (id === 'floor') {
    const at = document.querySelector('#ftab-RJ.active, #ftab-CW.active, #ftab-POT.active');
    if (typeof loadFloorFromFirebase === 'function') loadFloorFromFirebase(at ? at.id.replace('ftab-', '') : 'RJ');
  }
  if (id === 'coldstore' && typeof loadColdstore === 'function') loadColdstore();
  if (id === 'commodities') {
    const sumList = document.getElementById('comm-summary-list');
    const commDetail = document.getElementById('comm-detail');
    if (sumList) {
      sumList.innerHTML = '<div class="empty">Loading…</div>';
      sumList.style.display = 'block';
    }
    if (commDetail) commDetail.style.display = 'none';

    if (window.allLiveStockData && window.allLiveStockData.length > 0) {
      if (typeof renderCommodities === 'function' && typeof buildCommoditySummary === 'function') {
        renderCommodities(buildCommoditySummary());
      }
    } else {
      firebase.database().ref('stock').once('value')
        .then(snapshot => {
          const d = snapshot.val();
          const all = [];
          for (const uk in d || {}) {
            for (const ek in d[uk] || {}) {
              if (typeof firebaseToItem === 'function') {
                all.push({ ...firebaseToItem(d[uk][ek]), user: d[uk][ek].user || uk });
              }
            }
          }
          window.allLiveStockData = all;
          if (typeof renderCommodities === 'function' && typeof buildCommoditySummary === 'function') {
            renderCommodities(buildCommoditySummary());
          }
        })
        .catch(() => {
          if (sumList) sumList.innerHTML = '<div class="empty">Could not load data.</div>';
        });
    }
  }
}

function goHome() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const dashboard = document.getElementById('page-dashboard');
  if (dashboard) dashboard.classList.add('active');

  const homeBtn = document.getElementById('home-btn');
  if (homeBtn) homeBtn.style.display = 'none';

  const pageName = document.getElementById('hdr-page-name');
  if (pageName) pageName.textContent = 'Home';

  window.scrollTo(0, 0);
  if (typeof loadDashboard === 'function') loadDashboard();
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen && loginScreen.style.display !== 'none' && typeof doLogin === 'function') doLogin();
  }
});

window.addEventListener('load', function() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SK));
    if (s && s.exp > Date.now() && USERS[s.u]) {
      showApp(USERS[s.u].display);
    }
  } catch (e) {}
  loadPipelineState();
});
