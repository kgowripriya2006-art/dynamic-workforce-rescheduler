/* ═══════════════════════════════════════════════════════
   DATA.JS — Synthetic Data Generation Engine
   DynaShift AI — ANVATION 2026
═══════════════════════════════════════════════════════ */

const SKILLS = ['Nursing', 'Surgery', 'Admin', 'Security', 'IT', 'Engineering', 'Logistics', 'Quality'];
const SHIFT_NAMES = ['Morning', 'Afternoon', 'Night'];
const SHIFT_HOURS = { Morning: 8, Afternoon: 8, Night: 8 };
const AVATAR_COLORS = [
  '#4f8ef7','#9b59b6','#2ecc71','#f39c12','#e74c3c','#1abc9c',
  '#e67e22','#3498db','#e91e63','#00bcd4','#8bc34a','#ff9800'
];
const FIRST_NAMES = ['Alice','Bob','Carlos','Diana','Ethan','Fiona','George','Hana',
                     'Ivan','Julia','Kevin','Lisa','Marco','Nina','Oscar','Priya',
                     'Quinn','Rosa','Sam','Tara','Uma','Victor','Wendy','Xavier','Yusuf','Zara'];
const LAST_NAMES  = ['Smith','Patel','Kim','Garcia','Brown','Chen','Wilson','Ahmed',
                     'Lee','Johnson','Williams','Davis','Miller','Taylor','Anderson'];

/* Global state */
let STATE = {
  employees: [],
  demand: [],       // [day][shift] = required count
  schedule: null,   // initial schedule
  revised: null,    // schedule after repair
  disruptions: [],  // list of applied disruptions
  constraints: {
    maxHours: 40,
    minRest: 8,
    maxConsecutive: 5,
    requireSkillMatch: true
  },
  fitnessLog: [],   // GA evolution
  numDays: 7,
  numShifts: 3
};

/* ── Generate Synthetic Dataset ── */
function generateData() {
  const n = parseInt(document.getElementById('numEmployees').value);
  const days = parseInt(document.getElementById('numDays').value);
  const shifts = parseInt(document.getElementById('numShifts').value);

  STATE.numDays = days;
  STATE.numShifts = shifts;
  STATE.disruptions = [];
  STATE.schedule = null;
  STATE.revised = null;

  // Generate employees
  STATE.employees = [];
  for (let i = 0; i < n; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName  = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
    const numSkills = 1 + Math.floor(Math.random() * 3);
    const empSkills = shuffleArr([...SKILLS]).slice(0, numSkills);
    
    // Availability: for each day+shift, true/false
    const availability = {};
    for (let d = 0; d < days; d++) {
      availability[d] = {};
      for (let s = 0; s < shifts; s++) {
        // 85% available on any given slot
        availability[d][s] = Math.random() > 0.15;
      }
    }

    STATE.employees.push({
      id: i,
      name: `${firstName} ${lastName[0]}.`,
      fullName: `${firstName} ${lastName}`,
      skills: empSkills,
      availability,
      color: AVATAR_COLORS[i % AVATAR_COLORS.length],
      contractHours: 40,  // weekly max
      seniority: Math.floor(Math.random() * 10) + 1,
      active: true   // becomes false on sick-leave disruption
    });
  }

  // Generate demand matrix
  STATE.demand = [];
  const avgPerShift = Math.max(1, Math.floor(n / shifts / 2));
  for (let d = 0; d < days; d++) {
    STATE.demand[d] = [];
    for (let s = 0; s < shifts; s++) {
      // Weekend lower demand
      const isWeekend = (d % 7 === 5 || d % 7 === 6);
      const base = isWeekend ? Math.max(1, avgPerShift - 1) : avgPerShift;
      // Some random variation ±30%
      const variation = Math.round((Math.random() - 0.3) * base);
      STATE.demand[d][s] = Math.max(1, base + variation);
    }
  }

  // Read constraints from UI
  syncConstraints();

  // Update UI
  renderEmployeeList();
  renderDemandTable();
  populateEmployeeSelector();
  clearScheduleViews();
  clearConflicts();
  clearDisruptionLog();
  clearAiLog();

  addLog('info', `🧬 Generated ${n} employees, ${days} days × ${shifts} shifts.`);
  addLog('info', `📊 Demand matrix ready. Max daily demand: ${maxDemand()}.`);
  updateMetrics();
}

/* ── Populate the judge-facing employee dropdown ── */
function populateEmployeeSelector() {
  const sel = document.getElementById('disruptionEmployee');
  sel.innerHTML = '<option value="random">⚡ Random (Auto)</option>';
  STATE.employees.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = `${emp.name} — ${emp.skills.join(', ')}`;
    sel.appendChild(opt);
  });
}

/* ── Show/hide employee selector based on disruption type ── */
document.getElementById('disruptionType').addEventListener('change', function() {
  const row = document.getElementById('empSelectorRow');
  row.style.display = (this.value === 'absence' || this.value === 'skill_loss') ? 'flex' : 'none';
});

function maxDemand() {
  let m = 0;
  STATE.demand.forEach(row => row.forEach(v => { if (v > m) m = v; }));
  return m;
}

function syncConstraints() {
  STATE.constraints = {
    maxHours:       parseInt(document.getElementById('maxHours').value) || 40,
    minRest:        parseInt(document.getElementById('minRest').value) || 8,
    maxConsecutive: parseInt(document.getElementById('maxConsecutive').value) || 5,
    requireSkillMatch: document.getElementById('requireSkillMatch').checked
  };
}

function shuffleArr(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
