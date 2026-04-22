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
