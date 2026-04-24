// Service worker — handles Google OAuth and all Google Sheets API calls.
// Content scripts cannot call the Sheets API directly (CORS), so they send
// messages here and we proxy the requests.

const DEFAULT_SHEET_ID = '1qPynoi9uyrmqfgTSx6PrOIHNNfMZY71e-eXE5QFZqj8';

// ────────────────────────── column helpers ────────────────────────────────────

function colToLetter(index) {
  let letter = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

function buildColMap(headers) {
  const map = {};
  const set = (key, i) => { if (map[key] === undefined) map[key] = i; };
  headers.forEach((h, i) => {
    const lower = h.toLowerCase().trim();
    if (lower === 'name' || lower === 'full name') set('name', i);
    if (lower.includes('follower')) set('followers', i);
    else if (lower.includes('instagram') || lower === 'ig') set('instagram', i);
    if (lower.includes('email')) set('email', i);
    if (lower.includes('location') || lower.includes('city') || lower.includes('country')) set('location', i);
    if (lower.includes('niche') || lower.includes('industry') || lower.includes('category')) set('niche', i);
    if (lower.includes('engagement') || lower === 'er' || lower === 'eng rate') set('engagement', i);
  });
  return map;
}

function findWebsiteColIdx(headers) {
  return headers.findIndex(h => {
    const lower = h.toLowerCase().trim();
    return lower === 'website' || lower === 'link' || lower === 'url' ||
      lower.includes('website') ||
      (lower.includes('instagram') && (lower.includes('url') || lower.includes('link') || lower.includes('profile')));
  });
}

// Normalise an instagram cell value to a bare lowercase username
function normaliseHandle(raw) {
  return (raw || '').trim()
    .replace(/^@/, '')
    .replace(/.*instagram\.com\//, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
}

// ─────────────────────────── OAuth ───────────────────────────────────────────

async function getToken() {
  // Return cached token if still valid (with a 60-second buffer)
  const { accessToken, tokenExpiry } = await chrome.storage.local.get(['accessToken', 'tokenExpiry']);
  if (accessToken && tokenExpiry > Date.now() + 60_000) return accessToken;

  const { clientId } = await chrome.storage.sync.get('clientId');
  if (!clientId) throw new Error('SETUP_REQUIRED');

  const redirectUrl = chrome.identity.getRedirectURL('oauth2');
  const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUrl);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/spreadsheets');

  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true }, url => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (url)                 resolve(url);
      else                          reject(new Error('Auth cancelled'));
    });
  });

  const params   = new URLSearchParams(new URL(responseUrl).hash.slice(1));
  const token    = params.get('access_token');
  const expireIn = parseInt(params.get('expires_in') || '3600');

  await chrome.storage.local.set({
    accessToken: token,
    tokenExpiry: Date.now() + expireIn * 1000,
  });

  return token;
}

// ──────────────────────── Sheets API helpers ──────────────────────────────────

async function sheetsGet(token, sheetId, range) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Sheets read failed (${res.status})`);
  return res.json();
}

async function sheetsBatchUpdate(token, sheetId, updates) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: updates.map(u => ({ range: u.range, values: [[u.value]] })),
      }),
    }
  );
  if (!res.ok) throw new Error(`Sheets update failed (${res.status})`);
  return res.json();
}

async function sheetsAppend(token, sheetId, row, colCount) {
  const endCol = colToLetter(colCount - 1);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:${endCol}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] }),
    }
  );
  if (!res.ok) throw new Error(`Sheets append failed (${res.status})`);
  return res.json();
}

// ─────────────────────────── main sync logic ──────────────────────────────────

async function syncToSheet(profile) {
  const token = await getToken();

  const { sheetId: customId } = await chrome.storage.sync.get('sheetId');
  const sheetId = (customId || '').trim() || DEFAULT_SHEET_ID;

  const { values } = await sheetsGet(token, sheetId, 'A:Z');
  if (!values || values.length < 2) throw new Error('Sheet appears to be empty or has no data rows');

  const headers    = values[0];
  const colMap     = buildColMap(headers);
  const websiteIdx = findWebsiteColIdx(headers);

  if (colMap.instagram === undefined) throw new Error('No Instagram column found in the sheet');

  const username   = profile.username.toLowerCase();
  const igColIdx   = colMap.instagram;

  // ── Find an existing row for this influencer (match by normalised handle) ──
  let existingRowNum = -1;
  for (let i = 1; i < values.length; i++) {
    if (normaliseHandle(values[i][igColIdx]) === username) {
      existingRowNum = i + 1; // 1-indexed row number
      break;
    }
  }

  if (existingRowNum > 0) {
    // ── UPDATE existing row ──
    const row = existingRowNum;
    const updates = [];

    const has = key => colMap[key] !== undefined;
    const cell = key => `${colToLetter(colMap[key])}${row}`;

    if (profile.followers > 0   && has('followers'))  updates.push({ range: cell('followers'),  value: String(profile.followers) });
    if (profile.engagement != null && has('engagement')) updates.push({ range: cell('engagement'), value: `${profile.engagement}%` });
    if (profile.email             && has('email'))       updates.push({ range: cell('email'),       value: profile.email });

    // Location and niche: only fill in if currently blank
    const existingRow = values[existingRowNum - 1];
    if (profile.location && has('location') && !(existingRow[colMap.location] || '').trim())
      updates.push({ range: cell('location'), value: profile.location });
    if (profile.niche    && has('niche')    && !(existingRow[colMap.niche]    || '').trim())
      updates.push({ range: cell('niche'),    value: profile.niche });

    if (updates.length) await sheetsBatchUpdate(token, sheetId, updates);
    return { action: 'updated' };
  } else {
    // ── APPEND new row ──
    const colCount = headers.length;
    const row = Array(colCount).fill('');

    if (colMap.name      !== undefined) row[colMap.name]      = profile.name;
    if (colMap.instagram !== undefined) row[colMap.instagram] = `@${username}`;
    if (colMap.followers !== undefined && profile.followers > 0)      row[colMap.followers]  = String(profile.followers);
    if (colMap.email     !== undefined && profile.email)              row[colMap.email]      = profile.email;
    if (colMap.location  !== undefined && profile.location)           row[colMap.location]   = profile.location;
    if (colMap.niche     !== undefined && profile.niche)              row[colMap.niche]      = profile.niche;
    if (colMap.engagement !== undefined && profile.engagement != null) row[colMap.engagement] = `${profile.engagement}%`;
    if (websiteIdx >= 0) row[websiteIdx] = `https://www.instagram.com/${username}/`;

    await sheetsAppend(token, sheetId, row, colCount);
    return { action: 'added' };
  }
}

// ─────────────────────────── message handler ─────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SYNC_PROFILE') {
    syncToSheet(message.profile)
      .then(result => sendResponse({ ok: true, ...result }))
      .catch(err   => sendResponse({ ok: false, error: err.message }));
    return true; // keep the message channel open for the async response
  }

  if (message.type === 'GET_REDIRECT_URL') {
    sendResponse({ url: chrome.identity.getRedirectURL('oauth2') });
    return false;
  }

  if (message.type === 'SIGN_OUT') {
    chrome.storage.local.remove(['accessToken', 'tokenExpiry'], () => sendResponse({ ok: true }));
    return true;
  }
});
