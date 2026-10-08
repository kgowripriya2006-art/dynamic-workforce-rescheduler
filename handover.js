/* ═══════════════════════════════════════════════════════
   HANDOVER.JS — GitHub Work Handover Feature
   DynaShift AI — ANVATION 2026

   Uses the public GitHub REST API v3 (no auth token).
   Rate limit: 60 requests/hour per IP for unauthenticated
   requests. All fetched data is read-only and displayed
   verbatim — we never invent or assume task progress.
═══════════════════════════════════════════════════════ */

/* ── Module state ── */
const GH = {
  owner:       null,   // parsed from URL
  repo:        null,   // parsed from URL
  username:    null,   // GitHub username of absent employee
  empId:       null,   // DynaShift employee id
  data: {
    openIssues:    [],
    closedIssues:  [],
    pullRequests:  [],
    commits:       [],
    repoInfo:      null
  },
  pendingReplacement: null  // { absentEmpId, replacementEmpId } awaiting approval
};

const GH_API = 'https://api.github.com';

/* ════════════════════════════════════════════════════
   POPULATE EMPLOYEE DROPDOWN
   Called from data.js after generateData()
════════════════════════════════════════════════════ */
function populateHandoverEmployeeSelector() {
  const sel = document.getElementById('ghEmployee');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select absent employee —</option>';
  STATE.employees.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.id;
    const statusIcon = emp.active ? '' : ' 🤒';
    opt.textContent = `${emp.name}${statusIcon} — ${emp.skills.join(', ')}`;
    sel.appendChild(opt);
  });
}

/* ════════════════════════════════════════════════════
   HELPERS — UI state toggles
════════════════════════════════════════════════════ */
function ghShowLoader(msg) {
  document.getElementById('ghLoader').style.display = 'flex';
  document.getElementById('ghLoaderMsg').textContent = msg || 'Fetching from GitHub API…';
  document.getElementById('ghError').style.display   = 'none';
  document.getElementById('ghResults').style.display = 'none';
}

function ghHideLoader() {
  document.getElementById('ghLoader').style.display = 'none';
}

function ghShowError(title, msg) {
  ghHideLoader();
  const errEl = document.getElementById('ghError');
  errEl.style.display = 'flex';
  document.getElementById('ghErrorTitle').textContent = title;
  document.getElementById('ghErrorMsg').textContent   = msg;
  document.getElementById('ghResults').style.display  = 'none';
}

function ghShowResults() {
  ghHideLoader();
  document.getElementById('ghError').style.display   = 'none';
  document.getElementById('ghResults').style.display = 'block';
}

/* ════════════════════════════════════════════════════
   PARSE GITHUB URL
   Accepts:
     https://github.com/owner/repo
     https://github.com/owner/repo.git
     https://github.com/owner/repo/
════════════════════════════════════════════════════ */
function parseGitHubUrl(url) {
  try {
    const cleaned = url.trim().replace(/\.git$/, '').replace(/\/$/, '');
    const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  } catch {
    return null;
  }
}

/* ════════════════════════════════════════════════════
   FETCH WRAPPER — handles rate limits + errors cleanly
════════════════════════════════════════════════════ */
async function ghFetch(endpoint) {
  const url = endpoint.startsWith('http') ? endpoint : `${GH_API}${endpoint}`;
  const resp = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (resp.status === 403) {
    const remaining = resp.headers.get('X-RateLimit-Remaining');
    const reset     = resp.headers.get('X-RateLimit-Reset');
    const resetTime = reset ? new Date(parseInt(reset) * 1000).toLocaleTimeString() : 'soon';
    throw new Error(`GitHub rate limit hit (${remaining || 0} remaining). Resets at ${resetTime}.`);
  }
  if (resp.status === 404) {
    throw new Error('Repository not found. Check the URL and make sure it is public.');
  }
  if (!resp.ok) {
    throw new Error(`GitHub API error: ${resp.status} ${resp.statusText}`);
  }
  return resp.json();
}

/* ════════════════════════════════════════════════════
   PAGINATED FETCH — up to 2 pages (max 60 items)
════════════════════════════════════════════════════ */
async function ghFetchAll(endpoint, perPage = 30, maxPages = 2) {
  let results = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = endpoint.includes('?') ? '&' : '?';
    const data = await ghFetch(`${endpoint}${sep}per_page=${perPage}&page=${page}`);
    if (!Array.isArray(data) || data.length === 0) break;
    results = results.concat(data);
    if (data.length < perPage) break;
  }
  return results;
}

