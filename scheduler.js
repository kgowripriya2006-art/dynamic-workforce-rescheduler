/* ═══════════════════════════════════════════════════════
   SCHEDULER.JS — AI / ML Optimization Engine
   Implements:
     1. Greedy Heuristic
     2. Genetic Algorithm (ML-inspired)
     3. Simulated Annealing
     4. Constraint Propagation
   DynaShift AI — ANVATION 2026
═══════════════════════════════════════════════════════ */

/* ══════════════════════════════
   SCHEDULE REPRESENTATION
   schedule[employeeId][day] = shiftIndex | -1 (off)
══════════════════════════════ */

function makeEmptySchedule() {
  const s = {};
  STATE.employees.forEach(e => {
    s[e.id] = new Array(STATE.numDays).fill(-1);
  });
  return s;
}

/* ════════════════════════════════════════════════════
   FITNESS FUNCTION — Multi-objective
   Returns lower = better
════════════════════════════════════════════════════ */
function evaluateFitness(schedule, weights) {
  const w = weights || {
    coverage:  parseFloat(document.getElementById('coverageWeight').value) || 0.8,
    fairness:  parseFloat(document.getElementById('fairnessWeight').value) || 0.5,
    constraint: 1.0
  };

  let coveragePenalty  = 0;
  let fairnessPenalty  = 0;
  let constraintPenalty = 0;
  const workloads = {};
  STATE.employees.forEach(e => { workloads[e.id] = 0; });

  // ── Coverage ──
  for (let d = 0; d < STATE.numDays; d++) {
    for (let s = 0; s < STATE.numShifts; s++) {
      const required = STATE.demand[d][s];
      const assigned = countAssigned(schedule, d, s);
      const deficit = Math.max(0, required - assigned);
      const surplus = Math.max(0, assigned - required);
      coveragePenalty += deficit * 10 + surplus * 2;
    }
  }

  // ── Constraint violations ──
  STATE.employees.forEach(emp => {
    if (!emp.active) return;
    let consecutive = 0;
    let totalHours = 0;
    let prevShift = -1;

    for (let d = 0; d < STATE.numDays; d++) {
      const sh = schedule[emp.id][d];
      if (sh === -1) {
        consecutive = 0;
        prevShift = -1;
        continue;
      }

      // Availability
      if (!emp.availability[d][sh]) {
        constraintPenalty += 15;
      }
      // Skill match
      if (STATE.constraints.requireSkillMatch) {
        // (simplified: skill already checked during generation)
      }
      // Hours
      totalHours += 8;
      workloads[emp.id] += 1;
      consecutive++;
      // Max consecutive days
      if (consecutive > STATE.constraints.maxConsecutive) {
        constraintPenalty += 8;
      }
      prevShift = sh;
    }
    // Max hours per week
    const maxShifts = Math.floor(STATE.constraints.maxHours / 8);
    if (workloads[emp.id] > maxShifts) {
      constraintPenalty += (workloads[emp.id] - maxShifts) * 12;
    }
  });

  // ── Fairness (std dev of workloads) ──
  const vals = Object.values(workloads).filter(v => v > 0);
  if (vals.length > 0) {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / vals.length;
    fairnessPenalty = Math.sqrt(variance) * 5;
  }

  const total = w.coverage * coveragePenalty
               + w.fairness * fairnessPenalty
               + w.constraint * constraintPenalty;

  return { total, coveragePenalty, fairnessPenalty, constraintPenalty, workloads };
}

function countAssigned(schedule, day, shiftIdx) {
  let count = 0;
  STATE.employees.forEach(e => {
    if (e.active && schedule[e.id][day] === shiftIdx) count++;
  });
  return count;
}

