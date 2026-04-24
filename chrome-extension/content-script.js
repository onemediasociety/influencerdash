// Content script — runs on every instagram.com page.
// Accumulates profile data from page-script API interception.
// Does NOT auto-sync — responds to GET_CURRENT_PROFILE from the popup instead.

const BLOCKED = new Set([
  'p','reel','reels','explore','accounts','stories','tv','about','legal',
  'privacy','help','api','directory','hashtag','locations','web','lite',
  'music','direct','shop','tags','s','_n','graphql',
]);

// ─────────────────────────── helpers ────────────────────────────────────────

function parseCount(str) {
  const clean = (str || '').replace(/,/g, '').trim();
  const m = clean.match(/^([\d.]+)\s*([KMBkmb])?/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[m[2]?.toLowerCase()] || 1;
  return Math.round(n * mult);
}

function extractEmail(text) {
  const m = (text || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}

function extractLocation(text) {
  const patterns = [
    /📍\s*([A-Za-z][A-Za-z\s,.\-]{1,40}?)(?:\s*[\n|•]|$)/,
    /based\s+in\s+([A-Za-z][A-Za-z\s,]{1,30}?)(?:\s*[\n|•·]|$)/i,
    /located\s+in\s+([A-Za-z][A-Za-z\s,]{1,30}?)(?:\s*[\n|•·]|$)/i,
    /from\s+([A-Za-z][A-Za-z\s,]{1,30}?)(?:\s*[\n|•·]|$)/i,
  ];
  for (const p of patterns) {
    const m = text?.match(p);
    if (m) return m[1].trim().replace(/[,.\s]+$/, '');
  }
  return '';
}

const NICHES = [
  { name: 'Fitness & Health',       kw: /fitness|workout|gym|health|nutrition|trainer|wellness|yoga|pilates|hiit/ },
  { name: 'Food & Cuisine',         kw: /food|recipe|chef|cook|cuisine|restaurant|baking|pastry|foodie/ },
  { name: 'Travel',                 kw: /travel|explore|wanderlust|adventure|hotel|destination|nomad|backpack/ },
  { name: 'Fashion & Beauty',       kw: /fashion|style|beauty|makeup|skincare|ootd|outfit|model|clothing|glam/ },
  { name: 'Technology',             kw: /tech|software|developer|coding|ai|startup|engineering|programmer/ },
  { name: 'Gaming',                 kw: /gaming|gamer|game|esports|stream|twitch|nintendo|playstation|xbox/ },
  { name: 'Music',                  kw: /music|singer|musician|rapper|dj|album|concert|band|producer/ },
  { name: 'Comedy & Entertainment', kw: /comedy|funny|humor|comedian|sketch|meme|entertainer|skit/ },
  { name: 'Podcast & Media',        kw: /podcast|podcaster|\bhost\b|episode|radio|broadcaster|media|interview/ },
  { name: 'Art & Design',           kw: /art|design|creative|artist|illustrator|photographer|paint|draw|graphic/ },
  { name: 'Business & Finance',     kw: /finance|invest|money|entrepreneur|business|crypto|stock|wealth|ceo/ },
  { name: 'Parenting',              kw: /parent|\bmom\b|\bdad\b|family|baby|\bkids\b|children|motherhood|fatherhood/ },
  { name: 'Sports',                 kw: /sport|football|basketball|soccer|tennis|athlete|nfl|nba|baseball|golf/ },
  { name: 'Education',              kw: /education|learn|teach|professor|student|school|university|tutor/ },
  { name: 'Sustainability',         kw: /sustainable|eco|environment|green|zero.?waste|climate|organic|vegan/ },
];

function classifyNiche(text) {
  const lower = (text || '').toLowerCase();
  for (const { name, kw } of NICHES) if (kw.test(lower)) return name;
  return 'Lifestyle';
}

// ───────────────────────── profile URL detection ─────────────────────────────

function getProfileUsername() {
  const path = location.pathname.replace(/^\/|\/$/g, '');
  if (!path) return null;
  const [segment, sub] = path.split('/');
  if (!segment || sub || BLOCKED.has(segment.toLowerCase())) return null;
  return segment.toLowerCase();
}

// ─────────────── DOM + script-tag data extraction (fallback) ─────────────────

function extractFollowersFromScripts() {
  const patterns = [
    /"follower_count":(\d+)/,
    /"edge_followed_by":\{"count":(\d+)\}/,
    /"followed_by_count":(\d+)/,
  ];
  for (const script of document.querySelectorAll('script')) {
    const text = script.textContent;
    if (!text || !text.includes('follower')) continue;
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return parseInt(m[1], 10);
    }
  }
  return 0;
}

function extractFromDom(username) {
  const profile = {
    username,
    name: '',
    followers: 0,
    engagement: null,
    email: '',
    location: '',
    niche: '',
    bio: '',
  };

  // ── Name ──
  const nameSelectors = [
    'header h1', 'header h2',
    'section h1', 'section h2',
    '[data-testid="user-name"]',
  ];
  for (const sel of nameSelectors) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim()) { profile.name = el.textContent.trim(); break; }
  }

  // ── Bio ──
  const bioSelectors = [
    'header section div span',
    '[data-testid="user-description"] span',
    'header div[class] > span',
  ];
  let bioText = '';
  for (const sel of bioSelectors) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim().length > 10) { bioText = el.textContent.trim(); break; }
  }
  if (bioText) {
    profile.bio      = bioText;
    profile.email    = extractEmail(bioText);
    profile.location = extractLocation(bioText);
  }

  if (!profile.email) {
    const mailtoEl = document.querySelector('a[href^="mailto:"]');
    if (mailtoEl) profile.email = mailtoEl.href.replace('mailto:', '').split('?')[0];
  }

  // ── Followers — og:description meta tag (most reliable) ──
  const meta = document.querySelector('meta[name="description"], meta[property="og:description"]');
  if (meta?.content) {
    const m = meta.content.match(/([\d,.]+\s*[KMBkmb]?)\s*Followers/i);
    if (m) profile.followers = parseCount(m[1]);
  }

  // ── Followers fallback — header stats list (uses title attr for exact count) ──
  if (!profile.followers) {
    const listItems = document.querySelectorAll('header ul li, header section ul li');
    for (const li of listItems) {
      if (/follower/i.test(li.textContent)) {
        for (const sp of li.querySelectorAll('span')) {
          const n = parseCount(sp.getAttribute('title') || sp.textContent);
          if (n > profile.followers) profile.followers = n;
        }
      }
    }
  }

  // ── Followers fallback — embedded JSON in script tags ──
  if (!profile.followers) {
    profile.followers = extractFollowersFromScripts();
  }

  // ── Engagement from visible post grid aria-labels ──
  if (profile.followers > 0) {
    const likePattern    = /([\d,.]+[KMBkmb]?)\s*like/gi;
    const commentPattern = /([\d,.]+[KMBkmb]?)\s*comment/gi;
    const ariaTexts = [...document.querySelectorAll('[aria-label]')]
      .map(el => el.getAttribute('aria-label'))
      .filter(Boolean)
      .join(' ');

    const likes    = [...ariaTexts.matchAll(likePattern)].slice(0, 12).map(m => parseCount(m[1]));
    const comments = [...ariaTexts.matchAll(commentPattern)].slice(0, 12).map(m => parseCount(m[1]));

    if (likes.length >= 1) {
      const avgLikes    = likes.reduce((s, n) => s + n, 0) / likes.length;
      const avgComments = comments.length ? comments.reduce((s, n) => s + n, 0) / comments.length : 0;
      const rate = (avgLikes + avgComments) / profile.followers * 100;
      if (rate > 0 && rate < 100) profile.engagement = parseFloat(rate.toFixed(2));
    }
  }

  profile.niche = classifyNiche(`${profile.bio} ${username}`);
  return profile;
}

