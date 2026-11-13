// Small icons drawn in code for the round buttons (docs/menus.md): the Fight
// sword, a lock, and the main menu's tile icons. Plain canvas paths in cream,
// drawn at any size, so they stay sharp. They are on the tested buttons, so
// they stay; anything new uses a Kenney icon instead (AGENTS.md, "Never make
// art by hand in code"). The card stars and skulls are Kenney icons now
// (drawStars, drawIconCentered). Sizes are the icon's height (pixels).

export type MenuIcon = 'sword' | 'lock' | 'campaign' | 'daily' | 'custom' | 'settings' | 'replay' | 'back' | 'home';

const CREAM = '#f7e2b0';

/** One of the menu icons, centered at x, y, `size` tall, in `color` (cream by default). */
export function drawMenuIcon(c: CanvasRenderingContext2D, icon: MenuIcon, x: number, y: number, size: number, color = CREAM): void {
  const s = size;
  c.save();
  c.translate(x, y);
  c.fillStyle = color;
  c.strokeStyle = color;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.lineWidth = s * 0.09;
  switch (icon) {
    case 'sword': {
      // A blade pointing up, a cross guard and a round pommel.
      c.beginPath();
      c.moveTo(0, -s * 0.5);
      c.lineTo(s * 0.08, -s * 0.36);
      c.lineTo(s * 0.08, s * 0.14);
      c.lineTo(-s * 0.08, s * 0.14);
      c.lineTo(-s * 0.08, -s * 0.36);
      c.closePath();
      c.fill();
      c.fillRect(-s * 0.26, s * 0.14, s * 0.52, s * 0.09);
      c.fillRect(-s * 0.05, s * 0.23, s * 0.1, s * 0.17);
      c.beginPath();
      c.arc(0, s * 0.44, s * 0.07, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'lock': {
      c.beginPath();
      c.arc(0, -s * 0.1, s * 0.2, Math.PI, 0);
      c.stroke();
      c.beginPath();
      c.roundRect(-s * 0.3, -s * 0.1, s * 0.6, s * 0.5, s * 0.08);
      c.fill();
      break;
    }
    case 'campaign': {
      // A flag on a pole.
      c.beginPath();
      c.moveTo(-s * 0.28, s * 0.46);
      c.lineTo(-s * 0.28, -s * 0.46);
      c.stroke();
      c.beginPath();
      c.moveTo(-s * 0.26, -s * 0.44);
      c.lineTo(s * 0.36, -s * 0.28);
      c.lineTo(-s * 0.26, -s * 0.08);
      c.closePath();
      c.fill();
      break;
    }
    case 'daily': {
      // A sun.
      c.beginPath();
      c.arc(0, 0, s * 0.2, 0, Math.PI * 2);
      c.fill();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        c.beginPath();
        c.moveTo(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3);
        c.lineTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45);
        c.stroke();
      }
      break;
    }
    case 'custom': {
      // Three little sliders.
      for (const [i, knob] of [-0.2, 0.15, -0.05].entries()) {
        const y0 = (i - 1) * s * 0.3;
        c.beginPath();
        c.moveTo(-s * 0.4, y0);
        c.lineTo(s * 0.4, y0);
        c.stroke();
        c.beginPath();
        c.arc(knob * s * 2, y0, s * 0.1, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'settings': {
      c.beginPath();
      const teeth = 8;
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? s * 0.42 : s * 0.3;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      c.globalCompositeOperation = 'destination-out';
      c.beginPath();
      c.arc(0, 0, s * 0.13, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'replay': {
      // A round arrow.
      c.beginPath();
      c.arc(0, 0, s * 0.32, -Math.PI * 0.2, Math.PI * 1.4);
      c.stroke();
      c.beginPath();
      c.moveTo(s * 0.18, -s * 0.38);
      c.lineTo(s * 0.42, -s * 0.2);
      c.lineTo(s * 0.12, -s * 0.06);
      c.closePath();
      c.fill();
      break;
    }
    case 'home': {
      // A little castle keep (the home screen): a roof over a wall with a door cut out.
      c.beginPath();
      c.moveTo(-s * 0.42, -s * 0.04);
      c.lineTo(0, -s * 0.42);
      c.lineTo(s * 0.42, -s * 0.04);
      c.closePath();
      c.fill();
      c.fillRect(-s * 0.3, -s * 0.06, s * 0.6, s * 0.44);
      c.globalCompositeOperation = 'destination-out';
      c.beginPath();
      c.roundRect(-s * 0.09, s * 0.12, s * 0.18, s * 0.26, [s * 0.09, s * 0.09, 0, 0]);
      c.fill();
      break;
    }
    case 'back': {
      c.beginPath();
      c.moveTo(-s * 0.4, 0);
      c.lineTo(-s * 0.06, -s * 0.32);
      c.lineTo(-s * 0.06, -s * 0.12);
      c.lineTo(s * 0.38, -s * 0.12);
      c.lineTo(s * 0.38, s * 0.12);
      c.lineTo(-s * 0.06, s * 0.12);
      c.lineTo(-s * 0.06, s * 0.32);
      c.closePath();
      c.fill();
      break;
    }
  }
  c.restore();
}
