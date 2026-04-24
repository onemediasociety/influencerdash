import { useState } from 'react';

// Gradient palette — cycles by first letter so the same person always gets the same colour
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
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

// Renders the Instagram profile photo from unavatar.io.
// Shows a branded gradient-initial placeholder immediately; replaces it
// with the real photo once it loads. Falls back to initials on error.
export default function Avatar({ src, name, size = 48, ringClass = 'ring-2 ring-gray-100' }) {
  const [photoState, setPhotoState] = useState('loading'); // 'loading' | 'loaded' | 'error'

  const fontSize = Math.round(size * 0.33);

  return (
    <div
      className={`relative rounded-full flex-shrink-0 overflow-hidden ${ringClass}`}
      style={{ width: size, height: size, minWidth: size }}
    >
      {/* Gradient initials — always mounted, hidden only when photo loaded */}
      <div
        className="absolute inset-0 flex items-center justify-center text-white font-bold select-none"
        style={{
          background: gradientFor(name),
          fontSize,
          opacity: photoState === 'loaded' ? 0 : 1,
          transition: 'opacity .25s',
        }}
        aria-hidden="true"
      >
        {initials(name)}
      </div>

      {/* Real photo — fades in over the initials */}
      {src && (
        <img
          src={src}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: photoState === 'loaded' ? 1 : 0,
            transition: 'opacity .25s',
          }}
          onLoad={() => setPhotoState('loaded')}
          onError={() => setPhotoState('error')}
        />
      )}
    </div>
  );
}