/* ════════════════════════════════════════════════════
   MAIN FETCH ENTRY POINT
   Called by "Fetch Work Information" button
════════════════════════════════════════════════════ */
async function fetchGitHubWork() {
  // ── Validate inputs ──
  const repoUrl  = document.getElementById('ghRepoUrl').value.trim();
  const empIdVal = document.getElementById('ghEmployee').value;
  const username = document.getElementById('ghUsername').value.trim();

  if (!repoUrl) {
    ghShowError('Missing Input', 'Please enter a GitHub repository URL.');
    return;
  }

  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    ghShowError('Invalid URL', 'Could not parse the GitHub URL. Use the format: https://github.com/owner/repo');
    return;
  }

  GH.owner    = parsed.owner;
  GH.repo     = parsed.repo;
  GH.username = username || null;
  GH.empId    = empIdVal ? parseInt(empIdVal) : null;

  // ── Start loading ──
  addLog('info', `🐙 Fetching GitHub data: ${GH.owner}/${GH.repo}…`);
  ghShowLoader(`Connecting to ${GH.owner}/${GH.repo}…`);

  // Reset previous data
  GH.data = { openIssues: [], closedIssues: [], pullRequests: [], commits: [], repoInfo: null };

  try {
    // 1. Repo info (validates the repo exists + gets description)
    ghShowLoader('Verifying repository…');
    GH.data.repoInfo = await ghFetch(`/repos/${GH.owner}/${GH.repo}`);

    // 2. Open issues (issues endpoint includes PRs; filter them out)
    ghShowLoader('Fetching open issues…');
    const rawOpenIssues = await ghFetchAll(`/repos/${GH.owner}/${GH.repo}/issues?state=open&sort=updated`);
    GH.data.openIssues = rawOpenIssues.filter(i => !i.pull_request);

    // 3. Closed issues
    ghShowLoader('Fetching closed issues…');
    const rawClosedIssues = await ghFetchAll(`/repos/${GH.owner}/${GH.repo}/issues?state=closed&sort=updated`);
    GH.data.closedIssues = rawClosedIssues.filter(i => !i.pull_request);

    // 4. Pull requests
    ghShowLoader('Fetching pull requests…');
    GH.data.pullRequests = await ghFetchAll(`/repos/${GH.owner}/${GH.repo}/pulls?state=all&sort=updated`);

    // 5. Recent commits (optionally filtered by author)
    ghShowLoader('Fetching recent commits…');
    let commitEndpoint = `/repos/${GH.owner}/${GH.repo}/commits?per_page=30`;
    if (GH.username) commitEndpoint += `&author=${encodeURIComponent(GH.username)}`;
    try {
      GH.data.commits = await ghFetch(commitEndpoint);
      if (!Array.isArray(GH.data.commits)) GH.data.commits = [];
    } catch {
      // Author filter can return 404 if no commits found — fall back to all
      GH.data.commits = await ghFetch(`/repos/${GH.owner}/${GH.repo}/commits?per_page=30`);
      if (!Array.isArray(GH.data.commits)) GH.data.commits = [];
    }

    // ── Render everything ──
    renderGitHubData();
    updateGhSummaryStats();
    addLog('ok', `✅ GitHub data loaded: ${GH.data.openIssues.length} open issues, ${GH.data.pullRequests.length} PRs, ${GH.data.commits.length} commits.`);

  } catch (err) {
    addLog('error', `❌ GitHub fetch failed: ${err.message}`);
    ghShowError('Fetch Failed', err.message);
  }
}

/* ════════════════════════════════════════════════════
   UPDATE SUMMARY STAT CARDS
════════════════════════════════════════════════════ */
function updateGhSummaryStats() {
  document.getElementById('ghStatIssuesVal').textContent  = GH.data.openIssues.length;
  document.getElementById('ghStatPRsVal').textContent     = GH.data.pullRequests.filter(p => p.state === 'open').length;
  document.getElementById('ghStatCommitsVal').textContent = GH.data.commits.length;
  document.getElementById('ghStatClosedVal').textContent  = GH.data.closedIssues.length;
}

