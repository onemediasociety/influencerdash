import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown, RefreshCw, AlertCircle, UserPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import InfluencerCard from '../components/InfluencerCard';
import InfluencerModal from '../components/InfluencerModal';
import AddInfluencerModal from '../components/AddInfluencerModal';
import MetaSyncButton from '../components/MetaSyncButton';
import MetaLookup from '../components/MetaLookup';
import DeduplicateButton from '../components/DeduplicateButton';
import NicheResearcher from '../components/NicheResearcher';

const FOLLOWER_RANGES = [
  { label: 'All sizes',          min: 0,         max: Infinity },
  { label: 'Nano (1K–10K)',      min: 1_000,     max: 10_000 },
  { label: 'Micro (10K–100K)',   min: 10_000,    max: 100_000 },
  { label: 'Mid (100K–500K)',    min: 100_000,   max: 500_000 },
  { label: 'Macro (500K–1M)',    min: 500_000,   max: 1_000_000 },
  { label: 'Mega (1M+)',         min: 1_000_000, max: Infinity },
];

const SORT_OPTIONS = [
  { label: 'Most Followers',  value: 'followers_desc' },
  { label: 'Least Followers', value: 'followers_asc' },
  { label: 'Best Engagement', value: 'engagement_desc' },
  { label: 'Name A–Z',        value: 'name_asc' },
];

function Select({ value, onChange, options, placeholder }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none w-full text-sm bg-white border border-gray-200 rounded-xl px-4 py-2.5 pr-9 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-colors"
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
            {typeof opt === 'string' ? opt : opt.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

function formatSyncTime(date) {
  if (!date) return null;
  const diff = Math.round((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function SearchPage() {
  const { influencers, loading, error, sync, lastSync } = useApp();

  const [query,          setQuery]          = useState('');
  const [filterCountry,  setFilterCountry]  = useState('');
  const [filterCity,     setFilterCity]     = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterFollowers,setFilterFollowers]= useState('');
  const [sortBy,         setSortBy]         = useState('followers_desc');
  const [showFilters,    setShowFilters]    = useState(false);
  const [selectedInfluencer, setSelectedInfluencer] = useState(null);
  const [showAddModal,   setShowAddModal]   = useState(false);

  const countries  = useMemo(() => [...new Set(influencers.map(i => i.country).filter(Boolean))].sort(), [influencers]);
  const cities     = useMemo(() => [...new Set(influencers.map(i => i.city).filter(Boolean))].sort(), [influencers]);
  const industries = useMemo(() => [...new Set(influencers.map(i => i.industry).filter(Boolean))].sort(), [influencers]);

  const followerRange = FOLLOWER_RANGES.find(r => r.label === filterFollowers) || FOLLOWER_RANGES[0];

  const results = useMemo(() => {
    let list = influencers.filter(inf => {
      const q = query.toLowerCase();
      const matchesQuery    = !q || [inf.name, inf.handle, inf.city, inf.country, inf.email, inf.industry, inf.bio].some(v => v && v.toLowerCase().includes(q));
      const matchesCountry  = !filterCountry  || inf.country   === filterCountry;
      const matchesCity     = !filterCity     || inf.city      === filterCity;
      const matchesIndustry = !filterIndustry || inf.industry  === filterIndustry;
      const matchesFollowers = inf.followers >= followerRange.min && inf.followers <= followerRange.max;
      return matchesQuery && matchesCountry && matchesCity && matchesIndustry && matchesFollowers;
    });

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'followers_desc':  return b.followers  - a.followers;
        case 'followers_asc':   return a.followers  - b.followers;
        case 'engagement_desc': return (b.engagement ?? -1) - (a.engagement ?? -1);
        case 'name_asc':        return a.name.localeCompare(b.name);
        default: return 0;
      }
    });
  }, [influencers, query, filterCountry, filterCity, filterIndustry, followerRange, sortBy]);

  const activeFilters = [filterCountry, filterCity, filterIndustry, filterFollowers].filter(Boolean);

  function clearFilters() {
    setFilterCountry('');
    setFilterCity('');
    setFilterIndustry('');
    setFilterFollowers('');
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">

      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex-shrink-0">

        {/* Title row */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Influencer Discovery</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {influencers.length} influencer{influencers.length !== 1 ? 's' : ''} · live from your Google Sheet
              {lastSync && !loading && (
                <span className="ml-1">· synced {formatSyncTime(lastSync)}</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Primary CTA */}
            <MetaSyncButton />

            {/* Secondary actions */}
            <MetaLookup />

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              <UserPlus size={14} />
              Add
            </button>

            <NicheResearcher />
            <DeduplicateButton />

            <button
              onClick={sync}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Refresh from sheet"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Search + filter toggle */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, handle, location, niche, bio…"
              className="w-full pl-11 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-colors"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={15} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              showFilters || activeFilters.length > 0
                ? 'border-purple-400 bg-purple-50 text-purple-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <SlidersHorizontal size={15} />
            Filter
            {activeFilters.length > 0 && (
              <span className="w-5 h-5 bg-purple-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {activeFilters.length}
              </span>
            )}
          </button>
        </div>

        {/* Filter row */}
        {showFilters && (
          <div className="mt-3 grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Select value={filterCountry}  onChange={setFilterCountry}  options={countries}  placeholder="All countries" />
            <Select value={filterCity}     onChange={setFilterCity}     options={cities}     placeholder="All cities" />
            {industries.length > 0 && (
              <Select value={filterIndustry} onChange={setFilterIndustry} options={industries} placeholder="All niches" />
            )}
            <Select
              value={filterFollowers}
              onChange={setFilterFollowers}
              options={FOLLOWER_RANGES.slice(1).map(r => r.label)}
              placeholder="All sizes"
            />
            <Select value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} placeholder="Sort by" />
          </div>
        )}

        {activeFilters.length > 0 && (
          <button onClick={clearFilters} className="mt-2 text-xs text-purple-600 hover:text-purple-800 font-medium">
            Clear all filters
          </button>
        )}
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">

        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Couldn't load your sheet</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
              <button onClick={sync} className="mt-2 text-sm text-red-700 underline hover:text-red-900">Try again</button>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !influencers.length && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-gray-200 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-24 mb-2" />
                <div className="h-2.5 bg-gray-100 rounded w-16 mb-4" />
                <div className="h-2 bg-gray-100 rounded w-20" />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && (
          <>
            {results.length === 0 ? (
              <div className="text-center py-24">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search size={24} className="text-gray-400" />
                </div>
                <h3 className="text-gray-900 font-semibold mb-1">No influencers found</h3>
                <p className="text-sm text-gray-400">Try adjusting your search or filters</p>
                {(query || activeFilters.length > 0) && (
                  <button
                    onClick={() => { setQuery(''); clearFilters(); }}
                    className="mt-3 text-sm text-purple-600 hover:text-purple-800 font-medium"
                  >
                    Clear search & filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-4">
                  {results.length} result{results.length !== 1 ? 's' : ''}
                  {(query || activeFilters.length > 0) && ` for "${query || activeFilters.join(', ')}"`}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {results.map(inf => (
                    <InfluencerCard key={inf.id} influencer={inf} onClick={() => setSelectedInfluencer(inf)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {selectedInfluencer && (
        <InfluencerModal influencer={selectedInfluencer} onClose={() => setSelectedInfluencer(null)} />
      )}

      {showAddModal && (
        <AddInfluencerModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
