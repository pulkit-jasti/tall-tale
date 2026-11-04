// Debug link to the laptop debug page, over the dev server's own WebSocket
// (the one hot reload uses). Commands come in, measured run numbers go out.
// Only exists under `npm run dev`; the hosted build has no import.meta.hot, so
// this does nothing there.
import {
  DEBUG_ACTIONS,
  DEBUG_EVENT,
  HEARTBEAT_EVENT,
  RUN_STATS_EVENT,
  STRESS_TEST_EVENT,
  type DebugCommand,
  type PageInfo,
  type RunStats,
  type StressTestReport,
} from './debugKeys.js';
import { mark } from './perfMarks.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * This game page. The device comes from the host, not the user agent: the
 * IWSDK emulator fakes a Quest user agent, but it only runs on localhost,
 * while the headset opens the Mac's network address.
 */
export const PAGE = {
  id: Math.round(performance.timeOrigin).toString(36).slice(-5),
  device: LOCAL_HOSTS.has(location.hostname) ? 'laptop' : 'headset',
};

const known = new Set<string>(DEBUG_ACTIONS.map((a) => a.id));
const queue: DebugCommand[] = [];

if (import.meta.hot) {
  import.meta.hot.on(DEBUG_EVENT, (data: { id?: string }) => {
    if (data?.id && known.has(data.id)) queue.push(data.id as DebugCommand);
  });
}

/** Commands that arrived since the last call. */
export function takeRemoteCommands(): DebugCommand[] {
  return queue.splice(0, queue.length);
}

/** Sends measured run numbers to the debug page. */
export function sendRunStats(stats: RunStats): void {
  if (!import.meta.hot) return;
  mark('debug send');
  import.meta.hot.send(RUN_STATS_EVENT, stats);
}

/** Tells the debug page this page is alive and what it is doing. */
export function sendHeartbeat(info: Omit<PageInfo, 'page' | 'device'>): void {
  if (!import.meta.hot) return;
  mark('debug send');
  import.meta.hot.send(HEARTBEAT_EVENT, { page: PAGE.id, device: PAGE.device, ...info });
}

/** Sends the automatic stress test's progress to the debug page. */
export function sendStressTest(report: StressTestReport): void {
  if (!import.meta.hot) return;
  mark('debug send');
  import.meta.hot.send(STRESS_TEST_EVENT, report);
}
