import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { X, Search, Loader2, AlertCircle, CheckCircle, UserPlus } from 'lucide-react';
import { lookupInstagramProfile } from '../services/instagramLookup';
import { appendInfluencerRow } from '../services/sheetsApi';
import { useApp } from '../context/AppContext';

function Field({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
      />
    </div>
  );
}

export default function AddInfluencerModal({ onClose }) {
  const { sync } = useApp();
  const [step, setStep] = useState('input'); // input | searching | preview | saving | done | error
  const [handle, setHandle] = useState('');
  const [profile, setProfile] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [token, setToken] = useState(null);

  const login = useGoogleLogin({
    onSuccess: async res => {
      setToken(res.access_token);
      await save(res.access_token);
    },
    onError: () => {
      setErrorMsg('Google sign-in was cancelled or failed.');
      setStep('error');
    },
    scope: 'https://www.googleapis.com/auth/spreadsheets',
  });

  async function search() {
    if (!handle.trim()) return;
    setStep('searching');
    setErrorMsg('');
    try {
      const result = await lookupInstagramProfile(handle.trim());
      setProfile(result);
      setStep('preview');
    } catch (err) {
      setErrorMsg(err.message || 'Could not look up that profile.');
      setStep('error');
    }
  }

  async function save(accessToken) {
    setStep('saving');
    setErrorMsg('');
    try {
      await appendInfluencerRow(accessToken, profile);
      await sync();
      setStep('done');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save to sheet.');
      setStep('error');
    }
  }

  function handleSave() {
    if (!token) login(); else save(token);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-purple-600" />
            <h2 className="text-base font-semibold text-gray-900">Add Influencer</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Step: input */}
          {(step === 'input' || step === 'searching') && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Enter an Instagram handle and we'll look up their profile info automatically.</p>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                  <input
                    type="text"
                    value={handle}
                    onChange={e => setHandle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && search()}
                    placeholder="username"
                    autoFocus
                    disabled={step === 'searching'}
                    className="w-full pl-7 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 disabled:opacity-50"
                  />
                </div>
                <button
                  onClick={search}
                  disabled={!handle.trim() || step === 'searching'}
                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {step === 'searching' ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                  {step === 'searching' ? 'Searching…' : 'Search'}
                </button>
              </div>
            </div>
          )}

          {/* Step: preview */}
          {step === 'preview' && profile && (
            <div className="space-y-4">
              {/* Avatar + handle */}
              <div className="flex items-center gap-3">
                <img
                  src={profile.avatar}
                  onError={e => { e.target.src = profile.avatarFallback; }}
                  alt={profile.name}
                  className="w-14 h-14 rounded-full object-cover bg-gray-100 flex-shrink-0"
                />
                <div>
                  <p className="font-semibold text-gray-900">{profile.handle}</p>
                  {profile.followers > 0 && (
                    <p className="text-sm text-gray-500">{profile.followers.toLocaleString()} followers</p>
                  )}
                </div>
              </div>

              {profile.bio && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 leading-relaxed line-clamp-3">{profile.bio}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" value={profile.name} onChange={v => setProfile(p => ({ ...p, name: v }))} />
                <Field label="Niche" value={profile.niche} onChange={v => setProfile(p => ({ ...p, niche: v }))} />
                <Field label="Location" value={profile.location} onChange={v => setProfile(p => ({ ...p, location: v }))} />
                <Field label="Email" value={profile.email} onChange={v => setProfile(p => ({ ...p, email: v }))} />
                <Field
                  label="Followers"
                  value={profile.followers > 0 ? String(profile.followers) : ''}
                  onChange={v => setProfile(p => ({ ...p, followers: parseInt(v.replace(/,/g, '')) || 0 }))}
                />
                <Field
                  label="Engagement Rate (%)"
                  value={profile.engagement != null ? String(profile.engagement) : ''}
                  onChange={v => setProfile(p => ({ ...p, engagement: parseFloat(v) || null }))}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setStep('input'); setProfile(null); }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-colors"
                >
                  Save to Sheet
                </button>
              </div>
            </div>
          )}

          {/* Step: saving */}
          {step === 'saving' && (
            <div className="flex flex-col items-center py-6 gap-3">
              <Loader2 size={28} className="text-purple-600 animate-spin" />
              <p className="text-sm text-gray-600">Saving to Google Sheet…</p>
            </div>
          )}

          {/* Step: done */}
          {step === 'done' && (
            <div className="flex flex-col items-center py-6 gap-3">
              <CheckCircle size={32} className="text-green-500" />
              <p className="text-sm font-medium text-gray-800">{profile?.handle} added to your sheet!</p>
              <div className="flex gap-2 w-full mt-1">
                <button
                  onClick={() => { setStep('input'); setHandle(''); setProfile(null); }}
                  className="flex-1 px-4 py-2 border border-gray-200 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Add Another
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Step: error */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{errorMsg}</p>
              </div>
              <button
                onClick={() => setStep('input')}
                className="w-full px-4 py-2.5 border border-gray-200 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
