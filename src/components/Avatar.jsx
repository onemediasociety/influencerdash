import { useState } from 'react';

// Deterministic gradient palette — same name always gets the same colour
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

// Shows gradient initials immediately, fades in the real photo when it loads.
// photoUrl comes from the Google Sheet (written there by the Chrome extension).
export default function Avatar({ photoUrl, name, size = 48, ringClass = 'ring-2 ring-gray-100' }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const showPhoto = photoUrl && !failed;
  const fontSize  = Math.round(size * 0.33);

  return (
    <div
      className={`relative rounded-full flex-shrink-0 overflow-hidden ${ringClass}`}
      style={{ width: size, height: size, minWidth: size }}
    >
      {/* Gradient initials — always rendered, hidden only when photo is loaded */}
      <div
        className="absolute inset-0 flex items-center justify-center text-white font-bold select-none"
        style={{
          background: gradientFor(name),
          fontSize,
          opacity: loaded ? 0 : 1,
          transition: 'opacity .3s',
        }}
        aria-hidden="true"
      >
        {initials(name)}
      </div>

      {/* Real photo from the sheet — fades in over the initials */}
      {showPhoto && (
        <img
          src={photoUrl}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity .3s' }}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
