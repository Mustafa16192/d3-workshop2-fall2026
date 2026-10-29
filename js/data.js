// ============================================================================
// DATA.JS - loads the races and fills the race selector (provided, do not edit)
// ============================================================================

// Linking charts (one chart tells the others that something happened):
//
//   import { announce, listen } from './data.js';
//   announce('lapRange', [10, 30]);           // in the chart where it happens
//   listen('lapRange', range => { ... });     // in every chart that should react
//
// The two messages used in this workshop:
//   'lapRange'     [firstLap, lastLap] picked with the brush in chart 2, or null for all laps
//   'hoverDriver'  driver_number of the line under the mouse in chart 3, or null
//
// The race object:
//   race.label     'Japanese Grand Prix 2025'
//   race.maxLap    number of laps of the winner, e.g. 53
//   race.drivers   [{ driver_number, name_acronym, full_name, team_name,
//                     color, dash, finish }, ...]   sorted by finishing position
//                  color: team color (darkened if it is too light to read on white)
//                  dash:  true for the second driver of a team, so teammates differ
//                  finish: finishing position, or null if the driver did not finish
//   race.laps      [{ driver_number, lap_number, lap_duration, compound, pitIn }, ...]
//                  lap_duration is in seconds, and can be null (lap without a time)
//                  pitIn is true on the lap a driver came into the pits
//   race.stints    [{ driver_number, stint_number, compound, lap_start, lap_end, pit }, ...]
//                  a stint is the run on one set of tyres; compound is
//                  'SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET' or 'UNKNOWN'
//                  pit: the stop at the END of this stint, or null (last stint, retired):
//                    { lane: seconds from pit entry to pit exit,
//                      stop: seconds standing still, or null when not recorded }
//   race.outline   [[x, y], ...] 240 positions of a car during one lap (for the track)
//   race.lengthKm  lap length in km, measured along that lap (about 1% short of the official length)
//


const COMPOUNDS = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'];

// Darken a team color until it has at least 3:1 contrast on a white background.
function readableOnWhite(hex) {
    const contrast = c => {
        const lum = [c.r, c.g, c.b]
            .map(v => v / 255)
            .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 1.05 / (0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2] + 0.05);
    };
    let color = d3.hcl(hex);
    while (contrast(d3.rgb(color)) < 3) color = color.darker(0.2);
    return color.formatHex();
}

// Resample the outline to exactly n points, so any two circuits can morph smoothly.
function resample(points, n = 240) {
    if (points.length < 3) return []; // no track positions for this race
    return d3.range(n).map(i => {
        const t = (i * (points.length - 1)) / n;
        const i0 = Math.floor(t);
        const [x0, y0] = points[i0];
        const [x1, y1] = points[Math.min(i0 + 1, points.length - 1)];
        return [x0 + (x1 - x0) * (t - i0), y0 + (y1 - y0) * (t - i0)];
    });
}

// Length of one lap in km: add up the distances between consecutive positions.
// OpenF1 positions are in decimetres (10 units per metre). The car's position is
// sampled about 4 times a second, so corners are cut a little: about 1% short.
function lapLength(points) {
    let total = 0;
    points.forEach((p, i) => {
        const next = points[(i + 1) % points.length];
        total += Math.hypot(next[0] - p[0], next[1] - p[1]);
    });
    return total / 10 / 1000;
}

