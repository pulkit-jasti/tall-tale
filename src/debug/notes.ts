// Short notes from the game for the laptop debug page (its "notes" column):
// the last few things worth knowing while testing in the headset, where the
// browser console cannot be seen (a knight that got stuck, what the bell did,
// what paused the game). Each note also goes to the console. Cheap: a small
// ring of strings, sent with the page's heartbeat.

const MAX_NOTES = 4;
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
}

/** The last notes, newest first, one per line. */
export function recentNotes(): string {
  return notes.map((n) => `${new Date(n.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ${n.text}`).join('\n');
}
