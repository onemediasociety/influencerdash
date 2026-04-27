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

// Detects a "website / link / url" column that should receive the full IG profile URL.
// Matches common names like "Website", "Link", "URL", "Instagram URL", "Profile Link", etc.
function findWebsiteCol(headers) {
  return headers.findIndex(h =>
    h === 'website' || h === 'link' || h === 'url' ||
    h === 'profile link' || h === 'profile url' || h === 'ig url' || h === 'ig link' ||
    h.includes('website') ||
    (h.includes('instagram') && (h.includes('url') || h.includes('link') || h.includes('profile')))
  );
}

export async function buildInstagramUpdates(accessToken) {
  const { values } = await readSheetRows(accessToken);
  if (!values || values.length < 2) throw new Error('Sheet appears to be empty');

  const headers = values[0].map(h => h.toLowerCase().trim());
  const nameCol    = headers.findIndex(h => h === 'name' || h === 'full name');
  const igCol      = headers.findIndex(h => h.includes('instagram') && !h.includes('follower'));
  const followCol  = headers.findIndex(h => h.includes('follower'));
  const emailCol   = headers.findIndex(h => h.includes('email'));
  const locCol     = headers.findIndex(h => h.includes('location') || h.includes('city') || h.includes('country'));
  const nicheCol   = headers.findIndex(h => h.includes('niche') || h.includes('industry') || h.includes('category'));
  const engCol     = headers.findIndex(h => h.includes('engagement') || h === 'er' || h === 'eng rate');
  const websiteCol = findWebsiteCol(headers);

  if (nameCol === -1) throw new Error('No Name column found in the sheet.');
  if (igCol === -1) throw new Error('No Instagram column found in the sheet.');

  const cols = {
    ig:         colToLetter(igCol),
    website:    websiteCol >= 0 ? colToLetter(websiteCol) : null,
    followers:  followCol  >= 0 ? colToLetter(followCol)  : null,
    email:      emailCol   >= 0 ? colToLetter(emailCol)   : null,
    location:   locCol     >= 0 ? colToLetter(locCol)     : null,
    niche:      nicheCol   >= 0 ? colToLetter(nicheCol)   : null,
    engagement: engCol     >= 0 ? colToLetter(engCol)     : null,
  };

  const toFind = [];
  values.slice(1).forEach((row, i) => {
    const name = (row[nameCol] || '').trim();
    const ig   = (row[igCol]   || '').trim();
    if (name && !ig) toFind.push({
      rowNum: i + 2,
      name,
      current: {
        email:    (row[emailCol]  || '').trim(),
        location: (row[locCol]    || '').trim(),
        niche:    (row[nicheCol]  || '').trim(),
      },
    });
  });

  return { toFind, cols };
}

