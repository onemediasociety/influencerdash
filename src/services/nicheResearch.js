const BLOCKED_PATHS = new Set(['p', 'reel', 'reels', 'explore', 'accounts', 'stories', 'tv', 'about', 'legal', 'privacy', 'help', 'press', 'api', 'directory', 'hashtag', 'locations', 'web', 'ar', 'lite', 'music', 'direct', 'shop', 'tags', 's']);

function extractIgHandles(html) {
  const matches = [...html.matchAll(/instagram\.com\/([a-zA-Z0-9._]{1,30})/g)];
  return matches
    .map(m => m[1].replace(/\/$/, ''))
    .filter(u => u && !BLOCKED_PATHS.has(u.toLowerCase()));
}

function mostFrequent(candidates) {
  if (!candidates.length) return null;
  const freq = {};
  for (const c of candidates) freq[c.toLowerCase()] = (freq[c.toLowerCase()] || 0) + 1;
  const topKey = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  return candidates.find(c => c.toLowerCase() === topKey) || null;
}

// Parse "1.2M", "12.5K", "1,234,567" → integer
function parseFollowerStr(s) {
  const clean = s.replace(/,/g, '').trim();
  const m = clean.match(/^([\d.]+)\s*([KMBkmb])?$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const mult = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[m[2]?.toLowerCase()] || 1;
  return Math.round(n * mult);
}

// Instagram's meta description indexed by DuckDuckGo:
// "1.2M Followers, 456 Following, 789 Posts - See Instagram photos..."
function extractFollowersFromHtml(html) {
  const m = html.match(/([\d,.]+\s*[KMBkmb]?)\s*[Ff]ollowers[,\s]/);
  return m ? parseFollowerStr(m[1].trim()) : 0;
}

// Returns { handle: '@username', followers: <number> } or null
export async function lookupInstagramHandle(name) {
  if (!name) return null;

  // Try two DuckDuckGo variants — lite is less aggressively bot-blocked
  const queries = [
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(`"${name}" site:instagram.com`)}`,
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${name}" site:instagram.com`)}`,
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(`${name} instagram`)}`,
  ];

  for (const searchUrl of queries) {
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;

      const data = await res.json();
      const html = data.contents || '';

      if (html.length < 500 || html.includes('captcha') || html.includes('unusual traffic')) continue;

      const candidates = extractIgHandles(html);
      const best = mostFrequent(candidates);
      if (best) {
        return { handle: `@${best}`, followers: extractFollowersFromHtml(html) };
      }
    } catch {
      continue;
    }
  }

  return null;
}

const NICHES = [
  { name: 'Fitness & Health', keywords: /fitness|workout|gym|health|nutrition|trainer|wellness|yoga|pilates|hiit|bodybuilding|crossfit/ },
  { name: 'Food & Cuisine', keywords: /food|recipe|chef|cook|cuisine|restaurant|baking|pastry|foodie|eating|dinner|brunch|bbq/ },
  { name: 'Travel', keywords: /travel|explore|wanderlust|adventure|hotel|destination|nomad|backpack|trip|vacation|tourist/ },
  { name: 'Fashion & Beauty', keywords: /fashion|style|beauty|makeup|skincare|ootd|outfit|model|clothing|glam|cosmetic|luxury|hair/ },
  { name: 'Technology', keywords: /tech|software|developer|coding|ai|startup|engineering|programmer|digital|innovation|saas/ },
  { name: 'Gaming', keywords: /gaming|gamer|game|esports|stream|twitch|nintendo|playstation|xbox|minecraft|fortnite/ },
  { name: 'Music', keywords: /music|singer|musician|rapper|dj|album|concert|band|producer|songwriter|hiphop|pop/ },
  { name: 'Comedy & Entertainment', keywords: /comedy|funny|humor|comedian|sketch|meme|entertainer|skit|laugh|viral|prank/ },
  { name: 'Art & Design', keywords: /art|design|creative|artist|illustrator|photographer|paint|draw|graphic|visual|gallery/ },
  { name: 'Business & Finance', keywords: /finance|invest|money|entrepreneur|business|crypto|stock|wealth|startup|ceo|founder|trading/ },
  { name: 'Parenting', keywords: /parent|mom|dad|family|baby|kids|children|motherhood|fatherhood|toddler|newborn|pregnancy/ },
  { name: 'Sports', keywords: /sport|football|basketball|soccer|tennis|athlete|nfl|nba|baseball|golf|boxing|mma|rugby/ },
  { name: 'Education', keywords: /education|learn|teach|professor|student|school|university|tutor|mentor|knowledge|course/ },
  { name: 'Sustainability', keywords: /sustainable|eco|environment|green|zero.?waste|climate|organic|vegan|planet|recycle/ },
];

export function classifyNiche(text) {
  const lower = (text || '').toLowerCase();
  for (const { name, keywords } of NICHES) {
    if (keywords.test(lower)) return name;
  }
  return 'Lifestyle';
}

export async function lookupNiche(username) {
  const clean = (username || '').replace(/^@/, '').toLowerCase().trim();
  if (!clean) return null;

  // Try allorigins.win CORS proxy to fetch Instagram page
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://www.instagram.com/${clean}/`)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json();
      const html = data.contents || '';

      const bioMatch = html.match(/"biography":"([^"]{0,400})"/);
      const categoryMatch = html.match(/"category_name":"([^"]+)"/i) || html.match(/"category":"([^"]+)"/i);
      const ogDesc = html.match(/property="og:description"\s+content="([^"]+)"/i);

      const category = categoryMatch ? categoryMatch[1] : '';
      const bio = bioMatch ? JSON.parse(`"${bioMatch[1]}"`) : (ogDesc ? ogDesc[1] : '');
      return classifyNiche(`${category} ${bio} ${clean}`);
    }
  } catch {}

  // Fallback: classify from username alone
  return classifyNiche(clean);
}
