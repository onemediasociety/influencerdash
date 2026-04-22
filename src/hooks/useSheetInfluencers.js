import { useState, useEffect, useCallback } from 'react';

const SHEET_ID = '1qPynoi9uyrmqfgTSx6PrOIHNNfMZY71e-eXE5QFZqj8';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field.trim()); field = ''; }
      else if (ch === '\n' || (ch === '\r' && next !== '\n')) {
        row.push(field.trim());
        field = '';
        if (row.some(f => f)) rows.push(row);
        row = [];
      } else if (ch === '\r') {
        // \r\n — skip \r, \n handled next iteration
      } else {
        field += ch;
      }
    }
  }

  if (field.trim() || row.length) {
    row.push(field.trim());
    if (row.some(f => f)) rows.push(row);
  }

  return rows;
}

// Aliases / abbreviations → canonical city name
const CITY_ALIASES = {
  // New York
  'Nyc':'New York','N.Y.C.':'New York','New York City':'New York','Ny':'New York',
  // Los Angeles
  'La':'Los Angeles','L.A.':'Los Angeles','Los Angeles Ca':'Los Angeles',
  // San Francisco
  'Sf':'San Francisco','Sfo':'San Francisco','San Fran':'San Francisco','The Bay':'San Francisco',
  // Washington DC
  'Dc':'Washington','D.C.':'Washington','Washington Dc':'Washington','Washington D.C.':'Washington',
  // Fort Lauderdale
  'Ftl':'Fort Lauderdale','Ft Lauderdale':'Fort Lauderdale','Ft. Lauderdale':'Fort Lauderdale',
  // Other Florida
  'Mia':'Miami','Orl':'Orlando','Tpa':'Tampa','Jax':'Jacksonville',
  // Texas
  'Dfw':'Dallas','Dal':'Dallas','Hou':'Houston','H-Town':'Houston','Aus':'Austin','Sat':'San Antonio',
  // Georgia
  'Atl':'Atlanta',
  // Illinois
  'Chi':'Chicago','Chitown':'Chicago','Chi-Town':'Chicago',
  // Pennsylvania
  'Philly':'Philadelphia','Phl':'Philadelphia',
  // Nevada
  'Vegas':'Las Vegas','Lv':'Las Vegas','Lvn':'Las Vegas',
  // Louisiana
  'Nola':'New Orleans',
  // Tennessee
  'Nash':'Nashville','Nas':'Nashville',
  // New York boroughs
  'Bklyn':'Brooklyn','Bk':'Brooklyn','Bx':'Bronx',
  // California cities
  'Sd':'San Diego','Lb':'Long Beach','Sb':'Santa Barbara',
  'Sac':'Sacramento','Oak':'Oakland',
  // Pacific Northwest
  'Pdx':'Portland','Sea':'Seattle',
  // Colorado
  'Den':'Denver',
  // Arizona
  'Phx':'Phoenix',
  // Massachusetts
  'Bos':'Boston',
  // North Carolina
  'Clt':'Charlotte','Rdu':'Raleigh',
  // Canada
  'Van':'Vancouver','Mtl':'Montreal','Yyc':'Calgary','Yow':'Ottawa','Yyz':'Toronto',
  // UK
  'Ldn':'London','Mcr':'Manchester','Brum':'Birmingham',
  // International
  'Cdmx':'Mexico City','Sp':'São Paulo','Rj':'Rio De Janeiro','Bsas':'Buenos Aires',
  'Kl':'Kuala Lumpur',
};


function parseFollowers(str) {
  if (!str) return 0;
  const s = str.trim().replace(/,/g, '').replace(/\s/g, '');
  if (/k$/i.test(s)) return Math.round(parseFloat(s) * 1_000);
  if (/m$/i.test(s)) return Math.round(parseFloat(s) * 1_000_000);
  if (/b$/i.test(s)) return Math.round(parseFloat(s) * 1_000_000_000);
  return parseInt(s, 10) || 0;
}