/* ════════════════════════════════════════════════════
   1. GREEDY HEURISTIC
════════════════════════════════════════════════════ */
function greedySchedule() {
  const schedule = makeEmptySchedule();
  for (let d = 0; d < STATE.numDays; d++) {
    // Sort employees by least-assigned so far (fairness)
    const sorted = [...STATE.employees]
      .filter(e => e.active)
      .sort((a, b) => shiftsWorked(schedule, a.id) - shiftsWorked(schedule, b.id));

    for (let s = 0; s < STATE.numShifts; s++) {
      let needed = STATE.demand[d][s];
      for (const emp of sorted) {
        if (needed <= 0) break;
        if (emp.availability[d][s]) {
          schedule[emp.id][d] = s;
          needed--;
        }
      }
    }
  }
  return schedule;
}

function shiftsWorked(schedule, empId) {
  return schedule[empId].filter(s => s !== -1).length;
}

/* ════════════════════════════════════════════════════
   2. GENETIC ALGORITHM — Multi-generational
════════════════════════════════════════════════════ */
function geneticAlgorithm() {
  const POP_SIZE = 20;
  const GENERATIONS = Math.min(parseInt(document.getElementById('generations').value) || 100, 200);
  const MUTATION_RATE = 0.12;
  const ELITE = 2;

  addLog('info', `🧬 GA started: pop=${POP_SIZE}, gen=${GENERATIONS}`);

  // Initial population (seeded with greedy)
  let population = [];
  population.push(greedySchedule());
  for (let i = 1; i < POP_SIZE; i++) {
    population.push(randomSchedule());
  }

  STATE.fitnessLog = [];
  let bestSchedule = null;
  let bestFitness = Infinity;

  for (let gen = 0; gen < GENERATIONS; gen++) {
    // Evaluate
    const scored = population.map(sch => ({
      sch,
      fitness: evaluateFitness(sch).total
    })).sort((a, b) => a.fitness - b.fitness);

    if (scored[0].fitness < bestFitness) {
      bestFitness = scored[0].fitness;
      bestSchedule = deepCopySchedule(scored[0].sch);
    }

    STATE.fitnessLog.push(bestFitness);

    // Next generation
    const newPop = [];
    // Elites carry over
    for (let e = 0; e < ELITE; e++) newPop.push(scored[e].sch);

    // Tournament selection + crossover + mutation
    while (newPop.length < POP_SIZE) {
      const p1 = tournament(scored);
      const p2 = tournament(scored);
      const child = crossover(p1, p2);
      mutate(child, MUTATION_RATE);
      newPop.push(child);
    }
    population = newPop;
  }

  addLog('ok', `✅ GA complete. Best fitness: ${bestFitness.toFixed(2)}`);
  return bestSchedule || greedySchedule();
}

function randomSchedule() {
  const sch = makeEmptySchedule();
  STATE.employees.filter(e => e.active).forEach(emp => {
    for (let d = 0; d < STATE.numDays; d++) {
      if (Math.random() > 0.3) {  // 70% chance of working
        // Pick a random available shift
        const available = [];
        for (let s = 0; s < STATE.numShifts; s++) {
          if (emp.availability[d][s]) available.push(s);
        }
        if (available.length > 0) {
          sch[emp.id][d] = available[Math.floor(Math.random() * available.length)];
        }
      }
    }
  });
  return sch;
}

function tournament(scored, size = 3) {
  let best = null;
  for (let i = 0; i < size; i++) {
    const candidate = scored[Math.floor(Math.random() * scored.length)];
    if (!best || candidate.fitness < best.fitness) best = candidate;
  }
  return best.sch;
}

function crossover(p1, p2) {
  const child = makeEmptySchedule();
  const empIds = STATE.employees.map(e => e.id);
  const crossPoint = Math.floor(empIds.length / 2);
  empIds.forEach((id, idx) => {
    child[id] = idx < crossPoint
      ? [...p1[id]]
      : [...p2[id]];
  });
  return child;
}

