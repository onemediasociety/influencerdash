const SHEET_ID = '1qPynoi9uyrmqfgTSx6PrOIHNNfMZY71e-eXE5QFZqj8';

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

export async function readSheetRows(accessToken) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A:Z`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets read failed (${res.status})`);
  }
  return res.json();
}

export async function writeNiches(accessToken, updates) {
  // updates: [{ range: 'F2', value: 'Fitness & Health' }]
  if (!updates.length) return;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: updates.map(u => ({ range: u.range, values: [[u.value]] })),
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets write failed (${res.status})`);
  }
  return res.json();
}

export async function buildInstagramUpdates(accessToken) {
  const { values } = await readSheetRows(accessToken);
  if (!values || values.length < 2) throw new Error('Sheet appears to be empty');

  const headers = values[0].map(h => h.toLowerCase().trim());
  const nameCol = headers.findIndex(h => h === 'name' || h === 'full name');
  const igCol = headers.findIndex(h => h.includes('instagram') && !h.includes('follower'));

  if (nameCol === -1) throw new Error('No Name column found in the sheet.');
  if (igCol === -1) throw new Error('No Instagram column found in the sheet.');

  const igLetter = colToLetter(igCol);

  const toFind = [];
  values.slice(1).forEach((row, i) => {
    const name = (row[nameCol] || '').trim();
    const ig = (row[igCol] || '').trim();
    if (name && !ig) toFind.push({ rowNum: i + 2, name });
  });

  return { toFind, igLetter };
}

export async function appendInfluencerRow(accessToken, profile) {
  const { values } = await readSheetRows(accessToken);
  if (!values || values.length < 2) throw new Error('Sheet appears to be empty');

  const headers = values[0].map(h => h.toLowerCase().trim());
  const colCount = headers.length;

  // Build a row array aligned to the sheet's existing columns
  const row = Array(colCount).fill('');
  headers.forEach((h, i) => {
    if (h === 'name' || h === 'full name') row[i] = profile.name || '';
    else if (h.includes('instagram') && !h.includes('follower')) row[i] = profile.handle || '';
    else if (h.includes('follower')) row[i] = profile.followers ? String(profile.followers) : '';
    else if (h.includes('email')) row[i] = profile.email || '';
    else if (h.includes('location') || h.includes('city')) row[i] = profile.location || '';
    else if (h.includes('niche') || h.includes('industry') || h.includes('category')) row[i] = profile.niche || '';
    else if (h.includes('engagement') || h === 'er' || h === 'eng rate') row[i] = profile.engagement != null ? `${profile.engagement}%` : '';
  });

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A:${colToLetter(colCount - 1)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets append failed (${res.status})`);
  }
  return res.json();
}

export async function buildNicheUpdates(accessToken, influencers) {
  const { values } = await readSheetRows(accessToken);
  if (!values || values.length < 2) throw new Error('Sheet appears to be empty');

  const headers = values[0].map(h => h.toLowerCase().trim());
  const igCol = headers.findIndex(h => h.includes('instagram') && !h.includes('follower'));
  const nicheCol = headers.findIndex(h => h.includes('niche') || h.includes('industry') || h.includes('category'));

  if (nicheCol === -1) throw new Error('No Niche/Industry column found. Add a column called "Niche" to your sheet.');
  const nicheLetter = colToLetter(nicheCol);

  // Build a map from normalised username → row number
  const rowMap = {};
  values.slice(1).forEach((row, i) => {
    const igVal = (row[igCol] || '').trim().replace(/^@/, '').replace(/.*instagram\.com\//, '').replace(/\/$/, '').toLowerCase();
    const existingNiche = (row[nicheCol] || '').trim();
    if (igVal && !existingNiche) rowMap[igVal] = i + 2; // +2: 1-indexed + header row
  });

  return { rowMap, nicheLetter };
}
