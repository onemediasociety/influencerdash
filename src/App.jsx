import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import SearchPage from './pages/SearchPage';
import CampaignPage from './pages/CampaignPage';
import './index.css';

function Layout() {
  const { activePage } = useApp();

  const isCampaign = activePage.startsWith('campaign:');
  const campaignId = isCampaign ? activePage.replace('campaign:', '') : null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activePage === 'search' && <SearchPage />}
        {isCampaign && <CampaignPage campaignId={campaignId} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  );
}
