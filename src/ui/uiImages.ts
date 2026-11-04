// Kenney UI images (public/ui/README.md), drawn onto canvas textures for the
// hint sign and the panels. Loaded once at start. A missing image is skipped,
// so the panels still work with plain shapes.
//
// Sharpness: an image must have at least as many pixels as it covers on
// screen, or it looks blocky in the headset. Small icons come from the SVG
// versions (public/ui/vector/), drawn at any size. PNGs are only used where
// they are big enough (panels, the banner, the 100 px game icons).

const FILES = {
  panel: 'rpg/panel_beige.png',
  panelInset: 'rpg/panelInset_beige.png',
  banner: 'adventure/banner_hanging.png',
  checkOn: 'vector/checkbox_beige_checked.svg',
  checkOff: 'vector/checkbox_beige_empty.svg',
  marker: 'vector/minimap_icon_exclamation_yellow.svg',
  star: 'vector/minimap_icon_star_yellow.svg',
  up: 'icons/arrowUp.png',
  check: 'icons/checkmark.png',
  info: 'icons/information.png',
  trophy: 'icons/trophy.png',
  warning: 'icons/warning.png',
  target: 'icons/target.png',
  returnArrow: 'icons/return.png',
  next: 'icons/next.png',
} as const;

/** Long side of an SVG drawn into a texture of its own (pixels). */
const RASTER_SIZE = 256;

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

function tintCanvas(image: HTMLImageElement, tint?: string): HTMLCanvasElement {
  const key = `${image.src}|${tint ?? ''}`;
  let canvas = tinted.get(key);
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  // SVGs are drawn big, so they stay sharp. PNGs keep their own size.
  const svg = image.src.endsWith('.svg');
  const scale = svg ? RASTER_SIZE / Math.max(image.width, image.height, 1) : 1;
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const c = canvas.getContext('2d')!;
  c.drawImage(image, 0, 0, canvas.width, canvas.height);
  if (tint) {
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = tint;
    c.fillRect(0, 0, canvas.width, canvas.height);
  }
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

/** Image as a texture source for a sprite (markers), drawn at full sharpness, or null if it did not load. */
export function iconTextureSource(name: UiImageName, tint?: string): HTMLCanvasElement | null {
  const image = uiImage(name);
  return image ? tintCanvas(image, tint) : null;
}

export type ButtonIcon = 'next' | 'play' | 'restart';

/**
 * A crisp button icon drawn in code (256 px), in the same look as the arrows:
 * cream fill with a brown outline. Used on the faces of all poke buttons.
 */
export function buttonIconCanvas(icon: ButtonIcon): HTMLCanvasElement {
  if (icon === 'next') return arrowCanvas('right');
  const key = `button|${icon}`;
  const cached = tinted.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = RASTER_SIZE;
  const c = canvas.getContext('2d')!;
  const s = RASTER_SIZE;
  c.translate(s / 2, s / 2);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = '#6d4b27';
  c.fillStyle = '#f7e2b0';
  if (icon === 'play') {
    // A play triangle, pointing right, nudged right so it looks centered.
    c.beginPath();
    c.moveTo(s * 0.36, 0);
    c.lineTo(-s * 0.24, -s * 0.34);
    c.lineTo(-s * 0.24, s * 0.34);
    c.closePath();
    c.lineWidth = s * 0.06;
    c.fill();
    c.stroke();
  } else {
    // Restart: a circular arrow, an open ring with an arrowhead at its end.
    const r = s * 0.27;
    const start = -Math.PI * 0.35;
    const end = Math.PI * 1.35;
    c.beginPath();
    c.arc(0, 0, r, start, end);
    c.lineWidth = s * 0.17;
    c.strokeStyle = '#6d4b27';
    c.stroke();
    c.lineWidth = s * 0.09;
    c.strokeStyle = '#f7e2b0';
    c.stroke();
    // Arrowhead at the start of the ring, pointing along it (clockwise).
    const ax = Math.cos(start) * r;
    const ay = Math.sin(start) * r;
    const tangent = start + Math.PI / 2;
    const tx = Math.cos(tangent);
    const ty = Math.sin(tangent);
    const nx = Math.cos(start);
    const ny = Math.sin(start);
    const head = s * 0.16;
    c.beginPath();
    c.moveTo(ax - tx * head * 1.1, ay - ty * head * 1.1);
    c.lineTo(ax + nx * head + tx * head * 0.2, ay + ny * head + ty * head * 0.2);
    c.lineTo(ax - nx * head + tx * head * 0.2, ay - ny * head + ty * head * 0.2);
    c.closePath();
    c.lineWidth = s * 0.05;
    c.strokeStyle = '#6d4b27';
    c.fill();
    c.stroke();
  }
  tinted.set(key, canvas);
  return canvas;
}

/**
 * A crisp arrow drawn in code (256 px), in the Kenney look: cream fill with a
 * brown outline. `direction` is where it points.
 */
export function arrowCanvas(direction: 'left' | 'right' | 'down'): HTMLCanvasElement {
  const key = `arrow|${direction}`;
  const cached = tinted.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = RASTER_SIZE;
  const c = canvas.getContext('2d')!;
  const s = RASTER_SIZE;
  c.translate(s / 2, s / 2);
  // Drawn pointing right, then turned.
  c.rotate(direction === 'left' ? Math.PI : direction === 'down' ? Math.PI / 2 : 0);
  c.beginPath();
  c.moveTo(s * 0.42, 0);
  c.lineTo(s * 0.02, -s * 0.36);
  c.lineTo(s * 0.02, -s * 0.15);
  c.lineTo(-s * 0.4, -s * 0.15);
  c.lineTo(-s * 0.4, s * 0.15);
  c.lineTo(s * 0.02, s * 0.15);
  c.lineTo(s * 0.02, s * 0.36);
  c.closePath();
  c.lineJoin = 'round';
  c.lineWidth = s * 0.06;
  c.strokeStyle = '#6d4b27';
  c.fillStyle = '#f7e2b0';
  c.fill();
  c.stroke();
  tinted.set(key, canvas);
  return canvas;
}