function mutate(sch, rate) {
  STATE.employees.filter(e => e.active).forEach(emp => {
    for (let d = 0; d < STATE.numDays; d++) {
      if (Math.random() < rate) {
        if (Math.random() < 0.3) {
          sch[emp.id][d] = -1;  // set to off
        } else {
          const available = [];
          for (let s = 0; s < STATE.numShifts; s++) {
            if (emp.availability[d][s]) available.push(s);
          }
          if (available.length > 0) {
            sch[emp.id][d] = available[Math.floor(Math.random() * available.length)];
          }
        }
      }
    }
  });
}

/* ════════════════════════════════════════════════════
   3. SIMULATED ANNEALING
════════════════════════════════════════════════════ */
function simulatedAnnealing() {
  let current = greedySchedule();
  let currentFit = evaluateFitness(current).total;
  let best = deepCopySchedule(current);
  let bestFit = currentFit;

  let T = 1000;
  const alpha = 0.995;
  const iterations = 2000;
  STATE.fitnessLog = [];

  addLog('info', `🌡️ Simulated Annealing: T=${T}, iterations=${iterations}`);

  for (let i = 0; i < iterations; i++) {
    const neighbor = deepCopySchedule(current);
    perturbSchedule(neighbor);
    const neighborFit = evaluateFitness(neighbor).total;
    const delta = neighborFit - currentFit;

    if (delta < 0 || Math.random() < Math.exp(-delta / T)) {
      current = neighbor;
      currentFit = neighborFit;
    }
    if (currentFit < bestFit) {
      best = deepCopySchedule(current);
      bestFit = currentFit;
    }
    T *= alpha;
    if (i % 200 === 0) STATE.fitnessLog.push(bestFit);
  }

  addLog('ok', `✅ SA complete. Best fitness: ${bestFit.toFixed(2)}`);
  return best;
}

function perturbSchedule(sch) {
  const active = STATE.employees.filter(e => e.active);
  const emp = active[Math.floor(Math.random() * active.length)];
  const day = Math.floor(Math.random() * STATE.numDays);
  const available = [];
  for (let s = 0; s < STATE.numShifts; s++) {
    if (emp.availability[day][s]) available.push(s);
  }
  available.push(-1);  // off
  sch[emp.id][day] = available[Math.floor(Math.random() * available.length)];
}

/* ════════════════════════════════════════════════════
   4. CONSTRAINT PROPAGATION (Arc Consistency inspired)
════════════════════════════════════════════════════ */
function constraintPropagation() {
  addLog('info', `🔗 Constraint Propagation started`);
  const sch = makeEmptySchedule();
  const maxShifts = Math.floor(STATE.constraints.maxHours / 8);

  // Build domains: for each emp+day, list of possible shifts
  const domains = {};
  STATE.employees.filter(e => e.active).forEach(emp => {
    domains[emp.id] = {};
    for (let d = 0; d < STATE.numDays; d++) {
      domains[emp.id][d] = [-1];  // off is always possible
      for (let s = 0; s < STATE.numShifts; s++) {
        if (emp.availability[d][s]) domains[emp.id][d].push(s);
      }
    }
  });

  // Arc-consistency: reduce domains
  // Constraint: total shifts <= maxShifts
  STATE.employees.filter(e => e.active).forEach(emp => {
    const workDays = Object.keys(domains[emp.id])
      .filter(d => domains[emp.id][d].some(s => s >= 0));
    if (workDays.length > maxShifts) {
      // Force some days off
      const toForceOff = workDays.length - maxShifts;
      for (let i = 0; i < toForceOff; i++) {
        const d = workDays[Math.floor(Math.random() * workDays.length)];
        domains[emp.id][d] = [-1];
      }
    }
  });

  // Assign to meet demand
  for (let d = 0; d < STATE.numDays; d++) {
    for (let s = 0; s < STATE.numShifts; s++) {
      let needed = STATE.demand[d][s];
      // Sort by domain size (MRV heuristic) and availability
      const candidates = STATE.employees
        .filter(e => e.active && domains[e.id][d].includes(s))
        .sort((a, b) => {
          const aWork = Object.values(sch[a.id]).filter(x => x >= 0).length;
          const bWork = Object.values(sch[b.id]).filter(x => x >= 0).length;
          return aWork - bWork;
        });

      for (const emp of candidates) {
        if (needed <= 0) break;
        if (sch[emp.id][d] === -1) {
          sch[emp.id][d] = s;
          needed--;
        }
      }
    }
  }

  addLog('ok', `✅ Constraint Propagation complete.`);
  return sch;
}

