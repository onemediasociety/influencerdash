import { Search, FolderOpen, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../context/AppContext';

const CAMPAIGN_COLORS = [
  '#8b5cf6', '#ec4899', '#3b82f6', '#10b981',
  '#f59e0b', '#ef4444', '#06b6d4', '#84cc16',
];

export default function Sidebar() {
  const { campaigns, activePage, setActivePage, addCampaign, renameCampaign, deleteCampaign } = useApp();
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);
  const [pickedColor, setPickedColor] = useState(CAMPAIGN_COLORS[0]);

  function startEdit(c) {
    setEditingId(c.id);
    setEditName(c.name);
  }

  function confirmEdit() {
    if (editName.trim()) renameCampaign(editingId, editName.trim());
    setEditingId(null);
  }

  function handleCreate() {
    if (!newCampaignName.trim()) return;
    const id = addCampaign(newCampaignName.trim(), pickedColor);
    setActivePage(`campaign:${id}`);
    setNewCampaignName('');
    setPickedColor(CAMPAIGN_COLORS[0]);
    setShowNewInput(false);
  }

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-white text-sm font-bold">I</span>
          </div>
          <span className="font-semibold text-gray-900 text-lg">InfluencerHub</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 py-4 flex-1 overflow-y-auto">
        <button
          onClick={() => setActivePage('search')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors ${
            activePage === 'search'
              ? 'bg-purple-50 text-purple-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Search size={16} />
          Discover Influencers
        </button>

        <div className="mt-6 mb-2 px-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Campaigns</span>
          <button
            onClick={() => setShowNewInput(true)}
            className="text-gray-400 hover:text-purple-600 transition-colors"
            title="New campaign"
          >
            <Plus size={15} />
          </button>
        </div>

        {/* New campaign input */}
        {showNewInput && (
          <div className="mb-2 px-1">
            <input
              autoFocus
              value={newCampaignName}
              onChange={e => setNewCampaignName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewInput(false); }}
              placeholder="Campaign name..."
              className="w-full text-sm border border-purple-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-200 mb-2"
            />
            <div className="flex gap-1 mb-2 flex-wrap">
              {CAMPAIGN_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setPickedColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${pickedColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} className="flex-1 text-xs bg-purple-600 text-white rounded-lg py-1.5 hover:bg-purple-700 transition-colors">
                Create
              </button>
              <button onClick={() => setShowNewInput(false)} className="text-xs text-gray-500 px-2 hover:text-gray-700">
                Cancel
              </button>
            </div>
          </div>
        )}

        {campaigns.map(c => {
          const isActive = activePage === `campaign:${c.id}`;
          return (
            <div key={c.id} className="group relative">
              {editingId === c.id ? (
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditingId(null); }}
                    className="flex-1 text-sm border border-purple-300 rounded px-2 py-1 outline-none min-w-0"
                  />
                  <button onClick={confirmEdit} className="text-green-500 hover:text-green-700 flex-shrink-0"><Check size={13} /></button>
                  <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={13} /></button>
                </div>
              ) : (
                <button
                  onClick={() => setActivePage(`campaign:${c.id}`)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${
                    isActive ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="truncate flex-1 text-left">{c.name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{c.influencerIds.length}</span>
                </button>
              )}

              {editingId !== c.id && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={e => { e.stopPropagation(); startEdit(c); }}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <Edit2 size={11} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteCampaign(c.id); if (isActive) setActivePage('search'); }}
                    className="p-1 text-gray-400 hover:text-red-500 rounded"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {campaigns.length === 0 && (
          <p className="text-xs text-gray-400 px-3 mt-1">No campaigns yet</p>
        )}
      </nav>

      <div className="px-4 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">30 influencers indexed</p>
      </div>
    </aside>
  );
}
