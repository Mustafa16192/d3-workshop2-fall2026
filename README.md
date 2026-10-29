# D3.js Workshop: Interactions in D3 (F1 Race Explorer)

One page, three linked charts about a real Formula 1 race, built with D3 and data from [OpenF1](https://openf1.org):

| Part | File | Chart | Interactions you build | Who |
|------|------|-------|------------------------|-----|
| A. Demo | `js/demo.js` | 1. Track outline | a button that starts an animation; transitions when the race changes | we code it together in class |
| B. Participation | `js/participation.js` | 2. Tyre strategy | a brush (`d3.brushX`) over the chart to pick laps | in pairs or alone, due tomorrow |
| C. Assignment | `js/assignment.js` | 3. Race trace | a hover line and tooltip (`d3.pointer`); zoom to the brushed laps; highlight a driver in both charts | alone, due in one week |

The charts are linked: brushing laps in chart 2 zooms chart 3, and hovering a driver in chart 3 highlights them in chart 2. Charts talk to each other with `announce` and `listen` from `js/data.js`.

All three charts appear on `index.html`. That page is what you submit.

## Getting Started

### 1. Fork this repository
Click the **Fork** button in the top-right corner of this GitHub page. This creates your own copy under your GitHub account.

### 2. Clone your fork
```bash
git clone https://github.com/YOUR-USERNAME/d3-workshop2-fall2026.git
cd d3-workshop2-fall2026
```

### 3. Open in VS Code and install Live Server
D3 loads the race files with `fetch`, which needs a local server: opening the HTML file directly in your browser will not work. In VS Code, open the Extensions panel, search for **Live Server** by Ritwick Dey and install it.

### 4. Launch Live Server
Right-click `index.html` and select **Open with Live Server**. You should see the race selector and three empty charts. D3 is loaded from the internet, so stay online.

### 5. Working documents
Complete the TODO steps in `js/demo.js` (with the instructor), then `js/participation.js`, then `js/assignment.js`. 

You do not need to edit `js/data.js`. It loads the races from `data/` and gives every chart the same `race` object; the comment at the top of that file explains every field.

## The races

| Race | Why it is interesting |
|------|-----------------------|
| Japanese Grand Prix 2025 | dry and calm: one pit stop each, no safety car |
| British Grand Prix 2025 | rain: intermediate tyres, safety cars, five drivers out |
| Dutch Grand Prix 2025 | three safety cars that bunch the field together |

## Bonus (+0.5 points): add one more race

Download a race that is not in the list yet and make all three charts work with it. You need [Node.js](https://nodejs.org) 18 or newer (check with `node --version`) and internet.

1. List a season's races and their meeting keys (OpenF1 has data from 2023 onward):
   ```bash
   node scripts/fetch-race.mjs --year 2024
   ```
2. Fetch one race by its meeting key, for example:
   ```bash
   node scripts/fetch-race.mjs 1236
   ```
   This saves `data/races/<year>-<name>.json` and adds the race to the end of `data/index.json`.
3. Reload the page, pick the new race in the selector and check that all three charts draw it without errors in the console.
4. Commit the new JSON file and `data/index.json`, and say in "Your answers" below which race you added and why.

## Saving your work

```bash
git add .
git commit -m "your message here"
git push
```

## Your answers

**Participation answer** (3 sentences): which driver's strategy differed most from the winner's, and what on the chart shows it?

> In the 2025 Japanese Grand Prix, Lance Stroll (STR) stands out as differing most from winner Max Verstappen (VER) because he used three tyre compounds across three stints rather than two compounds across two stints. Verstappen's row changes from yellow medium tyres to gray hard tyres after lap 21, while Stroll's row changes from red soft tyres to gray hard tyres after lap 9 and then to yellow medium tyres after lap 30. The extra color segment and earlier first change show Stroll's two-stop strategy compared with Verstappen's one-stop strategy, although this chart alone cannot explain why the strategies differed or which was more effective.

**Assignment** (2 or 3 sentences): pick one race. What does the race trace show that a plain chart of lap times would hide?

>

**Bonus** (optional): which race did you add, and why?

>

---

Data: OpenF1 (https://openf1.org), licensed CC BY-NC-SA 4.0. OpenF1 is an unofficial project and is not associated with the Formula 1 companies. F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX and related marks are trademarks of Formula One Licensing B.V.
