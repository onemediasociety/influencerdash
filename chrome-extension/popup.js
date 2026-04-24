document.addEventListener('DOMContentLoaded', async () => {
  const clientIdInput = document.getElementById('client-id');
  const sheetIdInput  = document.getElementById('sheet-id');
  const saveBtn       = document.getElementById('save-btn');
  const signOutBtn    = document.getElementById('sign-out-btn');
  const statusEl      = document.getElementById('status');
  const redirectUrlEl = document.getElementById('redirect-url');

  // ── Show the redirect URL the user needs to whitelist ──
  chrome.runtime.sendMessage({ type: 'GET_REDIRECT_URL' }, res => {
    redirectUrlEl.textContent = res?.url || '(could not determine — try reloading the extension)';
  });

  // ── Load saved settings ──
  const { clientId, sheetId } = await chrome.storage.sync.get(['clientId', 'sheetId']);
  if (clientId) clientIdInput.value = clientId;
  if (sheetId)  sheetIdInput.value  = sheetId;

  // ── Check if already authenticated ──
  const { accessToken, tokenExpiry } = await chrome.storage.local.get(['accessToken', 'tokenExpiry']);
  if (accessToken && tokenExpiry > Date.now()) {
    showStatus('Connected to Google Sheets ✓ — visit any Instagram profile to auto-sync.', 'ok');
  } else if (clientId) {
    showStatus('Settings saved. Visit an Instagram profile to trigger authentication.', 'ok');
  }

  // ── Save settings ──
  saveBtn.addEventListener('click', async () => {
    const cid = clientIdInput.value.trim();
    const sid = sheetIdInput.value.trim();

    if (!cid) {
      showStatus('Please enter your Google OAuth Client ID.', 'err');
      return;
    }

    const toSave = { clientId: cid };
    if (sid) toSave.sheetId = sid;

    await chrome.storage.sync.set(toSave);
    // Clear any cached token so it re-authenticates with the new client
    await chrome.storage.local.remove(['accessToken', 'tokenExpiry']);
    showStatus('Settings saved! Visit an Instagram profile to connect your Google account.', 'ok');
  });

  // ── Sign out ──
  signOutBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'SIGN_OUT' });
    showStatus('Signed out of Google.', 'ok');
  });

  function showStatus(msg, type) {
    statusEl.textContent  = msg;
    statusEl.className    = `status visible ${type}`;
  }
});
