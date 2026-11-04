// Kenney UI images (public/ui/README.md), drawn onto canvas textures for the
// hint sign and the panels. Loaded once at start. A missing image is skipped,
// so the panels still work with plain shapes.

const FILES = {
  panel: 'rpg/panel_beige.png',
  panelInset: 'rpg/panelInset_beige.png',
  panelDark: 'adventure/panel_brown.png',
  banner: 'adventure/banner_hanging.png',
  checkOn: 'adventure/checkbox_beige_checked.png',
  checkOff: 'adventure/checkbox_beige_empty.png',
  hand: 'rpg/cursorHand_beige.png',
  gauntlet: 'rpg/cursorGauntlet_bronze.png',
  arrowLeft: 'rpg/arrowBeige_left.png',
  arrowRight: 'rpg/arrowBeige_right.png',
  marker: 'adventure/minimap_icon_exclamation_yellow.png',
  star: 'adventure/minimap_icon_star_yellow.png',
  up: 'icons/arrowUp.png',
  down: 'icons/arrowDown.png',
  check: 'icons/checkmark.png',
  info: 'icons/information.png',
  trophy: 'icons/trophy.png',
  warning: 'icons/warning.png',
  target: 'icons/target.png',
  returnArrow: 'icons/return.png',
  buttonLong: 'rpg/buttonLong_brown.png',
} as const;

export type UiImageName = keyof typeof FILES;

const images = new Map<UiImageName, HTMLImageElement>();

/** Loads every UI image. Call once before the panels are drawn. */
export async function loadUiImages(): Promise<void> {
  await Promise.all(
    (Object.keys(FILES) as UiImageName[]).map(
      (name) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.onload = () => {
            images.set(name, image);
            resolve();
          };
          image.onerror = () => {
            console.warn(`[ui] could not load ${FILES[name]}`);
            resolve();
          };
          image.src = `${import.meta.env.BASE_URL}ui/${FILES[name]}`;
        }),
    ),
  );
}

export function uiImage(name: UiImageName): HTMLImageElement | null {
  return images.get(name) ?? null;
}

/**
 * Draws a panel image stretched to a box without stretching its corners
 * (9-slice). `edge` is the corner size in the image, `edgeOut` on the canvas.
 */
export function drawNineSlice(
  c: CanvasRenderingContext2D,
  name: UiImageName,
  x: number,
  y: number,
  w: number,
  h: number,
  edge: number,
  edgeOut = edge,
): boolean {
  const image = uiImage(name);
  if (!image) return false;
  const iw = image.width;
  const ih = image.height;
  const sx = [0, edge, iw - edge, iw];
  const sy = [0, edge, ih - edge, ih];
  const dx = [x, x + edgeOut, x + w - edgeOut, x + w];
  const dy = [y, y + edgeOut, y + h - edgeOut, y + h];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const sw = sx[col + 1] - sx[col];
      const sh = sy[row + 1] - sy[row];
      const dw = dx[col + 1] - dx[col];
      const dh = dy[row + 1] - dy[row];
      if (sw > 0 && sh > 0 && dw > 0 && dh > 0) c.drawImage(image, sx[col], sy[row], sw, sh, dx[col], dy[row], dw, dh);
    }
  }
  return true;
}

/** Draws an icon fitted into a square, optionally tinted (white icons take any color). */
export function drawIcon(c: CanvasRenderingContext2D, name: UiImageName, x: number, y: number, size: number, tint?: string): void {
  const image = uiImage(name);
  if (!image) return;
  if (!tint) {
    c.drawImage(image, x, y, size, size);
    return;
  }
  // Tint on a small scratch canvas, so the panel's own pixels are not touched.
  const scratch = tintCanvas(image, tint);
  c.drawImage(scratch, x, y, size, size);
}

const tinted = new Map<string, HTMLCanvasElement>();

function tintCanvas(image: HTMLImageElement, tint: string): HTMLCanvasElement {
  const key = `${image.src}|${tint}`;
  let canvas = tinted.get(key);
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const c = canvas.getContext('2d')!;
  c.drawImage(image, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = tint;
  c.fillRect(0, 0, canvas.width, canvas.height);
  tinted.set(key, canvas);
  return canvas;
}

/** Splits text into lines that fit a width with the current font. */
export function wrapText(c: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (c.measureText(next).width > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Image as a texture source for a sprite (markers), or null if it did not load. */
export function iconTextureSource(name: UiImageName, tint?: string): HTMLImageElement | HTMLCanvasElement | null {
  const image = uiImage(name);
  if (!image) return null;
  return tint ? tintCanvas(image, tint) : image;
}
