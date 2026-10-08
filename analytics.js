/* ═══════════════════════════════════════════════════════
   ANALYTICS.JS — Chart.js Visualizations
   DynaShift AI — ANVATION 2026
═══════════════════════════════════════════════════════ */

let chartCoverage = null;
let chartWorkload = null;
let chartFitness  = null;
let chartSkills   = null;

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#9aa5be', font: { size: 11 } }
    }
  },
  scales: {
    x: { ticks: { color: '#9aa5be', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
    y: { ticks: { color: '#9aa5be', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
  }
};

function updateCharts() {
  updateCoverageChart();
  updateWorkloadChart();
  updateFitnessChart();
  updateSkillsChart();
}

/* ── Coverage by Day ── */
function updateCoverageChart() {
  const sched = STATE.revised || STATE.schedule;
  if (!sched) return;

  const labels = Array.from({ length: STATE.numDays }, (_, i) => `Day ${i + 1}`);
  const required = labels.map((_, d) =>
    STATE.demand[d].slice(0, STATE.numShifts).reduce((a, b) => a + b, 0)
  );
  const assigned = labels.map((_, d) =>
    STATE.employees.reduce((acc, e) => acc + (sched[e.id][d] >= 0 ? 1 : 0), 0)
  );

  const ctx = document.getElementById('chartCoverage');
  ctx.style.height = '180px';

  if (chartCoverage) chartCoverage.destroy();
  chartCoverage = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Required',
          data: required,
          backgroundColor: 'rgba(231,76,60,0.5)',
          borderColor: '#e74c3c',
          borderWidth: 1,
        },
        {
          label: 'Assigned',
          data: assigned,
          backgroundColor: 'rgba(46,204,113,0.5)',
          borderColor: '#2ecc71',
          borderWidth: 1,
        }
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        title: { display: false }
      }
    }
  });
}

/* ── Workload Distribution ── */
function updateWorkloadChart() {
  const sched = STATE.revised || STATE.schedule;
  if (!sched) return;

  const labels = STATE.employees.map(e => e.name);
  const data   = STATE.employees.map(e =>
    sched[e.id].filter(s => s >= 0).length
  );
  const colors = STATE.employees.map(e => e.color + 'cc');
  const borders = STATE.employees.map(e => e.color);

  const ctx = document.getElementById('chartWorkload');
  ctx.style.height = '180px';

  if (chartWorkload) chartWorkload.destroy();
  chartWorkload = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Shifts',
        data,
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      indexAxis: 'y',
      plugins: {
        legend: { display: false }
      }
    }
  });
}

/* ── GA Fitness Evolution ── */
function updateFitnessChart() {
  if (!STATE.fitnessLog.length) return;

  const labels = STATE.fitnessLog.map((_, i) => i + 1);
  const ctx = document.getElementById('chartFitness');
  ctx.style.height = '180px';

  if (chartFitness) chartFitness.destroy();
  chartFitness = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Fitness (lower=better)',
        data: STATE.fitnessLog,
        borderColor: '#9b59b6',
        backgroundColor: 'rgba(155,89,182,0.15)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        legend: { labels: { color: '#9aa5be', font: { size: 11 } } }
      }
    }
  });
}

/* ── Skill Coverage ── */
function updateSkillsChart() {
  if (!STATE.employees.length) return;

  // Count how many employees have each skill
  const skillCounts = {};
  SKILLS.forEach(sk => { skillCounts[sk] = 0; });
  STATE.employees.forEach(emp => {
    emp.skills.forEach(sk => { skillCounts[sk]++; });
  });

  const labels = Object.keys(skillCounts);
  const data   = Object.values(skillCounts);
  const colors = [
    'rgba(79,142,247,0.7)',   // blue
    'rgba(155,89,182,0.7)',   // purple
    'rgba(46,204,113,0.7)',   // green
    'rgba(243,156,18,0.7)',   // orange
    'rgba(231,76,60,0.7)',    // red
    'rgba(26,188,156,0.7)',   // teal
    'rgba(230,126,34,0.7)',   // orange2
    'rgba(52,152,219,0.7)'    // blue2
  ];

  const ctx = document.getElementById('chartSkills');
  ctx.style.height = '180px';

  if (chartSkills) chartSkills.destroy();
  chartSkills = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('0.7', '1')),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#9aa5be', font: { size: 10 }, boxWidth: 12 }
        }
      }
    }
  });
}

/* ════════════════════════════════════════════════════
   AUTO-DEMO: Run a full demo on page load
════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  // Show a welcome hint in the AI log
  addLog('info', '👋 Welcome to DynaShift AI — ANVATION 2026');
  addLog('info', '1️⃣ Click "Generate Synthetic Data"');
  addLog('info', '2️⃣ Click "Run AI Scheduler"');
  addLog('info', '3️⃣ Click "Inject Disruption" × 2');
  addLog('info', '4️⃣ Click "AI Repair Schedule"');
});
