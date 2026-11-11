// Layout math for panels and their controls, shared by every panel. No
// Three.js here, so it can be tested on its own. Panel space is cm from the
// panel's middle (x right, y up); layout space is the panel's canvas in
// layout pixels (x right, y down from the top left).

/** The middle of item `i` of `count` in a row, `gap` apart, centered on 0. */
export function rowX(i: number, count: number, gap: number): number {
  return (i - (count - 1) / 2) * gap;
}

/** The middle of a button row along a panel's bottom edge: the button's rim keeps `margin` from the edge. */
export function bottomRowY(panelHeight: number, rimRadius: number, margin: number): number {
  return -panelHeight / 2 + rimRadius + margin;
}

/** Panel cm to layout pixels, for drawing labels next to the controls placed in cm. */
export interface PanelMap {
  x(cm: number): number;
  y(cm: number): number;
  /** Layout pixels per cm. */
  px: number;
}

export function panelMap(panelWidth: number, panelHeight: number, layoutWidth: number, layoutHeight: number): PanelMap {
  const px = layoutWidth / panelWidth;
  return {
    px,
    x: (cm) => layoutWidth / 2 + cm * px,
    y: (cm) => ((panelHeight / 2 - cm) / panelHeight) * layoutHeight,
  };
}

/** Values from 0 to 1. */
export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** A value moved by `step` and rounded to the step grid (`steps` from one end to the other), so steps always land on the same values. */
export function stepValue(value: number, step: number, steps: number): number {
  return clamp01(Math.round((value + step) * steps) / steps);
}

/** The shortest turn from angle `from` to angle `to` (radians, from -PI to PI). */
export function angleTo(from: number, to: number): number {
  // No loop: a bad angle can never hang the game.
  const d = to - from;
  if (!Number.isFinite(d)) return 0;
  return d - Math.round(d / (Math.PI * 2)) * Math.PI * 2;
}