function toTitleCase(s) {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const US_STATES = new Set([
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
  'District Of Columbia','Dc',
  // abbreviations
  'Al','Ak','Az','Ar','Ca','Co','Ct','De','Fl','Ga','Hi','Id','Il','In','Ia',
  'Ks','Ky','La','Me','Md','Ma','Mi','Mn','Ms','Mo','Mt','Ne','Nv','Nh','Nj',
  'Nm','Ny','Nc','Nd','Oh','Ok','Or','Pa','Ri','Sc','Sd','Tn','Tx','Ut','Vt',
  'Va','Wa','Wv','Wi','Wy','Dc',
]);

const CITY_COUNTRY = {
  // USA
  'New York':'USA','Los Angeles':'USA','Miami':'USA','Chicago':'USA',
  'Houston':'USA','Atlanta':'USA','Dallas':'USA','San Francisco':'USA',
  'Seattle':'USA','Boston':'USA','Washington':'USA','Las Vegas':'USA',
  'Denver':'USA','Austin':'USA','Nashville':'USA','Phoenix':'USA',
  'Philadelphia':'USA','Portland':'USA','Minneapolis':'USA','Detroit':'USA',
  'San Diego':'USA','Tampa':'USA','Orlando':'USA','Charlotte':'USA',
  'Brooklyn':'USA','Manhattan':'USA','Bronx':'USA','Queens':'USA','Staten Island':'USA',
  'Beverly Hills':'USA','Malibu':'USA','Scottsdale':'USA','Salt Lake City':'USA',
  'New Orleans':'USA','Kansas City':'USA','Columbus':'USA','Indianapolis':'USA',
  'San Jose':'USA','Jacksonville':'USA','Memphis':'USA','Baltimore':'USA',
  'Louisville':'USA','Milwaukee':'USA','Albuquerque':'USA','Tucson':'USA',
  'Fresno':'USA','Sacramento':'USA','Oakland':'USA','Raleigh':'USA',
  'Colorado Springs':'USA','Long Beach':'USA','Virginia Beach':'USA',
  'Omaha':'USA','Tulsa':'USA','Arlington':'USA','Fort Worth':'USA',
  'Fort Lauderdale':'USA','Boca Raton':'USA','West Palm Beach':'USA',
  'Pompano Beach':'USA','Coral Gables':'USA','Hialeah':'USA','Doral':'USA',
  'Aventura':'USA','Coral Springs':'USA','Pembroke Pines':'USA','Sunrise':'USA',
  'San Antonio':'USA','El Paso':'USA','Corpus Christi':'USA','Lubbock':'USA',
  'Plano':'USA','Irving':'USA','Garland':'USA','Laredo':'USA','Amarillo':'USA',
  'Pittsburgh':'USA','Cleveland':'USA','Cincinnati':'USA','Akron':'USA',
  'Toledo':'USA','Columbus':'USA','Dayton':'USA',
  'St. Louis':'USA','Saint Louis':'USA','Kansas City':'USA',
  'Richmond':'USA','Norfolk':'USA','Hampton':'USA','Chesapeake':'USA',
  'Buffalo':'USA','Rochester':'USA','Albany':'USA','Syracuse':'USA','Yonkers':'USA',
  'Hartford':'USA','Providence':'USA','New Haven':'USA','Bridgeport':'USA',
  'Baton Rouge':'USA','Shreveport':'USA','New Orleans':'USA',
  'Birmingham':'USA','Montgomery':'USA','Huntsville':'USA','Mobile':'USA',
  'Chattanooga':'USA','Knoxville':'USA','Memphis':'USA',
  'Lexington':'USA','Louisville':'USA',
  'Ann Arbor':'USA','Grand Rapids':'USA','Lansing':'USA','Flint':'USA',
  'Madison':'USA','Green Bay':'USA',
  'Des Moines':'USA','Cedar Rapids':'USA',
  'Boise':'USA','Spokane':'USA','Tacoma':'USA','Bellevue':'USA',
  'Honolulu':'USA','Anchorage':'USA',
  'Wichita':'USA','Sioux Falls':'USA','Fargo':'USA',
  'Santa Barbara':'USA','Santa Monica':'USA','Pasadena':'USA','Glendale':'USA',
  'Burbank':'USA','Anaheim':'USA','Irvine':'USA','Riverside':'USA',
  'Bakersfield':'USA','Stockton':'USA','Modesto':'USA',
  'Durham':'USA','Greensboro':'USA','Winston-Salem':'USA',
  'Little Rock':'USA','Jackson':'USA',
  'San Juan':'USA','Honolulu':'USA',
  'Cheyenne':'USA','Billings':'USA','Missoula':'USA',
  // Canada
  'Toronto':'Canada','Vancouver':'Canada','Montreal':'Canada','Calgary':'Canada',
  'Edmonton':'Canada','Ottawa':'Canada','Winnipeg':'Canada','Quebec City':'Canada',
  // UK
  'London':'UK','Manchester':'UK','Birmingham':'UK','Edinburgh':'UK',
  'Glasgow':'UK','Bristol':'UK','Leeds':'UK','Liverpool':'UK','Sheffield':'UK',
  'Newcastle':'UK','Nottingham':'UK','Cardiff':'UK','Belfast':'UK',
  // Europe
  'Paris':'France','Lyon':'France','Marseille':'France','Nice':'France','Bordeaux':'France',
  'Berlin':'Germany','Munich':'Germany','Hamburg':'Germany','Frankfurt':'Germany','Cologne':'Germany',
  'Madrid':'Spain','Barcelona':'Spain','Seville':'Spain','Valencia':'Spain','Bilbao':'Spain',
  'Rome':'Italy','Milan':'Italy','Naples':'Italy','Turin':'Italy','Florence':'Italy',
  'Amsterdam':'Netherlands','Rotterdam':'Netherlands','The Hague':'Netherlands',
  'Brussels':'Belgium','Antwerp':'Belgium',
  'Zurich':'Switzerland','Geneva':'Switzerland','Bern':'Switzerland',
  'Vienna':'Austria','Graz':'Austria',
  'Stockholm':'Sweden','Gothenburg':'Sweden','Malmö':'Sweden',
  'Oslo':'Norway','Bergen':'Norway',
  'Copenhagen':'Denmark','Aarhus':'Denmark',
  'Helsinki':'Finland','Tampere':'Finland',
  'Dublin':'Ireland','Cork':'Ireland',
  'Lisbon':'Portugal','Porto':'Portugal',
  'Athens':'Greece','Thessaloniki':'Greece',
  'Warsaw':'Poland','Krakow':'Poland','Wroclaw':'Poland',
  'Prague':'Czech Republic',
  'Budapest':'Hungary',
  'Bucharest':'Romania',
  'Moscow':'Russia','Saint Petersburg':'Russia',
  'Kyiv':'Ukraine',
  'Istanbul':'Turkey','Ankara':'Turkey',
  // Middle East
  'Dubai':'UAE','Abu Dhabi':'UAE','Sharjah':'UAE',
  'Riyadh':'Saudi Arabia','Jeddah':'Saudi Arabia','Mecca':'Saudi Arabia',
  'Doha':'Qatar','Kuwait City':'Kuwait','Manama':'Bahrain','Muscat':'Oman',
  'Beirut':'Lebanon','Amman':'Jordan','Tel Aviv':'Israel','Jerusalem':'Israel',
  'Tehran':'Iran','Baghdad':'Iraq',
  // Africa
  'Cairo':'Egypt','Alexandria':'Egypt',
  'Lagos':'Nigeria','Abuja':'Nigeria',
  'Nairobi':'Kenya','Mombasa':'Kenya',
  'Johannesburg':'South Africa','Cape Town':'South Africa','Durban':'South Africa',
  'Accra':'Ghana','Kumasi':'Ghana',
  'Casablanca':'Morocco','Rabat':'Morocco','Marrakech':'Morocco',
  'Tunis':'Tunisia','Algiers':'Algeria','Tripoli':'Libya',
  'Addis Ababa':'Ethiopia','Dar Es Salaam':'Tanzania','Kampala':'Uganda',
  'Dakar':'Senegal','Abidjan':'Ivory Coast','Luanda':'Angola',
  'Khartoum':'Sudan','Harare':'Zimbabwe','Lusaka':'Zambia',
  // Asia
  'Tokyo':'Japan','Osaka':'Japan','Kyoto':'Japan','Yokohama':'Japan','Sapporo':'Japan',
  'Seoul':'South Korea','Busan':'South Korea','Incheon':'South Korea',
  'Beijing':'China','Shanghai':'China','Guangzhou':'China','Shenzhen':'China',
  'Chengdu':'China','Wuhan':'China','Hangzhou':'China','Xi\'An':'China',
  'Hong Kong':'Hong Kong','Macau':'Macau',
  'Singapore':'Singapore',
  'Bangkok':'Thailand','Chiang Mai':'Thailand','Phuket':'Thailand',
  'Kuala Lumpur':'Malaysia','Penang':'Malaysia',
  'Jakarta':'Indonesia','Bali':'Indonesia','Surabaya':'Indonesia',
  'Manila':'Philippines','Cebu':'Philippines',
  'Taipei':'Taiwan','Kaohsiung':'Taiwan',
  'Mumbai':'India','Delhi':'India','New Delhi':'India','Bangalore':'India',
  'Chennai':'India','Hyderabad':'India','Kolkata':'India','Pune':'India',
  'Ahmedabad':'India','Jaipur':'India','Surat':'India','Lucknow':'India',
  'Karachi':'Pakistan','Lahore':'Pakistan','Islamabad':'Pakistan',
  'Dhaka':'Bangladesh','Colombo':'Sri Lanka','Kathmandu':'Nepal',
  'Yangon':'Myanmar','Phnom Penh':'Cambodia','Ho Chi Minh City':'Vietnam',
  'Hanoi':'Vietnam','Vientiane':'Laos',
  // Oceania
  'Sydney':'Australia','Melbourne':'Australia','Brisbane':'Australia',
  'Perth':'Australia','Adelaide':'Australia','Gold Coast':'Australia',
  'Auckland':'New Zealand','Wellington':'New Zealand','Christchurch':'New Zealand',
  // Latin America
  'Mexico City':'Mexico','Guadalajara':'Mexico','Monterrey':'Mexico','Cancun':'Mexico',
  'São Paulo':'Brazil','Rio De Janeiro':'Brazil','Brasília':'Brazil','Salvador':'Brazil',
  'Belo Horizonte':'Brazil','Fortaleza':'Brazil','Manaus':'Brazil','Curitiba':'Brazil',
  'Buenos Aires':'Argentina','Córdoba':'Argentina','Rosario':'Argentina',
  'Bogotá':'Colombia','Medellín':'Colombia','Cali':'Colombia','Cartagena':'Colombia',
  'Lima':'Peru','Cusco':'Peru',
  'Santiago':'Chile','Valparaíso':'Chile',
  'Caracas':'Venezuela','Quito':'Ecuador','La Paz':'Bolivia',
  'Montevideo':'Uruguay','Asunción':'Paraguay',
  'Panama City':'Panama','San José':'Costa Rica','Guatemala City':'Guatemala',
  'Havana':'Cuba','Santo Domingo':'Dominican Republic','San Juan':'USA',
};

function resolveAlias(s) {
  const key = toTitleCase(s.trim());
  return CITY_ALIASES[key] || key;
}

function parseLocation(str) {
  if (!str) return { city: '', country: '' };

  // Split on comma first to separate city from country/state
  const commaParts = str.split(',').map(p => p.trim()).filter(Boolean);

  // Within the city portion, handle dash-separated formats like "Miami - FTL" or "NYC/LA"
  // Take the last segment as the most specific city
  const cityRaw = commaParts[0] || '';
  const dashParts = cityRaw.split(/\s*[-\/]\s*/).map(p => p.trim()).filter(Boolean);
  const citySegment = dashParts.length > 1 ? dashParts[dashParts.length - 1] : dashParts[0] || '';

  let city = resolveAlias(toTitleCase(citySegment));
  let country = commaParts.length >= 2 ? toTitleCase(commaParts[commaParts.length - 1]) : '';

  // Normalise US state → USA
  if (country && US_STATES.has(country)) country = 'USA';

  // Look up country from city if still missing
  if (!country && city) country = CITY_COUNTRY[city] || '';

  return { city, country };
}

function parseInstagram(str) {
  if (!str) return { handle: '', url: '', username: '' };
  const s = str.trim();

  const urlMatch = s.match(/instagram\.com\/([^\/\?\s#]+)/i);
  if (urlMatch) {
    const username = urlMatch[1].replace(/\/$/, '');
    return { handle: `@${username}`, url: `https://www.instagram.com/${username}/`, username };
  }
  if (s.startsWith('@')) {
    const username = s.slice(1);
    return { handle: s, url: `https://www.instagram.com/${username}/`, username };
  }
  // plain handle
  return { handle: `@${s}`, url: `https://www.instagram.com/${s}/`, username: s };
}

function handleToName(username) {
  return username
    .split(/[_.\-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function rowToInfluencer(row, colMap, index) {
  const get = key => (row[colMap[key]] || '').trim();

  const igRaw = get('instagram');
  const { handle, url, username } = parseInstagram(igRaw);
  const name = get('name') || (username ? handleToName(username) : `Influencer ${index + 1}`);
  const followers = parseFollowers(get('followers'));
  const email = get('email');
  const { city, country } = parseLocation(get('location'));
  const industry = get('industry');

  // Try Instagram profile photo via unavatar.io, fall back to letter avatar
  const avatar = username
    ? `https://unavatar.io/instagram/${username}`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8b5cf6&color=fff&size=150&bold=true`;
  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8b5cf6&color=fff&size=150&bold=true`;

  return {
    id: `sheet_${index}_${username || index}`,
    name,
    handle,
    avatar,
    avatarFallback,
    country,
    city,
    industry,
    bio: '',
    followers,
    engagement: null,
    platforms: ['Instagram'],
    email,
    website: url,
    instagramUrl: url,
    languages: [],
    avgLikes: null,
    avgViews: null,
    pricePerPost: null,
    source: 'sheet',
  };
}

function buildColMap(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const lower = h.toLowerCase().trim();
    if (lower === 'name' || lower === 'full name') map['name'] = i;
    if (lower.includes('follower')) map['followers'] = i;
    else if (lower.includes('instagram')) map['instagram'] = i;
    if (lower.includes('email')) map['email'] = i;
    if (lower.includes('location') || lower.includes('city') || lower.includes('country')) map['location'] = i;
    if (lower.includes('niche') || lower.includes('industry') || lower.includes('category')) map['industry'] = i;
  });
  return map;
}

export function useSheetInfluencers() {
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const sync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(CSV_URL);
      if (!res.ok) throw new Error(`Could not reach the sheet (HTTP ${res.status}). Make sure it's shared as "Anyone with the link can view".`);
      const text = await res.text();
      const rows = parseCSV(text);
      if (rows.length < 2) { setInfluencers([]); setLoading(false); return; }

      const colMap = buildColMap(rows[0]);
      const raw = rows
        .slice(1)
        .filter(row => row.some(f => f))
        .map((row, i) => rowToInfluencer(row, colMap, i))
        .filter(inf => inf.handle); // skip completely blank rows

      // Deduplicate by handle OR name — merge rows, preferring non-empty values
      const isEmpty = v => v === null || v === undefined || v === '' || v === 0;
      const normalise = s => (s || '').toLowerCase().replace(/^@/, '').trim();

      const merged = [];
      for (const inf of raw) {
        const infHandle = normalise(inf.handle);
        const infName = normalise(inf.name);
        const existing = merged.find(m =>
          (infHandle && normalise(m.handle) === infHandle) ||
          (infName && normalise(m.name) === infName)
        );
        if (!existing) {
          merged.push({ ...inf });
        } else {
          for (const field of Object.keys(inf)) {
            if (isEmpty(existing[field]) && !isEmpty(inf[field])) existing[field] = inf[field];
          }
        }
      }
      const data = merged;

      setInfluencers(data);
      setLastSync(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { sync(); }, [sync]);

  return { influencers, loading, error, sync, lastSync };
}
