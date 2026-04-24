import { classifyNiche } from './nicheResearch';

function safeJsonDecode(str) {
  try { return JSON.parse(`"${str}"`); } catch { return str; }
}

function extractEmail(text) {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}

function extractLocation(text) {
  const patterns = [
    /📍\s*([A-Za-z][A-Za-z\s,.\-]{1,40}?)(?:\s*[\n|•]|$)/,
    /based\s+in\s+([A-Za-z][A-Za-z\s,]{1,30}?)(?:\s*[\n|•·]|$)/i,
    /located\s+in\s+([A-Za-z][A-Za-z\s,]{1,30}?)(?:\s*[\n|•·]|$)/i,
    /from\s+([A-Za-z][A-Za-z\s,]{1,30}?)(?:\s*[\n|•·]|$)/i,
    /🌍\s*([A-Za-z][A-Za-z\s,]{1,30}?)(?:\s*[\n|•·]|$)/,
    /🌎\s*([A-Za-z][A-Za-z\s,]{1,30}?)(?:\s*[\n|•·]|$)/,
    /🌏\s*([A-Za-z][A-Za-z\s,]{1,30}?)(?:\s*[\n|•·]|$)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim().replace(/[,.\s]+$/, '');
  }
  return '';
}

function usernameToName(username) {
  return username
    .split(/[_.\-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// Parse "1.2M", "12.5K", "1,234,567" → integer
function parseFollowerStr(s) {
  const clean = (s || '').replace(/,/g, '').trim();
  const m = clean.match(/^([\d.]+)\s*([KMBkmb])?$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const mult = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[m[2]?.toLowerCase()] || 1;
  return Math.round(n * mult);
}

async function proxyFetch(url, timeout = 14000) {
  // allorigins wraps response in { contents: string }
  try {
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(timeout) });
    if (res.ok) {
      const body = await res.json().catch(() => null);
      if (body?.contents) return body.contents;
    }
  } catch {}

  // corsproxy returns the raw response body directly (text or JSON)
  try {
    const res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(timeout) });
    if (res.ok) {
      const text = await res.text().catch(() => null);
      if (text) return text;
    }
  } catch {}

  return null;
}

// DuckDuckGo search snippets include Instagram's meta description which contains
// "X Followers, Y Following, Z Posts" — reliable when Instagram blocks direct access.
async function searchForFollowers(username) {
  const queries = [
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(`site:instagram.com/${username}`)}`,
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(`"@${username}" instagram`)}`,
  ];
  for (const searchUrl of queries) {
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const data = await res.json();
      const html = data.contents || '';
      if (html.length < 500 || html.includes('captcha') || html.includes('unusual traffic')) continue;
      const m = html.match(/([\d,.]+\s*[KMBkmb]?)\s*[Ff]ollowers[,\s]/);
      if (m) {
        const count = parseFollowerStr(m[1].trim());
        if (count > 0) return count;
      }
    } catch {}
  }
  return 0;
}

function computeEngagement(posts, followers) {
  if (!posts.length || followers <= 0) return null;
  const avgLikes    = posts.reduce((s, p) => s + (p.node?.edge_liked_by?.count    || 0), 0) / posts.length;
  const avgComments = posts.reduce((s, p) => s + (p.node?.edge_media_to_comment?.count || 0), 0) / posts.length;
  const rate = (avgLikes + avgComments) / followers * 100;
  return (rate > 0 && rate < 100) ? parseFloat(rate.toFixed(2)) : null;
}

