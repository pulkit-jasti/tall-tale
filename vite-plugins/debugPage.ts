// Dev only: a laptop page at /__debug with one button per debug action,
// grouped in sections. A click sends the action to every open game page (the
// headset included) over Vite's own hot reload WebSocket, so the game reacts
// live with no reload. Not part of the hosted build.
// The game sends its measured run numbers back the same way, and the page
// shows the live run and a history of finished runs.
import type { Plugin } from 'vite';
import { FPS } from '../src/config/game.js';
import {
  DEBUG_ACTIONS,
  DEBUG_EVENT,
  DEBUG_GROUPS,
  HEARTBEAT_EVENT,
  RUN_STATS_EVENT,
  STRESS_TEST_EVENT,
  type DebugAction,
  type PageInfo,
  type RunStats,
  type StressTestReport,
} from '../src/debug/debugKeys.js';

const actions = new Map<string, DebugAction>(DEBUG_ACTIONS.map((a) => [a.id, a]));

const escape = (text: string): string => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** One button, or a row of numbered buttons for an action with values (Start at wave 1 to 5). */
function actionHtml(a: DebugAction): string {
  if (a.args) {
    const buttons = a.args
      .map((v) => `<button class="num" data-id="${a.id}" data-arg="${v}" title="${escape(a.does)}">${v}</button>`)
      .join('');
    return `<div class="multi" title="${escape(a.does)}"><span class="icon">${a.icon}</span><span class="label">${a.label}</span><span class="nums">${buttons}</span></div>`;
  }
  return `<button data-id="${a.id}" title="${escape(a.does)}"><span class="icon">${a.icon}</span><span class="label">${a.label}</span></button>`;
}

function sectionsHtml(): string {
  return DEBUG_GROUPS.map((g) => {
    const items = DEBUG_ACTIONS.filter((a) => a.group === g.id);
    if (!items.length) return '';
    return `<section class="panel"><h3><span class="icon">${g.icon}</span>${g.title}</h3><div class="grid">${items.map(actionHtml).join('')}</div></section>`;
  }).join('\n');
}

/** Too short to trust, so not kept in the history (seconds). */
const MIN_RUN_SECONDS = 5;
const HISTORY_SIZE = 100;
const live = new Map<string, RunStats & { at: number }>();
const history: (RunStats & { at: number })[] = [];
let stressTest: (StressTestReport & { at: number }) | null = null;
/** Game pages that checked in recently, by page id. */
const pages = new Map<string, PageInfo & { at: number }>();
/** A page that has not checked in for this long is gone (ms). */
const PAGE_TIMEOUT = 6000;

