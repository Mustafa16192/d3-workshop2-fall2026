// ============================================================================
// FETCH A RACE (bonus task, see README.md)
// Downloads one race from OpenF1 and saves it as data/races/<year>-<slug>.json,
// then adds it to the end of data/index.json, so it appears in the race selector.
// Needs Node 18 or newer and internet. No npm needed. Run it from the repository folder:
//
//   node scripts/fetch-race.mjs --year 2025     list that season's races and their meeting keys
//   node scripts/fetch-race.mjs 1256            fetch one race by its meeting key
//
// OpenF1 has free data from 2023 onward. Please run it once, not in a loop:
// the API limits how many requests you can make.
// ============================================================================

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const API = 'https://api.openf1.org/v1';
const DATA = new URL('../data/', import.meta.url);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// One request at a time, at least 400 ms apart; retry on HTTP 429 (too many requests).
// OpenF1 answers an empty result with HTTP 404, so 404 means "no rows".
async function get(endpoint, params = {}) {
  const query = Object.entries(params)
    .map(([k, v]) => `${k.replace('>', '%3E').replace('<', '%3C')}${/[<>]$/.test(k) ? '' : '='}${encodeURIComponent(v)}`)
    .join('&');
  const url = `${API}/${endpoint}?${query}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(400);
    const res = await fetch(url);
    if (res.status === 404) return [];
    if (res.status === 429) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (!res.ok) throw new Error(`OpenF1 ${res.status} for ${url}`);
    return res.json();
  }
  throw new Error(`Gave up after repeated 429 responses for ${url}`);
}

const pick = (row, fields) => Object.fromEntries(fields.map(f => [f, row[f] ?? null]));

// --- List a season -----------------------------------------------------------
const args = process.argv.slice(2);
if (args[0] === '--year') {
  const races = await get('sessions', { year: Number(args[1]), session_name: 'Race' });
  for (const s of races) console.log(`${s.meeting_key}\t${s.date_start.slice(0, 10)}\t${s.circuit_short_name}, ${s.country_name}`);
  process.exit(0);
}

const meetingKey = Number(args[0]);
if (!meetingKey) {
  console.error('Usage: node scripts/fetch-race.mjs <meeting_key>   or   node scripts/fetch-race.mjs --year 2025');
  process.exit(1);
}

// --- Fetch one race ------------------------------------------------------------
const sessions = await get('sessions', { meeting_key: meetingKey });
const race = sessions.find(s => s.session_name === 'Race');
if (!race) throw new Error(`No Race session for meeting ${meetingKey}`);
const quali = sessions.find(s => s.session_name === 'Qualifying'); // starting_grid belongs to qualifying
const [meeting] = await get('meetings', { meeting_key: meetingKey });
const sk = race.session_key;
console.log(`Fetching ${meeting.meeting_name} ${race.year} (session ${sk})...`);

const drivers = await get('drivers', { session_key: sk });
const results = await get('session_result', { session_key: sk });
const grid = quali ? await get('starting_grid', { session_key: quali.session_key }) : [];
const laps = await get('laps', { session_key: sk });
const stints = await get('stints', { session_key: sk });
const raceControl = await get('race_control', { session_key: sk });
const pits = await get('pit', { session_key: sk });

// Track outline: the winner's lap 5 (or the first lap with a time) from the location endpoint.
const winner = results.find(r => r.position === 1)?.driver_number;
const ok = l => l.date_start && l.lap_duration > 0;
const refLap = laps.find(l => l.driver_number === winner && l.lap_number === 5 && ok(l)) || laps.find(ok);
let location = [];
if (refLap) {
  const t0 = new Date(refLap.date_start);
  const t1 = new Date(t0.getTime() + refLap.lap_duration * 1000);
  const rows = await get('location', {
    session_key: sk, driver_number: refLap.driver_number, 'date>': t0.toISOString(), 'date<': t1.toISOString()
  });
  location = rows.filter(r => r.x !== null && r.y !== null).map(r => [r.x, r.y]);
}

const bundle = {
  meta: {
    year: race.year, meeting_key: meetingKey, meeting_name: meeting.meeting_name,
    circuit_short_name: race.circuit_short_name, country_name: race.country_name,
    session_key: sk, fetched_at: new Date().toISOString()
  },
  drivers: drivers.map(d => pick(d, ['driver_number', 'name_acronym', 'full_name', 'team_name', 'team_colour'])),
  laps: laps.map(l => pick(l, ['driver_number', 'lap_number', 'lap_duration', 'date_start', 'is_pit_out_lap'])),
  stints: stints.map(s => pick(s, ['driver_number', 'stint_number', 'compound', 'lap_start', 'lap_end', 'tyre_age_at_start'])),
  session_result: results.map(r => pick(r, ['driver_number', 'position', 'number_of_laps', 'dnf', 'dns', 'dsq'])),
  starting_grid: grid.map(g => pick(g, ['driver_number', 'position'])),
  location,
  race_control: raceControl.map(r => pick(r, ['lap_number', 'category', 'flag', 'message'])),
  // lane_duration: whole pit lane, entry to exit; stop_duration: stationary (from the 2024 US GP onward)
  pit: pits.map(p => pick(p, ['driver_number', 'lap_number', 'lane_duration', 'stop_duration']))
};

// --- Save --------------------------------------------------------------------
const slug = meeting.meeting_name.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/grand prix/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const id = `${race.year}-${slug}`;
const file = `races/${id}.json`;
await mkdir(new URL('races/', DATA), { recursive: true });
await writeFile(new URL(file, DATA), JSON.stringify(bundle) + '\n');

let index = [];
try {
  index = JSON.parse(await readFile(new URL('index.json', DATA), 'utf8'));
} catch {
  // no index yet
}
// New races go at the end; the first race in the list is the one the page opens with.
const entry = { id, label: `${meeting.meeting_name} ${race.year}`, year: race.year, meeting_key: meetingKey, file };
const at = index.findIndex(e => e.id === id);
if (at >= 0) index[at] = entry;
else index.push(entry);
await writeFile(new URL('index.json', DATA), JSON.stringify(index, null, 2) + '\n');

console.log(`Saved data/${file}: ${bundle.drivers.length} drivers, ${bundle.laps.length} laps, ` +
  `${bundle.stints.length} stints, ${location.length} track points.`);
