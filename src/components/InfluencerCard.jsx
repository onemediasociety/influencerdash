import { MapPin, Users, TrendingUp, Bookmark, BookmarkCheck, Mail } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../context/AppContext';

function formatFollowers(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export default function InfluencerCard({ influencer, onClick }) {
  const { campaigns, addInfluencerToCampaign, removeInfluencerFromCampaign, getCampaignsForInfluencer } = useApp();
  const [showSaveMenu, setShowSaveMenu] = useState(false);

  const savedIn = getCampaignsForInfluencer(influencer.id);
  const isSavedAnywhere = savedIn.length > 0;

  function toggleSave(e, campaignId) {
    e.stopPropagation();
    const inCampaign = campaigns.find(c => c.id === campaignId)?.influencerIds.includes(influencer.id);
    if (inCampaign) removeInfluencerFromCampaign(campaignId, influencer.id);
    else addInfluencerToCampaign(campaignId, influencer.id);
  }

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all cursor-pointer group relative"
    >
      {/* Save button */}
      <div className="absolute top-3 right-3 z-10" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setShowSaveMenu(v => !v)}
          className={`p-2 rounded-lg transition-all shadow-sm border border-gray-200 ${
            isSavedAnywhere
              ? 'bg-purple-100 text-purple-600'
              : 'bg-white text-gray-400 hover:text-purple-600 hover:bg-purple-50 opacity-0 group-hover:opacity-100'
          }`}
        >
          {isSavedAnywhere ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        </button>

        {showSaveMenu && (
          <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50">
            <p className="text-xs font-semibold text-gray-400 px-3 py-1.5 uppercase tracking-wider">Save to campaign</p>
            {campaigns.length === 0 && <p className="text-sm text-gray-500 px-3 py-2">No campaigns yet</p>}
            {campaigns.map(c => {
              const saved = c.influencerIds.includes(influencer.id);
              return (
                <button key={c.id} onClick={e => toggleSave(e, c.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="flex-1 text-left truncate">{c.name}</span>
                  {saved && <BookmarkCheck size={13} className="text-purple-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <img
            src={influencer.avatar}
            alt={influencer.name}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100 flex-shrink-0 bg-gray-100"
            onError={e => { e.target.src = influencer.avatarFallback || `https://ui-avatars.com/api/?name=${encodeURIComponent(influencer.name)}&background=8b5cf6&color=fff&size=150`; }}
          />
          <div className="min-w-0 pr-8">
            <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">{influencer.name}</h3>
            <p className="text-purple-500 text-xs truncate">{influencer.handle}</p>
            {(influencer.city || influencer.country) && (
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                <MapPin size={11} className="flex-shrink-0" />
                <span className="truncate">
                  {[influencer.city, influencer.country].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Industry tag — only if present */}
        {influencer.industry && (
          <div className="mb-3">
            <span className="inline-block text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full font-medium">
              {influencer.industry}
            </span>
          </div>
        )}

        {/* Bio — only if present */}
        {influencer.bio && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-4 leading-relaxed">{influencer.bio}</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 mt-3">
          {influencer.followers > 0 && (
            <div className="flex items-center gap-1.5 text-gray-700">
              <Users size={13} className="text-gray-400" />
              <span className="font-semibold text-sm">{formatFollowers(influencer.followers)}</span>
            </div>
          )}
          {influencer.engagement !== null && (
            <div className="flex items-center gap-1.5">
              <TrendingUp size={13} className="text-green-500" />
              <span className="font-semibold text-sm text-green-600">{influencer.engagement}%</span>
            </div>
          )}
          {influencer.email && (
            <div className="flex items-center gap-1 text-gray-400 ml-auto">
              <Mail size={13} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
