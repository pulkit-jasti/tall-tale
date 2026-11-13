import { describe, expect, it } from 'vitest';
import { angleTo, bottomRowY, clamp01, panelMap, rowX, stepValue } from './layout.js';

describe('UI layout math', () => {
  it('spaces a row evenly around the middle', () => {
    [-13.2, -4.4, 4.4, 13.2].forEach((x, i) => expect(rowX(i, 4, 8.8)).toBeCloseTo(x));
    expect(rowX(0, 1, 5)).toBe(0);
  });

  it('keeps a bottom row inside the panel edge', () => {
    expect(bottomRowY(23, 3.77, 1.2)).toBeCloseTo(-11.5 + 3.77 + 1.2);
  });

  it('maps panel cm to layout pixels (y down from the top)', () => {
    const at = panelMap(40, 20, 400, 200);
    expect(at.px).toBe(10);
    expect(at.x(0)).toBe(200);
    expect(at.x(-20)).toBe(0);
    expect(at.y(10)).toBe(0);
    expect(at.y(-10)).toBe(200);
  });

  it('steps a value on its grid and keeps it between 0 and 1', () => {
    expect(stepValue(0.5, 0.1, 10)).toBeCloseTo(0.6);
    expect(stepValue(0.53, 0.1, 10)).toBeCloseTo(0.6);
    expect(stepValue(0.95, 0.1, 10)).toBe(1);
    expect(stepValue(0.02, -0.1, 10)).toBe(0);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
  });

  it('turns the short way round', () => {
    expect(angleTo(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(angleTo(Math.PI * 0.9, -Math.PI * 0.9)).toBeCloseTo(Math.PI * 0.2);
  });
});
