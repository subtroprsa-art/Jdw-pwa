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
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('hdr-username').textContent = name;
  document.getElementById('live-date').textContent = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  loadDashboard();
  loadBuyersFromFirebase();
  loadStockFromFirebase('RJ');
  loadAllStockForMatcher();
  loadColdstore();
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
    commodities: 'Commodities'
  };

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('active');

  const homeBtn = document.getElementById('home-btn');
  if (homeBtn) homeBtn.style.display = 'block';

  const pageName = document.getElementById('hdr-page-name');
  if (pageName) pageName.textContent = pageNames[id] || id;

  window.scrollTo(0, 0);

  if (id === 'buyers') loadBuyersFromFirebase();
  if (id === 'stock') {
    const at = document.querySelector('.stock-tab.active');
    loadStockFromFirebase(at ? at.id.replace('tab-', '') : 'RJ');
    loadAllStockForMatcher();
  }
  if (id === 'pipeline') {
    if (!liveBuyerData.length) loadBuyersFromFirebase();
    loadAllStockForMatcher();
    loadPipelineState();
  }
  if (id === 'orders') {
    loadOrders();
    populateBuyerSuggestions();
    initOrderCommodityDropdown();
  }
  if (id === 'floor') {
    const at = document.querySelector('#ftab-RJ.active, #ftab-CW.active, #ftab-POT.active');
    loadFloorFromFirebase(at ? at.id.replace('ftab-', '') : 'RJ');
  }
  if (id === 'coldstore') loadColdstore();
  if (id === 'commodities') {
    document.getElementById('comm-summary-list').innerHTML = '<div class="empty">Loading…</div>';
    document.getElementById('comm-detail').style.display = 'none';
    document.getElementById('comm-summary-list').style.display = 'block';

    if (window.allLiveStockData && window.allLiveStockData.length > 0) {
      renderCommodities(buildCommoditySummary());
    } else {
      firebase.database().ref('stock').once('value')
        .then(snapshot => {
          const d = snapshot.val();
          const all = [];
          for (const uk in d || {}) {
            for (const ek in d[uk] || {}) {
              all.push({ ...firebaseToItem(d[uk][ek]), user: d[uk][ek].user || uk });
            }
          }
          window.allLiveStockData = all;
          renderCommodities(buildCommoditySummary());
        })
        .catch(() => {
          document.getElementById('comm-summary-list').innerHTML = '<div class="empty">Could not load data.</div>';
        });
    }
  }
}

function goHome() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-dashboard').classList.add('active');
  document.getElementById('home-btn').style.display = 'none';
  document.getElementById('hdr-page-name').textContent = 'Home';
  window.scrollTo(0, 0);
  loadDashboard();
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen && loginScreen.style.display !== 'none') doLogin();
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
