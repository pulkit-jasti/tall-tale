// The UI fonts. Two on purpose (headset test 2026-11-18: Fredoka everywhere
// looked hazy in small text, being wide and round):
// - UI_FONT, the plain system sans-serif, for all small and body text (hints,
//   descriptions, rows, the compass, signs): the sharpest in the headset.
// - DISPLAY_FONT, Fredoka (SIL Open Font License, public/fonts/OFL.txt,
//   @font-face in index.html), for big text only: panel titles, title
//   banners, tabs and the big call to action buttons. Always at
//   DISPLAY_WEIGHT (600), since its bold closes up the holes in letters.
// Canvas text is drawn once into a texture, so Fredoka must be loaded before
// the first panel is drawn: wait for `uiFontReady` before building the game.

/** Small and body text: `bold 20px ${UI_FONT}`. */
export const UI_FONT = 'sans-serif';

/** Big text only (titles, banners, tabs, call to action buttons), always with DISPLAY_WEIGHT. */
export const DISPLAY_FONT = "'Fredoka', sans-serif";

/** Fredoka's weight: lighter than bold, so it stays open and sharp. */
export const DISPLAY_WEIGHT = 600;

/** A canvas font string: bold system text, or Fredoka at its display weight. */
export function fontSpec(size: number, display = false): string {
  return display ? `${DISPLAY_WEIGHT} ${size}px ${DISPLAY_FONT}` : `bold ${size}px ${UI_FONT}`;
}

/** Resolves once Fredoka is loaded, or after 3 s / on failure, so a missing font never blocks the game. */
export const uiFontReady: Promise<void> = Promise.race([
  document.fonts.load(`${DISPLAY_WEIGHT} 32px ${DISPLAY_FONT}`).then(() => undefined),
  new Promise<void>((resolve) => window.setTimeout(resolve, 3000)),
]).catch(() => undefined);
