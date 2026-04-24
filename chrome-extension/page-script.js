// Runs in the PAGE's JavaScript context (not the extension's isolated world).
// This lets us access window globals that Instagram sets — specifically the
// __additionalDataLoaded callback that carries full profile + post data
// including like/comment counts needed for engagement rate.
(function () {
  function dispatch(user) {
    if (!user?.username) return;
    window.postMessage({ __igDash: true, user }, location.origin);
  }

  function tryExtract(data) {
    // Modern API response shape
    dispatch(data?.graphql?.user || data?.data?.user);
  }

  // ── Hook the callback Instagram fires when a profile's data finishes loading ──
  const orig = window.__additionalDataLoaded;
  window.__additionalDataLoaded = function (type, data) {
    try { tryExtract(data); } catch {}
    return orig?.apply(this, arguments);
  };

  // ── Try data that's already on the window before our script ran ──
  function tryExisting() {
    // Legacy global (still present on some responses)
    try {
      tryExtract(window._sharedData?.entry_data?.ProfilePage?.[0]);
    } catch {}

    // Newer: keyed object of component data
    try {
      Object.values(window.__additionalData || {}).forEach(d => tryExtract(d?.data));
    } catch {}

    // Some versions embed it as window.__initialData
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
