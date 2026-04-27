import { MapPin, TrendingUp, Users, Bookmark, BookmarkCheck, Mail } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Avatar from './Avatar';

function formatFollowers(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toString();
}

export default function InfluencerCard({ influencer, onClick }) {
  const { campaigns, addInfluencerToCampaign, removeInfluencerFromCampaign, getCampaignsForInfluencer } = useApp();
  const [showSaveMenu, setShowSaveMenu] = useState(false);

  const savedIn        = getCampaignsForInfluencer(influencer.id);
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
      className="bg-white rounded-2xl border border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all cursor-pointer group relative flex flex-col"
    >
      {/* Save button */}
      <div className="absolute top-3 right-3 z-10" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setShowSaveMenu(v => !v)}
          className={`p-1.5 rounded-lg transition-all shadow-sm border ${
            isSavedAnywhere
              ? 'bg-purple-100 text-purple-600 border-purple-200'
              : 'bg-white text-gray-400 border-gray-200 hover:text-purple-600 hover:bg-purple-50 opacity-0 group-hover:opacity-100'
          }`}
        >
          {isSavedAnywhere ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
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

      {/* Photo + identity */}
      <div className="p-5 flex flex-col items-center text-center flex-1">
        <div className="mb-3">
          <Avatar photoUrl={influencer.photoUrl} name={influencer.name} size={72} ringClass="ring-2 ring-purple-100" />
        </div>

        <h3 className="font-bold text-gray-900 text-sm leading-tight mb-0.5 truncate w-full px-4">
          {influencer.name}
        </h3>

        {influencer.instagramUrl ? (
          <a
            href={influencer.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-purple-500 text-xs hover:text-purple-700 hover:underline mb-2 block"
          >
            {influencer.handle}
          </a>
        ) : (
          <p className="text-purple-500 text-xs mb-2">{influencer.handle}</p>
        )}

        {(influencer.city || influencer.country) && (
          <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-3">
            <MapPin size={11} className="flex-shrink-0" />
            <span className="truncate">{[influencer.city, influencer.country].filter(Boolean).join(', ')}</span>
          </div>
        )}

        {influencer.industry && (
          <span className="inline-block text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full font-medium mb-3">
            {influencer.industry}
          </span>
        )}

        {influencer.bio && (
          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-3 px-1">{influencer.bio}</p>
        )}
      </div>

      {/* Stats footer */}
      <div className="border-t border-gray-100 flex divide-x divide-gray-100">
        {influencer.followers > 0 && (
          <div className="flex-1 px-3 py-2.5 text-center">
            <p className="text-sm font-bold text-gray-900">{formatFollowers(influencer.followers)}</p>
            <p className="text-xs text-gray-400">Followers</p>
          </div>
        )}
        {influencer.engagement !== null && (
          <div className="flex-1 px-3 py-2.5 text-center">
            <p className="text-sm font-bold text-green-600">{influencer.engagement}%</p>
            <p className="text-xs text-gray-400">Eng. Rate</p>
          </div>
        )}
        {influencer.email && !(influencer.followers > 0) && !(influencer.engagement !== null) && (
          <div className="flex-1 px-3 py-2.5 flex items-center justify-center text-gray-400">
            <Mail size={14} />
          </div>
        )}
        {/* Show email icon alongside stats */}
        {influencer.email && (influencer.followers > 0 || influencer.engagement !== null) && (
          <div className="px-3 py-2.5 flex items-center justify-center text-gray-300">
            <Mail size={13} />
          </div>
        )}
      </div>
    </div>
  );
}
