import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { GitMerge, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { findAndMergeDuplicates, writeNiches, deleteSheetRows } from '../services/sheetsApi';

export default function DeduplicateButton() {
  const { sync } = useApp();
  const [token, setToken]   = useState(null);
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState({ removed: 0 });
  const [error, setError]   = useState('');

  const login = useGoogleLogin({
    onSuccess: async res => { setToken(res.access_token); await run(res.access_token); },
    onError: () => { setError('Google sign-in failed.'); setStatus('error'); },
    scope: 'https://www.googleapis.com/auth/spreadsheets',
  });

  async function run(accessToken) {
    setStatus('working');
    setError('');
    try {
      const { mergeUpdates, rowsToDelete } = await findAndMergeDuplicates(accessToken);
      if (mergeUpdates.length > 0) await writeNiches(accessToken, mergeUpdates);
      if (rowsToDelete.length > 0) await deleteSheetRows(accessToken, rowsToDelete);
      setResult({ removed: rowsToDelete.length });
      setStatus('done');
      if (rowsToDelete.length > 0) sync();
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  if (status === 'working') return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
      <Loader2 size={15} className="text-indigo-600 animate-spin flex-shrink-0" />
      <span className="text-sm font-medium text-indigo-700">Checking duplicates…</span>
    </div>
  );

  if (status === 'done') return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl">
      <CheckCircle size={15} className="text-green-600 flex-shrink-0" />
      <span className="text-sm font-medium text-green-700">
        {result.removed === 0
          ? 'No duplicates found'
          : `${result.removed} duplicate${result.removed !== 1 ? 's' : ''} removed`}
      </span>
      <button onClick={() => setStatus('idle')} className="ml-1 text-green-500 hover:text-green-700 transition-colors" title="Dismiss">
        <X size={13} />
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
    <button
      onClick={() => (!token ? login() : run(token))}
      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:border-purple-400 hover:text-purple-700 hover:bg-purple-50 transition-colors"
    >
      <GitMerge size={14} />
      Deduplicate
    </button>
  );
}