/* ════════════════════════════════════════════════════
   RENDER ALL DATA SECTIONS
════════════════════════════════════════════════════ */
function renderGitHubData() {
  renderIssueList('ghOpenIssueList',   'ghOpenIssueCount',   GH.data.openIssues,   'open');
  renderIssueList('ghClosedIssueList', 'ghClosedIssueCount', GH.data.closedIssues, 'closed');
  renderPRList();
  renderCommitList();

  // Hide report/approvals from previous fetch
  document.getElementById('ghReport').style.display          = 'none';
  document.getElementById('ghReplacements').style.display    = 'none';
  document.getElementById('ghApprovalPanel').style.display   = 'none';

  ghShowResults();
}

/* ── Issue list ── */
function renderIssueList(listId, countId, issues, state) {
  const el = document.getElementById(listId);
  document.getElementById(countId).textContent = issues.length;

  if (!issues.length) {
    el.innerHTML = `<p class="handover-empty">No ${state} issues found.</p>`;
    return;
  }

  el.innerHTML = issues.slice(0, 20).map(issue => {
    const assignees = issue.assignees && issue.assignees.length
      ? issue.assignees.map(a => `<span class="gh-assignee">@${a.login}</span>`).join(' ')
      : '<span class="gh-unassigned">Unassigned</span>';
    const labels = issue.labels && issue.labels.length
      ? issue.labels.map(l => `<span class="gh-label" style="background:#${l.color}22;color:#${l.color};border-color:#${l.color}55">${escHtml(l.name)}</span>`).join('')
      : '';
    const updated = new Date(issue.updated_at).toLocaleDateString();
    const stateIcon = state === 'open' ? '🔴' : '✅';

    return `
      <div class="gh-item">
        <div class="gh-item-top">
          <span class="gh-item-num">#${issue.number}</span>
          <a href="${issue.html_url}" target="_blank" rel="noopener" class="gh-item-title">${escHtml(issue.title)}</a>
          ${stateIcon}
        </div>
        <div class="gh-item-meta">
          ${assignees}
          ${labels}
          <span class="gh-item-date">Updated ${updated}</span>
        </div>
      </div>
    `;
  }).join('');

  if (issues.length > 20) {
    el.innerHTML += `<p class="handover-more">…and ${issues.length - 20} more. <a href="https://github.com/${GH.owner}/${GH.repo}/issues" target="_blank" rel="noopener">View all on GitHub</a></p>`;
  }
}

/* ── Pull requests ── */
function renderPRList() {
  const el = document.getElementById('ghPRList');
  const prs = GH.data.pullRequests;
  document.getElementById('ghPRCount').textContent = prs.length;

  if (!prs.length) {
    el.innerHTML = `<p class="handover-empty">No pull requests found.</p>`;
    return;
  }

  el.innerHTML = prs.slice(0, 20).map(pr => {
    const stateClass = pr.state === 'open' ? 'gh-pr-open' : pr.merged_at ? 'gh-pr-merged' : 'gh-pr-closed';
    const stateLabel = pr.merged_at ? '🟣 Merged' : pr.state === 'open' ? '🟢 Open' : '🔴 Closed';
    const updated    = new Date(pr.updated_at).toLocaleDateString();
    const author     = pr.user ? `@${pr.user.login}` : 'unknown';

    return `
      <div class="gh-item">
        <div class="gh-item-top">
          <span class="gh-item-num">#${pr.number}</span>
          <a href="${pr.html_url}" target="_blank" rel="noopener" class="gh-item-title">${escHtml(pr.title)}</a>
          <span class="gh-state-badge ${stateClass}">${stateLabel}</span>
        </div>
        <div class="gh-item-meta">
          <span class="gh-assignee">${escHtml(author)}</span>
          <span class="gh-item-date">Updated ${updated}</span>
          ${pr.draft ? '<span class="gh-draft-badge">Draft</span>' : ''}
        </div>
      </div>
    `;
  }).join('');

  if (prs.length > 20) {
    el.innerHTML += `<p class="handover-more">…and ${prs.length - 20} more. <a href="https://github.com/${GH.owner}/${GH.repo}/pulls" target="_blank" rel="noopener">View all on GitHub</a></p>`;
  }
}

