import { useState, useEffect, useRef } from 'react';

// Deterministic gradient palette — same name always gets same colour
const GRADIENTS = [
  'linear-gradient(135deg,#7c3aed,#ec4899)',
  'linear-gradient(135deg,#2563eb,#7c3aed)',
  'linear-gradient(135deg,#059669,#2563eb)',
  'linear-gradient(135deg,#d97706,#ef4444)',
  'linear-gradient(135deg,#ec4899,#ef4444)',
  'linear-gradient(135deg,#0891b2,#059669)',
  'linear-gradient(135deg,#7c3aed,#2563eb)',
  'linear-gradient(135deg,#ef4444,#d97706)',
];

function gradientFor(name) {
  const code = (name || 'A').toUpperCase().charCodeAt(0) - 65;
  return GRADIENTS[((code % GRADIENTS.length) + GRADIENTS.length) % GRADIENTS.length];
}

function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// In-memory cache for this page session — avoids duplicate fetches
const memCache = new Map();

async function fetchPhoto(username) {
  if (!username) return null;
  if (memCache.has(username)) return memCache.get(username);

  // Check localStorage (7-day TTL)
  try {
    const raw = localStorage.getItem(`igph_${username}`);
    if (raw) {
      const { url, exp } = JSON.parse(raw);
      if (Date.now() < exp) {
        memCache.set(username, url);
        return url;
      }
    }
  } catch {}

  // Fetch Instagram page via CORS proxy and extract og:image
  try {
    const target = `https://www.instagram.com/${username}/`;
    const res = await fetch(
      `https://allorigins.win/get?url=${encodeURIComponent(target)}&timestamp=${Date.now()}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error('proxy error');
    const { contents } = await res.json();
    // og:image appears in two possible attribute orders
    const m = (contents || '').match(
      /property="og:image"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:image"/
    );
    const url = m?.[1] || m?.[2] || null;
    memCache.set(username, url);
    if (url) {
      try {
        localStorage.setItem(
          `igph_${username}`,
          JSON.stringify({ url, exp: Date.now() + 7 * 86_400_000 })
        );
      } catch {}
    }
    return url;
  } catch {
    memCache.set(username, null);
    return null;
  }
}

// Shared rate-limiter: at most 4 concurrent photo fetches, 300 ms gap between starts
const queue = [];
let active = 0;
const MAX_CONCURRENT = 4;
const GAP_MS = 300;

function enqueue(username) {
  return new Promise(resolve => {
    queue.push({ username, resolve });
    drain();
  });
}

async function drain() {
  if (active >= MAX_CONCURRENT || queue.length === 0) return;
  active++;
  const { username, resolve } = queue.shift();
  await new Promise(r => setTimeout(r, GAP_MS));
  try { resolve(await fetchPhoto(username)); }
  finally { active--; drain(); }
}

// ─── Avatar component ─────────────────────────────────────────────────────────

export default function Avatar({ username, name, size = 48, ringClass = 'ring-2 ring-gray-100' }) {
  const [photoUrl, setPhotoUrl]   = useState(null);
  const [photoReady, setPhotoReady] = useState(false);
  const rootRef = useRef();

  useEffect(() => {
    if (!username) return;

    // If already in memory cache, use it immediately without the observer
    if (memCache.has(username)) {
      const url = memCache.get(username);
      if (url) setPhotoUrl(url);
      return;
    }

    let cancelled = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        enqueue(username).then(url => {
          if (!cancelled && url) setPhotoUrl(url);
        });
      },
      { threshold: 0, rootMargin: '200px' } // start loading 200px before visible
    );

    if (rootRef.current) observer.observe(rootRef.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [username]);

  const fontSize = Math.round(size * 0.33);

  return (
    <div
      ref={rootRef}
      className={`relative rounded-full flex-shrink-0 overflow-hidden ${ringClass}`}
      style={{ width: size, height: size, minWidth: size }}
    >
      {/* Gradient initials — always rendered, fades out when photo arrives */}
      <div
        className="absolute inset-0 flex items-center justify-center text-white font-bold select-none"
        style={{
          background: gradientFor(name),
          fontSize,
          opacity: photoReady ? 0 : 1,
          transition: 'opacity .3s',
        }}
        aria-hidden="true"
      >
        {initials(name)}
      </div>

      {/* Real photo — fades in over the initials */}
      {photoUrl && (
        <img
          src={photoUrl}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: photoReady ? 1 : 0, transition: 'opacity .3s' }}
          onLoad={() => setPhotoReady(true)}
          onError={() => { setPhotoUrl(null); memCache.set(username, null); }}
        />
      )}
    </div>
  );
}