// ─────────────────────────── engagement calc ─────────────────────────────────

function computeEngagementFromItems(items, followers) {
  if (!items?.length || followers <= 0) return null;
  const avgLikes    = items.reduce((s, p) => s + (p.like_count    ?? p.edge_liked_by?.count    ?? 0), 0) / items.length;
  const avgComments = items.reduce((s, p) => s + (p.comment_count ?? p.edge_media_to_comment?.count ?? 0), 0) / items.length;
  const rate = (avgLikes + avgComments) / followers * 100;
  return (rate > 0 && rate < 100) ? parseFloat(rate.toFixed(2)) : null;
}

// ─── accumulated data from page-script messages ───────────────────────────────

let pendingProfile    = null;
let pendingMediaItems = null;

window.addEventListener('message', event => {
  if (event.source !== window || !event.data?.__igDash) return;

  const username = getProfileUsername();
  if (!username) return;

  if (event.data.__igDash === 'media') {
    pendingMediaItems = event.data.items;
    return;
  }

  const user = event.data.user;
  if (!user || user.username?.toLowerCase() !== username) return;

  // Prefer user objects that carry follower data
  const newFollowers = user.follower_count ?? user.edge_followed_by?.count ?? 0;
  const curFollowers = pendingProfile
    ? (pendingProfile.follower_count ?? pendingProfile.edge_followed_by?.count ?? 0)
    : 0;
  if (!pendingProfile || newFollowers > curFollowers) pendingProfile = user;
});

