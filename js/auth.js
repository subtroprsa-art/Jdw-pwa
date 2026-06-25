// ===== AUTH FUNCTIONS =====
// USERS and SK are loaded from HTML - don't redeclare them!

function doLogin() {
  const u = document.getElementById('login-user').value;
  const p = document.getElementById('login-pass').value;
  const e = document.getElementById('login-error');
  e.classList.remove('show');

  if (!u || !p) {
    e.textContent = 'Please enter your username and password.';
    e.classList.add('show');
    return;
  }

  const key = u.trim().toLowerCase().replace(/\s+/g, '.');
  const usr = USERS[key];

  if (!usr || usr.pw !== p) {
    e.textContent = 'Incorrect username or password.';
    e.classList.add('show');
    document.getElementById('login-pass').value = '';
    return;
  }

  const session = { u: key, exp: Date.now() + 28800000 };
  sessionStorage.setItem(SK, JSON.stringify(session));
  showApp(usr.display);
}

function doLogout() {
  sessionStorage.removeItem(SK);
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').classList.remove('show');
}

function togglePw() {
  const i = document.getElementById('login-pass');
  const b = document.getElementById('eye-btn');
  if (i.type === 'password') {
    i.type = 'text';
    b.textContent = '🙈';
  } else {
    i.type = 'password';
    b.textContent = '👁';
  }
}
