# ⚡ DynaShift AI — Dynamic Workforce Rescheduling Under Disruption

**ANVATION 2026 Hackathon Project**

🌐 **Live Demo:** https://kgowripriya2006-art.github.io/dynamic-workforce-rescheduler

---

## Problem Statement

Operational disruptions — such as unexpected employee absences, demand surges, equipment failures, or skill loss due to injury — break pre-built workforce schedules and leave shifts understaffed. Manually repairing those schedules is slow, error-prone, and often unfair to workers. There is no quick automated way to restore coverage while respecting availability, skills, and fairness constraints simultaneously.

---

## Project Objective

Build an interactive, browser-based tool that:

1. Generates a synthetic workforce dataset (employees, skills, availability, demand).
2. Produces an optimised initial schedule using AI/ML algorithms.
3. Simulates real-world operational disruptions.
4. Automatically repairs the broken schedule with the fewest possible changes (minimum-change metric).
5. Displays unresolved conflicts, coverage gaps, fairness scores, and a side-by-side comparison of the before/after schedule.

---

## Main Features

| Feature | Description |
|---|---|
| Synthetic Data Engine | Generates employees with randomised names, skills, availability, and shift demand per day |
| AI Scheduler | Four selectable optimisation algorithms (see Technology Stack) |
| Live Constraint Editor | Adjust max hours/week, min rest, max consecutive days, skill-match toggle — re-optimises instantly |
| Disruption Injection | Four disruption types: Employee Absence, Demand Surge, Skill Loss / Injury, Equipment Failure |
| AI Schedule Repair | Minimum-change iterative repair that fixes under-coverage and removes invalid assignments |
| Comparison View | Side-by-side diff of initial vs revised schedule; every changed cell is highlighted |
| Conflict Panel | Lists every unresolved constraint violation in real time |
| Analytics Dashboard | Four Chart.js charts — coverage by day, workload distribution, GA fitness evolution, skill coverage |
| Metrics Row | Six live KPIs — employees, shifts assigned, coverage %, fairness score, conflicts, change cost |
| AI Decision Log | Timestamped log of every algorithm step and repair action |

---

## Technology Stack