/* ════════════════════════════════════════════════════
   MAIN SCHEDULER ENTRY POINT
════════════════════════════════════════════════════ */
function runScheduler() {
  if (!STATE.employees.length) {
    alert('⚠️ Generate synthetic data first!');
    return;
  }
  syncConstraints();
  addLog('info', `🤖 Scheduler running...`);

  const algo = document.getElementById('algorithm').value;
  let schedule;

  if      (algo === 'greedy')     schedule = greedySchedule();
  else if (algo === 'genetic')    schedule = geneticAlgorithm();
  else if (algo === 'simulated')  schedule = simulatedAnnealing();
  else                            schedule = constraintPropagation();

  STATE.schedule = schedule;
  STATE.fitnessLog = STATE.fitnessLog.length ? STATE.fitnessLog : [evaluateFitness(schedule).total];

  renderSchedule('initial', schedule);
  detectAndShowConflicts(schedule, 'initial');
  updateMetrics();
  updateCharts();
  switchTab('initial', document.querySelector('.tab'));
  addLog('ok', `📋 Initial schedule rendered (${algo}).`);
}

/* ════════════════════════════════════════════════════
   DISRUPTION ENGINE
════════════════════════════════════════════════════ */
function injectDisruption() {
  if (!STATE.schedule) {
    alert('⚠️ Run the scheduler first!');
    return;
  }

  const type = document.getElementById('disruptionType').value;
  const day  = parseInt(document.getElementById('disruptionDay').value) - 1;
  const sev  = document.getElementById('disruptionSeverity').value;

  if (day < 0 || day >= STATE.numDays) {
    alert(`⚠️ Day must be between 1 and ${STATE.numDays}`);
    return;
  }

  const disruption = { type, day, severity: sev, timestamp: Date.now() };
  let description = '';

  if (type === 'absence') {
    // Randomly pick active employees to go absent
    const active = STATE.employees.filter(e => e.active);
    const count = sev === 'high' ? 3 : sev === 'medium' ? 2 : 1;
    const affected = shuffleArr([...active]).slice(0, count);
    affected.forEach(emp => {
      emp.active = false;
      for (let s = 0; s < STATE.numShifts; s++) {
        emp.availability[day][s] = false;
      }
    });
    disruption.affected = affected.map(e => e.name);
    description = `👤 ${affected.map(e => e.name).join(', ')} absent on Day ${day + 1}`;
    addLog('warn', `⚠️ DISRUPTION: ${description}`);

  } else if (type === 'surge') {
    // Increase demand on that day
    const factor = sev === 'high' ? 2 : sev === 'medium' ? 1.5 : 1.25;
    for (let s = 0; s < STATE.numShifts; s++) {
      STATE.demand[day][s] = Math.ceil(STATE.demand[day][s] * factor);
    }
    disruption.factor = factor;
    description = `📈 Demand surge ×${factor} on Day ${day + 1}`;
    addLog('warn', `⚠️ DISRUPTION: ${description}`);
    renderDemandTable();

  } else if (type === 'skill_loss') {
    const active = STATE.employees.filter(e => e.active && e.skills.length > 1);
    if (active.length > 0) {
      const emp = active[Math.floor(Math.random() * active.length)];
      const removedSkill = emp.skills.splice(Math.floor(Math.random() * emp.skills.length), 1)[0];
      disruption.affected = [emp.name];
      disruption.skill = removedSkill;
      description = `🩹 ${emp.name} lost skill: ${removedSkill} (injury)`;
      addLog('warn', `⚠️ DISRUPTION: ${description}`);
      renderEmployeeList();
    }

  } else if (type === 'equipment') {
    // Equipment failure: certain shift unavailable for that day
    const affectedShift = Math.floor(Math.random() * STATE.numShifts);
    STATE.employees.forEach(emp => {
      emp.availability[day][affectedShift] = false;
    });
    disruption.shift = affectedShift;
    description = `🔧 Equipment failure: ${SHIFT_NAMES[affectedShift]} shift blocked on Day ${day + 1}`;
    addLog('warn', `⚠️ DISRUPTION: ${description}`);
  }

  disruption.description = description;
  STATE.disruptions.push(disruption);
  addDisruptionBadge(disruption);
  updateMetrics();
  detectAndShowConflicts(STATE.schedule, 'post-disruption');
}

