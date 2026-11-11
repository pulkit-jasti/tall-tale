// The reach band (docs/controls-and-ui.md "Reach band"): every grab, pinch
// and poke target must be a comfortable reach from the seat. Distances are
// measured from the eyes, which sit BOARD.eyeToBoard above the board when it
// is placed. No Three.js here.
import {
  BALLOONS,
  BELL,
  BOARD,
  CASTLE,
  END_PANEL,
  HANDLES,
  HINT_SIGN,
  HORN,
  PAUSE,
  PEBBLE_BOWL,
  PEPPER,
  POKE,
  REACH,
  SLINGSHOT,
  SWATTER,
  TOOL_SPOTS,
  UI_SPACING,
  UI_ZONE,
} from '../config/game.js';

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

/** The eyes' height above the board (cm, default board). */
const EYES = BOARD.eyeToBoard * 100;

/**
 * Where a panel's middle goes (cm above the board) for UI_ZONE: right in
 * front, centerBelowEyes below the eyes, moved so its top and bottom stay
 * inside the zone. `height` is the panel's, tilted back `tiltDeg`.
 */
export function uiCenterY(height: number, tiltDeg: number): number {
  const half = (height / 2) * Math.cos((tiltDeg * Math.PI) / 180);
  let center = EYES - UI_ZONE.centerBelowEyes;
  center = Math.min(center, EYES + UI_ZONE.highestAboveEyes - half);
  center = Math.max(center, EYES - UI_ZONE.lowestBelowEyes + half);
  return center;
}

/** The settings page's tab row, below everything: its y on the panel (cm from its middle). */
export function settingsTabRowY(): number {
  const S = PAUSE.settings;
  return -S.height / 2 + S.tabRadius * POKE.rimScale + UI_SPACING.edge;
}

/** True if a panel this tall fits inside UI_ZONE at all. */
export function fitsUiZone(height: number, tiltDeg: number): boolean {
  return height * Math.cos((tiltDeg * Math.PI) / 180) <= UI_ZONE.highestAboveEyes + UI_ZONE.lowestBelowEyes;
}

