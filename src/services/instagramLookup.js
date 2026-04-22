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

export async function lookupInstagramProfile(input) {
  // Accept handle, @handle, or full URL
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
    email: '',
    location: '',
    niche: '',
    bio: '',
    instagramUrl: `https://www.instagram.com/${username}/`,
    avatar: `https://unavatar.io/instagram/${username}`,
    avatarFallback: `https://ui-avatars.com/api/?name=${encodeURIComponent(usernameToName(username))}&background=8b5cf6&color=fff&size=150`,
    source: 'sheet',
  };

  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://www.instagram.com/${username}/`)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });

    if (res.ok) {
      const data = await res.json();
      const html = data.contents || '';

      const bioMatch = html.match(/"biography":"([^"]{0,600})"/);
      const nameMatch = html.match(/"full_name":"([^"]+)"/);
      const followersMatch = html.match(/"edge_followed_by":\{"count":(\d+)\}/);
      const categoryMatch = html.match(/"category_name":"([^"]+)"/i);

      const bio = bioMatch ? safeJsonDecode(bioMatch[1]) : '';
      const fullName = nameMatch ? safeJsonDecode(nameMatch[1]) : '';

      if (fullName) result.name = fullName;
      if (bio) result.bio = bio;
      if (followersMatch) result.followers = parseInt(followersMatch[1]);

      result.email = extractEmail(bio);
      result.location = extractLocation(bio);
      result.niche = classifyNiche(`${categoryMatch ? categoryMatch[1] : ''} ${bio} ${username}`);
    }
  } catch {
    // Proxy failed — return best-effort result from username alone
    result.niche = classifyNiche(username);
  }

  return result;
}
