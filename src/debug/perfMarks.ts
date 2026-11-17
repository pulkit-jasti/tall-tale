// Tiny labels for "what happened this frame", so the FPS counter can say what
// came before each slow frame (a goblin was built, a sound played, the panel
// redrew). Costs one Set add per mark. Frames with no mark were probably the
// browser, hand tracking or garbage collection.

export type PerfMark =
  | 'goblin built'
  | 'goblin spawn'
  | 'warm gpu'
  | 'armor hit'
  | 'gear debris'
  | 'shield hit'
  | 'sound'
  | 'panel redraw'
  | 'hint sign'
  | 'horn'
  | 'knight charge'
  | 'debug send'
  | 'particles'
  | 'board placed'
  | 'pebble shot'
  | 'troop built'
  | 'troop spawn'
  | 'trigger'
  | 'balloon spawn'
  | 'gear'
  | 'juice'
  | 'time of day'
  | 'map load'
  | 'horn path'
  | 'horn ghosts built'
  | 'knight boost'
  | 'night fog'
  | 'trap back'
  | 'trophy toast'
  // v3 Phase 3: the new goblins.
  | 'digger up'
  | 'shaman cast'
  | 'bomber blast'
  | 'goblin volley'
  | 'card tap'
  | 'texture upload';

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
