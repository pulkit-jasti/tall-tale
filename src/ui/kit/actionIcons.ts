// Button icons for the Custom Game pages (docs/custom-mode.md section 8):
// yes and no (a tick and a cross), edit (a pencil), duplicate (two sheets),
// delete (a bin), share (three linked dots), the seed's dice, and a plain dot
// for a choice that is not picked. Drawn in code around (0, 0), `s` the
// icon canvas size, in the fill color the button icons use (set by the
// caller as fillStyle and strokeStyle).

export type ActionIcon = 'tick' | 'cross' | 'edit' | 'copy' | 'trash' | 'share' | 'dice' | 'dot';

export const ACTION_ICONS: readonly ActionIcon[] = ['tick', 'cross', 'edit', 'copy', 'trash', 'share', 'dice', 'dot'];

export function drawActionIcon(c: CanvasRenderingContext2D, icon: ActionIcon, s: number): void {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  switch (icon) {
    case 'tick':
      c.lineWidth = s * 0.13;
      c.beginPath();
      c.moveTo(-s * 0.27, s * 0.02);
      c.lineTo(-s * 0.08, s * 0.22);
      c.lineTo(s * 0.29, -s * 0.2);
      c.stroke();
      break;
    case 'cross':
      c.lineWidth = s * 0.13;
      c.beginPath();
      c.moveTo(-s * 0.22, -s * 0.22);
      c.lineTo(s * 0.22, s * 0.22);
      c.moveTo(s * 0.22, -s * 0.22);
      c.lineTo(-s * 0.22, s * 0.22);
      c.stroke();
      break;
    case 'edit': {
      // A pencil leaning right: the body, its tip, and a line to write on.
      c.save();
      c.rotate(-Math.PI / 4);
      c.lineWidth = s * 0.05;
      c.beginPath();
      c.roundRect(-s * 0.08, -s * 0.34, s * 0.16, s * 0.48, s * 0.03);
      c.fill();
      c.beginPath();
      c.moveTo(-s * 0.08, s * 0.16);
      c.lineTo(0, s * 0.32);
      c.lineTo(s * 0.08, s * 0.16);
      c.closePath();
      c.fill();
      c.restore();
      c.lineWidth = s * 0.05;
      c.beginPath();
      c.moveTo(-s * 0.3, s * 0.32);
      c.lineTo(s * 0.05, s * 0.32);
      c.stroke();
      break;
    }
    case 'copy':
      // Two sheets, the front one solid, the back one an outline.
      c.lineWidth = s * 0.06;
      c.beginPath();
      c.roundRect(-s * 0.26, -s * 0.3, s * 0.36, s * 0.44, s * 0.05);
      c.stroke();
      c.beginPath();
      c.roundRect(-s * 0.08, -s * 0.12, s * 0.36, s * 0.44, s * 0.05);
      c.fill();
      break;
    case 'trash':
      // A bin: the lid with its handle, then the body with two grooves cut out.
      c.lineWidth = s * 0.05;
      c.beginPath();
      c.roundRect(-s * 0.3, -s * 0.24, s * 0.6, s * 0.08, s * 0.03);
      c.roundRect(-s * 0.08, -s * 0.32, s * 0.16, s * 0.1, s * 0.03);
      c.fill();
      c.beginPath();
      c.moveTo(-s * 0.23, -s * 0.12);
      c.lineTo(s * 0.23, -s * 0.12);
      c.lineTo(s * 0.18, s * 0.32);
      c.lineTo(-s * 0.18, s * 0.32);
      c.closePath();
      c.fill();
      c.globalCompositeOperation = 'destination-out';
      c.lineWidth = s * 0.05;
      c.beginPath();
      for (const x of [-0.07, 0.07]) {
        c.moveTo(s * x, -s * 0.04);
        c.lineTo(s * x, s * 0.24);
      }
      c.stroke();
      c.globalCompositeOperation = 'source-over';
      break;
    case 'share': {
      // Three dots joined by two lines.
      const dots: [number, number][] = [
        [s * 0.2, -s * 0.22],
        [-s * 0.2, 0],
        [s * 0.2, s * 0.22],
      ];
      c.lineWidth = s * 0.06;
      c.beginPath();
      c.moveTo(...dots[0]);
      c.lineTo(...dots[1]);
      c.lineTo(...dots[2]);
      c.stroke();
      for (const [x, y] of dots) {
        c.beginPath();
        c.arc(x, y, s * 0.09, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'dice': {
      // A rounded square with five pips cut out.
      c.beginPath();
      c.roundRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6, s * 0.1);
      c.fill();
      c.globalCompositeOperation = 'destination-out';
      for (const [x, y] of [
        [-1, -1],
        [1, -1],
        [0, 0],
        [-1, 1],
        [1, 1],
      ]) {
        c.beginPath();
        c.arc(x * s * 0.15, y * s * 0.15, s * 0.055, 0, Math.PI * 2);
        c.fill();
      }
      c.globalCompositeOperation = 'source-over';
      break;
    }
    case 'dot':
      c.beginPath();
      c.arc(0, 0, s * 0.09, 0, Math.PI * 2);
      c.fill();
      break;
  }
}
