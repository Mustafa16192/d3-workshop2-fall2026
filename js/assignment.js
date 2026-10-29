// ============================================================================
// ASSIGNMENT.JS - Race trace
// ============================================================================
// Question: who gained or lost time against the reference driver, and on which laps?
//
// A plain line chart of lap times hides this: drivers differ by tenths of a
// second per lap, while a pit stop adds about 20 seconds. Instead we plot the
// GAP to a reference driver, lap by lap:
//
//   cumulative time after lap n = sum of the driver's lap times for laps 1..n
//   gap after lap n             = driver's cumulative time - reference's cumulative time
//
// Positive gap = behind the reference. Draw "ahead" at the top.
// A pit stop shows as a drop of about 20 s; a safety car pulls the lines together.
//
// Your task: complete the TODO steps to draw one line per driver, then make it
// interactive and link it to chart 2:
//   - ONE vertical line that follows the mouse, and a tooltip with every driver's gap (STEP 9)
//   - zoom to the laps picked with the brush in chart 2 (STEP 10)
//   - highlight the line nearest to the mouse, here and in chart 2 (STEP 11 and 12)
// Refer to demo.js and participation.js for guidance.
//
// Read more:
//   Lines       https://d3js.org/d3-shape/line
//   Pointer     https://d3js.org/d3-selection/events#pointer
//   d3.median   https://d3js.org/d3-array/summarize#median
//   d3.least    https://d3js.org/d3-array/sort#least

import { onRaceChange, announce, listen } from './data.js';

let duration = 0;

const TOP_N = 10; // how many drivers to show (the first TOP_N finishers)

// ============================================================================
// DATA PROCESSING
// ============================================================================

// TODO STEP 1: Cumulative race time of one driver after each lap: [{ lap, cumulative, missing }, ...]
// Some laps have no time (lap_duration is null). Never drop them: use the driver's
// typical lap instead (the median of their laps that are not lap 1 and not a pit-in lap)
// and mark the point missing: true.
function cumulativeTimes(race, driverNumber) {
    const laps = race.laps.filter(l => l.driver_number === driverNumber);

    const typical = d3.median(
        laps.filter(l => /* Define which laps count: not lap 1, not a pit-in lap (l.pitIn), and with a time */),
        l => /* Specify the value to take the median of */
    );
    if (typical === undefined) return []; // a driver with no usable laps at all

    let cumulative = 0;
    return laps.map(l => {
        const missing = /* Define when a lap is missing: its lap_duration is null */;
        cumulative += /* Add the typical lap when the lap is missing, otherwise the lap's own time */;
        return { lap: l.lap_number, cumulative, missing };
    });
}

// TODO STEP 2: Gap of one driver to the reference after each lap that BOTH completed: [{ lap, gap, missing }, ...]
// The reference driver's own gap must be 0 on every lap.
function gapToReference(race, driverNumber, referenceNumber) {
    // A Map from lap number to the reference's cumulative time, so we can look it up per lap
    const refCumulative = new Map(cumulativeTimes(race, referenceNumber).map(p => [/* Define the key: the lap */, /* Define the value: the cumulative time */]));

    return cumulativeTimes(race, driverNumber)
        .filter(p => /* Keep only laps the reference also completed (Map has a .has method) */)
        .map(p => ({ lap: p.lap, gap: /* Define the gap: this driver's cumulative minus the reference's cumulative */, missing: p.missing }));
}

// ============================================================================
// CHART DIMENSIONS AND SVG SETUP
// ============================================================================

const margin = { top: 20, right: 60, bottom: 40, left: 60 };
const width = 900;
const height = 450;

const svg = d3.select('#chart3')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', 'Race trace: gap to the reference driver, lap by lap');

const xAxisGroup = svg.append('g').attr('class', 'axis').attr('transform', `translate(0, ${height - margin.bottom})`);
const yAxisGroup = svg.append('g').attr('class', 'axis').attr('transform', `translate(${margin.left}, 0)`);
const zeroLine = svg.append('line').attr('class', 'zero-line');
const zeroLabel = svg.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle');
// Lines are clipped to the plot area, so they do not spill over the axes when zoomed in
svg.append('clipPath').attr('id', 'plot-area')
    .append('rect')
    .attr('x', margin.left).attr('y', margin.top)
    .attr('width', width - margin.left - margin.right)
    .attr('height', height - margin.top - margin.bottom);
const linesGroup = svg.append('g').attr('clip-path', 'url(#plot-area)');
const labelsGroup = svg.append('g');
const hoverLine = svg.append('line').attr('class', 'hover-line').attr('opacity', 0);

