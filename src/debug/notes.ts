// Short notes from the game for the laptop debug page (its "notes" column):
// the last few things worth knowing while testing in the headset, where the
// browser console cannot be seen (a knight that got stuck, what the bell did,
// what paused the game). Each note also goes to the console. Cheap: a small
// ring of strings, sent with the page's heartbeat.

const MAX_NOTES = 12;
const notes: { at: number; text: string }[] = [];

/**
 * Keeps a note (newest first on the debug page). 2026-11-17: cheap enough for gameplay events (heals, drum
 * strikes, trophies): no time formatting here (done when the notes are read) and the console only on the
 * dev server (console logging is slow on the Quest).
 */
export function note(text: string): void {
  if (import.meta.env.DEV) console.info(text);
  notes.unshift({ at: Date.now(), text });
  if (notes.length > MAX_NOTES) notes.length = MAX_NOTES;
  notesText = null;
}

/** One shared time format (a new one on each call was slow on the Quest), and the notes' text, made again only after a new note. */
const clock = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
let notesText: string | null = null;

/** When each guarded part last noted an error (ms), so one failing every frame notes once a few seconds. */
const lastError = new Map<string, number>();

/**
 * Runs one part of a frame on its own: an error in it is caught (the rest of the frame goes on), logged,
 * and noted on the debug page with the part's name and where in the code it was thrown (2026-11-17).
 */
export function guarded(part: string, run: () => void): void {
  try {
    run();
  } catch (error) {
    const now = Date.now();
    if (now - (lastError.get(part) ?? 0) < 3000) return;
    lastError.set(part, now);
    console.error(`[${part}]`, error);
    const e = error as Error;
    const where = e?.stack?.split('\n').find((l) => l.includes('/src/')) ?? '';
    note(`[error] ${part}: ${e?.message ?? String(error)} ${where.trim()}`);
  }
}

/** The last notes, newest first, one per line. */
export function recentNotes(): string {
  if (notesText === null) notesText = notes.map((n) => `${clock.format(n.at)} ${n.text}`).join('\n');
  return notesText;
}
