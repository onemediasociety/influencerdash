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

async function proxyFetch(url, timeout = 14000) {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(timeout) });
  if (!res.ok) return null;
  const wrapper = await res.json();
  return wrapper.contents || null;
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

  // --- Strategy 1: Instagram's internal JSON API (structured, easier to parse) ---
  try {
    const raw = await proxyFetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`
    );
    if (raw) {
      const json = JSON.parse(raw);
      const user = json?.data?.user;
      if (user && (user.edge_followed_by?.count || user.biography != null)) {
        if (user.full_name)               result.name      = user.full_name;
        if (user.biography)               result.bio       = user.biography;
        if (user.edge_followed_by?.count) result.followers = user.edge_followed_by.count;
        const bio = user.biography || '';
        result.email    = extractEmail(bio);
        result.location = extractLocation(bio);
        result.niche    = classifyNiche(`${user.category_name || ''} ${bio} ${username}`);

        // Engagement rate from post data bundled in the API response
        const posts = user.edge_owner_to_timeline_media?.edges || [];
        if (posts.length >= 3 && result.followers > 0) {
          const avgLikes    = posts.reduce((s, p) => s + (p.node?.edge_liked_by?.count    || 0), 0) / posts.length;
          const avgComments = posts.reduce((s, p) => s + (p.node?.edge_media_to_comment?.count || 0), 0) / posts.length;
          const rate = (avgLikes + avgComments) / result.followers * 100;
          if (rate > 0 && rate < 100) result.engagement = parseFloat(rate.toFixed(2));
        }

        return result;
      }
    }
  } catch {}

  // --- Strategy 2: profile HTML page ---
  try {
    const html = await proxyFetch(`https://www.instagram.com/${username}/`);
    if (html && html.length > 1000) {
      const bioMatch       = html.match(/"biography":"([^"]{0,600})"/);
      const nameMatch      = html.match(/"full_name":"([^"]+)"/);
      const followersMatch = html.match(/"edge_followed_by":\{"count":(\d+)\}/);
      const categoryMatch  = html.match(/"category_name":"([^"]+)"/i);

      const bio      = bioMatch  ? safeJsonDecode(bioMatch[1])  : '';
      const fullName = nameMatch ? safeJsonDecode(nameMatch[1]) : '';

      if (fullName)      result.name      = fullName;
      if (bio)           result.bio       = bio;
      if (followersMatch) result.followers = parseInt(followersMatch[1]);

      result.email    = extractEmail(bio);
      result.location = extractLocation(bio);
      result.niche    = classifyNiche(`${categoryMatch ? categoryMatch[1] : ''} ${bio} ${username}`);

      // Best-effort engagement rate from recent post likes + comments
      if (result.followers > 0) {
        const likesMatches    = [...html.matchAll(/"edge_liked_by":\{"count":(\d+)\}/g)].slice(0, 12);
        const commentsMatches = [...html.matchAll(/"edge_media_to_comment":\{"count":(\d+)\}/g)].slice(0, 12);
        if (likesMatches.length >= 3) {
          const avgLikes    = likesMatches.reduce((s, m) => s + parseInt(m[1]), 0) / likesMatches.length;
          const avgComments = commentsMatches.length > 0
            ? commentsMatches.reduce((s, m) => s + parseInt(m[1]), 0) / commentsMatches.length : 0;
          const rate = (avgLikes + avgComments) / result.followers * 100;
          if (rate > 0 && rate < 100) result.engagement = parseFloat(rate.toFixed(2));
        }
      }
    }
  } catch {}

  // If we still have no niche, derive from username alone
  if (!result.niche) result.niche = classifyNiche(username);

  return result;
}
