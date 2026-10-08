/* ═══════════════════════════════════════════════════════
   UI.JS — Rendering & Interaction
   DynaShift AI — ANVATION 2026
═══════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════
   TAB NAVIGATION
════════════════════════════════════════════════════ */
function switchTab(name, el) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  if (el) el.classList.add('active');
}

/* ════════════════════════════════════════════════════
   SCHEDULE RENDERER
════════════════════════════════════════════════════ */
function renderSchedule(type, schedule, conflicts) {
  const wrapId = type === 'initial' ? 'initialScheduleWrap' : 'revisedScheduleWrap';
  const wrap = document.getElementById(wrapId);

  // Build day headers
  const dayHeaders = ['<th>Employee</th>'];
  for (let d = 0; d < STATE.numDays; d++) {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const isWeekend = (d % 7 === 5 || d % 7 === 6);
    dayHeaders.push(
      `<th style="${isWeekend ? 'color:#f39c12' : ''}">
        Day ${d + 1}<br/><span style="font-size:0.68rem;opacity:0.7">${dayNames[d % 7]}</span>
      </th>`
    );
  }

  // Build rows
  const conflictSet = new Set(
    (conflicts || []).filter(c => c.type === 'availability').map(c => `${c.day}-${c.shift}`)
  );

  const rows = STATE.employees.map(emp => {
    const cells = [`<td>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="emp-avatar" style="background:${emp.color};font-size:0.7rem">
          ${emp.name.charAt(0)}
        </div>
        <div>
          <div style="font-size:0.8rem;font-weight:600;${!emp.active ? 'text-decoration:line-through;opacity:0.5' : ''}">${emp.name}</div>
          <div style="font-size:0.65rem;color:#888">${emp.skills[0]}</div>
        </div>
        ${!emp.active ? '<span title="Absent" style="font-size:0.8rem">🤒</span>' : ''}
      </div>
    </td>`];

    for (let d = 0; d < STATE.numDays; d++) {
      const s = schedule[emp.id][d];
      const isConflict = (s >= 0) && (!emp.active || !emp.availability[d][s]);
      cells.push(shiftCell(s, isConflict));
    }
    return `<tr>${cells.join('')}</tr>`;
  }).join('');

  // Demand row
  const demandCells = ['<td style="color:#888;font-size:0.72rem;padding-left:12px">📊 Required</td>'];
  for (let d = 0; d < STATE.numDays; d++) {
    const total = STATE.demand[d].slice(0, STATE.numShifts).reduce((a, b) => a + b, 0);
    const assigned = STATE.employees.reduce((acc, e) => acc + (schedule[e.id][d] >= 0 ? 1 : 0), 0);
    const ok = assigned >= total;
    demandCells.push(
      `<td style="color:${ok ? '#2ecc71' : '#e74c3c'};font-weight:700;font-size:0.78rem">
        ${assigned}/${total}
      </td>`
    );
  }

  wrap.innerHTML = `
    <table class="sched-table anim-in">
      <thead><tr>${dayHeaders.join('')}</tr></thead>
      <tbody>
        ${rows}
        <tr style="border-top:2px solid rgba(255,255,255,0.1)">${demandCells.join('')}</tr>
      </tbody>
    </table>
  `;
}

function shiftCell(s, isConflict) {
  if (s === -1) return `<td class="cell-off">—</td>`;
  const names = SHIFT_NAMES.slice(0, STATE.numShifts);
  const icons = ['🌅', '☀️', '🌙'];
  const cls = ['cell-morning', 'cell-afternoon', 'cell-night'];
  const conflictClass = isConflict ? ' cell-conflict' : '';
  return `<td class="${cls[s] || ''}${conflictClass}">${icons[s] || ''}${names[s] || s}</td>`;
}