// ────────── GET_CURRENT_PROFILE — called by popup when user clicks icon ───────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'GET_CURRENT_PROFILE') return false;

  const username = getProfileUsername();
  if (!username) {
    sendResponse({ ok: false, error: 'NOT_PROFILE_PAGE' });
    return false;
  }

  let profile = null;

  // Build from API-intercepted data (most accurate)
  if (pendingProfile) {
    const user        = pendingProfile;
    const bio         = user.biography || '';
    const followers   = user.follower_count ?? user.edge_followed_by?.count ?? 0;
    const embedded    = user.edge_owner_to_timeline_media?.edges?.map(e => e.node) || [];
    const allItems    = pendingMediaItems?.length ? pendingMediaItems : embedded;
    const engagement  = computeEngagementFromItems(allItems, followers);
    const apiEmail    = user.public_email || user.business_email || '';
    const bioEmail    = extractEmail(bio);
    const mailtoEl    = document.querySelector('a[href^="mailto:"]');
    const mailtoEmail = mailtoEl ? mailtoEl.href.replace('mailto:', '').split('?')[0] : '';

    profile = {
      username,
      name:       user.full_name || '',
      followers,
      engagement,
      bio,
      email:      apiEmail || mailtoEmail || bioEmail,
      location:   user.city_name || user.location_city || extractLocation(bio),
      niche:      classifyNiche(`${user.category_name || ''} ${bio} ${username}`),
    };
  }

  // DOM extraction (always run, fills gaps and acts as primary if no API data)
  const dom = extractFromDom(username);

  if (!profile) {
    profile = dom;
  } else {
    if (profile.followers === 0 && dom.followers > 0) {
      profile.followers = dom.followers;
      if (profile.engagement === null) profile.engagement = dom.engagement;
    }
    if (!profile.email    && dom.email)    profile.email    = dom.email;
    if (!profile.location && dom.location) profile.location = dom.location;
    if (!profile.name     && dom.name)     profile.name     = dom.name;
  }

  sendResponse({ ok: true, profile });
  return false;
});

// ──────────────────────── SPA navigation detection ───────────────────────────

let lastPath = location.pathname;

const navObserver = new MutationObserver(() => {
  if (location.pathname !== lastPath) {
    lastPath          = location.pathname;
    pendingProfile    = null;
    pendingMediaItems = null;
  }
});

navObserver.observe(document.documentElement, { subtree: true, childList: true });
