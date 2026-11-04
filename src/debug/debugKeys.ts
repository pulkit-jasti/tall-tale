// Debug keyboard shortcuts, so features can be tested on a desktop or in the
// emulator without a headset. The list is also shown on the start page.

export const DEBUG_KEYS: { code: string; key: string; does: string }[] = [
  { code: 'KeyG', key: 'G', does: 'Send a group of grunts' },
  { code: 'KeyR', key: 'R', does: 'Send a group of runners' },
  { code: 'KeyC', key: 'C', does: 'A climber pops up right in front of you' },
  { code: 'KeyV', key: 'V', does: 'A climber walks in on a random road' },
  { code: 'KeyT', key: 'T', does: 'Auto spawning on or off' },
  { code: 'KeyK', key: 'K', does: 'Remove all goblins' },
  { code: 'KeyB', key: 'B', does: 'Eat the goblin nearest the front of the wall' },
  { code: 'KeyQ', key: 'Q / E', does: 'Turn the board left / right (hold)' },
  { code: 'KeyZ', key: 'Z / X', does: 'Board down / up (hold)' },
  { code: 'KeyP', key: 'P', does: 'Place the board again in front of you' },
  { code: 'KeyF', key: 'F', does: 'FPS counter on or off (add ?fps to the URL to show it on the hosted build)' },
  { code: '', key: 'Mouse', does: 'Drag to look around, scroll to zoom (browser only)' },
];
