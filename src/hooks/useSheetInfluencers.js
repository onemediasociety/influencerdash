import { useState, useEffect, useCallback } from 'react';

const SHEET_ID = '1UDTrFqFEZcrQ3yjVoYAgFzpgSuc30S-ETAIrpL1aDDU';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field.trim()); field = ''; }
      else if (ch === '\n' || (ch === '\r' && next !== '\n')) {
        row.push(field.trim());
        field = '';
        if (row.some(f => f)) rows.push(row);
        row = [];
      } else if (ch === '\r') {
        // \r\n — skip \r, \n handled next iteration
      } else {
        field += ch;
      }
    }
  }

  if (field.trim() || row.length) {
    row.push(field.trim());
    if (row.some(f => f)) rows.push(row);
  }

  return rows;
}

function parseFollowers(str) {
  if (!str) return 0;
  const s = str.trim().replace(/,/g, '').replace(/\s/g, '');
  if (/k$/i.test(s)) return Math.round(parseFloat(s) * 1_000);
  if (/m$/i.test(s)) return Math.round(parseFloat(s) * 1_000_000);
  if (/b$/i.test(s)) return Math.round(parseFloat(s) * 1_000_000_000);
  return parseInt(s, 10) || 0;
}

function parseLocation(str) {
  if (!str) return { city: '', country: '' };
  const parts = str.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { city: parts[0], country: parts[parts.length - 1] };
  return { city: parts[0] || '', country: parts[0] || '' };
}

function parseInstagram(str) {
  if (!str) return { handle: '', url: '', username: '' };
  const s = str.trim();

  const urlMatch = s.match(/instagram\.com\/([^\/\?\s#]+)/i);
  if (urlMatch) {
    const username = urlMatch[1].replace(/\/$/, '');
    return { handle: `@${username}`, url: `https://www.instagram.com/${username}/`, username };
  }
  if (s.startsWith('@')) {
    const username = s.slice(1);
    return { handle: s, url: `https://www.instagram.com/${username}/`, username };
  }
  // plain handle
  return { handle: `@${s}`, url: `https://www.instagram.com/${s}/`, username: s };
}

function handleToName(username) {
  return username
    .split(/[_.\-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function rowToInfluencer(row, colMap, index) {
  const get = key => (row[colMap[key]] || '').trim();

  const igRaw = get('instagram');
  const { handle, url, username } = parseInstagram(igRaw);
  const name = username ? handleToName(username) : `Influencer ${index + 1}`;
  const followers = parseFollowers(get('followers'));
  const email = get('email');
  const { city, country } = parseLocation(get('location'));
  const industry = get('industry');

  // Try Instagram profile photo via unavatar.io, fall back to letter avatar
  const avatar = username
    ? `https://unavatar.io/instagram/${username}`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8b5cf6&color=fff&size=150&bold=true`;
  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8b5cf6&color=fff&size=150&bold=true`;

  return {
    id: `sheet_${index}_${username || index}`,
    name,
    handle,
    avatar,
    avatarFallback,
    country,
    city,
    industry,
    bio: '',
    followers,
    engagement: null,
    platforms: ['Instagram'],
    email,
    website: url,
    instagramUrl: url,
    languages: [],
    avgLikes: null,
    avgViews: null,
    pricePerPost: null,
    source: 'sheet',
  };
}

function buildColMap(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const lower = h.toLowerCase().trim();
    // Check 'follower' before 'instagram' so "Instagram Followers" maps to followers, not instagram
    if (lower.includes('follower')) map['followers'] = i;
    else if (lower.includes('instagram')) map['instagram'] = i;
    if (lower.includes('email')) map['email'] = i;
    if (lower.includes('location') || lower.includes('city') || lower.includes('country')) map['location'] = i;
    if (lower.includes('niche') || lower.includes('industry') || lower.includes('category')) map['industry'] = i;
  });
  return map;
}

export function useSheetInfluencers() {
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const sync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(CSV_URL);
      if (!res.ok) throw new Error(`Could not reach the sheet (HTTP ${res.status}). Make sure it's shared as "Anyone with the link can view".`);
      const text = await res.text();
      const rows = parseCSV(text);
      if (rows.length < 2) { setInfluencers([]); setLoading(false); return; }

      const colMap = buildColMap(rows[0]);
      const data = rows
        .slice(1)
        .filter(row => row.some(f => f))
        .map((row, i) => rowToInfluencer(row, colMap, i))
        .filter(inf => inf.handle); // skip completely blank rows

      setInfluencers(data);
      setLastSync(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { sync(); }, [sync]);

  return { influencers, loading, error, sync, lastSync };
}
