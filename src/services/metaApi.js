const GRAPH_VERSION = 'v19.0';
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const STORAGE_KEY = 'metaAuth';

export function getSavedMetaAuth() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

export function clearMetaAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

function loadFBSdk(appId) {
  return new Promise((resolve) => {
    if (window.FB) {
      window.FB.init({ appId, cookie: true, version: GRAPH_VERSION });
      resolve(window.FB);
      return;
    }
    window.fbAsyncInit = () => {
      window.FB.init({ appId, cookie: true, version: GRAPH_VERSION });
      resolve(window.FB);
    };
    const s = document.createElement('script');
    s.src = 'https://connect.facebook.net/en_US/sdk.js';
    s.async = true;
    document.body.appendChild(s);
  });
}

export async function connectMeta(appId) {
  const FB = await loadFBSdk(appId.trim());

  const authResponse = await new Promise((resolve, reject) => {
    FB.login(response => {
      if (response.authResponse) resolve(response.authResponse);
      else reject(new Error('Facebook login was cancelled or denied.'));
    }, { scope: 'pages_show_list,instagram_basic' });
  });

  const token = authResponse.accessToken;

  const pagesRes = await fetch(
    `${BASE}/me/accounts?fields=name,instagram_business_account&access_token=${token}`
  ).then(r => r.json());

  if (pagesRes.error) throw new Error(pagesRes.error.message);

  for (const page of pagesRes.data || []) {
    if (page.instagram_business_account?.id) {
      const auth = {
        appId: appId.trim(),
        token,
        igAccountId: page.instagram_business_account.id,
        pageName: page.name,
        connectedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
      return auth;
    }
  }

  throw new Error(
    'No Instagram Business or Creator account found. ' +
    'Make sure your Instagram account is set to Professional (Business or Creator) ' +
    'and is connected to a Facebook Page.'
  );
}

export async function refreshMetaToken(auth) {
  const FB = await loadFBSdk(auth.appId);
  return new Promise(resolve => {
    FB.getLoginStatus(response => {
      if (response.status === 'connected') {
        const updated = { ...auth, token: response.authResponse.accessToken };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        resolve(updated);
      } else {
        resolve(null);
      }
    });
  });
}

export async function lookupInstagramProfile(username, igAccountId, token) {
  const clean = username.trim().replace(/^@/, '').replace(/.*instagram\.com\//, '').replace(/[/?#].*$/, '');

  const mediaFields = 'like_count,comments_count,media_type';
  const profileFields = [
    'username', 'name', 'biography',
    'followers_count', 'media_count',
    'profile_picture_url', 'website',
    `media.limit(12){${mediaFields}}`,
  ].join(',');

  const url =
    `${BASE}/${igAccountId}` +
    `?fields=business_discovery.fields(${profileFields})` +
    `&username=${encodeURIComponent(clean)}` +
    `&access_token=${token}`;

  const data = await fetch(url).then(r => r.json());

  if (data.error) throw new Error(data.error.message);

  const bd = data.business_discovery;
  if (!bd) throw new Error('Profile not found or is not a professional account.');

  const followers = bd.followers_count || 0;
  const posts = (bd.media?.data || []).filter(m => m.media_type !== 'VIDEO');
  let engagement = null;

  if (posts.length >= 3 && followers > 0) {
    const avgLikes    = posts.reduce((s, p) => s + (p.like_count    || 0), 0) / posts.length;
    const avgComments = posts.reduce((s, p) => s + (p.comments_count || 0), 0) / posts.length;
    const rate = (avgLikes + avgComments) / followers * 100;
    if (rate > 0 && rate < 100) engagement = parseFloat(rate.toFixed(2));
  }

  return {
    username:   bd.username || clean,
    name:       bd.name || '',
    bio:        bd.biography || '',
    followers,
    engagement,
    photoUrl:   bd.profile_picture_url || '',
    website:    bd.website || '',
    mediaCount: bd.media_count || 0,
  };
}