| Layer | Technology |
|---|---|
| UI / Layout | HTML5, CSS3 (CSS custom properties, CSS Grid, Flexbox) |
| Styling | Pure CSS — dark multicolour gradient design, no CSS framework |
| Logic | Vanilla JavaScript (ES6+), no build tools required |
| Charts | [Chart.js](https://www.chartjs.org/) loaded from CDN (`cdn.jsdelivr.net`) |
| Algorithms | Greedy Heuristic, Genetic Algorithm, Simulated Annealing, Constraint Propagation |
| Data | Fully synthetic — generated in-browser, no backend or database |
| Runtime | Any modern browser (Chrome, Edge, Firefox, Safari) — open `index.html` directly |

---

## Project File Structure

```
yoga/
│
├── index.html       — Main HTML page (UI structure, layout, panels, tabs)
├── styles.css       — All styling (colours, layout, cards, schedule grid, animations)
├── data.js          — Synthetic data generation (employees, demand matrix, global STATE)
├── scheduler.js     — All AI/ML algorithms, disruption engine, repair engine, conflict detection
├── analytics.js     — Chart.js chart initialisation and update functions
├── ui.js            — DOM rendering (schedule table, employee list, demand table, metrics, logs)
│
├── README.md        — This file
├── CONTRIBUTING.md  — Team collaboration rules
├── TEAM_WORK.md     — Team responsibility table
└── .gitignore       — Files excluded from version control
```

---

## What Each File Does

### `index.html`
The single HTML page for the entire application. It defines:
- The sticky header with the project name and event badges.
- The six live metric cards (employees, shifts, coverage, fairness, conflicts, change cost).
- The three-column main layout: Left Panel (controls), Centre Panel (schedule grid + tabs), Right Panel (employee list, demand, conflicts, AI log).
- All form inputs, dropdowns, sliders, and buttons that call JavaScript functions.
- Script tags that load `data.js`, `scheduler.js`, `ui.js`, and `analytics.js` in that order (order matters — `data.js` defines `STATE` and `shuffleArr` which the others use).

### `styles.css`
All visual styling. Key sections:
- CSS custom properties (colour variables, radius, shadow) defined in `:root`.
- Header, metric cards, main three-column grid.
- Card components, form inputs, buttons.
- Schedule table cell types: `cell-morning`, `cell-afternoon`, `cell-night`, `cell-off`, `cell-conflict`, `cell-changed`.
- Employee list, demand table, conflict list, AI log entries.
- Chart cards, comparison metrics, disruption badges.
- Animations: `pulse`, `blink`, `flashRed`, `slideIn`.
- Responsive breakpoints at 1100 px and 750 px.

### `data.js`
Responsible for the global application state and synthetic data generation.
- Defines the global `STATE` object — the single source of truth shared by all other JS files. It holds `employees`, `demand`, `schedule`, `revised`, `disruptions`, `constraints`, `fitnessLog`, `numDays`, `numShifts`.
- `generateData()` — called by the "Generate Synthetic Data" button. Builds the employee array (names, skills, availability, seniority, colour) and the demand matrix (staffing requirements per day per shift).
- `syncConstraints()` — reads the Live Constraint Editor inputs and writes them to `STATE.constraints`.
- `shuffleArr()` — Fisher-Yates shuffle utility, used in `data.js` and `scheduler.js`.
- Constants: `SKILLS`, `SHIFT_NAMES`, `SHIFT_HOURS`, `AVATAR_COLORS`, `FIRST_NAMES`, `LAST_NAMES`.

### `scheduler.js`
The core AI/ML engine. Contains all four optimisation algorithms plus the disruption and repair systems.
- `makeEmptySchedule()` — creates a `schedule[employeeId][day] = -1` structure.
- `evaluateFitness(schedule)` — multi-objective fitness function. Computes coverage penalty, fairness penalty (std dev of workloads), and constraint penalty. Lower total = better.
- `countAssigned(schedule, day, shiftIdx)` — counts how many active employees are assigned to a given slot.
- `greedySchedule()` — fills slots day-by-day, always picking the least-loaded available employee first.
- `geneticAlgorithm()` — runs a generational GA with tournament selection, single-point crossover, and random mutation. Population seeded with one greedy solution. Elitism preserves the top 2 individuals each generation.
- `simulatedAnnealing()` — starts from greedy, perturbs one slot at a time, accepts worse solutions probabilistically based on temperature.
- `constraintPropagation()` — builds per-employee/per-day domains, applies arc-consistency to enforce max-hours, then assigns greedily using the MRV (Minimum Remaining Values) heuristic.
- `runScheduler()` — entry point called by the "Run AI Scheduler" button. Reads the selected algorithm and delegates.
- `injectDisruption()` — handles four disruption types: marks employees inactive, multiplies demand, removes a skill, or blocks an entire shift.
- `repairSchedule()` — iterative minimum-change repair. Copies the initial schedule, removes invalid assignments, fills under-covered slots with substitutes sorted by least-loaded first.
- `detectConflicts(schedule)` — checks for under-coverage, availability violations, max-consecutive-day violations, and max-hours violations. Returns an array of conflict objects.
- `calcMetrics(schedule)` — derives coverage %, fairness score, conflict count, total shifts, and change cost from a schedule.
- `deepCopySchedule(sch)` — shallow-clones each employee's day array.

### `ui.js`
All DOM rendering and user interaction handlers.
- `switchTab(name, el)` — shows the selected tab panel (Initial, Revised, Comparison, Analytics).
- `renderSchedule(type, schedule)` — builds the HTML schedule table. Rows = employees, columns = days. Each cell shows shift name + icon, coloured by type, with conflict highlighting for invalid assignments. A demand row at the bottom shows assigned/required ratio per day.
- `shiftCell(s, isConflict)` — returns a single `<td>` element for a given shift index.
- `renderComparison(initial, revised)` — computes change count, builds the comparison metrics grid, and renders the diff table where changed cells show the old shift struck through and the new shift in teal.
- `renderEmployeeList()` — renders the employee cards in the right panel with avatar, name, skills tags, and seniority.
- `renderDemandTable()` — renders the demand matrix with colour-coded cell classes (`demand-high`, `demand-med`, `demand-low`).
- `detectAndShowConflicts(schedule, source)` — calls `detectConflicts()` (from `scheduler.js`) and renders the conflict list in the right panel.
- `updateMetrics()` — reads the current schedule state and updates the six metric card values in the header row.
- `addDisruptionBadge(d)` — appends a styled badge to the disruption log in the Revised tab.
- `addLog(level, msg)` — prepends a timestamped entry to the AI Decision Log. Levels: `info`, `ok`, `warn`, `error`.
- Clear helpers: `clearScheduleViews()`, `clearConflicts()`, `clearDisruptionLog()`, `clearAiLog()`.
- Two event listeners for the fairness/coverage weight sliders that update their displayed values live.

### `analytics.js`
Manages all four Chart.js charts in the Analytics tab.
- `updateCharts()` — called after every scheduler run or repair; triggers all four chart updates.
- `updateCoverageChart()` — grouped bar chart (required vs assigned) per day.
- `updateWorkloadChart()` — horizontal bar chart of total shifts worked per employee.
- `updateFitnessChart()` — line chart plotting the best fitness score at each GA generation or SA checkpoint.
- `updateSkillsChart()` — doughnut chart showing how many employees hold each skill type.
- `CHART_DEFAULTS` — shared Chart.js options (dark theme colours, grid styles, legend font).
- `DOMContentLoaded` listener — displays welcome instructions in the AI log on page load.

---

## How to Run the Project Locally

No installation, build step, or server is required.

1. Clone or download the repository to your machine.
2. Open the `yoga/` folder.
3. Double-click `index.html` to open it in your browser.

That is all. The app loads Chart.js from a CDN, so an internet connection is needed for the charts. All other logic runs entirely in the browser.

**Recommended browser:** Google Chrome or Microsoft Edge (latest version).

---

## How the Scheduling / Rescheduling System Works

### Step 1 — Generate Data
Click **Generate Synthetic Data**. `data.js` builds the `STATE` object with a list of employees (each with skills and a per-slot availability map) and a demand matrix (`STATE.demand[day][shift] = required headcount`).

### Step 2 — Run AI Scheduler
Click **Run AI Scheduler**. `scheduler.js` runs the selected algorithm against `STATE.employees` and `STATE.demand`. Each algorithm produces a `schedule` object: `schedule[employeeId][day] = shiftIndex` (or `-1` for off). The result is saved to `STATE.schedule` and rendered by `ui.js`.

### Step 3 — Inject Disruptions
Click **Inject Disruption** (at least twice as required). Each disruption modifies `STATE` directly — for example, marking an employee's `active` flag as `false`, multiplying demand values, or zeroing out availability slots.

### Step 4 — Repair
Click **AI Repair Schedule**. `repairSchedule()` in `scheduler.js` copies `STATE.schedule`, then iterates up to 50 times:
- Removes assignments that are now invalid (employee inactive or unavailable).
- Fills under-covered slots by finding available, least-loaded substitutes.
- Trims over-covered slots.

The result is saved to `STATE.revised`. The repair prefers the fewest changes — it only touches slots that need fixing.

### Step 5 — Review Results
- **Comparison tab** — side-by-side diff; changed cells highlighted in teal.
- **Conflicts panel** — any slots that still cannot be filled are listed.
- **Metrics row** — change cost (number of cells modified), coverage %, fairness score.
- **Analytics tab** — charts update to reflect the revised schedule.

---

## How Each Team Member Can Understand and Continue Another Member's Work

- **All application state lives in `STATE`** (defined in `data.js`). If you want to understand what data the app is working with at any moment, inspect `STATE` in the browser console.
- **Function calls follow a clear pipeline:** `generateData()` → `runScheduler()` → `injectDisruption()` → `repairSchedule()`. Each step reads from and writes to `STATE`.
- **Each file has a single, clear responsibility.** If a bug is visual, look in `ui.js` or `styles.css`. If it is algorithmic, look in `scheduler.js`. If data is wrong, look in `data.js`. Charts are only in `analytics.js`.
- **All functions are global** (no modules), so you can call any function from the browser console to test it independently.
- **Script load order in `index.html` is significant:** `data.js` first (defines `STATE`, `SKILLS`, `SHIFT_NAMES`, `shuffleArr`), then `scheduler.js`, then `ui.js`, then `analytics.js`. Do not reorder these.
- **To trace a feature end-to-end**, search for the button's `onclick` value in `index.html` to find the entry-point function, then follow calls across files.

---

## GitHub Collaboration Instructions

### Initial Setup (do once)

```bash
# Clone the repository
git clone https://github.com/<your-org>/<repo-name>.git

# Move into the project folder
cd <repo-name>
```

### Pull the Latest Changes

Always do this before starting any new work:

```bash
git checkout main
git pull origin main
```

### Create a Branch

Use a short, descriptive name. One branch per feature or fix.

```bash
# Format: feature/<short-description> or fix/<short-description>
git checkout -b feature/improve-repair-algorithm
```

### Make and Commit Changes

Stage only the files you actually changed. Write a clear commit message.

```bash
# Stage specific files (preferred over git add .)
git add scheduler.js

# Commit with a meaningful message
git commit -m "feat: improve repair to handle equipment-failure disruption"
```

Commit message format to follow:
- `feat:` — new feature or enhancement
- `fix:` — bug fix
- `docs:` — documentation only
- `style:` — CSS or formatting change, no logic change
- `refactor:` — code restructure, no behaviour change

### Push Changes

```bash
git push -u origin feature/improve-repair-algorithm
```

### Create a Pull Request

1. Go to the repository on GitHub.
2. Click **Compare & pull request** (GitHub shows this automatically after a push).
3. Fill in the title and description — mention what changed and why.
4. Request a review from at least one teammate.
5. Do **not** merge your own PR without a review.

### Merge Changes Safely

1. Make sure all teammates have reviewed and approved the PR.
2. Resolve any merge conflicts locally:
   ```bash
   git checkout main
   git pull origin main
   git checkout feature/improve-repair-algorithm
   git merge main
   # Fix conflicts, then:
   git add <conflicted-files>
   git commit -m "merge: resolve conflicts with main"
   git push
   ```
3. Merge the PR on GitHub using **Squash and merge** to keep the main branch history clean.
4. Delete the feature branch after merging.

---

## Out of Scope

- Enterprise HR or payroll integration.
- Exhaustive labour-law implementation.
- Backend server or database — all data is synthetic and lives in the browser.
