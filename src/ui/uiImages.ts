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
/** The cream of every icon drawn in code, and the dark brown outline the tutorial markers keep (to read against the sky). */
const ICON_FILL = '#f7e2b0';
const ICON_OUTLINE = '#6d4b27';

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

/**
 * A title banner drawn in code: a red ribbon with a dark outline and a darker
 * bottom lip. The Kenney banner image has a cream frame line inside it, which
 * showed as a white box around the title, so it is not used.
 */
export function drawBanner(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const r = h * 0.18;
  const ribbon = (top: number, height: number): void => {
    c.beginPath();
    c.roundRect(x, top, w, height, r);
  };
  c.save();
  // The darker lip shows below the ribbon, like the fold of the cloth.
  ribbon(y + h * 0.1, h * 0.9);
  c.fillStyle = '#a8392f';
  c.fill();
  ribbon(y, h * 0.9);
  c.fillStyle = '#e2685c';
  c.fill();
  c.lineWidth = Math.max(2, h * 0.05);
  c.strokeStyle = '#7a2a22';
  c.stroke();
  c.restore();
}

/** Sets the largest bold font, from `size` down to `minSize`, that fits `text` in `maxWidth`. */
export function fitFont(c: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, minSize = size * 0.5): void {
  for (let s = size; s >= minSize; s -= 2) {
    c.font = `bold ${s}px sans-serif`;
    if (c.measureText(text).width <= maxWidth) return;
  }
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

export type ButtonIcon = 'next' | 'play' | 'restart' | 'pause' | 'table' | 'reach' | 'minus' | 'plus' | 'sound' | 'muted' | 'settings' | 'back' | 'access';

/**
 * A crisp button icon drawn in code (256 px), in the same look as the arrows:
 * cream fill with a brown outline. Used on the faces of all poke buttons.
 */
export function buttonIconCanvas(icon: ButtonIcon): HTMLCanvasElement {
  if (icon === 'next') return arrowCanvas('right', false);
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
  // No dark outline (it looked ugly on the buttons): the outline is the fill's own cream, so it only makes the shape a little bolder.
  c.strokeStyle = ICON_FILL;
  c.fillStyle = ICON_FILL;
  if (icon === 'minus' || icon === 'plus') {
    // A fat bar, and for plus a second one across it.
    c.lineWidth = s * 0.06;
    c.beginPath();
    c.roundRect(-s * 0.3, -s * 0.08, s * 0.6, s * 0.16, s * 0.04);
    if (icon === 'plus') c.roundRect(-s * 0.08, -s * 0.3, s * 0.16, s * 0.6, s * 0.04);
    c.fill();
    c.stroke();
    if (icon === 'plus') {
      // The crossing is filled again, so no outline shows through the middle.
      c.fillRect(-s * 0.08 + 2, -s * 0.08 + 2, s * 0.16 - 4, s * 0.16 - 4);
    }
  } else if (icon === 'sound' || icon === 'muted') {
    // A speaker: a box and a cone, then sound waves, or a cross when muted.
    c.lineWidth = s * 0.06;
    c.beginPath();
    c.moveTo(-s * 0.34, -s * 0.1);
    c.lineTo(-s * 0.18, -s * 0.1);
    c.lineTo(s * 0.02, -s * 0.28);
    c.lineTo(s * 0.02, s * 0.28);
    c.lineTo(-s * 0.18, s * 0.1);
    c.lineTo(-s * 0.34, s * 0.1);
    c.closePath();
    c.fill();
    c.stroke();
    c.lineWidth = s * 0.07;
    if (icon === 'sound') {
      for (const r of [0.14, 0.26]) {
        c.beginPath();
        c.arc(s * 0.06, 0, s * r, -0.8, 0.8);
        c.stroke();
      }
    } else {
      c.beginPath();
      c.moveTo(s * 0.14, -s * 0.14);
      c.lineTo(s * 0.36, s * 0.14);
      c.moveTo(s * 0.36, -s * 0.14);
      c.lineTo(s * 0.14, s * 0.14);
      c.stroke();
    }
  } else if (icon === 'settings') {
    // A gear: a toothed ring around a hole.
    c.lineWidth = s * 0.05;
    c.beginPath();
    const teeth = 8;
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? s * 0.36 : s * 0.27;
      const a0 = a - Math.PI / (teeth * 2) * 0.55;
      const a1 = a + Math.PI / (teeth * 2) * 0.55;
      c.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
      c.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
    }
    c.closePath();
    c.fill();
    c.stroke();
    // The hole is cut out, so the button's green shows through.
    c.beginPath();
    c.arc(0, 0, s * 0.11, 0, Math.PI * 2);
    c.globalCompositeOperation = 'destination-out';
    c.fill();
    c.globalCompositeOperation = 'source-over';
  } else if (icon === 'access') {
    // Accessibility: a round head over a figure with open arms and legs, in a ring.
    c.lineWidth = s * 0.07;
    c.beginPath();
    c.arc(0, 0, s * 0.38, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(0, -s * 0.2, s * 0.07, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = s * 0.08;
    c.beginPath();
    c.moveTo(-s * 0.22, -s * 0.07);
    c.lineTo(s * 0.22, -s * 0.07);
    c.moveTo(0, -s * 0.07);
    c.lineTo(0, s * 0.08);
    c.lineTo(-s * 0.12, s * 0.26);
    c.moveTo(0, s * 0.08);
    c.lineTo(s * 0.12, s * 0.26);
    c.stroke();
  } else if (icon === 'back') {
    // Back: an arrow pointing left.
    c.lineWidth = s * 0.06;
    c.beginPath();
    c.moveTo(-s * 0.34, 0);
    c.lineTo(-s * 0.06, -s * 0.28);
    c.lineTo(-s * 0.06, -s * 0.1);
    c.lineTo(s * 0.32, -s * 0.1);
    c.lineTo(s * 0.32, s * 0.1);
    c.lineTo(-s * 0.06, s * 0.1);
    c.lineTo(-s * 0.06, s * 0.28);
    c.closePath();
    c.fill();
    c.stroke();
  } else if (icon === 'play') {
    // A play triangle, pointing right, nudged right so it looks centered.
    c.beginPath();
    c.moveTo(s * 0.36, 0);
    c.lineTo(-s * 0.24, -s * 0.34);
    c.lineTo(-s * 0.24, s * 0.34);
    c.closePath();
    c.lineWidth = s * 0.06;
    c.fill();
    c.stroke();
  } else if (icon === 'pause') {
    // Two upright bars.
    c.lineWidth = s * 0.06;
    for (const x of [-s * 0.2, s * 0.06]) {
      c.beginPath();
      c.roundRect(x, -s * 0.3, s * 0.14, s * 0.6, s * 0.03);
      c.fill();
      c.stroke();
    }
  } else if (icon === 'table') {
    // Reset table: a round board seen from above with a down arrow onto it (placed again).
    c.lineWidth = s * 0.06;
    c.beginPath();
    c.ellipse(0, s * 0.2, s * 0.34, s * 0.13, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(0, s * 0.12);
    c.lineTo(-s * 0.16, -s * 0.06);
    c.lineTo(-s * 0.07, -s * 0.06);
    c.lineTo(-s * 0.07, -s * 0.36);
    c.lineTo(s * 0.07, -s * 0.36);
    c.lineTo(s * 0.07, -s * 0.06);
    c.lineTo(s * 0.16, -s * 0.06);
    c.closePath();
    c.fill();
    c.stroke();
  } else if (icon === 'reach') {
    // Measure reach: a double arrow between two end bars, like a tape measure.
    c.lineWidth = s * 0.06;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.roundRect(side * s * 0.36 - s * 0.04, -s * 0.24, s * 0.08, s * 0.48, s * 0.02);
      c.fill();
      c.stroke();
    }
    c.beginPath();
    c.moveTo(-s * 0.28, 0);
    c.lineTo(-s * 0.12, -s * 0.15);
    c.lineTo(-s * 0.12, -s * 0.06);
    c.lineTo(s * 0.12, -s * 0.06);
    c.lineTo(s * 0.12, -s * 0.15);
    c.lineTo(s * 0.28, 0);
    c.lineTo(s * 0.12, s * 0.15);
    c.lineTo(s * 0.12, s * 0.06);
    c.lineTo(-s * 0.12, s * 0.06);
    c.lineTo(-s * 0.12, s * 0.15);
    c.closePath();
    c.fill();
    c.stroke();
  } else {
    // Restart: a circular arrow, an open ring with an arrowhead at its end.
    const r = s * 0.27;
    const start = -Math.PI * 0.35;
    const end = Math.PI * 1.35;
    c.beginPath();
    c.arc(0, 0, r, start, end);
    c.lineWidth = s * 0.12;
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
export function arrowCanvas(direction: 'left' | 'right' | 'down', outline = true): HTMLCanvasElement {
  const key = `arrow|${direction}|${outline}`;
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
  // Outlined for the markers (they float against the sky); on a button no dark outline, it looked ugly there.
  c.strokeStyle = outline ? ICON_OUTLINE : ICON_FILL;
  c.fillStyle = ICON_FILL;
  c.fill();
  c.stroke();
  tinted.set(key, canvas);
  return canvas;
}
