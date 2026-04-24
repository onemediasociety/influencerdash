function fmt(n) {
  if (!n || n === 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}

function timeAgo(ts) {
  if (!ts) return '';
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60)    return 'just now';
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

// ── Profile card HTML (reused by capture and dashboard views) ──────────────

function profileCardHTML(profile, label) {
  const initials = (profile.name || profile.username || '?')
    .split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return `
    <div class="profile-card">
      ${label ? `<div class="card-label">${label}</div>` : ''}
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
    </div>`;
}

// ── Capture view ──────────────────────────────────────────────────────────────

let capturedProfile = null;

function renderCaptureProfile(profile) {
  capturedProfile = profile;
  const area = document.getElementById('capture-area');

  area.innerHTML = `
    ${profileCardHTML(profile, '')}
    <button id="sync-btn" class="btn btn-primary">Sync to Sheet</button>
    <div id="sync-result" class="status"></div>
  `;

  const img = document.getElementById('av-img');
  if (img) img.onload = () => {
    const av = document.getElementById('av-wrap');
    if (av) av.style.fontSize = '0';
  };

  document.getElementById('sync-btn').addEventListener('click', async () => {
    const btn    = document.getElementById('sync-btn');
    const result = document.getElementById('sync-result');

    btn.disabled    = true;
    btn.textContent = 'Syncing…';
    result.className = 'status';

    try {
      const res = await chrome.runtime.sendMessage({ type: 'SYNC_PROFILE', profile: capturedProfile });

      if (res?.ok) {
        const verb = res.action === 'added' ? 'Added' : 'Updated';
        result.textContent = `✓ ${verb} @${capturedProfile.username} in sheet`;
        result.className   = 'status visible ok';
        btn.textContent    = 'Synced ✓';
        btn.className      = 'btn btn-success';
      } else if (res?.error === 'SETUP_REQUIRED') {
        result.textContent = 'Setup required — click ⚙️ to configure';
        result.className   = 'status visible err';
        btn.disabled       = false;
        btn.textContent    = 'Sync to Sheet';
      } else {
        result.textContent = `Error: ${res?.error || 'unknown error'}`;
        result.className   = 'status visible err';
        btn.disabled       = false;
        btn.textContent    = 'Sync to Sheet';
      }
    } catch (err) {
      const isInvalidated = err.message?.includes('invalidated') || err.message?.includes('Extension context');
      result.textContent = isInvalidated
        ? 'Extension was reloaded — close and reopen this popup'
        : `Error: ${err.message}`;
      result.className   = 'status visible err';
      btn.disabled       = false;
      btn.textContent    = 'Sync to Sheet';
    }
  });
}

function renderCaptureError(msg) {
  const area = document.getElementById('capture-area');
  area.innerHTML = `
    <div class="no-sync-yet">
      <span class="emoji">⚠️</span>
      ${msg}
    </div>`;
}

// ── Dashboard (last sync) view ────────────────────────────────────────────────

function renderLastSync(lastSync) {
  const area = document.getElementById('last-sync-area');
  if (!lastSync) {
    area.innerHTML = `
      <div class="no-sync-yet">
        <span class="emoji">📋</span>
        Visit any Instagram profile and click this extension to capture their data.
      </div>`;
    return;
  }

  const { profile, action, timestamp } = lastSync;
  const actionBadge = action === 'added'
    ? '<span class="action-badge added">+ Added</span>'
    : '<span class="action-badge updated">↻ Updated</span>';

  area.innerHTML = `
    ${profileCardHTML(profile, `Last captured ${actionBadge}`)}
    <div class="sync-time">${timeAgo(timestamp)}</div>
  `;

  const img = document.getElementById('av-img');
  if (img) img.onload = () => {
    const av = document.getElementById('av-wrap');
    if (av) av.style.fontSize = '0';
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const captureEl   = document.getElementById('capture');
  const dashboardEl = document.getElementById('dashboard');
  const setupEl     = document.getElementById('setup');
  const settingsBtn = document.getElementById('settings-btn');
  const clientIdInput = document.getElementById('client-id');
  const sheetIdInput  = document.getElementById('sheet-id');
  const saveBtn       = document.getElementById('save-btn');
  const signOutBtn    = document.getElementById('sign-out-btn');
  const statusEl      = document.getElementById('status');
  const redirectUrlEl = document.getElementById('redirect-url');
  const sessionBadge  = document.getElementById('session-badge');

  let activeView     = null;
  let preSettingsView = null;

  function showView(id) {
    captureEl.classList.toggle('visible',   id === 'capture');
    dashboardEl.classList.toggle('visible', id === 'dashboard');
    setupEl.classList.toggle('visible',     id === 'setup');
    activeView       = id;
    settingsBtn.title = id === 'setup' ? 'Back' : 'Settings';
  }

  settingsBtn.addEventListener('click', () => {
    if (activeView === 'setup') {
      showView(preSettingsView || 'dashboard');
    } else {
      preSettingsView = activeView;
      showView('setup');
    }
  });

  // ── Redirect URL ──
  chrome.runtime.sendMessage({ type: 'GET_REDIRECT_URL' }, res => {
    if (redirectUrlEl) redirectUrlEl.textContent = res?.url || '(reload extension to get URL)';
  });

  // ── Load saved settings ──
  const { clientId, sheetId } = await chrome.storage.sync.get(['clientId', 'sheetId']);
  if (clientId) clientIdInput.value = clientId;
  if (sheetId)  sheetIdInput.value  = sheetId;

  // ── Auth state ──
  const { accessToken, tokenExpiry, lastSync, sessionCount } =
    await chrome.storage.local.get(['accessToken', 'tokenExpiry', 'lastSync', 'sessionCount']);

  const isConnected = accessToken && tokenExpiry > Date.now();

  if (!clientId) {
    // First-time setup
    showView('setup');
  } else {
    // Check if we're on an Instagram profile page
    let onInstagramProfile = false;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url   = tab?.url || '';
      // Match instagram.com/<username> but not feed, explore, etc.
      const m = url.match(/https:\/\/www\.instagram\.com\/([^/?#]+)\/?(?:[?#].*)?$/);
      const blockedPaths = new Set([
        'p','reel','reels','explore','accounts','stories','tv','about','legal',
        'privacy','help','api','directory','hashtag','locations','web','lite',
        'music','direct','shop','tags','s','_n','graphql',
      ]);
      if (m && m[1] && !blockedPaths.has(m[1].toLowerCase())) {
        onInstagramProfile = true;

        showView('capture');

        // Ask content script for profile data
        try {
          const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_PROFILE' });
          if (res?.ok && res.profile) {
            renderCaptureProfile(res.profile);
          } else if (res?.error === 'NOT_PROFILE_PAGE') {
            onInstagramProfile = false; // fall through to dashboard
          } else {
            renderCaptureError('Could not read profile — try reloading the page');
          }
        } catch {
          renderCaptureError('Could not connect to the page — try reloading Instagram');
        }
      }
    } catch {
      // tabs API unavailable — fall through to dashboard
    }

    if (!onInstagramProfile) {
      showView('dashboard');
      renderLastSync(lastSync || null);
      if (sessionCount) {
        sessionBadge.textContent = `${sessionCount} synced this session`;
      }
      if (!isConnected) {
        showStatus('Session expired — visit an Instagram profile and click this extension to re-authenticate.', 'ok');
      }
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
    showStatus('Saved! Visit any Instagram profile and click this extension to start syncing.', 'ok');
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
