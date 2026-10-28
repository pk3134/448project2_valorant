// HUD reaction test: shows a normal HUD frame, swaps to a warning frame after a
// random delay, times how long the tester takes to press Space, then asks what
// they noticed. Results are kept in this browser (localStorage) and export as CSV.
(() => {
  'use strict';

  const CFG = window.HUD_TEST;
  const STORE_KEY = 'hudReactionResults';
  const VERSIONS = [
    { id: 'before', label: 'Current HUD' },
    { id: 'after', label: 'Redesign' },
  ];

  const $ = id => document.getElementById(id);
  const screens = ['setup', 'trial', 'question', 'next', 'results', 'final'];
  function show(name) {
    for (const s of screens) $(s).hidden = s !== name;
  }

  // ---------- storage ----------
  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
  }
  function saveAll(sessions) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(sessions)); return true; } catch { return false; }
  }
  function saveSession(session) {
    const all = loadAll().filter(s => s.id !== session.id);
    all.push(session);
    return saveAll(all);
  }

  // ---------- setup ----------

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function preload(srcs) {
    return Promise.all(srcs.map(src => new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(null);
      img.onerror = () => resolve(src);
      img.src = src;
    }))).then(r => r.filter(Boolean));
  }

  let run = null; // the test in progress

  async function begin(practice) {
    const problems = CFG.problems;
    const picked = document.querySelector('input[name="order"]:checked');
    if (!practice && !picked) { $('setup-msg').textContent = 'Pick version A or B first.'; return; }
    const order = picked ? picked.value : 'A';

    const srcs = problems.flatMap(p => VERSIONS.flatMap(v => [p[v.id].normal, p[v.id].mid, p[v.id].warning].filter(Boolean)));
    $('setup-msg').textContent = 'Loading frames…';
    const missing = await preload(srcs);
    if (missing.length) {
      $('setup-msg').textContent = `These frame files couldn't be loaded: ${missing.join(', ')}. Check the file names in config.js.`;
      return;
    }
    $('setup-msg').textContent = '';

    // Fixed order from config.js. Version B is version A with every trial flipped.
    const byId = Object.fromEntries(problems.map(p => [p.id, p]));
    const flip = v => (v === 'before' ? 'after' : 'before');
    let queue = CFG.orderA.map(([id, v]) => ({ problem: byId[id], version: order === 'B' ? flip(v) : v }));
    if (practice) queue = shuffle(queue.slice()).slice(0, 2);

    run = {
      practice,
      queue,
      total: queue.length,
      done: 0,
      session: {
        id: Date.now().toString(36),
        tester: practice ? '(practice)' : `Version ${order}`,
        order: practice ? '' : order,
        playsFps: $('plays-fps').checked,
        date: new Date().toISOString(),
        trials: [],
      },
      falseStarts: 0,
      current: null,
      timer: null,
      onset: 0,
      phase: 'idle',
    };
    nextScreen();
  }

  $('setup-form').addEventListener('submit', e => { e.preventDefault(); begin(false); });
  $('practice').addEventListener('click', () => begin(true));
  $('view-results').addEventListener('click', () => showResults(null));

  // ---------- trial flow ----------
  function nextScreen() {
    if (!run.queue.length) return finish();
    run.phase = 'ready';
    $('next-count').textContent = `${run.practice ? 'Practice · ' : ''}Trial ${run.done + 1} of ${run.total}`;
    show('next');
  }

  // ---------- center aim task ----------
  // Keeps the tester's eyes on the crosshair, like a fight would: a small target
  // pops up next to the crosshair now and then, and they click the mouse to shoot it.
  // Every target is shot the same way, so there is no colour to judge and nothing to get wrong.
  const AIM = Object.assign({ enabled: true, showMs: 1200, minGapMs: 1500, maxGapMs: 3000, radiusPx: 70 }, CFG.centerTask);

  function startTargets() {
    const c = run.current;
    c.targets = 0; c.targetHits = 0;
    if (!AIM.enabled) return;
    const next = run.nextTarget = () => {
      run.targetTimer = setTimeout(() => {
        const angle = Math.random() * Math.PI * 2, r = AIM.radiusPx * (0.5 + Math.random() * 0.5);
        const el = $('target');
        el.style.transform = `translate(${Math.round(Math.cos(angle) * r)}px, ${Math.round(Math.sin(angle) * r)}px)`;
        el.classList.remove('hit');
        el.hidden = false;
        c.targets++;
        run.target = { hit: false };
        run.targetHide = setTimeout(() => { el.hidden = true; run.target = null; next(); }, AIM.showMs);
      }, AIM.minGapMs + Math.random() * (AIM.maxGapMs - AIM.minGapMs));
    };
    next();
  }

  function stopTargets() {
    clearTimeout(run.midTimer);
    clearTimeout(run.targetTimer); clearTimeout(run.targetHide);
    $('target').hidden = true;
    run.target = null;
  }

  function shoot() {
    const t = run.target;
    if (!t || t.hit) return; // clicking with no target up does nothing
    t.hit = true;
    run.current.targetHits++;
    $('target').classList.add('hit');
    clearTimeout(run.targetHide);
    run.targetHide = setTimeout(() => { $('target').hidden = true; run.target = null; run.nextTarget(); }, 150);
  }

  function startTrial() {
    const t = run.queue.shift();
    run.current = { ...t, falseStartsBefore: run.falseStarts };
    const frames = t.problem[t.version];
    $('frame-normal').src = frames.normal;
    $('frame-warning').src = frames.warning;
    $('frame-warning').hidden = true;
    if (frames.mid) $('frame-mid').src = frames.mid; else $('frame-mid').removeAttribute('src');
    $('frame-mid').hidden = true;
    $('flash').hidden = true;
    $('trial-count').textContent = `${run.done + 1} / ${run.total}`;
    show('trial');

    const delay = Math.round(CFG.minDelayMs + Math.random() * (CFG.maxDelayMs - CFG.minDelayMs));
    run.current.delayMs = delay;
    run.phase = 'waiting';
    startTargets();
    // With a "mid" frame (Low HP: 100 -> 40 -> 14) the clock starts when the mid frame
    // appears, and the warning frame follows midMs later if the tester hasn't pressed yet.
    const first = frames.mid ? 'frame-mid' : 'frame-warning';
    run.timer = setTimeout(() => {
      $(first).hidden = false;
      // Time from the frame the change is first painted in
      requestAnimationFrame(() => {
        run.onset = performance.now();
        run.phase = 'warning';
        run.timer = setTimeout(missed, CFG.timeoutMs);
        if (frames.mid) run.midTimer = setTimeout(() => { if (run.phase === 'warning') $('frame-warning').hidden = false; }, t.problem.midMs || 2000);
      });
    }, delay);
  }

  function falseStart() {
    clearTimeout(run.timer);
    stopTargets();
    run.falseStarts++;
    run.queue.unshift({ problem: run.current.problem, version: run.current.version }); // same trial again, so the order stays fixed
    run.phase = 'flash';
    $('flash').textContent = 'Too early! Let\'s try that one again.';
    $('flash').hidden = false;
    setTimeout(nextScreen, 1200);
  }

  function responded(eventTime) {
    clearTimeout(run.timer); clearTimeout(run.midTimer);
    stopTargets();
    run.current.reactionMs = Math.round(eventTime - run.onset);
    run.current.missed = false;
    askQuestion();
  }

  function missed() {
    clearTimeout(run.midTimer);
    stopTargets();
    run.current.reactionMs = null;
    run.current.missed = true;
    run.phase = 'flash';
    $('flash').textContent = 'Missed';
    $('flash').hidden = false;
    setTimeout(askQuestion, 900);
  }

  function askQuestion() {
    run.phase = 'question';
    $('q-result').textContent = run.current.missed ? 'No key press recorded' : 'Got it';
    $('answers').innerHTML = CFG.answers.map((a, i) =>
      `<button type="button" data-answer="${i}"><kbd>${i + 1}</kbd>${a}</button>`).join('');
    show('question');
  }

  function answer(i) {
    const a = CFG.answers[i];
    if (a === undefined) return;
    const c = run.current;
    run.falseStarts = 0;
    run.session.trials.push({
      position: run.done + 1,
      problem: c.problem.id,
      problemName: c.problem.name,
      version: c.version,
      delayMs: c.delayMs,
      reactionMs: c.reactionMs,
      missed: c.missed,
      answer: a,
      correct: a === c.problem.answer,
      falseStartsBefore: c.falseStartsBefore,
      targets: c.targets,
      targetHits: c.targetHits,
    });
    run.done++;
    if (!run.practice) saveSession(run.session); // save after every trial so nothing is lost
    nextScreen();
  }

  $('answers').addEventListener('click', e => {
    const b = e.target.closest('button[data-answer]');
    if (b && run?.phase === 'question') answer(Number(b.dataset.answer));
  });

  function finish() {
    run.phase = 'done';
    if (run.practice) {
      show('setup');
      $('setup-msg').textContent = 'Practice finished. Start the real test when the tester is ready.';
      run = null;
      return;
    }
    const s = run.session;
    run = null;
    showFinal(s);
  }

  // ---------- end of test: time and accuracy only ----------
  let finalSession = null;
  function finalRows(s) {
    return s.trials.map((t, i) => [i + 1, t.problemName, t.version === 'before' ? 'Current' : 'Redesign',
      t.missed ? '' : t.reactionMs, t.correct ? 1 : 0]);
  }
  function showFinal(s) {
    finalSession = s;
    const rows = finalRows(s);
    const avg = v => { const r = rows.filter(x => x[2] === v && x[3] !== ''); return r.length ? Math.round(r.reduce((a, x) => a + x[3], 0) / r.length) : '–'; };
    const acc = v => { const r = rows.filter(x => x[2] === v); return r.length ? Math.round(100 * r.filter(x => x[4]).length / r.length) + '%' : '–'; };
    $('final-title').textContent = `Version ${s.order}`;
    $('final-table').innerHTML = '<thead><tr><th>Trial</th><th>Problem</th><th>Version</th><th>Time (ms)</th><th>Correct</th></tr></thead><tbody>' +
      rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3] === '' ? 'Missed' : r[3]}</td><td>${r[4] ? 'Yes' : 'No'}</td></tr>`).join('') +
      `</tbody><tfoot><tr><td colspan="3">Current: average time / accuracy</td><td>${avg('Current')}</td><td>${acc('Current')}</td></tr>` +
      `<tr><td colspan="3">Redesign: average time / accuracy</td><td>${avg('Redesign')}</td><td>${acc('Redesign')}</td></tr></tfoot>`;
    $('final-msg').textContent = '';
    show('final');
  }
  $('copy-final').addEventListener('click', async () => {
    // Matches the results sheet: rows HP, Ammo, Map, Ability; columns
    // efficiency (time ms) original/redesign, effectiveness (correct 1/0) original/redesign.
    const rows = finalRows(finalSession);
    const cell = (name, v, col) => { const r = rows.find(x => x[1] === name && x[2] === v); return r ? r[col] : ''; };
    const text = ['Low HP', 'Ammo', 'Map / Spot Enemy', 'Ability'].map(n =>
      [cell(n, 'Current', 3), cell(n, 'Redesign', 3), cell(n, 'Current', 4), cell(n, 'Redesign', 4)].join('\t')).join('\n');
    try { await navigator.clipboard.writeText(text); $('final-msg').textContent = 'Copied. In the sheet, click the HP row\'s ORIGINAL cell under EFFICIENCY and paste. It fills HP, Ammo, Map and Ability.'; }
    catch { $('final-msg').textContent = 'Copying was blocked. Select the table and copy it by hand.'; }
  });
  $('final-new').addEventListener('click', () => {
    document.querySelectorAll('input[name="order"]').forEach(r => { r.checked = false; });
    $('plays-fps').checked = false;
    $('setup-msg').textContent = '';
    show('setup');
  });

  document.addEventListener('keydown', e => {
    if (!run) return;
    if (e.key === 'Escape' && run.phase !== 'done') { // stop early and keep what's done
      clearTimeout(run.timer);
      stopTargets();
      run.queue = [];
      return finish();
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (e.repeat) return;
      if (run.phase === 'ready') startTrial();
      else if (run.phase === 'waiting') falseStart();
      else if (run.phase === 'warning') responded(e.timeStamp);
      return;
    }
    if (run.phase === 'question' && /^[1-9]$/.test(e.key)) answer(Number(e.key) - 1);
  });

  $('trial').addEventListener('mousedown', e => {
    e.preventDefault(); // no text cursor, selection or focus when clicking the screen
    if (document.activeElement) document.activeElement.blur();
    if (e.button === 0 && run && (run.phase === 'waiting' || run.phase === 'warning')) shoot();
  });

  // ---------- results ----------
  let resultsView = 'session';
  let lastSession = null;

  const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const fmtMs = v => v == null ? '–' : `${Math.round(v)} ms`;
  const fmtPct = v => v == null ? '–' : `${Math.round(v * 100)}%`;

  function stats(trials) {
    const noticed = trials.filter(t => !t.missed && t.reactionMs != null);
    return {
      n: trials.length,
      rt: mean(noticed.map(t => t.reactionMs)),
      correct: trials.length ? trials.filter(t => t.correct).length / trials.length : null,
      missed: trials.filter(t => t.missed).length,
    };
  }

  function summaryHtml(trials) {
    if (!trials.length) return '<p class="lead">No results yet.</p>';
    const b = stats(trials.filter(t => t.version === 'before'));
    const a = stats(trials.filter(t => t.version === 'after'));
    const tile = (val, label) => `<div class="stat"><b>${val}</b><span>${label}</span></div>`;
    let html = `<div class="big">
      ${tile(fmtMs(b.rt), 'Average time to notice · current HUD')}
      ${tile(fmtMs(a.rt), 'Average time to notice · redesign')}
      ${tile(`${fmtPct(b.correct)} → ${fmtPct(a.correct)}`, 'Noticed the right thing · current → redesign')}
    </div>`;
    const rows = CFG.problems.map(p => {
      const pt = trials.filter(t => t.problem === p.id);
      if (!pt.length) return '';
      const sb = stats(pt.filter(t => t.version === 'before'));
      const sa = stats(pt.filter(t => t.version === 'after'));
      const diff = sb.rt != null && sa.rt != null ? sa.rt - sb.rt : null;
      const cls = diff == null ? '' : diff < 0 ? 'better' : 'worse';
      return `<tr><td>${p.name}</td>
        <td>${fmtMs(sb.rt)}</td><td>${fmtMs(sa.rt)}</td>
        <td class="${cls}">${diff == null ? '–' : (diff < 0 ? '' : '+') + Math.round(diff) + ' ms'}</td>
        <td>${fmtPct(sb.correct)}</td><td>${fmtPct(sa.correct)}</td>
        <td>${sb.missed} / ${sa.missed}</td></tr>`;
    }).join('');
    html += `<div class="table-wrap"><table>
      <thead><tr><th>Problem</th><th>Time · current</th><th>Time · redesign</th><th>Change</th><th>Correct · current</th><th>Correct · redesign</th><th>Missed (cur / new)</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <p class="note">Time is the average from the warning appearing to the Space press, for trials where the tester pressed in time. Missed means no press within ${CFG.timeoutMs / 1000} seconds. A negative change means the redesign was noticed faster.</p>`;
    return html;
  }

  function rowsFor(sessions) {
    return sessions.flatMap(s => s.trials.map((t, i) => ({ s, t, i })));
  }

  function rawHtml(sessions) {
    const rows = rowsFor(sessions);
    if (!rows.length) return '';
    return `<thead><tr><th>Tester</th><th>Order</th><th>#</th><th>Problem</th><th>Version</th><th>Delay</th><th>Time</th><th>Answer</th><th>Correct</th><th>False starts</th><th>Targets hit</th></tr></thead><tbody>` +
      rows.map(({ s, t, i }) => `<tr><td>${esc(s.tester)}</td><td>${s.order ?? ''}</td><td>${i + 1}</td><td>${t.problemName}</td>
        <td>${t.version === 'before' ? 'Current' : 'Redesign'}</td><td>${t.delayMs} ms</td>
        <td>${t.missed ? 'Missed' : t.reactionMs + ' ms'}</td><td>${esc(t.answer)}</td>
        <td>${t.correct ? 'Yes' : 'No'}</td><td>${t.falseStartsBefore}</td><td>${t.targets == null ? '–' : `${t.targetHits} / ${t.targets}`}</td></tr>`).join('') + '</tbody>';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function currentSessions() {
    if (resultsView === 'all' || !lastSession) return loadAll();
    return [lastSession];
  }

  function renderResults() {
    const sessions = currentSessions();
    const trials = sessions.flatMap(s => s.trials);
    const testers = new Set(sessions.map(s => s.tester)).size;
    $('results-title').textContent = resultsView === 'all' || !lastSession
      ? `All saved testers (${testers})`
      : `Results for ${lastSession.tester}`;
    $('tab-session').setAttribute('aria-selected', String(resultsView === 'session' && !!lastSession));
    $('tab-all').setAttribute('aria-selected', String(resultsView === 'all' || !lastSession));
    $('tab-session').disabled = !lastSession;
    $('summary').innerHTML = summaryHtml(trials);
    $('raw').innerHTML = rawHtml(sessions);
    $('results-msg').textContent = '';
  }

  function showResults(session) {
    lastSession = session;
    resultsView = session ? 'session' : 'all';
    renderResults();
    show('results');
  }

  $('tab-session').addEventListener('click', () => { resultsView = 'session'; renderResults(); });
  $('tab-all').addEventListener('click', () => { resultsView = 'all'; renderResults(); });
  $('new-tester').addEventListener('click', () => {
    document.querySelectorAll('input[name="order"]').forEach(r => { r.checked = false; });
    $('plays-fps').checked = false;
    $('setup-msg').textContent = '';
    show('setup');
  });

  function csv() {
    const head = ['tester', 'order', 'plays_fps', 'date', 'trial', 'problem', 'version', 'delay_ms', 'reaction_ms', 'missed', 'answer', 'correct', 'false_starts_before', 'targets_shown', 'targets_hit'];
    const q = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
    const lines = rowsFor(currentSessions()).map(({ s, t, i }) => [
      s.tester, s.order ?? '', s.playsFps, s.date, i + 1, t.problemName, t.version === 'before' ? 'current' : 'redesign',
      t.delayMs, t.reactionMs ?? '', t.missed, t.answer, t.correct, t.falseStartsBefore, t.targets ?? '', t.targetHits ?? '',
    ].map(q).join(','));
    return [head.join(','), ...lines].join('\n');
  }

  $('copy-csv').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(csv());
      $('results-msg').textContent = 'Copied. Paste it into Google Sheets or Excel.';
    } catch {
      $('results-msg').textContent = 'Copying was blocked by the browser. Use Download CSV instead.';
    }
  });

  $('download-csv').addEventListener('click', () => {
    const blob = new Blob([csv()], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hud-reaction-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  let confirmClear = false;
  $('clear-all').addEventListener('click', () => {
    if (!confirmClear) {
      confirmClear = true;
      $('clear-all').textContent = 'Click again to delete everything';
      setTimeout(() => { confirmClear = false; $('clear-all').textContent = 'Delete all saved results'; }, 4000);
      return;
    }
    confirmClear = false;
    $('clear-all').textContent = 'Delete all saved results';
    saveAll([]);
    lastSession = null;
    renderResults();
    $('results-msg').textContent = 'All saved results were deleted.';
  });

  show('setup');
})();
