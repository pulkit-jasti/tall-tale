// The reach band (docs/controls-and-ui.md "Reach band"): every grab, pinch
// and poke target must be a comfortable reach from the seat. Distances are
// measured from the eyes, which sit BOARD.eyeToBoard above the board when it
// is placed. No Three.js here.
import { BELL, BOARD, CASTLE, END_PANEL, HANDLES, HINT_SIGN, MEGAPHONE, PAUSE, PEBBLE_BOWL, PEPPER, POKE, REACH, SLINGSHOT, SWATTER, TOOL_SPOTS } from '../config/game.js';

export type ReachZone = 'tooClose' | 'close' | 'sweet' | 'far' | 'tooFar';

/** Distance from the eyes (cm) to a spot `radius` cm out from the seat and `y` cm above the board. */
export function reachDistance(radius: number, y: number): number {
  return Math.hypot(radius, BOARD.eyeToBoard * 100 - y);
}

export function reachZone(distance: number): ReachZone {
  if (distance < REACH.tooClose) return 'tooClose';
  if (distance < REACH.sweetMin) return 'close';
  if (distance <= REACH.sweetMax) return 'sweet';
  if (distance <= REACH.max) return 'far';
  return 'tooFar';
}

/** Every interactive spot (cm from the seat, cm above the board), and whether it may sit past the sweet spot. */
export function reachSpots(): { name: string; radius: number; y: number; rare?: boolean }[] {
  const top = TOOL_SPOTS.platformTop;
  // The end panel's button: at the bottom of the tilted panel, so the tilt brings it a little closer and higher.
  const tilt = (END_PANEL.tiltDeg * Math.PI) / 180;
  const endButtonDown = END_PANEL.height / 2 - END_PANEL.buttonRadius * POKE.rimScale - END_PANEL.buttonMargin;
  const endButtonY = END_PANEL.y - endButtonDown * Math.cos(tilt);
  const endButtonRadius = END_PANEL.radius - endButtonDown * Math.sin(tilt);
  // The pause panel's buttons: the same way, four in a row (the outer ones a little farther, to the sides).
  const P = PAUSE.panel;
  const pauseTilt = (P.tiltDeg * Math.PI) / 180;
  const pauseDown = P.height / 2 - P.buttonRadius * POKE.rimScale - P.buttonMargin;
  const pauseY = P.y - pauseDown * Math.cos(pauseTilt);
  const pauseOut = P.radius - pauseDown * Math.sin(pauseTilt);
  const pauseSide = 1.5 * P.buttonGap;
  return [
    { name: 'ring handle', radius: HANDLES.radius, y: HANDLES.ringY },
    { name: 'slingshot handle', radius: TOOL_SPOTS.slingshot.radius, y: top + SLINGSHOT.handleHeight / 2 },
    { name: 'pebble bowl', radius: PEBBLE_BOWL.radius, y: PEBBLE_BOWL.rimY },
    { name: 'swatter grip', radius: TOOL_SPOTS.leftSide.radius, y: top + (SWATTER.gripFrom + SWATTER.gripTo) / 2 },
    { name: 'pepper grip', radius: TOOL_SPOTS.leftFront.radius, y: top + (PEPPER.gripFrom + PEPPER.gripTo) / 2 },
    { name: 'bell handle', radius: TOOL_SPOTS.rightSide.radius, y: top + BELL.bellHeight + (BELL.gripFrom + BELL.gripTo) / 2 },
    { name: 'megaphone grip', radius: TOOL_SPOTS.rightSide.radius, y: top + (MEGAPHONE.gripFrom + MEGAPHONE.gripTo) / 2 },
    { name: 'hint Next button', radius: HINT_SIGN.nextAt, y: HINT_SIGN.nextY },
    { name: 'end panel button', radius: endButtonRadius, y: endButtonY },
    { name: 'pause panel middle buttons', radius: Math.hypot(pauseOut, P.buttonGap / 2), y: pauseY },
    { name: 'pause panel outer buttons', radius: Math.hypot(pauseOut, pauseSide), y: pauseY },
    { name: 'climber on the rampart', radius: CASTLE.rampartRadius, y: CASTLE.wallHeight + 2, rare: true },
    { name: 'intruder at the courtyard edge', radius: CASTLE.courtyardMax, y: 2, rare: true },
  ];
}

/** Dev check at start: warns about any spot outside the band (rare spots may sit up to REACH.max). */
export function checkReach(): void {
  for (const spot of reachSpots()) {
    const d = reachDistance(spot.radius, spot.y);
    const zone = reachZone(d);
    const ok = zone === 'sweet' || (spot.rare && (zone === 'far' || zone === 'close'));
    if (!ok) console.warn(`[reach] ${spot.name} is ${d.toFixed(0)} cm from the eyes (${zone}), see REACH in src/config/game.ts`);
  }
}