svg.append('text')
    .attr('class', 'axis-label')
    .attr('text-anchor', 'end')
    .attr('x', width - margin.right)
    .attr('y', height - 6)
    .text('Lap');
svg.append('text')
    .attr('class', 'axis-label')
    .attr('x', margin.left + 6)
    .attr('y', margin.top + 4)
    .text('▲ ahead');
svg.append('text')
    .attr('class', 'axis-label')
    .attr('x', margin.left + 6)
    .attr('y', height - margin.bottom - 6)
    .text('▼ behind');

// The scales are created once; their domains change in draw()
const x = d3.scaleLinear().range([margin.left, width - margin.right]);
const y = d3.scaleLinear().range([margin.top, height - margin.bottom]); // negative gap (ahead) at the top

// The tooltip box: an empty <div> on the page, hidden until the mouse is over the chart.
// position: fixed (in css/style.css) lets it float above everything, next to the mouse.
const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .attr('hidden', '');
const referenceSelect = d3.select('#reference-select');

let race = null;
let reference = null;
let series = [];
let lapRange = null;      // [firstLap, lastLap] from the brush in chart 2, or null for all laps
let hoverDriver = null;   // driver_number of the highlighted line, or null

// ============================================================================
// DRAW
// ============================================================================

function draw() {
    const drivers = race.drivers.slice(0, TOP_N);
    const refName = race.drivers.find(d => d.driver_number === reference).name_acronym;

    // One series per driver: the driver, and their gap to the reference on every lap
    series = drivers.map(d => ({ driver: d, values: gapToReference(race, d.driver_number, reference) }));

    // TODO STEP 3: Create the scales
    // Only the laps picked with the brush in chart 2 are visible (all laps when lapRange is null)
    const [firstLap, lastLap] = /* Define: lapRange, or [1, race.maxLap] when lapRange is null (use ??) */;
    const visible = v => /* Define: true when v.lap is between firstLap and lastLap */;
    const allGaps = series.flatMap(s => s.values.filter(visible).map(v => v.gap));

    x.domain(/* Define the domain: the visible laps */);
    y.domain(d3.extent(/* Define the values: all visible gaps AND 0, so the zero line always shows */)).nice();

    // TODO STEP 4: Create the axes first, then call them on their groups
    // x axis: whole laps only, d3.format('d'); at most 10 ticks, .ticks(Math.min(10, lastLap - firstLap))
    // y axis: ticks like "+10 s" / "-5 s" (a "+" in front of positive gaps)
    const xAxis = /* Create the x axis from the x scale */;
    const yAxis = /* Create the y axis from the y scale */;

    xAxisGroup.transition().duration(/* Define duration */).call(/* Call the x axis */);
    yAxisGroup.transition().duration(/* Define duration */).call(/* Call the y axis */);

    // TODO STEP 5: Draw the zero line (the reference driver) across the chart, and label it
    zeroLine.transition().duration(duration)
        .attr(/* Define the starting x */)
        .attr(/* Define the ending x */)
        .attr(/* Define the starting y */)
        .attr(/* Define the ending y */);
    zeroLabel.text(/* Define the text: "<reference acronym> (reference)" */)
        .transition().duration(duration)
        .attr(/* Define x: the middle of the plot area */)
        .attr(/* Define y: 6 px above the zero line */);

    // TODO STEP 6: One line per driver, keyed by driver number
    const line = d3.line()
        .x(d => /* Define x: the lap */)
        .y(d => /* Define y: the gap */);

    linesGroup.selectAll('path')
        .data(series, /* Define the key: the driver's number */)
        .join('path')
        .attr('class', 'trace-line')
        .attr('stroke', s => /* Define the color: the driver's team color */)
        .attr('stroke-dasharray', s => /* Dashed ('6 4') for the second driver of a team (s.driver.dash), otherwise null */)
        .transition().duration(duration)
        .attr('d', s => /* Draw the line from the driver's values */);

    // TODO STEP 7: Labels at the end of each line (the last lap you can see), pushed apart so they do not overlap
    const ends = series
        .filter(s => s.values.some(visible))
        .map(s => {
            const last = s.values.filter(visible).at(-1);
            return { driver: s.driver, lap: last.lap, y: /* Define the label height: y of the last gap */ };
        })
        .sort((a, b) => a.y - b.y);
    ends.forEach((d, i) => {
        // If a label is less than 14 px below the one above it, push it down
        if (i > 0 && d.y < ends[i - 1].y + 14) d.y = /* Define the new height */;
    });

    labelsGroup.selectAll('text')
        .data(ends, d => d.driver.driver_number)
        .join('text')
        .attr('class', 'end-label')
        .attr('fill', d => /* Define the color: the driver's team color */)
        .attr('dy', '0.35em')
        .text(d => /* Define the text: the driver's three-letter name */)
        .transition().duration(duration)
        .attr('x', d => /* Define x: just right of the last visible lap (+6 px) */)
        .attr('y', d => d.y);

    // TODO STEP 8: from the next change on, animate
    duration = /* Define duration: 750 */;
}