/* ── Commits ── */
function renderCommitList() {
  const el = document.getElementById('ghCommitList');
  const commits = GH.data.commits;
  document.getElementById('ghCommitCount').textContent = commits.length;

  if (!commits.length) {
    el.innerHTML = `<p class="handover-empty">No recent commits found.</p>`;
    return;
  }

  el.innerHTML = commits.slice(0, 20).map(c => {
    const msg     = c.commit.message.split('\n')[0]; // first line only
    const author  = c.commit.author ? c.commit.author.name : 'Unknown';
    const date    = c.commit.author ? new Date(c.commit.author.date).toLocaleDateString() : '';
    const sha     = c.sha ? c.sha.substring(0, 7) : '';
    const url     = c.html_url || `https://github.com/${GH.owner}/${GH.repo}/commit/${c.sha}`;

    return `
      <div class="gh-item">
        <div class="gh-item-top">
          <span class="gh-item-num gh-sha">
            <a href="${url}" target="_blank" rel="noopener" style="color:var(--teal);text-decoration:none">${sha}</a>
          </span>
          <span class="gh-item-title" style="text-decoration:none;color:var(--text)">${escHtml(msg)}</span>
        </div>
        <div class="gh-item-meta">
          <span class="gh-assignee">${escHtml(author)}</span>
          <span class="gh-item-date">${date}</span>
        </div>
      </div>
    `;
  }).join('');

  if (commits.length > 20) {
    el.innerHTML += `<p class="handover-more">Showing 20 of ${commits.length} commits. <a href="https://github.com/${GH.owner}/${GH.repo}/commits" target="_blank" rel="noopener">View all on GitHub</a></p>`;
  }
}

