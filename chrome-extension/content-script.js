// Content script — runs on every instagram.com page.
// Detects profile pages, extracts data from the DOM + injected page-script,
// then asks the background worker to sync it to the Google Sheet.

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
  { name: 'Art & Design',           kw: /art|design|creative|artist|illustrator|photographer|paint|draw|graphic/ },
  { name: 'Business & Finance',     kw: /finance|invest|money|entrepreneur|business|crypto|stock|wealth|ceo/ },
  { name: 'Parenting',              kw: /parent|mom|dad|family|baby|kids|children|motherhood|fatherhood/ },
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
  // Must be a top-level path with no sub-path (or only trailing slash)
  if (!segment || sub || BLOCKED.has(segment.toLowerCase())) return null;
  return segment.toLowerCase();
}

// ──────────────────────── page-script injection ──────────────────────────────

function injectPageScript() {
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('page-script.js');
  s.onload = () => s.remove();
  (document.head || document.documentElement).prepend(s);
}

// ─────────────────────── DOM-based data extraction ───────────────────────────
// Fallback when the page-script injection can't get post data (e.g. the data
// was already loaded before our script ran). Reads what's visible in the DOM.

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
  // Instagram renders the display name in a heading inside the profile header.
  // Selectors are ordered from most-specific to most-generic.
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

  // Business accounts have a mailto: "Email" button — most reliable email source
  if (!profile.email) {
    const mailtoEl = document.querySelector('a[href^="mailto:"]');
    if (mailtoEl) profile.email = mailtoEl.href.replace('mailto:', '').split('?')[0];
  }

  // ── Followers — most reliable from og:description meta tag ──
  const meta = document.querySelector('meta[name="description"], meta[property="og:description"]');
  if (meta?.content) {
    const m = meta.content.match(/([\d,.]+\s*[KMBkmb]?)\s*Followers/i);
    if (m) profile.followers = parseCount(m[1]);
  }

  // ── Followers fallback — scan the stats list in the profile header ──
  if (!profile.followers) {
    const listItems = document.querySelectorAll('header ul li, header section ul li');
    for (const li of listItems) {
      if (/follower/i.test(li.textContent)) {
        // The actual number is in a nested span; pick the largest parsed value
        for (const sp of li.querySelectorAll('span')) {
          const n = parseCount(sp.getAttribute('title') || sp.textContent);
          if (n > profile.followers) profile.followers = n;
        }
      }
    }
  }

  // ── Engagement from visible post grid ──
  // Instagram stopped showing individual like counts on the grid (2021+),
  // but we can still read counts from post thumbnails' aria-labels on some
  // account types, or from the `<article>` elements when expanded.
  if (profile.followers > 0) {
    const likePattern  = /([\d,.]+[KMBkmb]?)\s*like/gi;
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

// ─────────────────────────── toast notification ───────────────────────────────

function showToast(message, type = 'info') {
  const id = 'igdash-toast';
  document.getElementById(id)?.remove();

  const colours = { success: '#7c3aed', error: '#dc2626', info: '#2563eb' };

  if (!document.getElementById('igdash-toast-style')) {
    const style = document.createElement('style');
    style.id = 'igdash-toast-style';
    style.textContent = `
      @keyframes igdash-in  { from { transform: translateY(16px); opacity:0 } to { transform:none; opacity:1 } }
      @keyframes igdash-out { from { opacity:1 } to { opacity:0 } }
      #igdash-toast { animation: igdash-in .2s ease; }
      #igdash-toast.fade { animation: igdash-out .3s ease forwards; }
    `;
    document.head.appendChild(style);
  }

  const toast = document.createElement('div');
  toast.id = id;
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:2147483647;
    background:${colours[type] || colours.info}; color:#fff;
    padding:11px 16px; border-radius:10px; font-size:13px;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    box-shadow:0 4px 20px rgba(0,0,0,.3); max-width:260px; line-height:1.4;
    pointer-events:none;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade');
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}

// ──────────────────────────── sync logic ─────────────────────────────────────

// Per-session cooldown: don't re-sync the same profile URL within 5 min
const syncCache = {};
const COOLDOWN = 5 * 60 * 1000;
let syncInProgress = false;

async function triggerSync(profile) {
  if (syncInProgress) return;
  const url = location.href;
  if (syncCache[url] && Date.now() - syncCache[url] < COOLDOWN) return;

  syncInProgress = true;
  showToast(`Syncing @${profile.username}…`, 'info');

  try {
    const res = await chrome.runtime.sendMessage({ type: 'SYNC_PROFILE', profile });
    syncCache[url] = Date.now();

    if (res?.ok) {
      const verb = res.action === 'updated' ? 'Updated' : 'Added';
      showToast(`✓ ${verb} @${profile.username} in sheet`, 'success');
    } else if (res?.error === 'SETUP_REQUIRED') {
      showToast('InfluencerDash: Click the extension icon and enter your Google OAuth Client ID', 'error');
    } else {
      showToast(`Sync failed: ${res?.error || 'unknown error'}`, 'error');
    }
  } catch (err) {
    showToast(`Extension error: ${err.message}`, 'error');
  } finally {
    syncInProgress = false;
  }
}

// ────────────── listener for data posted from page-script.js ─────────────────

window.addEventListener('message', event => {
  if (event.source !== window || !event.data?.__igDash) return;
  const user = event.data.user;
  if (!user) return;

  const username = getProfileUsername();
  if (!username || user.username?.toLowerCase() !== username) return;

  const bio      = user.biography || '';
  const followers = user.edge_followed_by?.count || 0;
  const posts    = user.edge_owner_to_timeline_media?.edges || [];

  let engagement = null;
  if (posts.length >= 1 && followers > 0) {
    const avgLikes    = posts.reduce((s, p) => s + (p.node?.edge_liked_by?.count    || 0), 0) / posts.length;
    const avgComments = posts.reduce((s, p) => s + (p.node?.edge_media_to_comment?.count || 0), 0) / posts.length;
    const rate = (avgLikes + avgComments) / followers * 100;
    if (rate > 0 && rate < 100) engagement = parseFloat(rate.toFixed(2));
  }

  // public_email / business_email come from the API response on business accounts
  const apiEmail = user.public_email || user.business_email || '';
  const bioEmail = extractEmail(bio);
  // Also check for mailto: links Instagram renders for business contact buttons
  const mailtoEl = document.querySelector('a[href^="mailto:"]');
  const mailtoEmail = mailtoEl ? mailtoEl.href.replace('mailto:', '').split('?')[0] : '';

  const richProfile = {
    username,
    name:       user.full_name || '',
    followers,
    engagement,
    bio,
    email:    apiEmail || mailtoEmail || bioEmail,
    location: user.city_name || user.location_city || extractLocation(bio),
    niche:    classifyNiche(`${user.category_name || ''} ${bio} ${username}`),
  };

  triggerSync(richProfile);
});

// ────────────────────────── page initialisation ───────────────────────────────

function initPage() {
  const username = getProfileUsername();
  if (!username) return;

  // Inject the page-context script so it can intercept window.__additionalDataLoaded
  injectPageScript();

  // Give the page-script 5 seconds to fire (fetch interception); fall back to DOM parsing
  setTimeout(() => {
    if (syncInProgress || (syncCache[location.href] && Date.now() - syncCache[location.href] < COOLDOWN)) return;
    const domProfile = extractFromDom(username);
    if (domProfile.followers > 0 || domProfile.name) {
      triggerSync(domProfile);
    }
  }, 5000);
}

// ──────────────── SPA navigation detection (Instagram is a React SPA) ─────────

let lastPath = location.pathname;

const navObserver = new MutationObserver(() => {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    syncInProgress = false;
    setTimeout(initPage, 1500); // let the new page's content render
  }
});

navObserver.observe(document.documentElement, { subtree: true, childList: true });

initPage();
