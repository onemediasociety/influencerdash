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
  'Brooklyn':'USA','Manhattan':'USA','Bronx':'USA','Queens':'USA',
  'Beverly Hills':'USA','Malibu':'USA','Scottsdale':'USA','Salt Lake City':'USA',
  'New Orleans':'USA','Kansas City':'USA','Columbus':'USA','Indianapolis':'USA',
  'San Jose':'USA','Jacksonville':'USA','Memphis':'USA','Baltimore':'USA',
  'Louisville':'USA','Milwaukee':'USA','Albuquerque':'USA','Tucson':'USA',
  'Fresno':'USA','Sacramento':'USA','Oakland':'USA','Raleigh':'USA',
  'Colorado Springs':'USA','Long Beach':'USA','Virginia Beach':'USA',
  'Omaha':'USA','Tulsa':'USA','Arlington':'USA','Tampa':'USA',
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

function parseLocation(str) {
  if (!str) return { city: '', country: '' };
  const parts = str.split(',').map(p => toTitleCase(p.trim())).filter(Boolean);

  let city = parts[0] || '';
  let country = parts.length >= 2 ? parts[parts.length - 1] : '';

  // If second part is a US state name/abbreviation, country = USA
  if (country && US_STATES.has(toTitleCase(country))) country = 'USA';

  // If only one part or country still blank, look up city
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