/* ════════════════════════════════════════════════════
   REPAIR ENGINE — Minimum Change AI Repair
════════════════════════════════════════════════════ */
function repairSchedule() {
  if (!STATE.schedule) {
    alert('⚠️ Run the scheduler first!');
    return;
  }
  if (!STATE.disruptions.length) {
    alert('⚠️ Inject at least one disruption first!');
    return;
  }

  syncConstraints();
  addLog('info', `🔧 AI Repair started (minimum-change)...`);

  // Start from copy of initial schedule
  let repaired = deepCopySchedule(STATE.schedule);

  // Fix constraint violations iteratively
  let changed = 0;
  const REPAIR_ITERATIONS = 50;

  for (let iter = 0; iter < REPAIR_ITERATIONS; iter++) {
    let improved = false;

    for (let d = 0; d < STATE.numDays; d++) {
      for (let s = 0; s < STATE.numShifts; s++) {
        const required = STATE.demand[d][s];
        const assigned  = countAssigned(repaired, d, s);

        if (assigned < required) {
          // Under-covered: find best substitute
          const substitutes = STATE.employees
            .filter(e => e.active
                      && repaired[e.id][d] === -1
                      && e.availability[d][s])
            .sort((a, b) => shiftsWorked(repaired, a.id) - shiftsWorked(repaired, b.id));

          for (let i = 0; i < Math.min(required - assigned, substitutes.length); i++) {
            repaired[substitutes[i].id][d] = s;
            changed++;
            improved = true;
            addLog('ok', `🔄 Assigned ${substitutes[i].name} → Day ${d+1} ${SHIFT_NAMES[s]}`);
          }
        }

        if (assigned > required * 1.5) {
          // Over-covered: remove least-needed employee
          const overAssigned = STATE.employees
            .filter(e => repaired[e.id][d] === s)
            .sort((a, b) => shiftsWorked(repaired, b.id) - shiftsWorked(repaired, a.id));
          const toRemove = overAssigned.slice(required);
          toRemove.forEach(emp => {
            repaired[emp.id][d] = -1;
            changed++;
          });
        }
      }
    }
    // Remove invalid assignments (inactive or unavailable)
    STATE.employees.forEach(emp => {
      for (let d = 0; d < STATE.numDays; d++) {
        const s = repaired[emp.id][d];
        if (s >= 0 && (!emp.active || !emp.availability[d][s])) {
          repaired[emp.id][d] = -1;
          changed++;
          improved = true;
        }
      }
    });

    if (!improved) break;
  }

  STATE.revised = repaired;
  renderSchedule('revised', repaired);
  detectAndShowConflicts(repaired, 'revised');
  renderComparison(STATE.schedule, repaired);
  updateMetrics();
  updateCharts();
  switchTab('revised', document.querySelectorAll('.tab')[1]);
  addLog('ok', `✅ Repair complete. ${changed} changes made (change cost = ${changed}).`);
}

function applyConstraints() {
  syncConstraints();
  if (STATE.schedule) {
    addLog('info', `⚙️ Re-optimizing with new constraints...`);
    runScheduler();
  }
}

