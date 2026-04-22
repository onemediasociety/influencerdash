import { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [campaigns, setCampaigns] = useState([
    { id: 'default', name: 'Untitled Campaign', color: '#8b5cf6', influencerIds: [], createdAt: new Date() },
  ]);
  const [activePage, setActivePage] = useState('search');
  const [selectedInfluencer, setSelectedInfluencer] = useState(null);

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

  const isInCampaign = useCallback((campaignId, influencerId) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign ? campaign.influencerIds.includes(influencerId) : false;
  }, [campaigns]);

  const getCampaignsForInfluencer = useCallback((influencerId) => {
    return campaigns.filter(c => c.influencerIds.includes(influencerId));
  }, [campaigns]);

  return (
    <AppContext.Provider value={{
      campaigns,
      activePage,
      setActivePage,
      selectedInfluencer,
      setSelectedInfluencer,
      addCampaign,
      renameCampaign,
      deleteCampaign,
      addInfluencerToCampaign,
      removeInfluencerFromCampaign,
      isInCampaign,
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
