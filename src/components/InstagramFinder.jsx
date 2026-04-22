import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Search, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { lookupInstagramHandle } from '../services/nicheResearch';
import { lookupInstagramProfile } from '../services/instagramLookup';
import { buildInstagramUpdates, writeNiches } from '../services/sheetsApi';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export default function InstagramFinder() {
  const { sync } = useApp();
  const [token, setToken] = useState(null);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '', found: 0 });
  const [filled, setFilled] = useState(0);
  const [totalSearched, setTotalSearched] = useState(0);
  const [error, setError] = useState('');

  const login = useGoogleLogin({
    onSuccess: async res => { setToken(res.access_token); await run(res.access_token); },
    onError: () => { setError('Google sign-in was cancelled or failed.'); setStatus('error'); },
    scope: 'https://www.googleapis.com/auth/spreadsheets',
  });

  async function run(accessToken) {
    setStatus('working');
    setError('');
    let savedCount = 0;
    try {
      const { toFind, cols } = await buildInstagramUpdates(accessToken);
      setTotalSearched(toFind.length);
      setProgress({ done: 0, total: toFind.length, current: '', found: 0 });

      if (toFind.length === 0) { setStatus('done'); setFilled(0); return; }

      for (const { rowNum, name, current } of toFind) {
        setProgress(p => ({ ...p, current: name }));
        const result = await lookupInstagramHandle(name);
        if (result) {
          const { handle, followers: searchFollowers } = result;
          const username = handle.replace(/^@/, '');
          const igUrl = `https://www.instagram.com/${username}/`;

          const updates = [{ range: `${cols.ig}${rowNum}`, value: handle }];
          if (cols.website) updates.push({ range: `${cols.website}${rowNum}`, value: igUrl });

          // Also fetch the full IG profile page for extra data.
          // Use the search-snippet followers as a reliable fallback when the
          // profile page is blocked (which Instagram does frequently).
          let profileFollowers = 0;
          try {
            const profile = await lookupInstagramProfile(username);
            profileFollowers = profile.followers || 0;
            // Email + engagement — always overwrite with latest values
            if (profile.email && cols.email)
              updates.push({ range: `${cols.email}${rowNum}`, value: profile.email });
            if (profile.engagement != null && cols.engagement)
              updates.push({ range: `${cols.engagement}${rowNum}`, value: `${profile.engagement}%` });
            // Location + niche — fill in only if currently blank
            if (profile.location && !current.location && cols.location)
              updates.push({ range: `${cols.location}${rowNum}`, value: profile.location });
            if (profile.niche && !current.niche && cols.niche)
              updates.push({ range: `${cols.niche}${rowNum}`, value: profile.niche });
          } catch { /* profile page blocked — proceed with search data */ }

          // Prefer the scraped page count; fall back to the search-snippet count
          const followers = profileFollowers > 0 ? profileFollowers : searchFollowers;
          if (followers > 0 && cols.followers)
            updates.push({ range: `${cols.followers}${rowNum}`, value: String(followers) });

          await writeNiches(accessToken, updates);
          savedCount++;
        }
        setProgress(p => ({ done: p.done + 1, total: p.total, current: name, found: savedCount }));
        await sleep(800);
      }

      setFilled(savedCount);
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

  if (status === 'idle') return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:border-purple-400 hover:text-purple-700 hover:bg-purple-50 transition-colors shadow-sm"
    >
      <Search size={15} />
      Find IG Handles
    </button>
  );

  if (status === 'working') return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl min-w-[240px]">
      <Loader2 size={15} className="text-blue-600 animate-spin flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-blue-700">
          Searching {progress.done}/{progress.total}
          {progress.found > 0 && <span className="text-blue-500"> · {progress.found} found</span>}
        </p>
        {progress.current && <p className="text-xs text-blue-400 truncate">{progress.current}</p>}
      </div>
    </div>
  );

  if (status === 'done') return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl">
      <CheckCircle size={15} className="text-green-600 flex-shrink-0" />
      <p className="text-sm font-medium text-green-700">
        {totalSearched === 0
          ? 'All handles already filled'
          : filled > 0
            ? `${filled}/${totalSearched} handles saved to sheet!`
            : `Searched ${totalSearched} names — none found (search may be blocked)`}
      </p>
      <button onClick={() => setStatus('idle')} className="ml-1 text-green-600 hover:text-green-800 transition-colors" title="Run again">
        <RefreshCw size={13} />
      </button>
    </div>
  );

  return (
    <div className="flex items-start gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl max-w-xs">
      <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm text-red-700 leading-tight">{error}</p>
        <button onClick={() => setStatus('idle')} className="text-xs text-red-600 underline mt-0.5">Try again</button>
      </div>
    </div>
  );
}