/* ════════════════════════════════════════════════════
   COMPARISON VIEW
════════════════════════════════════════════════════ */
function renderComparison(initial, revised) {
  if (!initial || !revised) return;

  const m1 = calcMetrics(initial);
  const m2 = calcMetrics(revised);

  // Change cost
  let changes = 0;
  STATE.employees.forEach(emp => {
    for (let d = 0; d < STATE.numDays; d++) {
      if (initial[emp.id][d] !== revised[emp.id][d]) changes++;
    }
  });

  const metricsHTML = `
    <div class="cmp-metric">
      <div class="cmp-metric-label">Coverage</div>
      <span class="cmp-old">${(m1.coverage * 100).toFixed(0)}%</span>
      <span class="cmp-arrow">→</span>
      <span class="cmp-new">${(m2.coverage * 100).toFixed(0)}%</span>
    </div>
    <div class="cmp-metric">
      <div class="cmp-metric-label">Fairness</div>
      <span class="cmp-old">${m1.fairness.toFixed(2)}</span>
      <span class="cmp-arrow">→</span>
      <span class="cmp-new">${m2.fairness.toFixed(2)}</span>
    </div>
    <div class="cmp-metric">
      <div class="cmp-metric-label">Conflicts</div>
      <span class="cmp-old">${m1.conflicts}</span>
      <span class="cmp-arrow">→</span>
      <span class="cmp-new">${m2.conflicts}</span>
    </div>
    <div class="cmp-metric">
      <div class="cmp-metric-label">Change Cost</div>
      <span style="font-size:1.3rem;font-weight:800;color:#9b59b6">${changes}</span>
    </div>
    <div class="cmp-metric">
      <div class="cmp-metric-label">Shifts Assigned</div>
      <span class="cmp-old">${m1.shifts}</span>
      <span class="cmp-arrow">→</span>
      <span class="cmp-new">${m2.shifts}</span>
    </div>
  `;
  document.getElementById('comparisonMetrics').innerHTML = metricsHTML;

  // Diff table
  const wrap = document.getElementById('comparisonWrap');
  const dayHeaders = ['<th>Employee</th>'];
  for (let d = 0; d < STATE.numDays; d++) {
    dayHeaders.push(`<th>Day ${d + 1}</th>`);
  }

  const rows = STATE.employees.map(emp => {
    const cells = [`<td>
      <div style="display:flex;align-items:center;gap:6px">
        <div class="emp-avatar" style="background:${emp.color};font-size:0.7rem">${emp.name.charAt(0)}</div>
        <span style="font-size:0.8rem">${emp.name}</span>
      </div>
    </td>`];
    for (let d = 0; d < STATE.numDays; d++) {
      const s1 = initial[emp.id][d];
      const s2 = revised[emp.id][d];
      const changed = s1 !== s2;
      if (changed) {
        const from = s1 === -1 ? 'Off' : SHIFT_NAMES[s1];
        const to   = s2 === -1 ? 'Off' : SHIFT_NAMES[s2];
        cells.push(`
          <td class="cell-changed" title="Changed: ${from} → ${to}">
            <div style="color:#aaa;font-size:0.65rem;text-decoration:line-through">${from}</div>
            <div style="color:#1abc9c;font-size:0.75rem;font-weight:700">${to}</div>
          </td>
        `);
      } else {
        cells.push(shiftCell(s2, false));
      }
    }
    return `<tr>${cells.join('')}</tr>`;
  }).join('');

  wrap.innerHTML = `
    <div style="margin-top:12px">
      <p style="font-size:0.78rem;color:#1abc9c;margin-bottom:8px">
        🔄 <strong>${changes}</strong> changes highlighted in teal
      </p>
      <table class="sched-table anim-in">
        <thead><tr>${dayHeaders.join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* ════════════════════════════════════════════════════
   EMPLOYEE LIST
════════════════════════════════════════════════════ */
function renderEmployeeList() {
  const el = document.getElementById('employeeList');
  if (!STATE.employees.length) return;

  el.innerHTML = STATE.employees.map(emp => `
    <div class="emp-item">
      <div class="emp-avatar" style="background:${emp.color}">
        ${emp.name.charAt(0)}
      </div>
      <div style="flex:1;min-width:0">
        <div class="emp-name" style="${!emp.active ? 'opacity:0.4;text-decoration:line-through' : ''}">
          ${emp.name}
          ${!emp.active ? ' 🤒' : ''}
        </div>
        <div class="emp-skills">
          ${emp.skills.map((sk, i) => {
            const skColors = ['#4f8ef7','#9b59b6','#2ecc71','#f39c12','#e74c3c','#1abc9c','#e67e22','#3498db'];
            return `<span class="skill-tag" style="background:${skColors[SKILLS.indexOf(sk) % skColors.length]}22;color:${skColors[SKILLS.indexOf(sk) % skColors.length]};border:1px solid ${skColors[SKILLS.indexOf(sk) % skColors.length]}44">${sk}</span>`;
          }).join('')}
        </div>
      </div>
      <div style="font-size:0.7rem;color:#888">S${emp.seniority}</div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════
   DEMAND TABLE
════════════════════════════════════════════════════ */
function renderDemandTable() {
  const el = document.getElementById('demandTable');
  if (!STATE.demand.length) return;

  const shiftNames = SHIFT_NAMES.slice(0, STATE.numShifts);
  const headers = `<tr><th>Day</th>${shiftNames.map(n => `<th>${n}</th>`).join('')}<th>Total</th></tr>`;
  const rows = STATE.demand.map((row, d) => {
    const total = row.slice(0, STATE.numShifts).reduce((a, b) => a + b, 0);
    const cells = row.slice(0, STATE.numShifts).map(v => {
      const cls = v >= 4 ? 'demand-high' : v >= 2 ? 'demand-med' : 'demand-low';
      return `<td class="${cls}">${v}</td>`;
    }).join('');
    const isWeekend = (d % 7 === 5 || d % 7 === 6);
    return `<tr style="${isWeekend ? 'opacity:0.7' : ''}"><td>D${d+1}</td>${cells}<td style="font-weight:700">${total}</td></tr>`;
  }).join('');

  el.innerHTML = `<table class="demand-table"><thead>${headers}</thead><tbody>${rows}</tbody></table>`;
}

/* ════════════════════════════════════════════════════
   CONFLICTS
════════════════════════════════════════════════════ */
function detectAndShowConflicts(schedule, source) {
  const conflicts = detectConflicts(schedule);
  const el = document.getElementById('conflictList');

  if (!conflicts.length) {
    el.innerHTML = `<p style="color:#2ecc71;text-align:center;font-size:0.82rem">✅ No conflicts found</p>`;
  } else {
    const icons = {
      'under-coverage': '📉',
      'availability': '⛔',
      'max-consecutive': '🔁',
      'max-hours': '⏰'
    };
    el.innerHTML = conflicts.map(c => `
      <div class="conflict-item">
        <div class="conflict-icon">${icons[c.type] || '⚠️'}</div>
        <div class="conflict-text">
          <strong>${c.type.replace('-', ' ').toUpperCase()}</strong>
          <div class="cf-detail">${c.detail}</div>
        </div>
      </div>
    `).join('');
  }
  document.getElementById('mConflicts').textContent = conflicts.length;
  return conflicts;
}

function clearConflicts() {
  document.getElementById('conflictList').innerHTML =
    `<p style="color:#888;text-align:center">No conflicts found.</p>`;
}

/* ════════════════════════════════════════════════════
   METRICS
════════════════════════════════════════════════════ */
function updateMetrics() {
  const sched = STATE.revised || STATE.schedule;
  const m = sched ? calcMetrics(sched) : { coverage: 0, fairness: 0, conflicts: 0, shifts: 0, changeCost: 0 };

  document.getElementById('mEmployees').textContent = STATE.employees.length;
  document.getElementById('mShifts').textContent = m.shifts;
  document.getElementById('mCoverage').textContent = (m.coverage * 100).toFixed(0) + '%';
  document.getElementById('mFairness').textContent = m.fairness.toFixed(2);
  document.getElementById('mConflicts').textContent = detectConflicts(sched || {}).length || 0;

  // Change cost
  if (STATE.schedule && STATE.revised) {
    let changes = 0;
    STATE.employees.forEach(emp => {
      for (let d = 0; d < STATE.numDays; d++) {
        if (STATE.schedule[emp.id][d] !== STATE.revised[emp.id][d]) changes++;
      }
    });
    document.getElementById('mChangeCost').textContent = changes;
  } else {
    document.getElementById('mChangeCost').textContent = 0;
  }
}

/* ════════════════════════════════════════════════════
   DISRUPTION LOG
════════════════════════════════════════════════════ */
function addDisruptionBadge(d) {
  const log = document.getElementById('disruptionLog');
  const icons = { absence: '👤', surge: '📈', skill_loss: '🩹', equipment: '🔧' };
  const existing = log.querySelector('p');
  if (existing) existing.remove();
  log.innerHTML += `
    <span class="disruption-badge anim-in">
      ${icons[d.type] || '⚠️'} ${d.description}
    </span>`;
}
function clearDisruptionLog() {
  document.getElementById('disruptionLog').innerHTML = `<p style="color:#888">No disruptions yet.</p>`;
}

/* ════════════════════════════════════════════════════
   AI LOG
════════════════════════════════════════════════════ */
function addLog(level, msg) {
  const log = document.getElementById('aiLog');
  const p = log.querySelector('p');
  if (p) p.remove();
  const entry = document.createElement('div');
  entry.className = `log-entry log-${level} anim-in`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  log.prepend(entry);
  // Keep max 20 entries
  while (log.children.length > 20) log.lastChild.remove();
}
function clearAiLog() {
  document.getElementById('aiLog').innerHTML = `<p style="color:#888">Waiting for AI activity...</p>`;
}

/* ════════════════════════════════════════════════════
   CLEAR HELPERS
════════════════════════════════════════════════════ */
function clearScheduleViews() {
  document.getElementById('initialScheduleWrap').innerHTML = `
    <div class="empty-state"><div class="empty-icon">🤖</div>
    <p>Generate data and run the AI Scheduler to see your schedule.</p></div>`;
  document.getElementById('revisedScheduleWrap').innerHTML = `
    <div class="empty-state"><div class="empty-icon">🔥</div>
    <p>Inject a disruption and run AI Repair to see the revised schedule.</p></div>`;
  document.getElementById('comparisonWrap').innerHTML = '';
  document.getElementById('comparisonMetrics').innerHTML = `<p style="color:#888">Run both schedules first.</p>`;
}

/* ════════════════════════════════════════════════════
   RANGE SLIDERS
════════════════════════════════════════════════════ */
document.getElementById('fairnessWeight').addEventListener('input', e => {
  document.getElementById('fairnessWeightVal').textContent = e.target.value;
});
document.getElementById('coverageWeight').addEventListener('input', e => {
  document.getElementById('coverageWeightVal').textContent = e.target.value;
});
