import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { influencers, INDUSTRIES, countries, cities } from '../data/influencers';
import InfluencerCard from '../components/InfluencerCard';
import InfluencerModal from '../components/InfluencerModal';

const FOLLOWER_RANGES = [
  { label: 'All sizes', min: 0, max: Infinity },
  { label: 'Nano (1K–10K)', min: 1000, max: 10000 },
  { label: 'Micro (10K–100K)', min: 10000, max: 100000 },
  { label: 'Mid (100K–500K)', min: 100000, max: 500000 },
  { label: 'Macro (500K–1M)', min: 500000, max: 1000000 },
  { label: 'Mega (1M+)', min: 1000000, max: Infinity },
];

const SORT_OPTIONS = [
  { label: 'Most Followers', value: 'followers_desc' },
  { label: 'Least Followers', value: 'followers_asc' },
  { label: 'Highest Engagement', value: 'engagement_desc' },
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

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterFollowers, setFilterFollowers] = useState('');
  const [sortBy, setSortBy] = useState('followers_desc');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedInfluencer, setSelectedInfluencer] = useState(null);

  const followerRange = FOLLOWER_RANGES.find(r => r.label === filterFollowers) || FOLLOWER_RANGES[0];

  const results = useMemo(() => {
    let list = influencers.filter(inf => {
      const q = query.toLowerCase();
      const matchesQuery = !q || [inf.name, inf.handle, inf.bio, inf.city, inf.country, inf.industry].some(
        v => v.toLowerCase().includes(q)
      );
      const matchesCountry = !filterCountry || inf.country === filterCountry;
      const matchesCity = !filterCity || inf.city === filterCity;
      const matchesIndustry = !filterIndustry || inf.industry === filterIndustry;
      const matchesFollowers = inf.followers >= followerRange.min && inf.followers <= followerRange.max;
      return matchesQuery && matchesCountry && matchesCity && matchesIndustry && matchesFollowers;
    });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'followers_desc': return b.followers - a.followers;
        case 'followers_asc': return a.followers - b.followers;
        case 'engagement_desc': return b.engagement - a.engagement;
        case 'name_asc': return a.name.localeCompare(b.name);
        default: return 0;
      }
    });

    return list;
  }, [query, filterCountry, filterCity, filterIndustry, followerRange, sortBy]);

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
        <div className="flex items-center gap-4 mb-1">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Discover Influencers</h1>
            <p className="text-sm text-gray-500">Find creators worldwide for your next campaign</p>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <div className="flex-1 relative">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, location, niche, or keyword…"
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
              <span className="ml-0.5 w-5 h-5 bg-purple-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {activeFilters.length}
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-3 grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Select value={filterCountry} onChange={setFilterCountry} options={countries} placeholder="All countries" />
            <Select value={filterCity} onChange={setFilterCity} options={cities} placeholder="All cities" />
            <Select value={filterIndustry} onChange={setFilterIndustry} options={INDUSTRIES} placeholder="All industries" />
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
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {results.length === 0 ? 'No influencers found' : `${results.length} influencer${results.length !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {results.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search size={24} className="text-gray-400" />
            </div>
            <h3 className="text-gray-900 font-semibold mb-1">No results found</h3>
            <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {results.map(inf => (
              <InfluencerCard
                key={inf.id}
                influencer={inf}
                onClick={() => setSelectedInfluencer(inf)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedInfluencer && (
        <InfluencerModal
          influencer={selectedInfluencer}
          onClose={() => setSelectedInfluencer(null)}
        />
      )}
    </div>
  );
}
