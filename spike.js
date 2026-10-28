// Spike decision test: show a spike screenshot, the tester presses F (defuse) or J (too late).
// Measures decision time and accuracy for the current HUD vs the redesign.
(() => {
  const CFG = window.SPIKE_TEST;
  const $ = id => document.getElementById(id);
  const screens = ['setup', 'next', 'trial', 'final'];
  const show = name => { for (const s of screens) $(s).hidden = s !== name; };
  const flip = v => (v === 'current' ? 'redesign' : 'current');
  const ANSWERS = { defuse: 'Defuse', late: 'Too late' };

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Version A order: from config, or alternate current/redesign through the list.
  function buildOrderA() {
    if (CFG.orderA && CFG.orderA.length) return CFG.orderA;
    const s = CFG.situations, n = s.length, order = [];
    if (n === 2) return [[s[0].id, 'current'], [s[1].id, 'redesign'], [s[0].id, 'redesign'], [s[1].id, 'current']];
    const shift = n >= 3 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      order.push([s[k].id, 'current']);
      order.push([s[(k + shift) % n].id, 'redesign']);
    }
    return order;
  }

  function preload(srcs) {
    return Promise.all(srcs.map(src => new Promise(res => {
      const img = new Image(); img.onload = () => res(null); img.onerror = () => res(src); img.src = src;
    }))).then(r => r.filter(Boolean));
  }

  let run = null;

  async function begin(practice) {
    const picked = document.querySelector('input[name="order"]:checked');
    if (!practice && !picked) { $('setup-msg').textContent = 'Pick version A or B first.'; return; }
    const order = picked ? picked.value : 'A';
    const byId = Object.fromEntries(CFG.situations.map(s => [s.id, s]));
    $('setup-msg').textContent = 'Loading screenshots…';
    const missing = await preload(CFG.situations.flatMap(s => [s.current, s.redesign]));
    if (missing.length) { $('setup-msg').textContent = `These files couldn't be loaded: ${missing.join(', ')}. Check spike-config.js.`; return; }
    $('setup-msg').textContent = '';
    let queue = buildOrderA().map(([id, v]) => ({ s: byId[id], version: order === 'B' ? flip(v) : v }));
    if (practice) queue = shuffle(queue.slice()).slice(0, 2);
    run = { practice, order, queue, total: queue.length, trials: [], phase: 'idle' };
    nextScreen();
  }

  function nextScreen() {
    if (!run.queue.length) return finish();
    run.phase = 'ready';
    $('next-count').textContent = `${run.practice ? 'Practice · ' : ''}Trial ${run.trials.length + 1} of ${run.total}`;
    show('next');
  }

  function startTrial() {
    run.current = run.queue.shift();
    $('frame').hidden = true;
    $('frame').src = run.current.s[run.current.version];
    $('trial-count').textContent = `${run.trials.length + 1} / ${run.total}`;
    $('flash').hidden = true;
    show('trial');
    run.phase = 'fixation';
    run.timer = setTimeout(() => {
      $('frame').hidden = false;
      requestAnimationFrame(() => {
        run.onset = performance.now();
        run.phase = 'deciding';
        run.timer = setTimeout(() => record(null, null), CFG.timeoutMs);
      });
    }, CFG.fixationMs);
  }

  function record(choice, t) {
    clearTimeout(run.timer);
    const c = run.current;
    run.trials.push({
      timeLeft: c.s.timeLeft, version: c.version, answer: c.s.answer, choice,
      ms: choice ? Math.round(t - run.onset) : null, correct: choice === c.s.answer,
    });
    run.phase = 'flash';
    $('flash').textContent = choice ? 'Got it' : 'Too slow';
    $('flash').hidden = false;
    setTimeout(nextScreen, 600);
  }

  function finish() {
    if (run.practice) { run = null; show('setup'); $('setup-msg').textContent = 'Practice finished. Start the real test when the tester is ready.'; return; }
    const rows = run.trials.map((t, i) => [i + 1, `${t.timeLeft}s left`, t.version === 'current' ? 'Current' : 'Redesign',
      ANSWERS[t.answer], t.choice ? ANSWERS[t.choice] : 'No answer', t.ms ?? '', t.correct ? 1 : 0]);
    run.rows = rows;
    const avg = v => { const r = rows.filter(x => x[2] === v && x[5] !== ''); return r.length ? Math.round(r.reduce((a, x) => a + x[5], 0) / r.length) : '–'; };
    const acc = v => { const r = rows.filter(x => x[2] === v); return r.length ? Math.round(100 * r.filter(x => x[6]).length / r.length) + '%' : '–'; };
    $('final-title').textContent = `Spike test · Version ${run.order}`;
    $('final-table').innerHTML = '<thead><tr><th>Trial</th><th>Spike</th><th>Version</th><th>Right answer</th><th>Tester said</th><th>Time (ms)</th><th>Correct</th></tr></thead><tbody>' +
      rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5] === '' ? '–' : r[5]}</td><td>${r[6] ? 'Yes' : 'No'}</td></tr>`).join('') +
      `</tbody><tfoot><tr><td colspan="5">Current: average time / accuracy</td><td>${avg('Current')}</td><td>${acc('Current')}</td></tr>` +
      `<tr><td colspan="5">Redesign: average time / accuracy</td><td>${avg('Redesign')}</td><td>${acc('Redesign')}</td></tr></tfoot>`;
    $('final-msg').textContent = '';
    run.phase = 'done';
    show('final');
  }

  $('setup-form').addEventListener('submit', e => { e.preventDefault(); begin(false); });
  $('practice').addEventListener('click', () => begin(true));
  $('copy-final').addEventListener('click', async () => {
    // One row for the SPIKE line of the results sheet: average time original/redesign,
    // accuracy (share correct, 0–1) original/redesign.
    const rows = run.rows;
    const avg = v => { const r = rows.filter(x => x[2] === v && x[5] !== ''); return r.length ? Math.round(r.reduce((a, x) => a + x[5], 0) / r.length) : ''; };
    const acc = v => { const r = rows.filter(x => x[2] === v); return r.length ? +(r.filter(x => x[6]).length / r.length).toFixed(2) : ''; };
    const text = [avg('Current'), avg('Redesign'), acc('Current'), acc('Redesign')].join('\t');
    try { await navigator.clipboard.writeText(text); $('final-msg').textContent = 'Copied. In the sheet, click the SPIKE row\'s ORIGINAL cell under EFFICIENCY and paste.'; }
    catch { $('final-msg').textContent = 'Copying was blocked. Select the table and copy it by hand.'; }
  });
  $('final-new').addEventListener('click', () => {
    document.querySelectorAll('input[name="order"]').forEach(r => { r.checked = false; });
    run = null; $('setup-msg').textContent = ''; show('setup');
  });

  // No text cursor, selection or focus when clicking the screenshot
  $('trial').addEventListener('mousedown', e => { e.preventDefault(); if (document.activeElement) document.activeElement.blur(); });

  document.addEventListener('keydown', e => {
    if (!run) return;
    if (e.key === 'Escape') { clearTimeout(run.timer); run.queue = []; return finish(); }
    if (run.phase === 'ready' && (e.code === 'Space' || e.key === 'Enter')) { e.preventDefault(); startTrial(); return; }
    if (run.phase === 'deciding' && (e.code === 'KeyF' || e.code === 'KeyJ')) record(e.code === 'KeyF' ? 'defuse' : 'late', performance.now());
  });
})();
