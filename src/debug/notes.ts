// Short notes from the game for the laptop debug page (its "notes" column):
// the last few things worth knowing while testing in the headset, where the
// browser console cannot be seen (a knight that got stuck, what the bell did,
// what paused the game). Each note also goes to the console. Cheap: a small
// ring of strings, sent with the page's heartbeat.

const MAX_NOTES = 4;
const notes: string[] = [];

/** Keeps a note (newest first on the debug page) and logs it. */
export function note(text: string): void {
  console.info(text);
  const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  notes.unshift(`${at} ${text}`);
  if (notes.length > MAX_NOTES) notes.length = MAX_NOTES;
}

/** The last notes, newest first, one per line. */
export function recentNotes(): string {
  return notes.join('\n');
}