// Raw OpenF1 bundle -> the race object described above.
function prepare(entry, raw) {
    // Last lap row of each driver
    const lastLap = d3.rollup(raw.laps, v => d3.max(v, d => d.lap_number), d => d.driver_number);

    // Stints: fix two OpenF1 quirks. A stint can start on the lap the previous one
    // ended, and a retired driver's last stint can stop one lap early.
    const stints = [];
    for (const [num, list] of d3.group(raw.stints, d => d.driver_number)) {
        list.sort((a, b) => a.stint_number - b.stint_number);
        let prevEnd = 0;
        list.forEach((s, i) => {
            const lap_start = Math.max(s.lap_start, prevEnd + 1);
            let lap_end = s.lap_end ?? lastLap.get(num);
            if (i === list.length - 1) lap_end = Math.max(lap_end, lastLap.get(num) ?? 0);
            stints.push({
                driver_number: num,
                stint_number: s.stint_number,
                compound: COMPOUNDS.includes(s.compound) ? s.compound : 'UNKNOWN',
                lap_start,
                lap_end: Math.max(lap_end, lap_start)
            });
            prevEnd = lap_end;
        });
    }

    // Pit stops: OpenF1 records each stop on the last lap of the stint before it
    const pits = new Map((raw.pit ?? []).map(p => [`${p.driver_number}-${p.lap_number}`, p]));
    for (const s of stints) {
        const p = pits.get(`${s.driver_number}-${s.lap_end}`);
        s.pit = p ? { lane: p.lane_duration, stop: p.stop_duration } : null;
    }

    // Laps: add the compound and a pit-in flag
    const laps = raw.laps.map(l => {
        const own = stints.filter(s => s.driver_number === l.driver_number);
        const i = own.findIndex(s => l.lap_number >= s.lap_start && l.lap_number <= s.lap_end);
        return {
            driver_number: l.driver_number,
            lap_number: l.lap_number,
            lap_duration: l.lap_duration > 0 ? l.lap_duration : null,
            compound: i >= 0 ? own[i].compound : 'UNKNOWN',
            pitIn: i >= 0 && i < own.length - 1 && l.lap_number === own[i].lap_end
        };
    }).sort((a, b) => a.driver_number - b.driver_number || a.lap_number - b.lap_number);

    // Drivers: finishing order (non-finishers last), team color, dash for teammates
    const results = new Map(raw.session_result.map(r => [r.driver_number, r]));
    const seenTeams = new Set();
    const drivers = raw.drivers
        .map(d => {
            const r = results.get(d.driver_number);
            return {
                driver_number: d.driver_number,
                name_acronym: d.name_acronym,
                full_name: d.full_name,
                team_name: d.team_name,
                color: readableOnWhite(`#${d.team_colour || '888888'}`),
                finish: r && !r.dnf && !r.dns && !r.dsq ? r.position : null,
                laps: lastLap.get(d.driver_number) ?? 0
            };
        })
        .sort((a, b) => (a.finish ?? 99) - (b.finish ?? 99) || b.laps - a.laps);
    for (const d of [...drivers].sort((a, b) => a.driver_number - b.driver_number)) {
        d.dash = seenTeams.has(d.team_name);
        seenTeams.add(d.team_name);
    }

    return {
        id: entry.id,
        label: entry.label,
        maxLap: drivers[0]?.laps ?? d3.max(laps, d => d.lap_number),
        drivers,
        laps,
        stints,
        outline: resample(raw.location),
        lengthKm: lapLength(raw.location)
    };
}

// --- Race selector and loading (one shared copy for all three chart files) ---

const select = document.getElementById('race-select');
const status = document.getElementById('status');
const trackLength = document.getElementById('track-length');
const listeners = [];
const cache = new Map();

// cache: 'no-cache' makes the browser check for newer files, so updated race data shows up on reload
const races = await d3.json('data/index.json', { cache: 'no-cache' });
select.innerHTML = races.map(r => `<option value="${r.id}">${r.label}</option>`).join('');

async function loadRace(id) {
    if (!cache.has(id)) {
        const entry = races.find(r => r.id === id);
        cache.set(id, prepare(entry, await d3.json(`data/${entry.file}`, { cache: 'no-cache' })));
    }
    return cache.get(id);
}

function showSummary(race) {
    status.textContent = `${race.drivers.length} drivers, ${race.maxLap} laps`;
    trackLength.textContent = race.lengthKm > 0
        ? `Lap length: about ${race.lengthKm.toFixed(2)} km (measured from one lap of car positions).`
        : 'No track positions for this race.';
}

let current = await loadRace(races[0].id);
showSummary(current);

select.addEventListener('change', async () => {
    current = await loadRace(select.value);
    showSummary(current);
    listeners.forEach(fn => fn(current));
});

// --- Linking charts --------------------------------------------------------

const channels = new Map();

/** Tell every chart that listens to `name` about a new value. */
export function announce(name, value) {
    (channels.get(name) ?? []).forEach(fn => fn(value));
}

/** Call fn(value) every time some chart announces `name`. */
export function listen(name, fn) {
    if (!channels.has(name)) channels.set(name, []);
    channels.get(name).push(fn);
}

/** Call fn(race) now, and again whenever another race is selected. */
export function onRaceChange(fn) {
    listeners.push(fn);
    fn(current);
}
