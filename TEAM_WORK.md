# Team Responsibility Table — DynaShift AI

**ANVATION 2026 Hackathon**

Update this table whenever responsibilities shift or status changes. Keeping it accurate helps any member pick up where another left off.

---

## Responsibility Assignment

| Member | Responsibility | Primary Files / Modules | Current Status |
|---|---|---|---|
| Member 1 | Synthetic data generation; global application state; employee and demand data structures | `data.js` | Placeholder — update with actual name and status |
| Member 2 | AI/ML scheduling algorithms (Genetic Algorithm, Simulated Annealing, Greedy, Constraint Propagation); disruption engine; schedule repair engine; conflict detection; metrics calculation | `scheduler.js` | Placeholder — update with actual name and status |
| Member 3 | UI rendering; schedule grid table; comparison view; employee list; demand table; conflict panel; AI log; metrics row updates; tab navigation | `ui.js`, `index.html` | Placeholder — update with actual name and status |
| Member 4 | Visual design; CSS layout and styling; Chart.js analytics dashboard (coverage, workload, fitness, skills charts); responsive breakpoints | `styles.css`, `analytics.js` | Placeholder — update with actual name and status |

---

## How to Use This Table

- **Before starting work**, check this table to understand what each member owns.
- **If you need to edit a file owned by another member**, coordinate with them first to avoid conflicts.
- **Update the "Current Status" column** regularly so the team knows what is in progress, done, or blocked. Suggested status values: `In Progress`, `Complete`, `Needs Review`, `Blocked`.

---

## File Ownership Quick Reference

| File | Owner |
|---|---|
| `data.js` | Member 1 |
| `scheduler.js` | Member 2 |
| `ui.js` | Member 3 |
| `index.html` | Member 3 |
| `styles.css` | Member 4 |
| `analytics.js` | Member 4 |
| `README.md` | All members (shared) |
| `CONTRIBUTING.md` | All members (shared) |
| `TEAM_WORK.md` | All members (shared) |

---

## Key Interfaces Between Files

Understanding these handoff points helps members work independently without breaking each other's code.

| Produces | Consumed By | What is Passed |
|---|---|---|
| `data.js` → `STATE` | `scheduler.js`, `ui.js`, `analytics.js` | Global `STATE` object — employees, demand, schedule, constraints |
| `data.js` → `SKILLS`, `SHIFT_NAMES`, `shuffleArr` | `scheduler.js`, `ui.js` | Constants and utility function used across files |
| `scheduler.js` → `STATE.schedule` | `ui.js` (`renderSchedule`), `analytics.js` | The initial schedule object |
| `scheduler.js` → `STATE.revised` | `ui.js` (`renderSchedule`, `renderComparison`), `analytics.js` | The repaired schedule object |
| `scheduler.js` → `STATE.fitnessLog` | `analytics.js` (`updateFitnessChart`) | Array of best fitness values per generation |
| `ui.js` → DOM elements | All — DOM is the shared output surface | Rendered HTML in the browser |

---

## Notes for a New Member Joining Mid-Hackathon

1. Read `README.md` fully before touching any code.
2. Open `index.html` in a browser and run through the full demo flow to understand what the app does.
3. Open the browser console (F12) and type `STATE` to inspect the live application data.
4. Read only the file(s) relevant to your assigned responsibility.
5. Create your own branch immediately — never work on `main` directly.
6. If something is unclear, search for the function name across all files using your editor's global search before asking — the codebase is small and fully in-browser.
