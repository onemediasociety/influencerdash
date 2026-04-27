import { useState } from 'react';
import { Instagram, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { useApp } from '../context/AppContext';
import { getSavedMetaAuth, batchLookup } from '../services/metaApi';
import { readSheetRows, batchUpdateFromMeta } from '../services/sheetsApi';

function normaliseHandle(raw) {
  return (raw || '').trim()
    .replace(/^@/, '')
    .replace(/.*instagram\.com\//, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
}

export default function MetaSyncButton() {
  const { sync } = useApp();
  const [phase, setPhase]       = useState('idle'); // idle | syncing | done | error
  const [progress, setProgress] = useState({ current: 0, total: 0, username: '' });
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');
  const [googleToken, setGoogleToken] = useState(null);

  const loginGoogle = useGoogleLogin({
    onSuccess: async res => {
      setGoogleToken(res.access_token);
      await runSync(res.access_token);
    },
    onError: () => { setError('Google sign-in failed.'); setPhase('error'); },
    scope: 'https://www.googleapis.com/auth/spreadsheets',
  });

  async function handleClick() {
    const metaAuth = getSavedMetaAuth();
    if (!metaAuth) {
      setError('Connect your Meta/Facebook account first using the "Instagram Lookup" button in the toolbar.');
      setPhase('error');
      return;
    }
    if (googleToken) await runSync(googleToken);
    else loginGoogle();
  }

  async function runSync(accessToken) {
    const metaAuth = getSavedMetaAuth();
    if (!metaAuth) { setError('Meta account not connected.'); setPhase('error'); return; }

    setPhase('syncing');
    setError('');

    try {
      const { values } = await readSheetRows(accessToken);
      if (!values || values.length < 2) throw new Error('Sheet is empty');

      const headers = values[0].map(h => h.toLowerCase().trim());
      const igCol   = headers.findIndex(h => h.includes('instagram') && !h.includes('follower'));
      if (igCol === -1) throw new Error('No Instagram column found in sheet');

      const usernames = values.slice(1)
        .map(row => normaliseHandle(row[igCol]))
        .filter(Boolean);

      if (!usernames.length) throw new Error('No Instagram handles found in sheet');

      setProgress({ current: 0, total: usernames.length, username: '' });

      const metaResults = await batchLookup(
        usernames,
        metaAuth.igAccountId,
        metaAuth.token,
        (current, total, username) => setProgress({ current, total, username })
      );

      const updateResult = await batchUpdateFromMeta(accessToken, metaResults);
      setResult(updateResult);
      setPhase('done');
      sync();
    } catch (err) {
      setError(err.message);
      setPhase('error');
    }
  }

  if (phase === 'syncing') {
    const pct = progress.total ? Math.round(progress.current / progress.total * 100) : 0;
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-purple-50 border border-purple-200 rounded-xl min-w-[220px]">
        <Loader2 size={15} className="text-purple-600 animate-spin flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-purple-700">Syncing from Instagram</p>
            <p className="text-xs text-purple-500">{pct}%</p>
          </div>
          <div className="w-full bg-purple-200 rounded-full h-1">
            <div className="bg-purple-600 h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          {progress.username && (
            <p className="text-xs text-purple-400 mt-1 truncate">@{progress.username}</p>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'done') return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl">
      <CheckCircle size={15} className="text-green-600 flex-shrink-0" />
      <span className="text-sm font-medium text-green-700">
        {result?.updatedCount ?? 0} updated
        {result?.errorCount > 0 ? `, ${result.errorCount} skipped` : ''}
      </span>
      <button onClick={() => setPhase('idle')} className="ml-1 text-green-500 hover:text-green-700 transition-colors">
        <X size={13} />
      </button>
    </div>
  );

  if (phase === 'error') return (
    <div className="flex items-start gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl max-w-sm">
      <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm text-red-700 leading-snug">{error}</p>
        <button onClick={() => setPhase('idle')} className="text-xs text-red-600 underline mt-0.5 hover:text-red-800">Dismiss</button>
      </div>
    </div>
  );

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-purple-300 bg-purple-50 text-sm font-semibold text-purple-700 hover:bg-purple-100 hover:border-purple-400 transition-colors shadow-sm"
    >
      <Instagram size={14} />
      Sync All from Instagram
    </button>
  );
}