export async function lookupInstagramProfile(input) {
  const username = input
    .trim()
    .replace(/^@/, '')
    .replace(/.*instagram\.com\//, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();

  if (!username) throw new Error('Please enter a valid Instagram handle or URL.');

  const result = {
    handle: `@${username}`,
    name: usernameToName(username),
    followers: 0,
    engagement: null,
    email: '',
    location: '',
    niche: '',
    bio: '',
    instagramUrl: `https://www.instagram.com/${username}/`,
    avatar: `https://unavatar.io/instagram/${username}`,
    avatarFallback: `https://ui-avatars.com/api/?name=${encodeURIComponent(usernameToName(username))}&background=8b5cf6&color=fff&size=150`,
    source: 'sheet',
  };

  // --- Strategy 1: Instagram's internal JSON API ---
  let gotUserData = false;
  try {
    const raw = await proxyFetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`);
    if (raw) {
      const json = JSON.parse(raw);
      if (json?.status === 'fail' || json?.message === 'user_not_found') return { ...result, notFound: true };
      const user = json?.data?.user;
      if (user === null) return { ...result, notFound: true };
      if (user && (user.edge_followed_by?.count || user.biography != null)) {
        gotUserData = true;
        if (user.full_name)               result.name      = user.full_name;
        if (user.biography)               result.bio       = user.biography;
        if (user.edge_followed_by?.count) result.followers = user.edge_followed_by.count;
        const bio = user.biography || '';
        result.email    = extractEmail(bio);
        // Prefer the structured city/state field, fall back to bio text parsing
        result.location = user.city_name || user.location_city || extractLocation(bio);
        result.niche    = classifyNiche(`${user.category_name || ''} ${bio} ${username}`);
        const posts = user.edge_owner_to_timeline_media?.edges || [];
        result.engagement = computeEngagement(posts, result.followers);
      }
    }
  } catch {}

  if (gotUserData && result.engagement !== null) return result;

  // --- Strategy 2: profile HTML page ---
  try {
    const html = await proxyFetch(`https://www.instagram.com/${username}/`);
    if (html && html.length > 1000) {
      if (html.includes("Sorry, this page isn") || html.includes('page_not_found') || html.includes('"user_not_found"')) {
        return { ...result, notFound: true };
      }
      if (!gotUserData) {
        const bioMatch       = html.match(/"biography":"([^"]{0,600})"/);
        const nameMatch      = html.match(/"full_name":"([^"]+)"/);
        const followersMatch = html.match(/"edge_followed_by":\{"count":(\d+)\}/);
        const categoryMatch  = html.match(/"category_name":"([^"]+)"/i);
        const cityMatch      = html.match(/"city_name":"([^"]+)"/i);
        const ogDescMatch    = html.match(/property="og:description"\s+content="([^"]+)"/i)
                            || html.match(/name="description"\s+content="([^"]+)"/i);
        const bio      = bioMatch  ? safeJsonDecode(bioMatch[1])  : '';
        const fullName = nameMatch ? safeJsonDecode(nameMatch[1]) : '';
        if (fullName)       result.name      = fullName;
        if (bio)            result.bio       = bio;
        if (followersMatch) result.followers = parseInt(followersMatch[1]);
        result.email    = extractEmail(bio);
        // Try structured city first, then bio text, then og:description text
        result.location = (cityMatch ? safeJsonDecode(cityMatch[1]) : '')
          || extractLocation(bio)
          || extractLocation(ogDescMatch ? ogDescMatch[1] : '');
        result.niche    = classifyNiche(`${categoryMatch ? categoryMatch[1] : ''} ${bio} ${username}`);
      }
      if (result.engagement === null && result.followers > 0) {
        const likesMatches    = [...html.matchAll(/"edge_liked_by":\{"count":(\d+)\}/g)].slice(0, 12);
        const commentsMatches = [...html.matchAll(/"edge_media_to_comment":\{"count":(\d+)\}/g)].slice(0, 12);
        if (likesMatches.length >= 1) {
          const avgLikes    = likesMatches.reduce((s, m) => s + parseInt(m[1]), 0) / likesMatches.length;
          const avgComments = commentsMatches.length > 0
            ? commentsMatches.reduce((s, m) => s + parseInt(m[1]), 0) / commentsMatches.length : 0;
          const rate = (avgLikes + avgComments) / result.followers * 100;
          if (rate > 0 && rate < 100) result.engagement = parseFloat(rate.toFixed(2));
        }
      }
    }
  } catch {}

  // --- Strategy 3: ?__a=1 JSON endpoint (sometimes still returns full GraphQL response) ---
  if (result.engagement === null) {
    try {
      const raw = await proxyFetch(`https://www.instagram.com/${username}/?__a=1&__d=dis`);
      if (raw) {
        const json = JSON.parse(raw);
        const user = json?.graphql?.user || json?.data?.user;
        if (user) {
          if (!gotUserData) {
            if (user.full_name)               result.name      = user.full_name;
            if (user.biography)               result.bio       = user.biography;
            if (user.edge_followed_by?.count) result.followers = user.edge_followed_by.count;
            const bio = user.biography || '';
            result.email    = extractEmail(bio);
            result.location = user.city_name || user.location_city || extractLocation(bio);
            result.niche    = classifyNiche(`${user.category_name || ''} ${bio} ${username}`);
            gotUserData = true;
          }
          const posts = user.edge_owner_to_timeline_media?.edges || [];
          result.engagement = computeEngagement(posts, result.followers);
        }
      }
    } catch {}
  }

  // --- Strategy 4: DuckDuckGo search snippet for follower count ---
  // Instagram's cached meta descriptions reliably include "X Followers, Y Following, Z Posts".
  if (result.followers === 0) {
    try {
      const count = await searchForFollowers(username);
      if (count > 0) result.followers = count;
    } catch {}
  }

  if (!result.niche) result.niche = classifyNiche(username);

  return result;
}
