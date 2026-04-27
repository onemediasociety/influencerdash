import { useState } from 'react';
import { Camera, X, Search, Loader2, CheckCircle, AlertCircle, ExternalLink, Plus } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { useApp } from '../context/AppContext';
import { getSavedMetaAuth, connectMeta, lookupInstagramProfile, clearMetaAuth } from '../services/metaApi';
import { appendInfluencerRow } from '../services/sheetsApi';
import Avatar from './Avatar';

function formatFollowers(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toString();
}

export default function MetaLookup() {
  const { sync } = useApp();
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState(() => getSavedMetaAuth());
  const [appIdInput, setAppIdInput] = useState(() => getSavedMetaAuth()?.appId || '');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');

  const [username, setUsername] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [result, setResult] = useState(null);

  const [addStatus, setAddStatus] = useState('idle'); // idle | loading | done | error
  const [addError, setAddError] = useState('');
  const [googleToken, setGoogleToken] = useState(null);

  const loginGoogle = useGoogleLogin({
    onSuccess: async res => {
      setGoogleToken(res.access_token);
      await addToSheet(res.access_token);
    },
    onError: () => {
      setAddError('Google sign-in failed.');
      setAddStatus('error');
    },
    scope: 'https://www.googleapis.com/auth/spreadsheets',
  });

  async function handleConnect() {
    if (!appIdInput.trim()) return;
    setConnecting(true);
    setConnectError('');
    try {
      const newAuth = await connectMeta(appIdInput);
      setAuth(newAuth);
    } catch (err) {
      setConnectError(err.message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleSearch(e) {
    e?.preventDefault();
    if (!username.trim() || !auth) return;
    setSearching(true);
    setSearchError('');
    setResult(null);
    setAddStatus('idle');
    setAddError('');
    try {
      const profile = await lookupInstagramProfile(username, auth.igAccountId, auth.token);
      setResult(profile);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function addToSheet(accessToken) {
    if (!result) return;
    setAddStatus('loading');
    setAddError('');
    try {
      await appendInfluencerRow(accessToken, {
        name:       result.name,
        handle:     `@${result.username}`,
        followers:  result.followers,
        engagement: result.engagement,
        bio:        result.bio,
        email:      '',
        location:   '',
        niche:      '',
        photoUrl:   result.photoUrl,
      });
      setAddStatus('done');
      sync();
    } catch (err) {
      setAddError(err.message);
      setAddStatus('error');
    }
  }

  function handleAddClick() {
    if (googleToken) addToSheet(googleToken);
    else loginGoogle();
  }

  function handleDisconnect() {
    clearMetaAuth();
    setAuth(null);
    setResult(null);
    setUsername('');
  }

  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:border-pink-400 hover:text-pink-700 hover:bg-pink-50 transition-colors"
      >
        <Camera size={14} />
        Instagram Lookup
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Camera size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 text-sm">Instagram Lookup</h2>
                  <p className="text-xs text-gray-400">Search any public professional account by username</p>
                </div>
              </div>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors ml-4">
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              {!auth ? (
                /* ── Setup screen ── */
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                    <p className="text-sm font-semibold text-blue-900">One-time setup (5 minutes)</p>
                    <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1.5">
                      <li>Go to <strong>developers.facebook.com</strong> → My Apps → Create App → <em>Consumer</em></li>
                      <li>Add the <strong>Instagram Graph API</strong> product to your app</li>
                      <li>In Facebook Login settings, add <code className="bg-blue-100 px-1 rounded text-xs">http://localhost:5173</code> to Valid OAuth Redirect URIs</li>
                      <li>Copy your <strong>App ID</strong> and paste it below</li>
                    </ol>
                    <p className="text-xs text-blue-600 pt-1">
                      Your Instagram must be a <strong>Business or Creator</strong> account connected to a Facebook Page. Only works on public professional accounts.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Facebook App ID
                    </label>
                    <input
                      type="text"
                      value={appIdInput}
                      onChange={e => setAppIdInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleConnect()}
                      placeholder="e.g. 1234567890123456"
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 font-mono"
                    />
                  </div>

                  {connectError && (
                    <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl p-3">
                      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                      <span>{connectError}</span>
                    </div>
                  )}

                  <button
                    onClick={handleConnect}
                    disabled={!appIdInput.trim() || connecting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {connecting ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                    {connecting ? 'Connecting…' : 'Connect with Facebook'}
                  </button>
                </div>
              ) : (
                /* ── Search screen ── */
                <div className="space-y-4">
                  {/* Connected badge */}
                  <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-green-600 flex-shrink-0" />
                      <span className="text-sm text-green-700 font-medium">Connected via {auth.pageName}</span>
                    </div>
                    <button
                      onClick={handleDisconnect}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>

                  {/* Search */}
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">@</span>
                      <input
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value.replace(/^@/, ''))}
                        placeholder="username"
                        autoFocus
                        className="w-full pl-8 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-colors"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!username.trim() || searching}
                      className="px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                    >
                      {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                      {searching ? 'Searching…' : 'Look up'}
                    </button>
                  </form>

                  {searchError && (
                    <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl p-3">
                      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                      <span>{searchError}</span>
                    </div>
                  )}

                  {result && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      {/* Profile */}
                      <div className="p-4 flex items-start gap-3">
                        <Avatar photoUrl={result.photoUrl} name={result.name} size={56} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{result.name}</p>
                          <p className="text-sm text-purple-600">@{result.username}</p>
                          {result.bio && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{result.bio}</p>
                          )}
                        </div>
                        <a
                          href={`https://www.instagram.com/${result.username}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5"
                          title="Open on Instagram"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>

                      {/* Stats */}
                      <div className="flex border-t border-gray-100 divide-x divide-gray-100 bg-gray-50">
                        <div className="flex-1 px-4 py-3 text-center">
                          <p className="text-base font-bold text-gray-900">{formatFollowers(result.followers)}</p>
                          <p className="text-xs text-gray-400">Followers</p>
                        </div>
                        {result.engagement !== null && (
                          <div className="flex-1 px-4 py-3 text-center">
                            <p className="text-base font-bold text-green-600">{result.engagement}%</p>
                            <p className="text-xs text-gray-400">Engagement</p>
                          </div>
                        )}
                        <div className="flex-1 px-4 py-3 text-center">
                          <p className="text-base font-bold text-gray-900">{result.mediaCount}</p>
                          <p className="text-xs text-gray-400">Posts</p>
                        </div>
                      </div>

                      {/* Add to sheet */}
                      <div className="px-4 pb-4 pt-3 border-t border-gray-100">
                        {addStatus === 'done' ? (
                          <div className="flex items-center justify-center gap-2 py-2.5 text-green-700 text-sm font-medium">
                            <CheckCircle size={15} />
                            Added to your sheet
                          </div>
                        ) : (
                          <>
                            {addError && (
                              <p className="text-xs text-red-600 mb-2">{addError}</p>
                            )}
                            <button
                              onClick={handleAddClick}
                              disabled={addStatus === 'loading'}
                              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                              {addStatus === 'loading'
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Plus size={14} />}
                              {addStatus === 'loading' ? 'Adding to sheet…' : 'Add to Sheet'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
