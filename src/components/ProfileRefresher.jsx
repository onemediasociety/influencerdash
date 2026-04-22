import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { lookupInstagramProfile } from '../services/instagramLookup';
import { buildRefreshUpdates, writeNiches } from '../services/sheetsApi';

const STORAGE_KEY = 'influencerLastProfileSync';
const REFRESH_INTERVAL_DAYS = 30;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getLastSync() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? new Date(v) : null;
  } catch { return null; }
}

function daysSince(date) {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

export default function ProfileRefresher() {
  const { sync } = useApp();
  const [token, setToken] = useState(null);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '', updated: 0 });
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState(getLastSync);

  const days = daysSince(lastSync);
  const isDue = days === null || days >= REFRESH_INTERVAL_DAYS;

  const login = useGoogleLogin({
    onSuccess: async res => { setToken(res.access_token); await run(res.access_token); },
    onError: () => { setError('Google sign-in was cancelled or failed.'); setStatus('error'); },
    scope: 'https://www.googleapis.com/auth/spreadsheets',
  });

  async function run(accessToken) {
    setStatus('working');
    setError('');
    let updatedCount = 0;

    try {
      const toRefresh = await buildRefreshUpdates(accessToken);
      setProgress({ done: 0, total: toRefresh.length, current: '', updated: 0 });

      for (const { rowNum, username, current, cols } of toRefresh) {
        setProgress(p => ({ ...p, current: `@${username}` }));

        try {
          const profile = await lookupInstagramProfile(username);
          const updates = [];

          // Followers — always overwrite with the latest count
          if (profile.followers > 0 && cols.followers) {
            updates.push({ range: `${cols.followers}${rowNum}`, value: String(profile.followers) });
          }
          // Engagement rate — always overwrite if we have it
          if (profile.engagement != null && cols.engagement) {
            updates.push({ range: `${cols.engagement}${rowNum}`, value: `${profile.engagement}%` });
          }
          // Email, location, niche — fill in only if currently blank
          if (profile.email && !current.email && cols.email) {
            updates.push({ range: `${cols.email}${rowNum}`, value: profile.email });
          }
          if (profile.location && !current.location && cols.location) {
            updates.push({ range: `${cols.location}${rowNum}`, value: profile.location });
          }
          if (profile.niche && !current.niche && cols.niche) {
            updates.push({ range: `${cols.niche}${rowNum}`, value: profile.niche });
          }
          // Write the full Instagram URL to the website/link column if currently blank
          if (!current.website && cols.website) {
            updates.push({ range: `${cols.website}${rowNum}`, value: `https://www.instagram.com/${username}/` });
          }

          if (updates.length > 0) {
            await writeNiches(accessToken, updates);
            updatedCount++;
          }
        } catch {
          // Skip this profile if the lookup fails; don't abort the whole run
        }

        setProgress(p => ({ done: p.done + 1, total: p.total, current: `@${username}`, updated: updatedCount }));
        await sleep(1500); // stay well under the proxy rate limit
      }

      const now = new Date();
      localStorage.setItem(STORAGE_KEY, now.toISOString());
      setLastSync(now);
      setStatus('done');
      sync();
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  function handleClick() {
    if (!token) login(); else run(token);
  }

  if (status === 'working') return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl min-w-[240px]">
      <Loader2 size={15} className="text-indigo-600 animate-spin flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-indigo-700">
          Syncing {progress.done}/{progress.total}
          {progress.updated > 0 && <span className="text-indigo-500"> · {progress.updated} updated</span>}
        </p>
        {progress.current && <p className="text-xs text-indigo-400 truncate">{progress.current}</p>}
      </div>
    </div>
  );

  if (status === 'done') return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl">
      <CheckCircle size={15} className="text-green-600 flex-shrink-0" />
      <p className="text-sm font-medium text-green-700">
        {progress.updated > 0 ? `${progress.updated} profiles refreshed!` : 'All profiles up to date'}
      </p>
      <button onClick={() => setStatus('idle')} className="ml-1 text-green-600 hover:text-green-800 transition-colors" title="Run again">
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

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={handleClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
          isDue
            ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
            : 'border-gray-200 bg-white text-gray-600 hover:border-purple-400 hover:text-purple-700 hover:bg-purple-50'
        }`}
      >
        <RefreshCw size={14} />
        Sync Profiles
        {isDue && <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />}
      </button>
      <p className="text-xs text-gray-400">
        {lastSync === null
          ? 'Never synced'
          : days === 0
            ? 'Synced today'
            : `Synced ${days}d ago`}
        {isDue && lastSync !== null && <span className="text-orange-500"> · due now</span>}
      </p>
    </div>
  );
}
