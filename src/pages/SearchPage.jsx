import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown, RefreshCw, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import InfluencerCard from '../components/InfluencerCard';
import InfluencerModal from '../components/InfluencerModal';
import NicheResearcher from '../components/NicheResearcher';

const FOLLOWER_RANGES = [
  { label: 'All sizes', min: 0, max: Infinity },
  { label: 'Nano (1K–10K)', min: 1_000, max: 10_000 },
  { label: 'Micro (10K–100K)', min: 10_000, max: 100_000 },
  { label: 'Mid (100K–500K)', min: 100_000, max: 500_000 },
  { label: 'Macro (500K–1M)', min: 500_000, max: 1_000_000 },
  { label: 'Mega (1M+)', min: 1_000_000, max: Infinity },
];

const SORT_OPTIONS = [
  { label: 'Most Followers', value: 'followers_desc' },
  { label: 'Least Followers', value: 'followers_asc' },
  { label: 'Name A–Z', value: 'name_asc' },
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

  const [query, setQuery] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterFollowers, setFilterFollowers] = useState('');
  const [sortBy, setSortBy] = useState('followers_desc');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedInfluencer, setSelectedInfluencer] = useState(null);

  const countries = useMemo(() =>
    [...new Set(influencers.map(i => i.country).filter(Boolean))].sort(), [influencers]);
  const cities = useMemo(() =>
    [...new Set(influencers.map(i => i.city).filter(Boolean))].sort(), [influencers]);
  const industries = useMemo(() =>
    [...new Set(influencers.map(i => i.industry).filter(Boolean))].sort(), [influencers]);

  const followerRange = FOLLOWER_RANGES.find(r => r.label === filterFollowers) || FOLLOWER_RANGES[0];

  const results = useMemo(() => {
    let list = influencers.filter(inf => {
      const q = query.toLowerCase();
      const matchesQuery = !q || [inf.name, inf.handle, inf.city, inf.country, inf.email, inf.industry].some(
        v => v && v.toLowerCase().includes(q)
      );
      const matchesCountry = !filterCountry || inf.country === filterCountry;
      const matchesCity = !filterCity || inf.city === filterCity;
      const matchesIndustry = !filterIndustry || inf.industry === filterIndustry;
      const matchesFollowers = inf.followers >= followerRange.min && inf.followers <= followerRange.max;
      return matchesQuery && matchesCountry && matchesCity && matchesIndustry && matchesFollowers;
    });

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'followers_desc': return b.followers - a.followers;
        case 'followers_asc': return a.followers - b.followers;
        case 'name_asc': return a.name.localeCompare(b.name);
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
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Discover Influencers</h1>
            <p className="text-sm text-gray-500">Live from your Google Sheet</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            <NicheResearcher />
            <button
              onClick={sync}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-purple-400 hover:text-purple-700 hover:bg-purple-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Syncing…' : 'Refresh'}
              {lastSync && !loading && (
                <span className="text-xs text-gray-400 font-normal">· {formatSyncTime(lastSync)}</span>
              )}
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, handle, location…"
              className="w-full pl-11 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-colors"
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
            Filters
            {activeFilters.length > 0 && (
              <span className="w-5 h-5 bg-purple-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {activeFilters.length}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Select value={filterCountry} onChange={setFilterCountry} options={countries} placeholder="All countries" />
            <Select value={filterCity} onChange={setFilterCity} options={cities} placeholder="All cities" />
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

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-8 py-6">

        {/* Error state */}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded" />
                  <div className="h-3 bg-gray-200 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {results.length === 0 ? 'No influencers found' : `${results.length} influencer${results.length !== 1 ? 's' : ''}`}
            </p>

            {results.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search size={24} className="text-gray-400" />
                </div>
                <h3 className="text-gray-900 font-semibold mb-1">No results found</h3>
                <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
                {(query || activeFilters.length > 0) && (
                  <button onClick={() => { setQuery(''); clearFilters(); }} className="mt-3 text-sm text-purple-600 hover:text-purple-800 font-medium">
                    Clear search & filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {results.map(inf => (
                  <InfluencerCard key={inf.id} influencer={inf} onClick={() => setSelectedInfluencer(inf)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selectedInfluencer && (
        <InfluencerModal influencer={selectedInfluencer} onClose={() => setSelectedInfluencer(null)} />
      )}
    </div>
  );
}