// ============================================================================
// REFERENCE DRIVER SELECTOR (provided)
// ============================================================================

referenceSelect.on('change', event => {
    reference = Number(event.target.value);
    draw();
});

onRaceChange(newRace => {
    race = newRace;
    lapRange = null;                           // a new race starts zoomed out
    reference = race.drivers[0].driver_number; // the winner
    referenceSelect.selectAll('option')
        .data(race.drivers)
        .join('option')
        .attr('value', d => d.driver_number)
        .text(d => `${d.name_acronym} (${d.full_name})`);
    referenceSelect.property('value', reference);
    draw();
});

// ============================================================================
// ZOOM: listen to the brush in chart 2
// ============================================================================

// TODO STEP 10: chart 2 announces 'lapRange' when you brush. Remember it and redraw.
listen(/* Define the message name */, range => {
    lapRange = /* Define: the range chart 2 sent */;
    draw();
});

// ============================================================================
// HOVER: one vertical line, a tooltip with every driver's gap on that lap,
// and the line nearest to the mouse highlighted here AND in chart 2
// ============================================================================

// TODO STEP 11: highlight one driver: dim the other lines and tell chart 2
function highlight(driverNumber) {
    if (driverNumber === hoverDriver) return; // nothing changed
    hoverDriver = driverNumber;
    linesGroup.selectAll('path')
        .attr('opacity', s => /* Define opacity */);
    announce(/* Define the message name */, driverNumber);    // chart 2 fades the other drivers' bars
}

// TODO STEP 9: a transparent rect over the plot area catches the mouse
svg.append('rect')
    .attr('x', margin.left)
    .attr('y', margin.top)
    .attr('width', width - margin.left - margin.right)
    .attr('height', height - margin.top - margin.bottom)
    .attr('fill', 'transparent')
    .on('mousemove', event => {
        // The mouse position in pixels, and the lap under it (kept inside the visible laps)
        const [mx, my] = d3.pointer(event);
        const [firstLap, lastLap] = x.domain();
        const lap = Math.max(firstLap, Math.min(lastLap, Math.round(/* Define: turn the mouse x back into a lap */)));

        // The vertical line at that lap
        hoverLine
            .attr('opacity', /* Define opacity */)
            .attr(/* Define the starting x */)
            .attr(/* Define the ending x */)
            .attr(/* Define the starting y */)
            .attr(/* Define the ending y */);

        // Every driver's gap on that lap, from ahead to behind
        const points = series
            .map(s => ({ driver: s.driver, point: s.values.find(v => /* Define: the value for this lap */) }))
            .filter(r => r.point)
            .sort((a, b) => /* Define the order: smallest gap first */);

        // TODO STEP 11 (continued): the driver whose line is nearest to the mouse on this lap
        const nearest = d3.least(points, r => /* Define the distance in pixels between the line and the mouse (Math.abs, my) */);
        highlight(nearest ? nearest.driver.driver_number : null);

        const rows = points.map(r => {
            const text = `${r.driver.name_acronym}: ${r.point.gap > 0 ? '+' : ''}${r.point.gap.toFixed(1)} s${r.point.missing ? ' (estimated)' : ''}`;
            return r === nearest ? `<strong>${text}</strong>` : text;
        });

        // Show the tooltip next to the mouse
        tooltip
            .attr('hidden', null)
            .style('left', /* Define: 14 px right of the mouse (event.clientX) */)
            .style('top', /* Define: 14 px below the mouse (event.clientY) */)
            .html(`<strong>Lap ${lap}</strong><br>${rows.join('<br>')}`);
    })
    .on('mouseleave', () => {
        // Hide the line and the tooltip, and stop highlighting (STEP 11)
        hoverLine.attr('opacity', /* Define opacity */);
        tooltip.attr('hidden', '');
        highlight(/* Define: no driver */);
    });

// TODO STEP 12: in participation.js (at the bottom), listen to 'hoverDriver' and fade the
// other drivers' bars in chart 2.