export async function appendInfluencerRow(accessToken, profile) {
  const { values } = await readSheetRows(accessToken);
  if (!values || values.length < 2) throw new Error('Sheet appears to be empty');

  const headers = values[0].map(h => h.toLowerCase().trim());
  const colCount = headers.length;

  // Build a row array aligned to the sheet's existing columns
  const row = Array(colCount).fill('');
  const websiteColIdx = findWebsiteCol(headers);
  const igUsername = (profile.handle || '').replace(/^@/, '');
  const igUrl = igUsername ? `https://www.instagram.com/${igUsername}/` : '';

  headers.forEach((h, i) => {
    if (h === 'name' || h === 'full name') row[i] = profile.name || '';
    else if (h.includes('instagram') && !h.includes('follower')) row[i] = profile.handle || '';
    else if (h.includes('follower')) row[i] = profile.followers ? String(profile.followers) : '';
    else if (h.includes('email')) row[i] = profile.email || '';
    else if (h.includes('location') || h.includes('city')) row[i] = profile.location || '';
    else if (h.includes('niche') || h.includes('industry') || h.includes('category')) row[i] = profile.niche || '';
    else if (h.includes('engagement') || h === 'er' || h === 'eng rate') row[i] = profile.engagement != null ? `${profile.engagement}%` : '';
    else if (['photo','avatar','photo url','profile photo','profile pic','image'].includes(h)) row[i] = profile.photoUrl || '';
  });

  // Write the full Instagram URL to the website/link column if one exists
  if (websiteColIdx >= 0 && igUrl) row[websiteColIdx] = igUrl;

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

export async function buildRefreshUpdates(accessToken) {
  const { values } = await readSheetRows(accessToken);
  if (!values || values.length < 2) throw new Error('Sheet appears to be empty');

  const headers = values[0].map(h => h.toLowerCase().trim());
  const igCol      = headers.findIndex(h => h.includes('instagram') && !h.includes('follower'));
  const followCol  = headers.findIndex(h => h.includes('follower'));
  const emailCol   = headers.findIndex(h => h.includes('email'));
  const locCol     = headers.findIndex(h => h.includes('location') || h.includes('city') || h.includes('country'));
  const nicheCol   = headers.findIndex(h => h.includes('niche') || h.includes('industry') || h.includes('category'));
  const engCol     = headers.findIndex(h => h.includes('engagement') || h === 'er' || h === 'eng rate');
  const websiteCol = findWebsiteCol(headers);

  if (igCol === -1) throw new Error('No Instagram column found in the sheet.');

  const toRefresh = [];
  values.slice(1).forEach((row, i) => {
    const igRaw = (row[igCol] || '').trim();
    const username = igRaw.replace(/^@/, '').replace(/.*instagram\.com\//, '').replace(/[/?#].*$/, '').toLowerCase();
    if (!username) return;
    toRefresh.push({
      rowNum: i + 2,
      username,
      current: {
        email:    (row[emailCol]   || '').trim(),
        location: (row[locCol]     || '').trim(),
        niche:    (row[nicheCol]   || '').trim(),
        website:  (row[websiteCol] || '').trim(),
      },
      cols: {
        followers:  followCol  >= 0 ? colToLetter(followCol)  : null,
        email:      emailCol   >= 0 ? colToLetter(emailCol)   : null,
        location:   locCol     >= 0 ? colToLetter(locCol)     : null,
        niche:      nicheCol   >= 0 ? colToLetter(nicheCol)   : null,
        engagement: engCol     >= 0 ? colToLetter(engCol)     : null,
        website:    websiteCol >= 0 ? colToLetter(websiteCol) : null,
      },
    });
  });

  return toRefresh;
}

// rowNums: 1-indexed row numbers (e.g. [3, 7, 12]). Must be sorted descending so
// deleting later rows first doesn't shift earlier row indices.
export async function deleteSheetRows(accessToken, rowNums) {
  if (!rowNums.length) return;
  const sorted = [...rowNums].sort((a, b) => b - a);
  const requests = sorted.map(rowNum => ({
    deleteDimension: {
      range: {
        sheetId: 0,
        dimension: 'ROWS',
        startIndex: rowNum - 1, // 0-indexed
        endIndex: rowNum,
      },
    },
  }));
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets delete failed (${res.status})`);
  }
  return res.json();
}

// Groups sheet rows by normalised Instagram handle, picks the best row for each
// duplicate group (most data filled in, then highest follower count), merges any
// missing values from dupes into the winner, and returns the rows to delete.
export async function findAndMergeDuplicates(accessToken) {
  const { values } = await readSheetRows(accessToken);
  if (!values || values.length < 2) return { mergeUpdates: [], rowsToDelete: [], duplicateCount: 0 };

  const headers = values[0].map(h => h.toLowerCase().trim());
  const igCol = headers.findIndex(h => h.includes('instagram') && !h.includes('follower'));
  if (igCol === -1) throw new Error('No Instagram column found in the sheet');
  const followCol = headers.findIndex(h => h.includes('follower'));

  function normalizeHandle(raw) {
    return (raw || '').trim()
      .replace(/^@/, '')
      .replace(/.*instagram\.com\//, '')
      .replace(/[/?#].*$/, '')
      .toLowerCase();
  }

  // Group rows by normalised handle
  const groups = {};
  values.slice(1).forEach((row, i) => {
    const handle = normalizeHandle(row[igCol] || '');
    if (!handle) return;
    if (!groups[handle]) groups[handle] = [];
    groups[handle].push({ rowNum: i + 2, row: [...row] }); // i+2 = 1-indexed + skip header
  });

  const rowsToDelete = [];
  const mergeUpdates = [];
  let duplicateCount = 0;

  for (const entries of Object.values(groups)) {
    if (entries.length <= 1) continue;
    duplicateCount++;

    // Score each row: most non-empty cells wins; break ties by follower count
    const scored = entries.map(({ rowNum, row }) => {
      const rawFollowers = followCol >= 0 ? (row[followCol] || '') : '';
      const followers = parseInt(rawFollowers.replace(/[^0-9]/g, '')) || 0;
      return { rowNum, row, score: row.filter(c => (c || '').trim()).length, followers };
    });
    scored.sort((a, b) => b.score - a.score || b.followers - a.followers);

    const winner = scored[0];
    const dupes  = scored.slice(1);

    // Merge missing cells from dupes into winner
    const merged = [...winner.row];
    while (merged.length < headers.length) merged.push('');

    for (const dup of dupes) {
      dup.row.forEach((cell, i) => {
        if ((cell || '').trim() && !(merged[i] || '').trim()) merged[i] = cell;
      });
      rowsToDelete.push(dup.rowNum);
    }

    // Queue cell updates for any newly filled values
    merged.forEach((cell, i) => {
      const orig = (winner.row[i] || '').trim();
      const now  = (cell || '').trim();
      if (now && now !== orig) {
        mergeUpdates.push({ range: `${colToLetter(i)}${winner.rowNum}`, value: cell });
      }
    });
  }

  return { mergeUpdates, rowsToDelete, duplicateCount };
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
