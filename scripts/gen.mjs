// The level generator from the command line (docs/custom-mode.md section 6).
// Level files are made by this command, never typed by hand.
//
//   npm run gen -- --seed 42                      the default settings, printed
//   npm run gen -- --seed 42 --set camps=4 --set wiggle=0.8
//   npm run gen -- --seed 42 --settings my.json --out src/maps/levels/level3.json
//   npm run gen -- --seed 42 --svg map.svg        a top view of the map, to look at
//   npm run gen -- --help                         every setting with its limits
//
// It loads the generator's TypeScript through Vite (already a dev dependency,
// so no new runner), runs the checks, prints the summary, and writes the level
// file with --out. Exits with 1 when no seed passes the checks.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';

function parseArgs(argv) {
  const args = { seed: 1, set: [], settings: null, out: null, name: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--seed') args.seed = Number(next());
    else if (a === '--set') args.set.push(next());
    else if (a === '--settings') args.settings = next();
    else if (a === '--out') args.out = next();
    else if (a === '--name') args.name = next();
    else if (a === '--svg') args.svg = next();
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`unknown argument ${a} (try --help)`);
  }
  return args;
}

/** A top view of the map as an SVG picture (front of the board up), to look at a map before the headset. */
function mapSvg(level) {
  const nodes = new Map(level.map.nodes.map((n) => [n.id, n]));
  const xy = ([r, deg]) => {
    const a = (deg * Math.PI) / 180;
    return [Math.round(r * Math.sin(a)), Math.round(-r * Math.cos(a))];
  };
  const parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="-520 -520 1040 1040" width="720" height="720">'];
  parts.push('<rect x="-520" y="-520" width="1040" height="1040" fill="#9cc46a"/>');
  parts.push('<circle r="52" fill="#c9c2b4" stroke="#7a7266" stroke-width="4"/>');
  for (const road of level.map.roads) {
    const pts = [nodes.get(road.from).at, ...road.via, nodes.get(road.to).at].map(xy).map((p) => p.join(',')).join(' ');
    parts.push(`<polyline points="${pts}" fill="none" stroke="#d9c08a" stroke-width="7" stroke-linejoin="round"/>`);
  }
  const colors = { keg: '#b5462e', boulder: '#6e6a64', tree: '#2f5f22' };
  for (const t of level.map.triggers) {
    const [x, y] = xy(t.at);
    parts.push(`<circle cx="${x}" cy="${y}" r="8" fill="${colors[t.kind] ?? '#000'}"/>`);
  }
  for (const n of level.map.nodes) {
    const [x, y] = xy(n.at);
    if (n.kind === 'camp') {
      parts.push(`<circle cx="${x}" cy="${y}" r="${n.size / 2}" fill="#7a4a2a"/>`);
      parts.push(`<text x="${x}" y="${y + 5}" font-size="18" text-anchor="middle" fill="#fff">${n.id.replace('camp', 'C')} w${n.wave}</text>`);
    } else if (n.kind === 'junction') parts.push(`<circle cx="${x}" cy="${y}" r="5" fill="#5a4630"/>`);
  }
  parts.push('<text x="0" y="-500" font-size="22" text-anchor="middle">front</text></svg>');
  return parts.join('\n');
}

/** "camps=4", "kegs=false", "campDistance=300,400", "difficulty=hard". */
function parseSet(text) {
  const eq = text.indexOf('=');
  if (eq < 0) throw new Error(`--set needs key=value, got ${text}`);
  const key = text.slice(0, eq);
  const raw = text.slice(eq + 1);
  if (raw === 'true' || raw === 'false') return [key, raw === 'true'];
  if (raw.includes(',')) return [key, raw.split(',').map(Number)];
  const n = Number(raw);
  return [key, Number.isFinite(n) ? n : raw];
}

const args = parseArgs(process.argv.slice(2));
// No config file (the game's plugins are not needed) and no dependency scan (only plain TypeScript is loaded).
const server = await createServer({
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, entries: [] },
});
let code = 0;
try {
  const settingsModule = await server.ssrLoadModule('/src/config/levelSettings.ts');
  const gen = await server.ssrLoadModule('/src/level/generate.ts');
  if (args.help) {
    console.log('Settings (--set key=value):');
    for (const def of settingsModule.LEVEL_SETTINGS) {
      const limits = def.kind === 'choice' ? def.choices.map((c) => c.id).join(' | ') : def.kind === 'toggle' ? 'true | false' : `${def.min} to ${def.max}`;
      console.log(`  ${def.key.padEnd(16)} ${def.kind.padEnd(7)} ${limits.padEnd(28)} default ${JSON.stringify(def.default)}`);
    }
  } else {
    const raw = args.settings ? JSON.parse(readFileSync(resolve(args.settings), 'utf8')) : {};
    const merged = { ...settingsModule.defaultSettings(), ...raw, ...Object.fromEntries(args.set.map(parseSet)) };
    const settings = settingsModule.fixSettings(merged);
    for (const key of Object.keys(merged)) {
      if (!(key in settings)) console.warn(`warning: unknown setting ${key} (left out)`);
      else if (JSON.stringify(merged[key]) !== JSON.stringify(settings[key])) console.warn(`warning: ${key} ${JSON.stringify(merged[key])} was fixed to ${JSON.stringify(settings[key])}`);
    }
    try {
      const generated = gen.generateLevel(args.seed, settings, args.name ?? 'custom');
      console.log(gen.summarize(generated));
      if (args.out) {
        const out = resolve(args.out);
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, JSON.stringify(generated.level, null, 1) + '\n');
        console.log(`written ${args.out}`);
      }
      if (args.svg) {
        writeFileSync(resolve(args.svg), mapSvg(generated.level));
        console.log(`map picture written ${args.svg}`);
      }
    } catch (error) {
      if (error && Array.isArray(error.problems)) {
        console.error(`no level: ${error.message}`);
        for (const p of error.problems) console.error(`  - ${p}`);
        code = 1;
      } else throw error;
    }
  }
} finally {
  await server.close();
}
process.exit(code);
