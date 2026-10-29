// ============================================================================
// DEMO.JS - Track outline (we build this together in class)
// ============================================================================
// Question: what does this circuit look like?
//
// race.outline is a list of [x, y] positions of one car during one lap.
// The units are arbitrary, so we have to scale them into our SVG ourselves.
//
// Read more:
//   Scales      https://d3js.org/d3-scale/linear
//   Lines       https://d3js.org/d3-shape/line
//   Transitions https://d3js.org/d3-transition
// ============================================================================

import { onRaceChange } from './data.js';

// No animation on the first draw (page load); after that, transitions take 750 ms.
// Use .transition().duration(duration), and set duration = 750 at the end of each draw.
let duration = 0;


// ============================================================================
// SVG SETUP
// ============================================================================
// viewBox makes the SVG scale with the page, keeping its shape

const width = 600;
const height = 400;
const padding = 20;

const svg = d3.select('#chart1')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', 'Track outline');

// We create the elements ONCE here, and only change their attributes when the race changes
const track = svg.append('path').attr('class', 'track');

// TODO: append a circle with class 'start-dot' (radius 7) and a text 'Start / finish'
const startDot = svg.append('circle').attr('class', 'start-dot').attr('r', 7);
const startLabel = svg.append('text').text('Start / Finish');

// TODO: we also need one more dot that will trace around the circuit when we hit play
// It should be invisible at the beginning 
const replayDot = svg.append('circle').attr('class', 'replay-dot').attr('r', 8).attr('opacity', 0)


// ============================================================================
// LINE GENERATOR
// ============================================================================
// d3.line() turns a list of [x, y] points into the "d" attribute of a <path>.

// TODO: create a line generator with a closed, smooth curve
// Hint: d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))
const line = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))


// ============================================================================
// DRAW (runs for the first race and every time the race changes)
// ============================================================================

onRaceChange(race => {
    const points = race.outline;
    console.log('Outline points:', points.length, points.slice(0, 3));

    // TODO STEP 1: How big is the track? Use d3.extent to get [min, max] of x and of y
    const xRange = 
    const yRange = 

    const trackWidth = 
    const trackHeight = 

    // TODO STEP 2: Calculate the scale factor for both axes
    // The track length and height are way bigger than the available pixels on the screen, so we have to shrink it
    // k is the min value between two values:
    // screen width - left and right padding over the track width
    // screen height - top and bottom padding over the track height
    // k =

    // TODO STEP 3: Center the track 
    // Right now the track would start from the top left corner of the canvas
    // We need to create an offset to start from the center
    const offsetX = 
    const offsetY = 
    
    
    // TODO STEP 4: Build scales x and y, using scale factor x
    const x = d3.scaleLinear()
        .domain(/* Define domain */)
        .range(/* Define range */)

    const y = d3.scaleLinear()
        .domain(/* Define domain */)
        .range(/* Define range */) // Remember: SVG y points DOWN, so flip the range of y (otherwise the circuit is mirrored)
    
    // TODO STEP 5: convert the points to screen positions and set the path's "d" attribute
    const screenPoints = points.map(d => [])

    // TODO STEP 6: Use a transition so the old circuit morphs into the new one when the race changes:
    // track.transition().duration(duration).attr('d', ...)
    // ...and at the end of this function: duration = 750;

    // TODO STEP 7: move the start/finish dot and label to the first point of the lap
    const [startX, startY] = 
    // startDot is a circle, so it means we need to define cx, cy
    // startLabel is a text, we need to define x and y

    // Update the aria-label of the svg with the race name
    svg.attr('aria-label', `Track outline of the ${race.label}`);
    replayDot.interrupt().attr('opacity', 0);
});


// ============================================================================
// REPLAY A LAP
// ============================================================================
// TODO: when the "Replay a lap" button (#replay) is clicked, move a dot along the path in 5 seconds.
const replayButton = d3.select('#replay');

replayButton.on('click', () => {
    const path = track.node();
    const length = path.getTotalLength();
    const start = path.getPointAtLength(0);

    // TODO STEP 8: whenever new track is selected, place the replayDot to the start of that track
    // Hint: starting point is it start.x and start.y
    replayDot.interrupt()
        .attr(/* Define opacity */)
        .attr(/* Define position along x axis */)
        .attr(/* Define position along y axis */)
        .attr('transform', null);

    
    // Disable the button while the lap plays, so clicks do not restart it
    replayButton.property('disabled', true);

    // TODO STEP 9: Set animation duration to 5 seconds and specify how to translate points
    replayDot.transition()
        .duration(/* Define duration */)
        .ease(d3.easeLinear) // constant speed
        .attrTween('transform', () => t => {
            const p = path.getPointAtLength(t * length);
            return `translate(${/* Define the translation point's x axis value */}, ${/* Define the translation point's y axis value */})`;
        })
        // 'end' when the lap finishes, 'interrupt' when a race change stops it
        .on('end interrupt', () => replayButton.property('disabled', false));

});