/* ════════════════════════════════════════════════════
   GENERATE HANDOVER REPORT
   Organises verified data + clearly labels inferences
════════════════════════════════════════════════════ */
function generateHandoverReport() {
  const reportEl = document.getElementById('ghReport');

  if (!GH.data.repoInfo) {
    reportEl.innerHTML = `<p style="color:var(--text-dim)">Fetch data first before generating a report.</p>`;
    reportEl.style.display = 'block';
    return;
  }

  const emp = GH.empId !== null ? STATE.employees.find(e => e.id === GH.empId) : null;
  const empName    = emp ? emp.name : (GH.username || 'Unknown Employee');
  const empSkills  = emp ? emp.skills.join(', ') : 'Not available';
  const ghUser     = GH.username ? `@${GH.username}` : '(GitHub username not provided)';
  const now        = new Date().toLocaleString();
  const repoDesc   = GH.data.repoInfo.description || 'No description provided.';

  // Open issues — potentially unfinished (INFERRED, not guaranteed)
  const openAssigned = GH.data.openIssues.filter(i =>
    i.assignees && i.assignees.some(a => GH.username && a.login.toLowerCase() === GH.username.toLowerCase())
  );
  const openUnassigned = GH.data.openIssues.filter(i => !i.assignees || !i.assignees.length);
  const openAll        = GH.data.openIssues;

  // Open PRs
  const openPRs = GH.data.pullRequests.filter(p => p.state === 'open');
  const myOpenPRs = openPRs.filter(p =>
    GH.username && p.user && p.user.login.toLowerCase() === GH.username.toLowerCase()
  );

  // Recent commits
  const recentCommits = GH.data.commits.slice(0, 5);

  const issueRows = (list) => list.length
    ? list.map(i => `  • #${i.number} ${i.title} — ${i.html_url}`).join('\n')
    : '  None found.';

  const prRows = (list) => list.length
    ? list.map(p => `  • #${p.number} ${p.title} [${p.state}] — ${p.html_url}`).join('\n')
    : '  None found.';

  const commitRows = recentCommits.length
    ? recentCommits.map(c => `  • ${c.sha.substring(0,7)} ${c.commit.message.split('\n')[0]} (${c.commit.author ? c.commit.author.name : 'unknown'}, ${c.commit.author ? new Date(c.commit.author.date).toLocaleDateString() : ''})`).join('\n')
    : '  No recent commits found.';

  const report = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  WORK HANDOVER REPORT
  Generated: ${now}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ABSENT EMPLOYEE
  Name:         ${empName}
  GitHub:       ${ghUser}
  Skills:       ${empSkills}
  Status:       ${emp && !emp.active ? '🤒 Currently absent' : 'Active / Not marked absent in DynaShift'}

REPOSITORY
  Name:         ${GH.owner}/${GH.repo}
  Description:  ${repoDesc}
  URL:          https://github.com/${GH.owner}/${GH.repo}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ SECTION 1 — VERIFIED: ASSIGNED OPEN ISSUES
  These issues are directly assigned to ${ghUser}.
  They are CONFIRMED tasks associated with this employee.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${issueRows(openAssigned)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ SECTION 2 — VERIFIED: OPEN PULL REQUESTS by ${ghUser}
  These PRs were opened by this employee and are still open.
  They may require review or continuation.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${prRows(myOpenPRs)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ SECTION 3 — VERIFIED: RECENT CODE CHANGES
  Last ${recentCommits.length} commits${GH.username ? ` attributed to ${ghUser}` : ' in repository'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${commitRows}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ SECTION 4 — INFERRED: POTENTIALLY UNFINISHED WORK
  ⚠ The following are ALL open issues in the repo.
  They are NOT confirmed to belong to this employee
  unless assigned. Verify before reassigning.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total open issues: ${openAll.length}
  Unassigned issues: ${openUnassigned.length}

${openAll.length ? openAll.slice(0, 10).map(i => `  • #${i.number} ${i.title} [${
    i.assignees && i.assignees.length
      ? 'assigned: ' + i.assignees.map(a => '@' + a.login).join(', ')
      : '⚠ unassigned'
  }]`).join('\n') : '  No open issues.'}
${openAll.length > 10 ? `\n  …and ${openAll.length - 10} more open issues.` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ SECTION 5 — RECOMMENDED NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. Reassign confirmed open issues (Section 1) to
     an available team member with matching skills.
  2. Review open PRs (Section 2) — they may need
     code review or merge conflict resolution.
  3. Check recent commits (Section 3) for work-in-
     progress branches not yet in a PR.
  4. Contact the employee or their team lead to
     clarify unassigned issues (Section 4).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ SECTION 6 — MISSING INFORMATION
  The following could NOT be determined from GitHub:
  • Tasks tracked outside of GitHub (Jira, Trello, etc.)
  • Work-in-progress on local branches not pushed
  • Verbal commitments or undocumented responsibilities
  • Code review obligations not reflected in PR status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ℹ All data sourced from the public GitHub REST API.
    This report distinguishes verified facts from
    inferences. Treat Section 4 as a starting point,
    not a confirmed task list.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();

  reportEl.innerHTML = `<pre class="handover-report-pre">${escHtml(report)}</pre>
    <div style="margin-top:12px">
      <button class="btn btn-teal" style="width:auto;padding:6px 16px;font-size:0.78rem"
        onclick="copyReportToClipboard()">📋 Copy to Clipboard</button>
    </div>`;
  reportEl.style.display = 'block';
  addLog('ok', `📄 Handover report generated for ${empName}.`);
}

/* Copy report text */
function copyReportToClipboard() {
  const pre = document.querySelector('.handover-report-pre');
  if (!pre) return;
  navigator.clipboard.writeText(pre.textContent).then(() => {
    addLog('ok', '📋 Handover report copied to clipboard.');
  }).catch(() => {
    addLog('warn', '⚠️ Clipboard copy failed — please select and copy manually.');
  });
}

/* ════════════════════════════════════════════════════
   GENERATE REPLACEMENT RECOMMENDATIONS
   Uses existing DynaShift employee data, skills,
   availability, and workload from STATE
════════════════════════════════════════════════════ */
function generateReplacementRecommendations() {
  const replacementsEl = document.getElementById('ghReplacements');
  const approvalEl     = document.getElementById('ghApprovalPanel');

  if (!GH.empId && GH.empId !== 0) {
    replacementsEl.innerHTML = `<div class="handover-reco-notice">
      Select an absent employee in the setup panel above to generate replacement recommendations.
    </div>`;
    replacementsEl.style.display = 'block';
    return;
  }

  if (!STATE.employees.length) {
    replacementsEl.innerHTML = `<div class="handover-reco-notice">
      Generate workforce data in DynaShift first (click "🧬 Generate Synthetic Data").
    </div>`;
    replacementsEl.style.display = 'block';
    return;
  }

  const absentEmp = STATE.employees.find(e => e.id === GH.empId);
  if (!absentEmp) {
    replacementsEl.innerHTML = `<div class="handover-reco-notice">Employee not found in current DynaShift data.</div>`;
    replacementsEl.style.display = 'block';
    return;
  }

  // Score each active employee as a potential replacement
  const candidates = STATE.employees
    .filter(e => e.active && e.id !== absentEmp.id)
    .map(e => {
      // Skill overlap
      const skillOverlap = absentEmp.skills.filter(sk => e.skills.includes(sk)).length;
      const skillScore   = absentEmp.skills.length > 0
        ? skillOverlap / absentEmp.skills.length
        : 0;

      // Workload — lower is better
      const currentShifts = STATE.schedule
        ? Object.values(STATE.schedule[e.id] || []).filter(s => s >= 0).length
        : 0;
      const maxShifts  = Math.floor(STATE.constraints.maxHours / 8);
      const loadScore  = maxShifts > 0 ? 1 - (currentShifts / maxShifts) : 0;

      // Availability overlap — count days absent emp had shifts
      const absentDays = STATE.schedule
        ? Object.entries(STATE.schedule[absentEmp.id] || {})
            .filter(([, s]) => s >= 0)
            .map(([d]) => parseInt(d))
        : [];
      const availableOnAbsentDays = absentDays.length > 0
        ? absentDays.filter(d => {
            const shift = STATE.schedule ? STATE.schedule[absentEmp.id][d] : -1;
            return shift >= 0 && e.availability[d] && e.availability[d][shift];
          }).length / absentDays.length
        : 0;

      const totalScore = (skillScore * 0.5) + (loadScore * 0.3) + (availableOnAbsentDays * 0.2);

      return { emp: e, skillScore, loadScore, availableOnAbsentDays, totalScore, currentShifts };
    })
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5);

  if (!candidates.length) {
    replacementsEl.innerHTML = `<div class="handover-reco-notice">No active replacement candidates found.</div>`;
    replacementsEl.style.display = 'block';
    return;
  }

  const rows = candidates.map((c, idx) => {
    const skillMatch = absentEmp.skills.filter(sk => c.emp.skills.includes(sk));
    const skillMiss  = absentEmp.skills.filter(sk => !c.emp.skills.includes(sk));
    const scoreBar   = Math.round(c.totalScore * 100);
    const rank       = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][idx];

    return `
      <div class="gh-reco-card${idx === 0 ? ' gh-reco-top' : ''}">
        <div class="gh-reco-header">
          <div class="emp-avatar" style="background:${c.emp.color};font-size:0.75rem;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">${c.emp.name.charAt(0)}</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:0.88rem">${rank} ${c.emp.name}</div>
            <div style="font-size:0.72rem;color:var(--text-dim)">Seniority: S${c.emp.seniority} &nbsp;|&nbsp; Current shifts: ${c.currentShifts}</div>
          </div>
          <div class="gh-reco-score">${scoreBar}%</div>
        </div>
        <div class="gh-reco-bar"><div class="gh-reco-bar-fill" style="width:${scoreBar}%"></div></div>
        <div class="gh-reco-skills">
          ${skillMatch.map(sk => `<span class="skill-tag" style="background:rgba(46,204,113,0.15);color:#2ecc71;border:1px solid rgba(46,204,113,0.3)">${sk}</span>`).join('')}
          ${skillMiss.map(sk => `<span class="skill-tag" style="background:rgba(231,76,60,0.1);color:#e74c3c;border:1px solid rgba(231,76,60,0.2)">${sk} ✗</span>`).join('')}
        </div>
        ${idx === 0 ? `
        <button class="btn btn-orange" style="margin-top:8px;width:auto;padding:6px 16px;font-size:0.78rem"
          onclick="proposeReplacement(${absentEmp.id}, ${c.emp.id})">
          ➕ Propose as Replacement
        </button>` : ''}
      </div>
    `;
  }).join('');

  replacementsEl.innerHTML = `
    <div class="gh-reco-section">
      <h4 style="font-size:0.9rem;font-weight:700;margin-bottom:12px">
        👥 Top Replacement Candidates for ${absentEmp.name}
      </h4>
      <p style="font-size:0.78rem;color:var(--text-dim);margin-bottom:12px">
        Scored on: skill overlap (50%) + available capacity (30%) + day availability (20%).<br/>
        Green tags = matched skills. Red tags = skills the absent employee had that this person lacks.
      </p>
      ${rows}
    </div>`;
  replacementsEl.style.display = 'block';
  approvalEl.style.display = 'none';

  addLog('ok', `👥 Replacement recommendations generated for ${absentEmp.name}.`);
}

/* ════════════════════════════════════════════════════
   PROPOSE → APPROVE / REJECT FLOW
════════════════════════════════════════════════════ */
function proposeReplacement(absentEmpId, replacementEmpId) {
  GH.pendingReplacement = { absentEmpId, replacementEmpId };

  const absent      = STATE.employees.find(e => e.id === absentEmpId);
  const replacement = STATE.employees.find(e => e.id === replacementEmpId);
  if (!absent || !replacement) return;

  const approvalEl  = document.getElementById('ghApprovalPanel');
  const detailsEl   = document.getElementById('ghApprovalDetails');

  // Work out which days/shifts are affected
  const affectedShifts = STATE.schedule
    ? Object.entries(STATE.schedule[absentEmpId] || {})
        .filter(([, s]) => s >= 0)
        .map(([d, s]) => `Day ${parseInt(d) + 1} — ${SHIFT_NAMES[s] || 'Shift ' + s}`)
    : [];

  detailsEl.innerHTML = `
    <div class="gh-approval-details-box">
      <div class="gh-approval-row">
        <span class="gh-approval-label">Absent</span>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="emp-avatar" style="background:${absent.color};width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700">${absent.name.charAt(0)}</div>
          <span style="font-weight:600">${absent.name}</span>
          <span style="font-size:0.72rem;color:var(--text-dim)">${absent.skills.join(', ')}</span>
        </div>
      </div>
      <div style="text-align:center;font-size:1.2rem;padding:4px 0">↓</div>
      <div class="gh-approval-row">
        <span class="gh-approval-label">Proposed Replacement</span>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="emp-avatar" style="background:${replacement.color};width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700">${replacement.name.charAt(0)}</div>
          <span style="font-weight:600">${replacement.name}</span>
          <span style="font-size:0.72rem;color:var(--text-dim)">${replacement.skills.join(', ')}</span>
        </div>
      </div>
      ${affectedShifts.length ? `
      <div class="gh-approval-row" style="margin-top:8px">
        <span class="gh-approval-label">Shifts to Transfer</span>
        <div style="font-size:0.78rem;color:var(--text-dim)">${affectedShifts.join(' · ') || 'None scheduled'}</div>
      </div>` : ''}
    </div>`;

  approvalEl.style.display = 'block';
  approvalEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function approveReassignment() {
  if (!GH.pendingReplacement) return;
  const { absentEmpId, replacementEmpId } = GH.pendingReplacement;

  if (!STATE.schedule) {
    addLog('warn', '⚠️ No schedule to update. Run the AI Scheduler first.');
    return;
  }

  const absent      = STATE.employees.find(e => e.id === absentEmpId);
  const replacement = STATE.employees.find(e => e.id === replacementEmpId);
  if (!absent || !replacement) return;

  // Clone the schedule and transfer shifts
  const newSchedule = deepCopySchedule(STATE.schedule);
  let transferredCount = 0;

  for (let d = 0; d < STATE.numDays; d++) {
    const shiftIdx = newSchedule[absentEmpId][d];
    if (shiftIdx >= 0 && replacement.availability[d] && replacement.availability[d][shiftIdx]) {
      newSchedule[replacementEmpId][d] = shiftIdx;
      newSchedule[absentEmpId][d]      = -1;
      transferredCount++;
    }
  }

  // Apply as the revised schedule
  STATE.revised = newSchedule;
  renderSchedule('revised', newSchedule);
  detectAndShowConflicts(newSchedule, 'revised');
  renderComparison(STATE.schedule, newSchedule);
  updateMetrics();
  updateCharts();

  document.getElementById('ghApprovalPanel').style.display = 'none';
  GH.pendingReplacement = null;

  addLog('ok', `✅ Approved: ${transferredCount} shifts transferred from ${absent.name} to ${replacement.name}.`);
  addLog('info', `💡 Switch to "🔄 Revised Schedule" or "📊 Comparison" tabs to review.`);

  // Offer to switch tabs
  const confirm = window.confirm(
    `✅ ${transferredCount} shifts transferred to ${replacement.name}.\n\nSwitch to the Comparison tab now?`
  );
  if (confirm) {
    switchTab('comparison', document.querySelectorAll('.tab')[2]);
  }
}

function rejectReassignment() {
  GH.pendingReplacement = null;
  document.getElementById('ghApprovalPanel').style.display = 'none';
  addLog('info', '❌ Replacement proposal rejected. Schedule unchanged.');
}

/* ════════════════════════════════════════════════════
   UTILITY
════════════════════════════════════════════════════ */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Called from data.js → generateData() */
function onDataGenerated() {
  populateHandoverEmployeeSelector();
}
