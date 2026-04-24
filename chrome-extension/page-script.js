// Runs in the PAGE's JavaScript context.
// Intercepts Instagram's API responses (fetch + XHR + window callbacks)
// to capture the full user object including post like/comment counts
// needed for engagement rate, and public_email for business accounts.
(function () {
  function dispatch(user) {
    if (!user?.username) return;
    window.postMessage({ __igDash: true, user }, location.origin);
  }

  function tryExtract(data) {
    if (!data) return;
    dispatch(data?.graphql?.user);
    dispatch(data?.data?.user);
    dispatch(data?.user);
  }

  // Instagram's newer REST API returns media items in a separate feed call.
  // Items have like_count / comment_count (not edge_liked_by).
  function tryExtractMedia(data) {
    if (!data) return;
    const items = data?.items || data?.data?.items || data?.edges?.map?.(e => e.node);
    if (Array.isArray(items) && items.length > 0) {
      window.postMessage({ __igDash: 'media', items }, location.origin);
    }
  }

  // ── 1. Hook __additionalDataLoaded ──────────────────────────────────────────
  const origAdditional = window.__additionalDataLoaded;
  window.__additionalDataLoaded = function (type, data) {
    try { tryExtract(data); } catch {}
    return origAdditional?.apply(this, arguments);
  };

  // ── 2. Intercept fetch ──────────────────────────────────────────────────────
  // This is the key one — Instagram loads profile + post data via fetch to
  // /api/v1/users/web_profile_info and /graphql/query. Intercepting the
  // response gives us followers, post likes, comments, AND public_email.
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await origFetch.apply(this, args);
    try {
      const url = (typeof args[0] === 'string' ? args[0] : args[0]?.url) || '';
      if (
        url.includes('web_profile_info') ||
        url.includes('/graphql/query')   ||
        url.includes('/api/v1/users/')   ||
        url.includes('/api/v1/feed/user/') ||
        url.includes('/api/v1/clips/user/')
      ) {
        response.clone().json().then(data => {
          tryExtract(data);
          if (data?.data)    tryExtract(data.data);
          if (data?.graphql) tryExtract(data.graphql);
          tryExtractMedia(data);
        }).catch(() => {});
      }
    } catch {}
    return response;
  };

  // ── 3. Intercept XHR (older Instagram code paths) ──────────────────────────
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__igUrl = url || '';
    return origOpen.call(this, method, url, ...rest);
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (
      this.__igUrl?.includes('web_profile_info') ||
      this.__igUrl?.includes('/graphql/query')
    ) {
      this.addEventListener('load', () => {
        try {
          const data = JSON.parse(this.responseText);
          tryExtract(data);
          tryExtractMedia(data);
        } catch {}
      });
    }
    return origSend.apply(this, args);
  };

  // ── 4. Try already-loaded window globals ────────────────────────────────────
  function tryExisting() {
    try { tryExtract(window._sharedData?.entry_data?.ProfilePage?.[0]); } catch {}
    try {
      Object.values(window.__additionalData || {}).forEach(d => tryExtract(d?.data));
    } catch {}
    try {
      (window.__initialData?.pending || []).forEach(r => tryExtract(r?.result?.data));
    } catch {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryExisting);
  } else {
    tryExisting();
  }
})();
