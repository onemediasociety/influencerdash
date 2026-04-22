import { X, MapPin, Users, TrendingUp, Mail, BookmarkCheck, Bookmark, Heart, Eye, DollarSign, Languages, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../context/AppContext';

function formatFollowers(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export default function InfluencerModal({ influencer, onClose }) {
  const { campaigns, addInfluencerToCampaign, removeInfluencerFromCampaign } = useApp();
  const [emailCopied, setEmailCopied] = useState(false);

  function copyEmail() {
    navigator.clipboard.writeText(influencer.email).then(() => {
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    });
  }

  function toggleCampaign(campaignId) {
    const inCampaign = campaigns.find(c => c.id === campaignId)?.influencerIds.includes(influencer.id);
    if (inCampaign) removeInfluencerFromCampaign(campaignId, influencer.id);
    else addInfluencerToCampaign(campaignId, influencer.id);
  }

  // Build stats grid only from available data
  const stats = [
    influencer.followers > 0 && { icon: <Users size={16} />, color: 'bg-purple-50 text-purple-500', value: formatFollowers(influencer.followers), label: 'Followers' },
    influencer.engagement !== null && { icon: <TrendingUp size={16} />, color: 'bg-green-50 text-green-500', value: `${influencer.engagement}%`, label: 'Engagement' },
    influencer.avgLikes !== null && { icon: <Heart size={16} />, color: 'bg-pink-50 text-pink-500', value: formatFollowers(influencer.avgLikes), label: 'Avg Likes' },
    influencer.avgViews !== null && { icon: <Eye size={16} />, color: 'bg-blue-50 text-blue-500', value: formatFollowers(influencer.avgViews), label: 'Avg Views' },
  ].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="relative">
          <div className="h-24 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 rounded-t-2xl" />
          <button onClick={onClose} className="absolute top-3 right-3 bg-white/20 hover:bg-white/40 text-white rounded-full p-1.5 transition-colors">
            <X size={18} />
          </button>
          <div className="px-6 pb-4">
            <div className="flex items-end gap-4 -mt-8">
              <img
                src={influencer.avatar}
                alt={influencer.name}
                className="w-20 h-20 rounded-full ring-4 ring-white object-cover flex-shrink-0 bg-gray-100"
                onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(influencer.name)}&background=8b5cf6&color=fff&size=150`; }}
              />
              <div className="mb-1 flex-1 min-w-0">
                <h2 className="text-xl font-bold text-gray-900 truncate">{influencer.name}</h2>
                <p className="text-purple-600 text-sm">{influencer.handle}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Location + industry tags */}
          <div className="flex flex-wrap gap-2">
            {(influencer.city || influencer.country) && (
              <span className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                <MapPin size={14} />
                {[influencer.city, influencer.country].filter(Boolean).join(', ')}
              </span>
            )}
            {influencer.industry && (
              <span className="text-sm bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full font-medium">
                {influencer.industry}
              </span>
            )}
          </div>

          {/* Bio */}
          {influencer.bio && <p className="text-gray-600 text-sm leading-relaxed">{influencer.bio}</p>}

          {/* Stats grid — only what's available */}
          {stats.length > 0 && (
            <div className={`grid gap-3 ${stats.length === 1 ? 'grid-cols-1' : stats.length === 2 ? 'grid-cols-2' : stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
              {stats.map((s, i) => (
                <div key={i} className={`${s.color.split(' ')[0]} rounded-xl p-3 text-center`}>
                  <div className={`flex items-center justify-center mb-1 ${s.color.split(' ')[1]}`}>{s.icon}</div>
                  <p className="text-xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Languages */}
          {influencer.languages?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Languages</h4>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Languages size={14} className="text-gray-400" />
                {influencer.languages.map((lang, i) => (
                  <span key={lang} className="text-sm text-gray-600">
                    {lang}{i < influencer.languages.length - 1 ? ',' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Pricing */}
          {influencer.pricePerPost && (
            <div className="bg-amber-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-700">
                <DollarSign size={16} />
                <span className="font-semibold text-sm">Estimated rate per post</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">${influencer.pricePerPost.toLocaleString()}</p>
            </div>
          )}

          {/* Contact */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact & Links</h4>
            <div className="space-y-2">

              {/* Instagram link */}
              {influencer.instagramUrl && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ExternalLink size={14} className="text-white" />
                  </div>
                  <span className="text-sm text-gray-700 flex-1 truncate">{influencer.instagramUrl}</span>
                  <a
                    href={influencer.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium bg-pink-100 text-pink-700 hover:bg-pink-200 flex-shrink-0 transition-colors"
                  >
                    View
                  </a>
                </div>
              )}

              {/* Email */}
              {influencer.email && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail size={15} className="text-purple-600" />
                  </div>
                  <span className="text-sm text-gray-700 flex-1 truncate">{influencer.email}</span>
                  <button
                    onClick={copyEmail}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all flex-shrink-0 ${
                      emailCopied ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    {emailCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}
            </div>

            {/* Outreach button */}
            {influencer.email && (
              <a
                href={`mailto:${influencer.email}?subject=Brand Collaboration Inquiry&body=Hi ${influencer.name},%0D%0A%0D%0AWe'd love to discuss a potential collaboration with you.%0D%0A%0D%0ABest regards`}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2.5 rounded-xl font-medium text-sm hover:opacity-90 transition-opacity"
              >
                <Mail size={15} />
                Send Outreach Email
              </a>
            )}

            {!influencer.email && !influencer.instagramUrl && (
              <p className="text-sm text-gray-400 text-center py-2">No contact info available</p>
            )}
          </div>

          {/* Save to campaign */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Save to Campaign</h4>
            {campaigns.length === 0 ? (
              <p className="text-sm text-gray-500">No campaigns yet — create one in the sidebar.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {campaigns.map(c => {
                  const saved = c.influencerIds.includes(influencer.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleCampaign(c.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        saved ? 'border-purple-300 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="truncate flex-1 text-left">{c.name}</span>
                      {saved ? <BookmarkCheck size={14} className="flex-shrink-0 text-purple-500" /> : <Bookmark size={14} className="flex-shrink-0 text-gray-300" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
