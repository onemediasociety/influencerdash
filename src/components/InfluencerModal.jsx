import { X, MapPin, Users, TrendingUp, Mail, BookmarkCheck, Bookmark, Heart, Eye, ExternalLink, Globe, FileText } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Avatar from './Avatar';

function formatFollowers(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toString();
}

function StatBox({ icon, value, label, color = 'text-gray-900' }) {
  return (
    <div className="flex-1 text-center py-4 px-2">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1">
        {icon}
        {label}
      </p>
    </div>
  );
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

  const stats = [
    influencer.followers > 0        && { value: formatFollowers(influencer.followers), label: 'Followers',  icon: <Users size={11} />,      color: 'text-gray-900' },
    influencer.engagement !== null   && { value: `${influencer.engagement}%`,           label: 'Eng. Rate',  icon: <TrendingUp size={11} />,  color: 'text-green-600' },
    influencer.avgLikes   !== null   && { value: formatFollowers(influencer.avgLikes),   label: 'Avg Likes',  icon: <Heart size={11} />,       color: 'text-pink-600' },
    influencer.avgViews   !== null   && { value: formatFollowers(influencer.avgViews),   label: 'Avg Views',  icon: <Eye size={11} />,         color: 'text-blue-600' },
  ].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">

        {/* Gradient banner + avatar */}
        <div className="relative flex-shrink-0">
          <div className="h-28 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 rounded-t-2xl" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-white/20 hover:bg-white/40 text-white rounded-full p-1.5 transition-colors backdrop-blur-sm"
          >
            <X size={16} />
          </button>

          {/* Avatar floats over banner */}
          <div className="px-6 pb-0">
            <div className="flex items-end gap-4 -mt-10">
              <Avatar photoUrl={influencer.photoUrl} name={influencer.name} size={88} ringClass="ring-4 ring-white shadow-lg" />
              <div className="pb-2 flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900 truncate leading-tight">{influencer.name}</h2>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {influencer.instagramUrl ? (
                    <a
                      href={influencer.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 text-sm font-medium hover:text-purple-800 hover:underline"
                    >
                      {influencer.handle}
                    </a>
                  ) : (
                    <span className="text-purple-600 text-sm font-medium">{influencer.handle}</span>
                  )}
                  {influencer.industry && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                      {influencer.industry}
                    </span>
                  )}
                </div>
                {(influencer.city || influencer.country) && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                    <MapPin size={11} />
                    {[influencer.city, influencer.country].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pt-4 pb-6 space-y-5 flex-1">

          {/* Bio */}
          {influencer.bio && (
            <div className="flex items-start gap-2 text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-4">
              <FileText size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <p>{influencer.bio}</p>
            </div>
          )}

          {/* Stats row */}
          {stats.length > 0 && (
            <div className="flex divide-x divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden bg-gray-50">
              {stats.map((s, i) => (
                <StatBox key={i} value={s.value} label={s.label} icon={s.icon} color={s.color} />
              ))}
            </div>
          )}

          {/* Contact & Links */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact & Links</h4>
            <div className="space-y-2">

              {influencer.instagramUrl && (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ExternalLink size={13} className="text-white" />
                  </div>
                  <span className="text-sm text-gray-600 flex-1 truncate">{influencer.instagramUrl}</span>
                  <a
                    href={influencer.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium bg-pink-100 text-pink-700 hover:bg-pink-200 flex-shrink-0 transition-colors"
                  >
                    Open
                  </a>
                </div>
              )}

              {influencer.email && (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail size={13} className="text-purple-600" />
                  </div>
                  <span className="text-sm text-gray-600 flex-1 truncate">{influencer.email}</span>
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

              {!influencer.email && !influencer.instagramUrl && (
                <p className="text-sm text-gray-400 text-center py-3">No contact info available</p>
              )}
            </div>

            {influencer.email && (
              <a
                href={`mailto:${influencer.email}?subject=Brand Collaboration Inquiry&body=Hi ${influencer.name},%0D%0A%0D%0AWe'd love to discuss a potential collaboration with you.%0D%0A%0D%0ABest regards`}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm"
              >
                <Mail size={14} />
                Send Outreach Email
              </a>
            )}
          </div>

          {/* Save to campaign */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Save to Campaign</h4>
            {campaigns.length === 0 ? (
              <p className="text-sm text-gray-400">No campaigns yet — create one in the sidebar.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {campaigns.map(c => {
                  const saved = c.influencerIds.includes(influencer.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleCampaign(c.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        saved
                          ? 'border-purple-300 bg-purple-50 text-purple-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="truncate flex-1 text-left">{c.name}</span>
                      {saved
                        ? <BookmarkCheck size={14} className="flex-shrink-0 text-purple-500" />
                        : <Bookmark size={14} className="flex-shrink-0 text-gray-300" />}
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
