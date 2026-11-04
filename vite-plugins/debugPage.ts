// Dev only: a laptop page at /__debug with one button per debug action.
// A click sends the action to every open game page (the headset included)
// over Vite's own hot reload WebSocket, so the game reacts live with no
// reload. Not part of the hosted build.
// The game sends its measured run numbers back the same way, and the page
// shows the live run and a history of finished runs.
import type { Plugin } from 'vite';
import { FPS } from '../src/config/game.js';
import {
  DEBUG_ACTIONS,
  DEBUG_EVENT,
  HEARTBEAT_EVENT,
  RUN_STATS_EVENT,
  STRESS_TEST_EVENT,
  type PageInfo,
  type RunStats,
  type StressTestReport,
} from '../src/debug/debugKeys.js';

const ids = new Set<string>(DEBUG_ACTIONS.map((a) => a.id));
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
  const buttons = DEBUG_ACTIONS.map(
    (a) => `<button data-id="${a.id}" title="${a.does}">${a.label}${a.code ? ` <small>${a.code.replace('Key', '').replace('Digit', '')}</small>` : ''}</button>`,
  ).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tall Tale debug</title>
<style>
  body { font-family: system-ui, sans-serif; background: #1d1813; color: #eee6d8; margin: 0; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 16px; color: #b9ae9c; font-size: 14px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  button { font: inherit; font-size: 15px; padding: 14px 10px; border-radius: 10px; border: 1px solid #5a4330;
    background: #3b2b1f; color: #f2e9da; cursor: pointer; }
  button:hover { background: #4d3828; }
  button:active { background: #f2c14e; color: #1d1813; }
  small { opacity: 0.6; margin-left: 4px; }
  #log { margin-top: 16px; font-size: 13px; color: #b9ae9c; min-height: 1.2em; }
  h2 { font-size: 16px; margin: 28px 0 8px; }
  .live { display: flex; gap: 12px; flex-wrap: wrap; }
  .card { background: #2a211a; border: 1px solid #5a4330; border-radius: 10px; padding: 12px 16px; min-width: 260px; }
  .card b { font-size: 26px; display: block; }
  .stats { display: grid; grid-template-columns: repeat(4, auto); gap: 4px 18px; font-size: 13px; color: #b9ae9c; }
  table { border-collapse: collapse; font-size: 14px; }
  th, td { padding: 6px 12px; text-align: right; border-bottom: 1px solid #3b2b1f; }
  th { color: #b9ae9c; font-weight: 500; }
  .good { color: #7ddf64; } .ok { color: #f2c14e; } .bad { color: #ff5a4e; }
  .row { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; }
  .row button { padding: 6px 10px; font-size: 13px; }
  .result { background: #2a211a; border: 1px solid #5a4330; padding: 12px 16px; border-radius: 10px; margin: 8px 0;
    white-space: pre; font-family: ui-monospace, Menlo, monospace; font-size: 13px; overflow-x: auto; }
  .note { font-size: 15px; margin: 4px 0 8px; }
</style>
</head>
<body>
<h1>Tall Tale debug</h1>
<p>Each button runs on every open game page (headset included) right away. Needs <code>npm run dev</code>.</p>
<div class="grid">
${buttons}
</div>
<div id="log"></div>
<h2>Connected game pages</h2>
<p>Every open game page checks in every 2 s. "laptop" pages run on localhost (the emulator fakes a Quest there), "headset" pages on the Mac's network address. Close laptop game tabs before testing.</p>
<table>
  <thead><tr><th>page</th><th>device</th><th>in VR</th><th>state</th><th>fps</th><th>target</th><th>units</th></tr></thead>
  <tbody id="pages"><tr><td colspan="7">No game page connected.</td></tr></tbody>
</table>
<h2>Automatic stress test</h2>
<p>Put on the headset and enter VR, press <b>Run stress test</b> above, then sit still and look at the board in front of you until it says Done. Only a page in VR runs it. Paste the result text.</p>
<div id="test"><p>Not run yet.</p></div>
<h2>Measured run (live)</h2>
<div class="live" id="live"><p>No game page is sending numbers yet.</p></div>
<h2>Finished runs</h2>
<div class="row">
  <button id="copy">Copy as CSV</button>
  <button id="clear">Clear history</button>
</div>
<table>
  <thead><tr><th>time</th><th>page</th><th>device</th><th>units</th><th>seconds</th><th>avg fps</th><th>1% low</th><th>missed</th></tr></thead>
  <tbody id="history"></tbody>
</table>
<script>
  const TARGET = ${FPS.target};
  const log = document.getElementById('log');
  const cls = (fps, target) => {
    const t = target || TARGET;
    return fps >= t * 0.95 ? 'good' : fps >= t * 0.8 ? 'ok' : 'bad';
  };
  const missCls = (pct) => (pct < 1 ? 'good' : pct < 5 ? 'ok' : 'bad');
  const time = (at) => new Date(at).toLocaleTimeString();
  let rows = [];
  async function refresh() {
    try {
      const data = await (await fetch('/__debug/stats')).json();
      document.getElementById('pages').innerHTML = data.pages.length
        ? data.pages
            .map(
              (p) => '<tr><td>' + p.page + '</td><td>' + p.device + '</td><td>' + (p.immersive ? 'yes' : 'no') +
                '</td><td>' + (p.testing ? 'stress test' : p.paused ? 'paused' : 'playing') + '</td><td class="' +
                cls(p.liveFps, p.targetFps) + '">' + p.liveFps.toFixed(0) + '</td><td>' + p.targetFps + '</td><td>' +
                p.units + '</td></tr>',
            )
            .join('')
        : '<tr><td colspan="7">No game page connected.</td></tr>';
      const live = document.getElementById('live');
      live.innerHTML = data.live.length
        ? data.live
            .map(
              (s) => '<div class="card"><div class="stats"><span>' + s.device + ' ' + s.page + '</span><span>' + s.units +
                ' units</span><span>' + s.seconds.toFixed(0) + ' s</span><span>of ' + s.targetFps + ' fps</span></div>' +
                '<div class="stats"><span>avg<b class="' + cls(s.avgFps, s.targetFps) + '">' + s.avgFps.toFixed(1) + '</b></span>' +
                '<span>1% low<b class="' + cls(s.lowFps, s.targetFps) + '">' + s.lowFps.toFixed(0) + '</b></span>' +
                '<span>missed<b class="' + missCls(s.missedPct) + '">' + s.missedPct.toFixed(1) + '%</b></span></div></div>',
            )
            .join('')
        : '<p>No game page is sending numbers yet.</p>';
      rows = data.history;
      document.getElementById('history').innerHTML = rows
        .map(
          (s) => '<tr><td>' + time(s.at) + '</td><td>' + s.page + '</td><td>' + s.device + '</td><td>' + s.units + '</td><td>' +
            s.seconds.toFixed(0) + '</td><td class="' + cls(s.avgFps, s.targetFps) + '">' + s.avgFps.toFixed(1) +
            '</td><td class="' + cls(s.lowFps, s.targetFps) + '">' + s.lowFps.toFixed(0) + '</td><td class="' +
            missCls(s.missedPct) + '">' + s.missedPct.toFixed(1) + '%</td></tr>',
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
  for (const button of document.querySelectorAll('.grid button')) {
    button.addEventListener('click', async () => {
      try {
        const res = await fetch('/__debug/run?c=' + button.dataset.id, { method: 'POST' });
        log.textContent = res.ok ? 'Sent: ' + button.textContent.trim() : 'Error: ' + res.status;
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
          if (!ids.has(id)) {
            res.statusCode = 400;
            res.end('unknown command');
            return;
          }
          server.ws.send(DEBUG_EVENT, { id });
          res.end('ok');
          return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(page());
      });
    },
  };
}
