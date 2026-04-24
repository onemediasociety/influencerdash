// Content script — runs on every instagram.com page.
// Intercepts profile data from page-script, shows an overlay card on the page,
// and lets the user sync to their Google Sheet with one click.

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

function fmtNum(n) {
  if (!n) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return n.toLocaleString();
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
  const profile = { username, name: '', followers: 0, engagement: null, email: '', location: '', niche: '', bio: '' };

  const nameSelectors = ['header h1', 'header h2', 'section h1', 'section h2', '[data-testid="user-name"]'];
  for (const sel of nameSelectors) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim()) { profile.name = el.textContent.trim(); break; }
  }

  const bioSelectors = ['header section div span', '[data-testid="user-description"] span', 'header div[class] > span'];
  let bioText = '';
  for (const sel of bioSelectors) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim().length > 10) { bioText = el.textContent.trim(); break; }
  }
  if (bioText) { profile.bio = bioText; profile.email = extractEmail(bioText); profile.location = extractLocation(bioText); }

  if (!profile.email) {
    const mailtoEl = document.querySelector('a[href^="mailto:"]');
    if (mailtoEl) profile.email = mailtoEl.href.replace('mailto:', '').split('?')[0];
  }

  const meta = document.querySelector('meta[name="description"], meta[property="og:description"]');
  if (meta?.content) {
    const m = meta.content.match(/([\d,.]+\s*[KMBkmb]?)\s*Followers/i);
    if (m) profile.followers = parseCount(m[1]);
  }

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

  if (!profile.followers) profile.followers = extractFollowersFromScripts();

  if (profile.followers > 0) {
    const likePattern    = /([\d,.]+[KMBkmb]?)\s*like/gi;
    const commentPattern = /([\d,.]+[KMBkmb]?)\s*comment/gi;
    const ariaTexts = [...document.querySelectorAll('[aria-label]')]
      .map(el => el.getAttribute('aria-label')).filter(Boolean).join(' ');
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

// ─────────────────────────── overlay card ───────────────────────────────────

let overlayEl      = null;
let overlayMinimised = false;

function removeOverlay() {
  overlayEl?.remove();
  overlayEl = null;
}

function showOverlay(profile) {
  removeOverlay();

  const card = document.createElement('div');
  card.id = 'igdash-card';

  const style = document.createElement('style');
  style.textContent = `
    #igdash-card {
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      width: 236px;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,.18), 0 0 0 1px rgba(124,58,237,.12);
      overflow: hidden;
    }
    #igdash-card .ig-header {
      background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
      padding: 9px 12px;
      display: flex; align-items: center; justify-content: space-between;
      cursor: pointer; user-select: none;
    }
    #igdash-card .ig-brand { color: #fff; font-size: 11px; font-weight: 700; letter-spacing: .3px; }
    #igdash-card .ig-header-actions { display: flex; gap: 4px; }
    #igdash-card .ig-btn-sm {
      background: rgba(255,255,255,.2); border: none; color: rgba(255,255,255,.9);
      width: 20px; height: 20px; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; line-height: 1; padding: 0;
    }
    #igdash-card .ig-btn-sm:hover { background: rgba(255,255,255,.35); }
    #igdash-card .ig-body { padding: 11px 12px; }
    #igdash-card .ig-stats {
      display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-bottom: 9px;
    }
    #igdash-card .ig-stat {
      background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 7px 9px;
    }
    #igdash-card .ig-stat-label {
      font-size: 8px; font-weight: 600; color: #9ca3af;
      text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px;
    }
    #igdash-card .ig-stat-val {
      font-size: 17px; font-weight: 700;
    }
    #igdash-card .ig-stat-val.purple { color: #7c3aed; }
    #igdash-card .ig-stat-val.green  { color: #059669; }
    #igdash-card .ig-detail {
      font-size: 11px; color: #374151; margin-bottom: 4px;
      display: flex; align-items: center; gap: 5px;
    }
    #igdash-card .ig-detail span:first-child { color: #9ca3af; font-size: 10px; }
    #igdash-card .ig-sync-btn {
      width: 100%; margin-top: 9px; padding: 8px;
      background: #7c3aed; color: #fff; border: none; border-radius: 8px;
      font-size: 12px; font-weight: 600; cursor: pointer;
      transition: background .15s;
    }
    #igdash-card .ig-sync-btn:hover:not(:disabled) { background: #6d28d9; }
    #igdash-card .ig-sync-btn:disabled { opacity: .65; cursor: default; }
    #igdash-card .ig-sync-btn.success { background: #059669; }
    #igdash-card .ig-result {
      font-size: 10px; text-align: center; margin-top: 5px; display: none;
    }
    #igdash-card .ig-result.err { color: #dc2626; display: block; }
  `;
  document.head.appendChild(style);

  card.innerHTML = `
    <div class="ig-header" id="igdash-header">
      <span class="ig-brand">InfluencerDash</span>
      <div class="ig-header-actions">
        <button class="ig-btn-sm" id="igdash-min" title="Minimise">−</button>
        <button class="ig-btn-sm" id="igdash-close" title="Close">×</button>
      </div>
    </div>
    <div class="ig-body" id="igdash-body">
      <div class="ig-stats">
        <div class="ig-stat">
          <div class="ig-stat-label">Followers</div>
          <div class="ig-stat-val purple">${fmtNum(profile.followers)}</div>
        </div>
        <div class="ig-stat">
          <div class="ig-stat-label">Engagement</div>
          <div class="ig-stat-val green">${profile.engagement != null ? profile.engagement + '%' : '—'}</div>
        </div>
      </div>
      ${profile.location ? `<div class="ig-detail"><span>📍</span>${profile.location}</div>` : ''}
      ${profile.niche    ? `<div class="ig-detail"><span>🏷</span>${profile.niche}</div>`    : ''}
      ${profile.email    ? `<div class="ig-detail"><span>✉</span>${profile.email}</div>`    : ''}
      <button class="ig-sync-btn" id="igdash-sync">Sync to Sheet</button>
      <div class="ig-result" id="igdash-result"></div>
    </div>
  `;

  document.body.appendChild(card);
  overlayEl = card;

  // Minimise / expand
  document.getElementById('igdash-min').addEventListener('click', e => {
    e.stopPropagation();
    const body = document.getElementById('igdash-body');
    overlayMinimised = !overlayMinimised;
    body.style.display = overlayMinimised ? 'none' : '';
    document.getElementById('igdash-min').textContent = overlayMinimised ? '+' : '−';
  });

  document.getElementById('igdash-header').addEventListener('click', () => {
    if (overlayMinimised) {
      const body = document.getElementById('igdash-body');
      overlayMinimised = false;
      body.style.display = '';
      document.getElementById('igdash-min').textContent = '−';
    }
  });

  document.getElementById('igdash-close').addEventListener('click', e => {
    e.stopPropagation();
    removeOverlay();
  });

  document.getElementById('igdash-sync').addEventListener('click', async () => {
    const btn    = document.getElementById('igdash-sync');
    const result = document.getElementById('igdash-result');
    btn.disabled    = true;
    btn.textContent = 'Syncing…';
    result.className = 'ig-result';

    // Extension context becomes invalidated when the extension is reloaded while
    // the tab is still open. chrome.runtime.id goes undefined in that state.
    if (!chrome.runtime?.id) {
      result.textContent = 'Extension was reloaded — refresh this page to continue';
      result.className = 'ig-result err';
      btn.textContent = 'Sync to Sheet';
      btn.disabled = false;
      return;
    }

    try {
      const res = await chrome.runtime.sendMessage({ type: 'SYNC_PROFILE', profile });
      if (res?.ok) {
        const verb = res.action === 'added' ? 'Added' : 'Updated';
        btn.textContent = `✓ ${verb} in sheet`;
        btn.classList.add('success');
      } else if (res?.error === 'SETUP_REQUIRED') {
        result.textContent = 'Click the extension icon to set up first';
        result.className = 'ig-result err';
        btn.textContent = 'Sync to Sheet';
        btn.disabled = false;
      } else {
        result.textContent = res?.error || 'Sync failed';
        result.className = 'ig-result err';
        btn.textContent = 'Sync to Sheet';
        btn.disabled = false;
      }
    } catch (err) {
      const isInvalidated = err.message?.includes('invalidated') || err.message?.includes('Extension context');
      result.textContent = isInvalidated
        ? 'Extension reloaded — refresh this page'
        : err.message;
      result.className = 'ig-result err';
      btn.textContent = 'Sync to Sheet';
      btn.disabled = false;
    }
  });
}

// ─── accumulated data from page-script messages ───────────────────────────────

let pendingProfile    = null;
let pendingMediaItems = null;
let overlayShown      = false;

function buildProfileFromApi(username) {
  if (!pendingProfile) return null;
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

  return {
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

function maybeShowOverlay(username) {
  if (overlayShown) return;
  let profile = buildProfileFromApi(username);
  const dom   = extractFromDom(username);

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

  if (profile.followers > 0 || profile.name) {
    overlayShown = true;
    showOverlay(profile);
  }
}

window.addEventListener('message', event => {
  if (event.source !== window || !event.data?.__igDash) return;

  const username = getProfileUsername();
  if (!username) return;

  if (event.data.__igDash === 'media') {
    pendingMediaItems = event.data.items;
    // If profile already arrived, re-render overlay with engagement data
    if (pendingProfile && overlayShown) {
      overlayShown = false;
      maybeShowOverlay(username);
    }
    return;
  }

  const user = event.data.user;
  if (!user || user.username?.toLowerCase() !== username) return;

  const newFollowers = user.follower_count ?? user.edge_followed_by?.count ?? 0;
  const curFollowers = pendingProfile
    ? (pendingProfile.follower_count ?? pendingProfile.edge_followed_by?.count ?? 0)
    : 0;
  if (!pendingProfile || newFollowers > curFollowers) pendingProfile = user;

  maybeShowOverlay(username);
});

// ────────── GET_CURRENT_PROFILE — called by popup when user clicks icon ───────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'GET_CURRENT_PROFILE') return false;

  const username = getProfileUsername();
  if (!username) {
    sendResponse({ ok: false, error: 'NOT_PROFILE_PAGE' });
    return false;
  }

  let profile = buildProfileFromApi(username);
  const dom   = extractFromDom(username);

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

// ──────────── DOM fallback — show overlay if API data never arrived ───────────

function initPage() {
  const username = getProfileUsername();
  if (!username) return;

  setTimeout(() => {
    if (!overlayShown) maybeShowOverlay(username);
  }, 4000);
}

// ──────────────────────── SPA navigation detection ───────────────────────────

let lastPath = location.pathname;

const navObserver = new MutationObserver(() => {
  if (location.pathname !== lastPath) {
    lastPath          = location.pathname;
    pendingProfile    = null;
    pendingMediaItems = null;
    overlayShown      = false;
    overlayMinimised  = false;
    removeOverlay();
    setTimeout(initPage, 1500);
  }
});

navObserver.observe(document.documentElement, { subtree: true, childList: true });

initPage();
