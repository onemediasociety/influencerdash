import { useState } from 'react';
import { Trash2, Mail, Users, TrendingUp, MapPin, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { influencers } from '../data/influencers';
import InfluencerModal from '../components/InfluencerModal';

function formatFollowers(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}

export default function CampaignPage({ campaignId }) {
  const { campaigns, removeInfluencerFromCampaign, renameCampaign } = useApp();
  const [selectedInfluencer, setSelectedInfluencer] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState('');

  const campaign = campaigns.find(c => c.id === campaignId);
  if (!campaign) return (
    <div className="flex-1 flex items-center justify-center text-gray-500">Campaign not found</div>
  );

  const members = influencers.filter(i => campaign.influencerIds.includes(i.id));
  const totalFollowers = members.reduce((s, i) => s + i.followers, 0);
  const avgEngagement = members.length
    ? (members.reduce((s, i) => s + i.engagement, 0) / members.length).toFixed(1)
    : 0;

  function startRename() {
    setNameVal(campaign.name);
    setEditingName(true);
  }

  function confirmRename() {
    if (nameVal.trim()) renameCampaign(campaign.id, nameVal.trim());
    setEditingName(false);
  }

  function buildMailtoAll() {
    const emails = members.filter(i => i.email).map(i => i.email).join(',');
    const subject = encodeURIComponent(`Campaign Collaboration: ${campaign.name}`);
    const body = encodeURIComponent(`Hi everyone,\n\nWe'd love to discuss a collaboration for our ${campaign.name} campaign.\n\nBest regards`);
    return `mailto:${emails}?subject=${subject}&body=${body}`;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-sm flex-shrink-0 mt-1" style={{ backgroundColor: campaign.color }} />
            <div>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={nameVal}
                    onChange={e => setNameVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setEditingName(false); }}
                    onBlur={confirmRename}
                    className="text-2xl font-bold text-gray-900 border-b-2 border-purple-400 outline-none bg-transparent"
                  />
                </div>
              ) : (
                <h1
                  className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-purple-700 transition-colors"
                  onClick={startRename}
                  title="Click to rename"
                >
                  {campaign.name}
                </h1>
              )}
              <p className="text-sm text-gray-500 mt-0.5">
                {members.length} influencer{members.length !== 1 ? 's' : ''} · Click name to rename
              </p>
            </div>
          </div>

          {members.length > 0 && (
            <a
              href={buildMailtoAll()}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:opacity-90 transition-opacity flex-shrink-0"
            >
              <Mail size={15} />
              Email All ({members.filter(i => i.email).length})
            </a>
          )}
        </div>

        {/* Stats */}
        {members.length > 0 && (
          <div className="flex gap-6 mt-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users size={15} className="text-purple-500" />
              <span className="font-semibold text-gray-900">{formatFollowers(totalFollowers)}</span>
              <span>total reach</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <TrendingUp size={15} className="text-green-500" />
              <span className="font-semibold text-gray-900">{avgEngagement}%</span>
              <span>avg engagement</span>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {members.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={24} className="text-gray-400" />
            </div>
            <h3 className="text-gray-900 font-semibold mb-1">No influencers yet</h3>
            <p className="text-sm text-gray-500">Go to Discover and save influencers to this campaign</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map(inf => (
              <div
                key={inf.id}
                className="bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all flex items-center gap-4 px-5 py-4 group cursor-pointer"
                onClick={() => setSelectedInfluencer(inf)}
              >
                <img src={inf.avatar} alt={inf.name} className="w-11 h-11 rounded-full object-cover ring-2 ring-gray-100 flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-sm">{inf.name}</h3>
                    <span className="text-xs text-purple-500">{inf.handle}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                    <MapPin size={11} />
                    <span>{inf.city}, {inf.country}</span>
                    <span className="mx-1">·</span>
                    <span>{inf.industry}</span>
                  </div>
                </div>

                <div className="flex items-center gap-5 flex-shrink-0">
                  <div className="text-center hidden sm:block">
                    <p className="font-semibold text-sm text-gray-900">{formatFollowers(inf.followers)}</p>
                    <p className="text-xs text-gray-400">followers</p>
                  </div>
                  <div className="text-center hidden sm:block">
                    <p className="font-semibold text-sm text-green-600">{inf.engagement}%</p>
                    <p className="text-xs text-gray-400">engagement</p>
                  </div>
                  {inf.email && (
                    <a
                      href={`mailto:${inf.email}?subject=Brand Collaboration Inquiry&body=Hi ${inf.name},%0D%0A%0D%0AWe'd love to discuss a potential collaboration with you.%0D%0A%0D%0ABest regards`}
                      onClick={e => e.stopPropagation()}
                      className="p-2 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors flex-shrink-0"
                      title={inf.email}
                    >
                      <Mail size={15} />
                    </a>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); removeInfluencerFromCampaign(campaign.id, inf.id); }}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                    title="Remove from campaign"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedInfluencer && (
        <InfluencerModal influencer={selectedInfluencer} onClose={() => setSelectedInfluencer(null)} />
      )}
    </div>
  );
}
