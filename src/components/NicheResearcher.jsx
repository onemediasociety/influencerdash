import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Sparkles, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { lookupNiche } from '../services/nicheResearch';
import { buildNicheUpdates, writeNiches } from '../services/sheetsApi';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export default function NicheResearcher() {
  const { influencers, sync } = useApp();
  const [token, setToken] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | working | done | error
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' });
  const [filled, setFilled] = useState(0);
  const [error, setError] = useState('');

  const login = useGoogleLogin({
    onSuccess: async res => {
      setToken(res.access_token);
      await run(res.access_token);
    },
    onError: () => { setError('Google sign-in was cancelled or failed.'); setStatus('error'); },
    scope: 'https://www.googleapis.com/auth/spreadsheets',
  });

  async function run(accessToken) {
    setStatus('working');
    setError('');
    try {
      const { rowMap, nicheLetter } = await buildNicheUpdates(accessToken, influencers);

      const entries = Object.entries(rowMap);
      setProgress({ done: 0, total: entries.length, current: '' });

      if (entries.length === 0) { setStatus('done'); setFilled(0); return; }

      const updates = [];
      for (const [username, rowNum] of entries) {
        setProgress(p => ({ ...p, current: `@${username}` }));
        const niche = await lookupNiche(username);
        if (niche) updates.push({ range: `${nicheLetter}${rowNum}`, value: niche });
        setProgress(p => ({ done: p.done + 1, total: p.total, current: `@${username}` }));
        await sleep(600); // avoid rate-limiting the proxy
      }

      await writeNiches(accessToken, updates);
      setFilled(updates.length);
      setStatus('done');
      sync();
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  function handleClick() {
    if (!token) login();
    else run(token);
  }

  if (status === 'idle') return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
    >
      <Sparkles size={15} />
      Auto-fill Niches
    </button>
  );

  if (status === 'working') return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-purple-50 border border-purple-200 rounded-xl min-w-[220px]">
      <Loader2 size={15} className="text-purple-600 animate-spin flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-purple-700">
          Researching {progress.done}/{progress.total}…
        </p>
        {progress.current && (
          <p className="text-xs text-purple-400 truncate">{progress.current}</p>
        )}
      </div>
    </div>
  );

  if (status === 'done') return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl">
      <CheckCircle size={15} className="text-green-600 flex-shrink-0" />
      <p className="text-sm font-medium text-green-700">
        {filled > 0 ? `${filled} niches filled!` : 'All niches already filled'}
      </p>
      <button
        onClick={() => setStatus('idle')}
        className="ml-1 text-green-600 hover:text-green-800 transition-colors"
        title="Run again"
      >
        <RefreshCw size={13} />
      </button>
    </div>
  );

  if (status === 'error') return (
    <div className="flex items-start gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl max-w-xs">
      <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm text-red-700 leading-tight">{error}</p>
        <button onClick={() => setStatus('idle')} className="text-xs text-red-600 underline mt-0.5">Try again</button>
      </div>
    </div>
  );
}
