// Tiny labels for "what happened this frame", so the FPS counter can say what
// came before each slow frame (a goblin was built, a sound played, the panel
// redrew). Costs one Set add per mark. Frames with no mark were probably the
// browser, hand tracking or garbage collection.

export type PerfMark =
  | 'goblin built'
  | 'goblin spawn'
  | 'sound'
  | 'panel redraw'
  | 'hint sign'
  | 'price tag'
  | 'debug send'
  | 'particles'
  | 'board placed'
  | 'pebble shot';

const marks = new Set<PerfMark>();

export function mark(name: PerfMark): void {
  marks.add(name);
}

/** The marks since the last call, then clears them. */
export function takeMarks(out: PerfMark[]): PerfMark[] {
  out.length = 0;
  for (const m of marks) out.push(m);
  marks.clear();
  return out;
}