function page(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tall Tale debug</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: #1d1813; color: #eee6d8; margin: 0; }
  main { max-width: 1240px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 0 0 6px; }
  h3 { font-size: 13px; font-weight: 600; margin: 0 0 10px; color: #f2c14e; text-transform: uppercase; letter-spacing: 0.04em; }
  h3 .icon { margin-right: 8px; }
  p { margin: 0 0 12px; color: #b9ae9c; font-size: 13px; line-height: 1.45; }
  .panel { background: #2a211a; border: 1px solid #4a372a; border-radius: 12px; padding: 14px 16px; }
  .stack { display: grid; gap: 16px; margin-top: 16px; }
  .top { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: baseline; justify-content: space-between; margin-bottom: 16px; }
  .state { font-size: 13px; color: #b9ae9c; }
  .state b { color: #f2e9da; }
  #log { font-size: 13px; color: #7ddf64; min-height: 1.2em; }
  /* The action sections: cards of equal width, each row as tall as its tallest card. */
  .sections { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 14px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  button { font: inherit; font-size: 13px; min-height: 40px; padding: 8px 10px; border-radius: 9px; border: 1px solid #5a4330;
    background: #3b2b1f; color: #f2e9da; cursor: pointer; display: flex; align-items: center; gap: 8px; text-align: left; }
  button:hover { background: #4d3828; }
  button:active, button.sent { background: #f2c14e; color: #1d1813; }
  button .label { flex: 1; }
  .icon { font-size: 16px; line-height: 1; }
  .multi { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 4px 10px; border-radius: 9px;
    border: 1px solid #5a4330; background: #33261b; font-size: 13px; }
  .multi .label { flex: 1; }
  .nums { display: flex; gap: 6px; }
  button.num { min-height: 30px; padding: 4px 12px; font-weight: 600; justify-content: center; }
  .scroll { overflow-x: auto; }
  table { border-collapse: collapse; font-size: 13px; width: 100%; }
  th, td { padding: 6px 10px; border-bottom: 1px solid #3b2b1f; text-align: left; vertical-align: top; }
  th { color: #b9ae9c; font-weight: 500; white-space: nowrap; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  td.notes { white-space: pre-line; font-size: 12px; color: #d8cdb9; min-width: 280px; }
  .good { color: #7ddf64; } .ok { color: #f2c14e; } .bad { color: #ff5a4e; }
  .row { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
  .row button { min-height: 30px; padding: 4px 10px; }
  .live { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
  .run { background: #33261b; border: 1px solid #5a4330; border-radius: 10px; padding: 10px 14px; }
  .run .meta { font-size: 12px; color: #b9ae9c; margin-bottom: 8px; }
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .tile span { display: block; font-size: 11px; color: #b9ae9c; text-transform: uppercase; letter-spacing: 0.04em; }
  .tile b { font-size: 24px; }
  .result { background: #1d1813; border: 1px solid #4a372a; padding: 12px 14px; border-radius: 10px; margin: 8px 0;
    white-space: pre; font-family: ui-monospace, Menlo, monospace; font-size: 12px; overflow-x: auto; }
  .note { font-size: 14px; margin: 4px 0 8px; }
</style>
</head>
<body>
<main>
<div class="top">
  <div>
    <h1>Tall Tale debug</h1>
    <p>Each button runs on every open game page (the headset too) right away, while <code>npm run dev</code> runs. Hover a button to see what it does.</p>
  </div>
  <div>
    <div class="state" id="state">No game page connected.</div>
    <div id="log"></div>
  </div>
</div>
<div class="sections">
${sectionsHtml()}
</div>
<div class="stack">
  <section class="panel">
    <h2>Connected game pages</h2>
    <p>Each open game page checks in every 2 s. "laptop" pages run on localhost (the emulator fakes a Quest there), "headset" pages on the Mac's network address. Close laptop game tabs before testing. Notes are the game's last few messages (a stuck knight, what the bell did, what paused it).</p>
    <div class="scroll"><table>
      <thead><tr><th>page</th><th>device</th><th>in VR</th><th>state</th><th>step</th><th>Play at</th><th class="num">fps</th><th class="num">target</th><th class="num">units</th><th>mic</th><th>notes</th></tr></thead>
      <tbody id="pages"><tr><td colspan="11">No game page connected.</td></tr></tbody>
    </table></div>
  </section>
  <section class="panel">
    <h2>Automatic stress test</h2>
    <p>Put on the headset and enter VR, press <b>Run stress test</b> above, then sit still and look at the board in front of you until it says Done. Only a page in VR runs it. Paste the result text.</p>
    <div id="test"><p>Not run yet.</p></div>
  </section>
  <section class="panel">
    <h2>Measured run (live)</h2>
    <div class="live" id="live"><p>No game page is sending numbers yet.</p></div>
  </section>
  <section class="panel">
    <h2>Finished runs</h2>
    <div class="row">
      <button id="copy">Copy as CSV</button>
      <button id="clear">Clear history</button>
    </div>
    <div class="scroll"><table>
      <thead><tr><th>time</th><th>page</th><th>device</th><th class="num">units</th><th class="num">seconds</th><th class="num">avg fps</th><th class="num">1% low</th><th class="num">missed</th></tr></thead>
      <tbody id="history"></tbody>
    </table></div>
  </section>
</div>
</main>
<script>
  const TARGET = ${FPS.target};
  const log = document.getElementById('log');
  const cls = (fps, target) => {
    const t = target || TARGET;
    return fps >= t * 0.95 ? 'good' : fps >= t * 0.8 ? 'ok' : 'bad';
  };
  const missCls = (pct) => (pct < 1 ? 'good' : pct < 5 ? 'ok' : 'bad');
  const time = (at) => new Date(at).toLocaleTimeString();
  const esc = (text) => String(text == null ? '' : text).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const td = (text, cl) => '<td' + (cl ? ' class="' + cl + '"' : '') + '>' + text + '</td>';
  let rows = [];
  async function refresh() {
    try {
      const data = await (await fetch('/__debug/stats')).json();
      document.getElementById('pages').innerHTML = data.pages.length
        ? data.pages
            .map(
              (p) =>
                '<tr>' + td(esc(p.page)) + td(esc(p.device)) + td(p.immersive ? 'yes' : 'no') +
                td(p.testing ? 'stress test' : p.paused ? 'paused' : 'playing') + td(esc(p.step)) + td('wave ' + (p.playFrom || 1)) +
                td(p.liveFps.toFixed(0), 'num ' + cls(p.liveFps, p.targetFps)) + td(p.targetFps, 'num') + td(p.units, 'num') +
                td(esc(p.mic)) + td(esc(p.notes), 'notes') + '</tr>',
            )
            .join('')
        : '<tr><td colspan="11">No game page connected.</td></tr>';
      // Short summary at the top: what the first connected page is doing.
      const first = data.pages.find((p) => p.device === 'headset') || data.pages[0];
      document.getElementById('state').innerHTML = first
        ? '<b>' + first.device + '</b> ' + (first.immersive ? 'in VR' : 'not in VR') + ', step <b>' + (first.step || '?') +
          '</b>, Play starts at <b>wave ' + (first.playFrom || 1) + '</b>'
        : 'No game page connected.';
      const live = document.getElementById('live');
      live.innerHTML = data.live.length
        ? data.live
            .map(
              (s) =>
                '<div class="run"><div class="meta">' + esc(s.device) + ' ' + esc(s.page) + ' · ' + s.units + ' units · ' +
                s.seconds.toFixed(0) + ' s · target ' + s.targetFps + ' fps</div><div class="tiles">' +
                '<div class="tile"><span>avg</span><b class="' + cls(s.avgFps, s.targetFps) + '">' + s.avgFps.toFixed(1) + '</b></div>' +
                '<div class="tile"><span>1% low</span><b class="' + cls(s.lowFps, s.targetFps) + '">' + s.lowFps.toFixed(0) + '</b></div>' +
                '<div class="tile"><span>missed</span><b class="' + missCls(s.missedPct) + '">' + s.missedPct.toFixed(1) + '%</b></div>' +
                '</div></div>',
            )
            .join('')
        : '<p>No game page is sending numbers yet.</p>';
      rows = data.history;
      document.getElementById('history').innerHTML = rows
        .map(
          (s) =>
            '<tr>' + td(time(s.at)) + td(esc(s.page)) + td(esc(s.device)) + td(s.units, 'num') + td(s.seconds.toFixed(0), 'num') +
            td(s.avgFps.toFixed(1), 'num ' + cls(s.avgFps, s.targetFps)) + td(s.lowFps.toFixed(0), 'num ' + cls(s.lowFps, s.targetFps)) +
            td(s.missedPct.toFixed(1) + '%', 'num ' + missCls(s.missedPct)) + '</tr>',
        )
        .join('');
      renderTest(data.stressTest);
    } catch (e) {}
  }
  let resultText = '';
  function testText(t) {
    const r = t.rule;
    const lines = [
      'Tall Tale stress test (' + (t.device || 'unknown') + ' ' + (t.page || '') + '), ' + new Date(t.at).toLocaleString(),
      'Pass rule: avg >= ' + r.minAvgFps + ', 1% low >= ' + r.minLowFps + ', missed < ' + r.maxMissedPct +
        '%, ' + r.measureSeconds + ' s per step, target ' + r.targetFps + ' fps',
      '1% low counts frames in whole display beats; raw is the page clock (wobbles, info only).',
      'units   avg    1% low  raw   missed      slowest  result',
    ];
    for (const s of t.steps) {
      const result = s.baseline ? (s.pass ? 'baseline ok' : 'baseline FAIL') : s.pass ? 'pass' : 'FAIL';
      lines.push(
        (s.baseline ? 'empty' : String(s.units)).padEnd(8) + s.avgFps.toFixed(1).padEnd(7) +
          s.lowFps.toFixed(0).padEnd(8) + (s.rawLowFps || 0).toFixed(0).padEnd(6) + (s.missedPct.toFixed(1) + '% (' + (s.missed || 0) + ')').padEnd(12) +
          ((s.slowestMs || 0).toFixed(0) + ' ms').padEnd(9) + result,
      );
      const causes = Object.entries(s.causes || {}).sort((a, b) => b[1] - a[1]);
      if (causes.length) lines.push('        before missed frames: ' + causes.map((c) => c[0] + ' ' + c[1]).join(', '));
    }
    lines.push('Budget: ' + (t.budget === null ? 'none passed' : t.budget + ' units') + '. ' + t.note);
    return lines.join('\\n');
  }
  function renderTest(t) {
    const box = document.getElementById('test');
    if (!t) return;
    resultText = testText(t);
    box.innerHTML =
      '<div class="note">' + (t.state === 'done' ? '<b>Done.</b> ' : '<b>Running.</b> ') + t.note + '</div>' +
      '<div class="result"></div>' +
      (t.state === 'done' ? '<div class="row"><button id="copyTest">Copy result</button></div>' : '');
    box.querySelector('.result').textContent = resultText;
    const copy = document.getElementById('copyTest');
    if (copy) {
      copy.addEventListener('click', async () => {
        await navigator.clipboard.writeText(resultText);
        log.textContent = 'Copied the stress test result';
      });
    }
  }
  setInterval(refresh, 1000);
  refresh();
  document.getElementById('copy').addEventListener('click', async () => {
    const csv = ['time,page,device,target_fps,units,seconds,avg_fps,low1_fps,missed_pct']
      .concat(rows.map((s) => [time(s.at), s.page, s.device, s.targetFps, s.units, s.seconds.toFixed(1), s.avgFps.toFixed(1), s.lowFps.toFixed(1), s.missedPct.toFixed(2)].join(',')))
      .join('\\n');
    await navigator.clipboard.writeText(csv);
    log.textContent = 'Copied ' + rows.length + ' runs as CSV';
  });
  document.getElementById('clear').addEventListener('click', async () => {
    await fetch('/__debug/clear', { method: 'POST' });
    refresh();
  });
  for (const button of document.querySelectorAll('.sections button')) {
    button.addEventListener('click', async () => {
      const arg = button.dataset.arg ? '&arg=' + button.dataset.arg : '';
      const name = button.dataset.arg
        ? button.closest('.multi').querySelector('.label').textContent + ' ' + button.dataset.arg
        : button.querySelector('.label').textContent;
      try {
        const res = await fetch('/__debug/run?c=' + button.dataset.id + arg, { method: 'POST' });
        log.textContent = res.ok ? 'Sent: ' + name : 'Error: ' + res.status;
        button.classList.add('sent');
        setTimeout(() => button.classList.remove('sent'), 250);
      } catch (e) {
        log.textContent = 'Dev server not reachable';
      }
    });
  }
</script>
</body>
</html>`;
}

export function debugPage(): Plugin {
  return {
    name: 'tall-tale-debug-page',
    apply: 'serve',
    configureServer(server) {
      server.ws.on(RUN_STATS_EVENT, (data: RunStats) => {
        const entry = { ...data, at: Date.now() };
        if (data.final) {
          live.delete(data.page);
          if (data.seconds >= MIN_RUN_SECONDS) {
            history.unshift(entry);
            history.length = Math.min(history.length, HISTORY_SIZE);
          }
        } else {
          live.set(data.page, entry);
        }
      });
      server.ws.on(STRESS_TEST_EVENT, (data: StressTestReport) => {
        stressTest = { ...data, at: Date.now() };
      });
      server.ws.on(HEARTBEAT_EVENT, (data: PageInfo) => {
        pages.set(data.page, { ...data, at: Date.now() });
      });
      server.middlewares.use('/__debug', (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (url.pathname === '/stats') {
          // Drop live runs that stopped reporting (page closed or paused).
          for (const [page, s] of live) if (Date.now() - s.at > 5000) live.delete(page);
          for (const [page, p] of pages) if (Date.now() - p.at > PAGE_TIMEOUT) pages.delete(page);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ live: [...live.values()], history, stressTest, pages: [...pages.values()] }));
          return;
        }
        if (url.pathname === '/clear') {
          history.length = 0;
          res.end('ok');
          return;
        }
        if (url.pathname === '/run') {
          const id = url.searchParams.get('c') ?? '';
          const action = actions.get(id);
          if (!action) {
            res.statusCode = 400;
            res.end('unknown command');
            return;
          }
          const argText = url.searchParams.get('arg');
          const arg = argText === null ? undefined : Number(argText);
          if (action.args && (arg === undefined || !action.args.includes(arg))) {
            res.statusCode = 400;
            res.end('bad value');
            return;
          }
          server.ws.send(DEBUG_EVENT, { id, arg });
          res.end('ok');
          return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(page());
      });
    },
  };
}