/** Every interactive spot (cm from the seat, cm above the board), and whether it may sit past the sweet spot. */
export function reachSpots(): { name: string; radius: number; y: number; rare?: boolean }[] {
  const top = TOOL_SPOTS.platformTop;
  // A spot on a tilted panel, `y` cm up from its middle (negative is down): the tilt brings low spots closer and lifts them less.
  const onPanel = (panelRadius: number, centerY: number, tiltDeg: number, y: number, side = 0): { radius: number; y: number } => {
    const tilt = (tiltDeg * Math.PI) / 180;
    return { radius: Math.hypot(panelRadius + y * Math.sin(tilt), side), y: centerY + y * Math.cos(tilt) };
  };
  // The end panel's button, at the bottom of the panel.
  const E = END_PANEL;
  const endButton = onPanel(E.radius, uiCenterY(E.height, E.tiltDeg), E.tiltDeg, -(E.height / 2 - E.buttonRadius * POKE.rimScale - E.buttonMargin));
  // The pause panel's buttons, four in a row (the outer ones a little farther, to the sides).
  const P = PAUSE.panel;
  const pauseCenter = uiCenterY(P.height, P.tiltDeg);
  const pauseDown = -(P.height / 2 - P.buttonRadius * POKE.rimScale - P.buttonMargin);
  // A balloon rider's middle: it stands on the basket's floor (src/units/balloons.ts), a grunt 3.9 cm tall.
  const riderMiddle = BALLOONS.height - (BALLOONS.radius * 1.15 + 4.2 + BALLOONS.basketHeight / 2 - 0.2) + 3.9 * 0.5;
  // The settings page: its lowest sound row, Back (top left) and the tabs (bottom row).
  const S = PAUSE.settings;
  const settingsCenter = uiCenterY(S.height, P.tiltDeg);
  const lowestRow = onPanel(P.radius, settingsCenter, P.tiltDeg, S.firstRowY - 4 * S.rowGap, S.sliderX + S.sliderLength / 2);
  const backButton = onPanel(P.radius, settingsCenter, P.tiltDeg, S.backAt[1], S.backAt[0]);
  const tabRow = onPanel(P.radius, settingsCenter, P.tiltDeg, settingsTabRowY(), Math.max(...S.tabX.map(Math.abs)));
  return [
    { name: 'ring handle', radius: HANDLES.radius, y: HANDLES.ringY },
    { name: 'slingshot handle', radius: TOOL_SPOTS.slingshot.radius, y: top + SLINGSHOT.handleHeight / 2 },
    { name: 'pebble bowl', radius: PEBBLE_BOWL.radius, y: PEBBLE_BOWL.rimY },
    { name: 'swatter grip', radius: TOOL_SPOTS.leftSide.radius, y: top + (SWATTER.gripFrom + SWATTER.gripTo) / 2 },
    { name: 'pepper grip', radius: TOOL_SPOTS.leftFront.radius, y: top + (PEPPER.gripFrom + PEPPER.gripTo) / 2 },
    { name: 'bell handle', radius: TOOL_SPOTS.leftMiddle.radius, y: top + BELL.bellHeight + (BELL.gripFrom + BELL.gripTo) / 2 },
    { name: 'horn grip', radius: TOOL_SPOTS.rightSide.radius, y: top + HORN.restLift + (HORN.gripFrom + HORN.gripTo) / 2 },
    // At the pause button's height, so like it a little past the sweet spot.
    { name: 'hint Next button', radius: HINT_SIGN.nextAt, y: HINT_SIGN.nextY, rare: true },
    // Lower than Next so it does not block the view: a little past the sweet spot, fine for a button poked now and then.
    { name: 'pause button', radius: PAUSE.button.at, y: PAUSE.button.y, rare: true },
    { name: 'end panel button', ...endButton },
    {
      name: 'welcome panel Settings button',
      ...onPanel(
        E.radius,
        uiCenterY(E.height, E.tiltDeg),
        E.tiltDeg,
        -(E.height / 2 - E.settingsRadius * POKE.rimScale - E.buttonMargin),
        E.width / 2 - E.settingsRadius * POKE.rimScale - E.buttonMargin,
      ),
    },
    // Four in a row: Resume, Settings, Restart, Skip tutorial.
    { name: 'pause panel middle buttons', ...onPanel(P.radius, pauseCenter, P.tiltDeg, pauseDown, P.buttonGap / 2) },
    { name: 'pause panel outer buttons', ...onPanel(P.radius, pauseCenter, P.tiltDeg, pauseDown, 1.5 * P.buttonGap) },
    { name: 'settings lowest row (slider end)', ...lowestRow, rare: true },
    { name: 'settings Back (top left)', ...backButton, rare: true },
    { name: 'settings tabs (bottom row)', ...tabRow, rare: true },
    { name: 'climber on the rampart', radius: CASTLE.rampartRadius, y: CASTLE.wallHeight + 2, rare: true },
    { name: 'intruder at the courtyard edge', radius: CASTLE.courtyardMax, y: 2, rare: true },
    // A balloon rider while it is dropped into the courtyard (its middle, standing in the basket), and as it crosses the wall.
    { name: 'balloon rider over the courtyard', radius: BALLOONS.dropRadius, y: riderMiddle },
    { name: 'balloon rider over the wall', radius: CASTLE.wallOut, y: riderMiddle, rare: true },
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
  // Every menu panel must fit between the highest and lowest spot UI may reach.
  const panels: [string, number, number][] = [
    ['end panel', END_PANEL.height, END_PANEL.tiltDeg],
    ['pause panel', PAUSE.panel.height, PAUSE.panel.tiltDeg],
    ['settings page', PAUSE.settings.height, PAUSE.panel.tiltDeg],
  ];
  for (const [name, height, tilt] of panels) {
    if (!fitsUiZone(height, tilt)) console.warn(`[reach] the ${name} is too tall for UI_ZONE in src/config/game.ts: make it shorter`);
  }
}