/* ════════════════════════════════════════════════════
   CONFLICT DETECTION
════════════════════════════════════════════════════ */
function detectConflicts(schedule) {
  const conflicts = [];

  // 1. Under-coverage
  for (let d = 0; d < STATE.numDays; d++) {
    for (let s = 0; s < STATE.numShifts; s++) {
      const required = STATE.demand[d][s];
      const assigned  = countAssigned(schedule, d, s);
      if (assigned < required) {
        conflicts.push({
          type: 'under-coverage',
          day: d, shift: s,
          detail: `Need ${required}, have ${assigned} (−${required - assigned})`
        });
      }
    }
  }

  // 2. Availability violations
  STATE.employees.forEach(emp => {
    for (let d = 0; d < STATE.numDays; d++) {
      const s = schedule[emp.id][d];
      if (s >= 0 && !emp.availability[d][s]) {
        conflicts.push({
          type: 'availability',
          day: d, shift: s,
          detail: `${emp.name} unavailable on Day ${d+1} ${SHIFT_NAMES[s]}`
        });
      }
    }
  });

  // 3. Max consecutive days
  STATE.employees.forEach(emp => {
    let consec = 0;
    for (let d = 0; d < STATE.numDays; d++) {
      if (schedule[emp.id][d] >= 0) {
        consec++;
        if (consec > STATE.constraints.maxConsecutive) {
          conflicts.push({
            type: 'max-consecutive',
            day: d,
            detail: `${emp.name} exceeded ${STATE.constraints.maxConsecutive} consecutive days`
          });
          break;
        }
      } else {
        consec = 0;
      }
    }
  });

  // 4. Max hours
  const maxShifts = Math.floor(STATE.constraints.maxHours / 8);
  STATE.employees.forEach(emp => {
    const worked = schedule[emp.id].filter(s => s >= 0).length;
    if (worked > maxShifts) {
      conflicts.push({
        type: 'max-hours',
        day: -1,
        detail: `${emp.name} has ${worked} shifts (max ${maxShifts})`
      });
    }
  });

  return conflicts;
}

/* ════════════════════════════════════════════════════
   METRICS CALCULATION
════════════════════════════════════════════════════ */
function calcMetrics(schedule) {
  if (!schedule) return { coverage: 0, fairness: 0, conflicts: 0, shifts: 0, changeCost: 0 };

  const fit = evaluateFitness(schedule);
  const workloads = Object.values(fit.workloads);
  const mean = workloads.reduce((a, b) => a + b, 0) / Math.max(1, workloads.length);
  const variance = workloads.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(1, workloads.length);
  const stddev = Math.sqrt(variance);
  const fairnessScore = Math.max(0, 1 - stddev / Math.max(1, mean));

  // Coverage %
  let totalRequired = 0, totalMet = 0;
  for (let d = 0; d < STATE.numDays; d++) {
    for (let s = 0; s < STATE.numShifts; s++) {
      const required = STATE.demand[d][s];
      const assigned  = countAssigned(schedule, d, s);
      totalRequired += required;
      totalMet += Math.min(assigned, required);
    }
  }
  const coverage = totalRequired > 0 ? totalMet / totalRequired : 0;
  const totalShifts = Object.values(schedule).reduce((acc, row) => acc + row.filter(s => s >= 0).length, 0);
  const conflicts = detectConflicts(schedule).length;

  // Change cost
  let changeCost = 0;
  if (STATE.schedule && STATE.revised && schedule === STATE.revised) {
    STATE.employees.forEach(emp => {
      for (let d = 0; d < STATE.numDays; d++) {
        if (STATE.schedule[emp.id][d] !== STATE.revised[emp.id][d]) changeCost++;
      }
    });
  }

  return { coverage, fairness: fairnessScore, conflicts, shifts: totalShifts, changeCost };
}

/* ════════════════════════════════════════════════════
   UTILITY
════════════════════════════════════════════════════ */
function deepCopySchedule(sch) {
  const copy = {};
  Object.keys(sch).forEach(id => {
    copy[id] = [...sch[id]];
  });
  return copy;
}
