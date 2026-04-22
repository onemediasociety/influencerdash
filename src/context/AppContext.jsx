import { createContext, useContext, useState, useCallback } from 'react';
import { useSheetInfluencers } from '../hooks/useSheetInfluencers';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { influencers, loading, error, sync, lastSync } = useSheetInfluencers();

  const [campaigns, setCampaigns] = useState([
    { id: 'default', name: 'Untitled Campaign', color: '#8b5cf6', influencerIds: [], createdAt: new Date() },
  ]);
  const [activePage, setActivePage] = useState('search');

  const addCampaign = useCallback((name, color = '#8b5cf6') => {
    const id = `campaign_${Date.now()}`;
    setCampaigns(prev => [...prev, { id, name, color, influencerIds: [], createdAt: new Date() }]);
    return id;
  }, []);

  const renameCampaign = useCallback((id, name) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  }, []);

  const deleteCampaign = useCallback((id) => {
    setCampaigns(prev => prev.filter(c => c.id !== id));
  }, []);

  const addInfluencerToCampaign = useCallback((campaignId, influencerId) => {
    setCampaigns(prev =>
      prev.map(c =>
        c.id === campaignId
          ? { ...c, influencerIds: c.influencerIds.includes(influencerId) ? c.influencerIds : [...c.influencerIds, influencerId] }
          : c
      )
    );
  }, []);

  const removeInfluencerFromCampaign = useCallback((campaignId, influencerId) => {
    setCampaigns(prev =>
      prev.map(c =>
        c.id === campaignId
          ? { ...c, influencerIds: c.influencerIds.filter(id => id !== influencerId) }
          : c
      )
    );
  }, []);

  const getCampaignsForInfluencer = useCallback((influencerId) => {
    return campaigns.filter(c => c.influencerIds.includes(influencerId));
  }, [campaigns]);

  return (
    <AppContext.Provider value={{
      // sheet data
      influencers,
      loading,
      error,
      sync,
      lastSync,
      // campaigns
      campaigns,
      activePage,
      setActivePage,
      addCampaign,
      renameCampaign,
      deleteCampaign,
      addInfluencerToCampaign,
      removeInfluencerFromCampaign,
      getCampaignsForInfluencer,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
