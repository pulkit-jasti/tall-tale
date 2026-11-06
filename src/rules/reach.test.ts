import { describe, expect, it } from 'vitest';
import { BOARD, END_PANEL, PAUSE, UI_ZONE } from '../config/game.js';
import { fitsUiZone, reachDistance, reachSpots, reachZone, uiCenterY } from './reach.js';

const EYES = BOARD.eyeToBoard * 100;

describe('UI zone', () => {
  it('keeps every menu panel between the highest and lowest spot, centered when it can', () => {
    const panels: [number, number][] = [
      [END_PANEL.height, END_PANEL.tiltDeg],
      [PAUSE.panel.height, PAUSE.panel.tiltDeg],
      [PAUSE.settings.height, PAUSE.panel.tiltDeg],
    ];
    for (const [height, tilt] of panels) {
      expect(fitsUiZone(height, tilt)).toBe(true);
      const center = uiCenterY(height, tilt);
      const half = (height / 2) * Math.cos((tilt * Math.PI) / 180);
      expect(center + half).toBeLessThanOrEqual(EYES + UI_ZONE.highestAboveEyes + 1e-6);
      expect(center - half).toBeGreaterThanOrEqual(EYES - UI_ZONE.lowestBelowEyes - 1e-6);
    }
    // A short panel sits right at the chosen spot below the eyes.
    expect(uiCenterY(10, 0)).toBeCloseTo(EYES - UI_ZONE.centerBelowEyes);
  });

  it('keeps the menu buttons in reach', () => {
    for (const spot of reachSpots().filter((s) => /panel|settings/.test(s.name))) {
      const zone = reachZone(reachDistance(spot.radius, spot.y));
      expect(spot.rare ? zone !== 'tooFar' && zone !== 'tooClose' : zone === 'sweet', spot.name).toBe(true);
    }
  });
});
