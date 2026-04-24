function fmt(n) {
  if (!n || n === 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}

function timeAgo(ts) {
  if (!ts) return '';
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60)   return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function renderLastSync(lastSync) {
  const area = document.getElementById('last-sync-area');
  if (!lastSync) {
    area.innerHTML = `
      <div class="no-sync-yet">
        <span class="emoji">📋</span>
        Visit any Instagram profile and we'll automatically capture their data into your sheet.
      </div>`;
    return;
  }

  const { profile, action, timestamp } = lastSync;
  const initials = (profile.name || profile.username || '?')
    .split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const actionBadge = action === 'added'
    ? '<span class="action-badge added">+ Added</span>'
    : '<span class="action-badge updated">↻ Updated</span>';

  area.innerHTML = `
    <div class="last-sync-card">
      <div class="card-label">Last captured ${actionBadge}</div>

      <div class="profile-row">
        <div class="avatar" id="av-wrap">
          <img id="av-img" src="https://unavatar.io/instagram/${profile.username}"
               onerror="this.style.display='none'" alt="" />
          ${initials}
        </div>
        <div class="profile-meta">
          <div class="name">${profile.name || profile.username}</div>
          <div class="handle">@${profile.username}</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat">
          <div class="stat-label">Followers</div>
          <div class="stat-value purple">${fmt(profile.followers)}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Engagement</div>
          <div class="stat-value green">${profile.engagement != null ? profile.engagement + '%' : '—'}</div>
        </div>
      </div>

      ${profile.location ? `
      <div class="stat-full" style="margin-top:6px;">
        <span class="tag">📍</span> ${profile.location}
      </div>` : ''}

      ${profile.niche ? `
      <div class="stat-full" style="margin-top:6px;">
        <span class="tag">🏷</span> ${profile.niche}
      </div>` : ''}

      ${profile.email ? `
      <div class="stat-full" style="margin-top:6px;">
        <span class="tag">✉</span> ${profile.email}
      </div>` : ''}

      <div class="sync-time">${timeAgo(timestamp)}</div>
    </div>`;

  // Hide the initials fallback if image loads successfully
  const img = document.getElementById('av-img');
  if (img) {
    img.onload = () => {
      const av = document.getElementById('av-wrap');
      if (av) av.style.fontSize = '0'; // hide initials text, show image
    };
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const dashboard  = document.getElementById('dashboard');
  const setup      = document.getElementById('setup');
  const settingsBtn = document.getElementById('settings-btn');
  const clientIdInput = document.getElementById('client-id');
  const sheetIdInput  = document.getElementById('sheet-id');
  const saveBtn       = document.getElementById('save-btn');
  const signOutBtn    = document.getElementById('sign-out-btn');
  const statusEl      = document.getElementById('status');
  const redirectUrlEl = document.getElementById('redirect-url');
  const sessionBadge  = document.getElementById('session-badge');

  let showingSettings = false;

  function showDashboard() {
    showingSettings = false;
    dashboard.classList.add('visible');
    setup.classList.remove('visible');
    settingsBtn.title = 'Settings';
  }

  function showSetup() {
    showingSettings = true;
    setup.classList.add('visible');
    dashboard.classList.remove('visible');
    settingsBtn.title = 'Back';
  }

  settingsBtn.addEventListener('click', () => {
    if (showingSettings) showDashboard(); else showSetup();
  });

  // ── Redirect URL ──
  chrome.runtime.sendMessage({ type: 'GET_REDIRECT_URL' }, res => {
    if (redirectUrlEl) redirectUrlEl.textContent = res?.url || '(reload extension to get URL)';
  });

  // ── Load saved settings ──
  const { clientId, sheetId } = await chrome.storage.sync.get(['clientId', 'sheetId']);
  if (clientId) clientIdInput.value = clientId;
  if (sheetId)  sheetIdInput.value  = sheetId;

  // ── Check auth + last sync state ──
  const { accessToken, tokenExpiry, lastSync, sessionCount } =
    await chrome.storage.local.get(['accessToken', 'tokenExpiry', 'lastSync', 'sessionCount']);

  const isConnected = accessToken && tokenExpiry > Date.now();

  if (isConnected && clientId) {
    // Show dashboard
    showDashboard();
    renderLastSync(lastSync || null);
    if (sessionCount) {
      sessionBadge.textContent = `${sessionCount} synced this session`;
    }
  } else {
    // Show setup
    showSetup();
    if (clientId && !isConnected) {
      showStatus('Session expired — visit an Instagram profile to re-authenticate.', 'ok');
    }
  }

  // ── Save settings ──
  saveBtn.addEventListener('click', async () => {
    const cid = clientIdInput.value.trim();
    const sid = sheetIdInput.value.trim();
    if (!cid) { showStatus('Please enter your Google OAuth Client ID.', 'err'); return; }

    const toSave = { clientId: cid };
    if (sid) toSave.sheetId = sid;
    await chrome.storage.sync.set(toSave);
    await chrome.storage.local.remove(['accessToken', 'tokenExpiry']);
    showStatus('Saved! Visit any Instagram profile to connect Google and start syncing.', 'ok');
  });

  // ── Sign out ──
  signOutBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'SIGN_OUT' });
    showStatus('Signed out.', 'ok');
  });

  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className   = `status visible ${type}`;
  }
});
