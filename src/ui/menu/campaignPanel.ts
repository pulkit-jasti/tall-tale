// The campaign panel (docs/menus.md section 8): a split panel in the main
// menu's spot, nothing pops over anything. Left: the level list (a tap only
// ScrollList: tap a level to select it) and the upright slider beside it,
// the only way to scroll it (touch scrolling mixed up taps and swipes on the
// headset). Each row is a card with the number, the name and the best stars
// (or a lock), the selected one gold. Right: the selected level's card in
// one padded column: the level and its name, two labeled blocks (Best stars,
// Difficulty skulls), the flavor, the reward (a small turning copy of the
// tool, so it is clear without knowing its name), and the rectangular Fight
// button. Fight is locked only on a locked level (the reason under it). With
// a tool slot empty it still says Fight!, and a poke asks the game for the empty slots hint
// (a glass sign and a red arrow, not on this card). Back (top left) goes to
// the main menu. Nothing is redrawn while the list scrolls: the list only
// when the selection or the stars change, the card only on a new selection
// or loadout.
import { Box3, Group, Vector3, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import { MENU, UI_SPACING } from '../../config/game.js';
import { LEVELS, type LevelEntry, type LevelReward } from '../../config/levels.js';
import { mark } from '../../debug/perfMarks.js';
import type { HandState } from '../../player/hands.js';
import { isOpen, type PickTool, type Progress } from '../../rules/campaign.js';
import {
  armControls,
  drawLine,
  drawMenuIcon,
  drawSkull,
  drawStar,
  FightButton,
  Panel,
  PanelHeader,
  panelMap,
  ScrollList,
  Slider,
  UI_COLORS,
  menuCenterY,
  wrapText,
} from '../kit/index.js';

export type CampaignChoice = { kind: 'back' } | { kind: 'fight'; level: number } | { kind: 'needTools' } | null;

/** The list's entries: every level, then the "More coming soon" row. */
const ENTRIES = LEVELS.length + 1;

const TOOL_NAMES: Record<string, string> = { swatter: 'Fly swatter', pepper: 'Pepper shaker', bell: 'Bell', mystery: '???' };

export class CampaignPanel {
  private panel: Panel;
  private back: PanelHeader;
  private list: ScrollList;
  private slider: Slider;
  private fight: FightButton;
  /** The selected level (index into LEVELS). */
  private selected = 0;
  /** The small turning copy of each reward tool on the card (only the selected level's shows). */
  private rewards = new Map<LevelReward, Group>();
  private spin = 0;

  constructor(
    parent: Object3D,
    audio: GameAudio,
    private progress: Progress,
    rewardModels: Partial<Record<PickTool, Object3D>>,
  ) {
    const C = MENU.campaign;
    const M = MENU.main;
    this.panel = new Panel(parent, {
      width: C.width,
      height: C.height,
      radius: M.radius,
      centerY: menuCenterY(C.height, M.tiltDeg),
      tiltDeg: M.tiltDeg,
      layoutWidth: Math.round(C.width * C.pxPerCm),
      canvasScale: 2,
    });
    // The title and Back float over the panel (navigation outside, content inside).
    this.back = new PanelHeader(audio, 'Campaign', { back: true });
    this.back.placeAbove(C.height);
    this.panel.root.add(this.back.group);
    this.list = new ScrollList(audio, {
      width: C.listRight - C.listLeft,
      height: C.listTop - C.listBottom,
      rowHeight: C.rowHeight,
      rowGap: C.rowGap,
      count: ENTRIES,
      drawRow: (c, i, w, h) => this.drawRow(c, i, w, h),
      selectable: (i) => i < LEVELS.length,
      swipe: false,
    });
    const listY = (C.listTop + C.listBottom) / 2;
    this.list.group.position.set((C.listLeft + C.listRight) / 2, listY, 0);
    this.list.onSelect = (i) => {
      if (i === this.selected) return;
      this.selected = i;
      this.list.redraw();
      this.showSelected();
    };
    this.panel.root.add(this.list.group);
    // The upright slider: the only way to scroll the list (1, its top, shows the first levels). Smooth, no row steps.
    this.slider = new Slider(audio, { length: C.sliderLength, steps: ENTRIES - 4, value: 1, vertical: true, scrollbar: true });
    this.slider.group.position.set(C.sliderX, listY, 0);
    this.slider.onChange = (value) => this.list.scrollToShare(1 - value);
    this.panel.root.add(this.slider.group);
    this.fight = new FightButton(audio, C.fightSize[0], C.fightSize[1]);
    this.fight.group.position.set(C.fightAt[0], C.fightAt[1], 0);
    // A poke on the locked Fight: with empty tool slots, the game shows where to put tools.
    this.panel.root.add(this.fight.group);
    // The reward tools, each sized to rewardHeight and stood on the card.
    for (const [tool, model] of Object.entries(rewardModels) as [PickTool, Object3D][]) {
      const holder = new Group();
      const box = new Box3().setFromObject(model);
      const size = box.getSize(new Vector3());
      const center = box.getCenter(new Vector3());
      const scale = C.rewardHeight / Math.max(size.y, 0.001);
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      holder.add(model);
      const materials = new Set<MeshStandardMaterial>();
      model.traverse((o) => {
        const mesh = o as Mesh;
        if (mesh.isMesh && !Array.isArray(mesh.material)) materials.add(mesh.material as MeshStandardMaterial);
      });
      this.rewardMaterials.set(model, [...materials]);
      holder.position.set(C.rewardAt[0], C.rewardAt[1], Math.max(size.x, size.z) * scale * 0.5 + 0.4);
      holder.visible = false;
      this.panel.root.add(holder);
      this.rewards.set(tool, holder);
    }
  }

  get visible(): boolean {
    return this.panel.visible;
  }

  /**
   * The reward tool on the card right now (its small copy, whose world pose
   * the shelves' grab code copies), or null. The shelves let the player grab
   * it: a full-size copy comes into the hand (no effects run, it is only to
   * look at and swing), and the card's copy hides meanwhile (`showOnCard`).
   */
  rewardShown(): { tool: PickTool; model: Object3D; materials: MeshStandardMaterial[]; showOnCard: (on: boolean) => void } | null {
    if (!this.panel.visible) return null;
    const reward = LEVELS[this.selected].reward;
    const holder = reward ? this.rewards.get(reward) : undefined;
    if (!holder || !reward || reward === 'mystery') return null;
    const model = holder.children[0];
    return { tool: reward, model, materials: this.rewardMaterials.get(model) ?? [], showOnCard: (on) => (model.visible = on) };
  }

  /** Each reward copy's materials (its Ready glow when a hand comes near). */
  private rewardMaterials = new Map<Object3D, MeshStandardMaterial[]>();

  /** Opens on level 1, selected, at the top of the list (never empty). */
  show(): void {
    this.panel.visible = true;
    this.panel.popIn(0.25);
    this.selected = 0;
    this.list.scrollToTop();
    this.slider.setValue(1);
    this.list.redraw();
    this.showSelected();
    armControls([this.back, this.list, this.slider, this.fight]);
  }

  hide(): void {
    this.panel.visible = false;
  }

  /** Stars or open levels changed (after a battle): the list and the card again. */
  refresh(): void {
    this.list.redraw();
    this.showSelected();
  }

  /** The loadout changed: only the card (Fight). */
  refreshFight(): void {
    this.showSelected();
  }

  update(hands: HandState[], dt: number): CampaignChoice {
    if (!this.panel.visible) return null;
    this.panel.update(dt);
    // The reward tool turns slowly, so its shape reads from every side.
    this.spin += dt * Math.PI * 2 * MENU.campaign.rewardSpin;
    for (const holder of this.rewards.values()) if (holder.visible) holder.rotation.y = this.spin;
    if (this.back.update(hands, dt)) return { kind: 'back' };
    this.slider.update(hands, dt);
    this.list.update(hands, dt);
    if (this.fight.update(hands, dt)) {
      // Empty tool slots: no battle yet, the game shows the glass sign and the red arrow at the stand.
      if (this.progress.loadout.includes(null)) return { kind: 'needTools' };
      return { kind: 'fight', level: LEVELS[this.selected].number };
    }
    return null;
  }

  /** One row: a soft card (gold when selected), the number and name, then the best stars or a lock. */
  private drawRow(c: CanvasRenderingContext2D, i: number, w: number, h: number): void {
    const level = LEVELS[i];
    const pad = h * 0.18;
    if (!level) {
      c.strokeStyle = 'rgba(138, 90, 52, 0.45)';
      c.lineWidth = 3;
      c.setLineDash([10, 8]);
      c.beginPath();
      c.roundRect(2, 2, w - 4, h - 4, h * 0.18);
      c.stroke();
      c.setLineDash([]);
      drawLine(c, 'More coming soon', w / 2, h / 2, w - pad * 2, h * 0.26, UI_COLORS.note);
      return;
    }
    const open = isOpen(this.progress, level.number);
    const selected = i === this.selected;
    c.fillStyle = selected ? MENU.campaign.selectedColor : open ? 'rgba(255, 248, 228, 0.85)' : 'rgba(200, 190, 170, 0.6)';
    c.beginPath();
    c.roundRect(2, 2, w - 4, h - 4, h * 0.18);
    c.fill();
    c.strokeStyle = selected ? '#8a5a14' : 'rgba(138, 90, 52, 0.35)';
    c.lineWidth = selected ? 4 : 2;
    c.stroke();
    const ink = open ? UI_COLORS.ink : UI_COLORS.note;
    drawLine(c, `${level.number}.  ${level.name}`, pad, h * 0.34, w - pad * 2, h * 0.3, ink, 'left');
    if (open) {
      const stars = this.progress.stars[level.number] ?? 0;
      for (let s = 0; s < 3; s++) drawStar(c, pad + h * 0.14 + s * h * 0.32, h * 0.72, h * 0.26, s < stars);
    } else {
      drawMenuIcon(c, 'lock', pad + h * 0.12, h * 0.72, h * 0.26, UI_COLORS.note);
      drawLine(c, 'Locked', pad + h * 0.34, h * 0.72, w, h * 0.2, UI_COLORS.note, 'left');
    }
  }

  /** The detail card and the Fight button of the selected level. */
  private showSelected(): void {
    const level = LEVELS[this.selected];
    const open = isOpen(this.progress, level.number);
    // Only a locked level locks Fight. With empty tool slots it still says Fight! (so it gets poked), and the poke shows where to put tools.
    this.fight.setLocked(!open);
    for (const [reward, holder] of this.rewards) holder.visible = reward === level.reward;
    mark('panel redraw');
    this.panel.paint((c, w, h) => this.draw(c, w, h, level, open));
  }

  private draw(c: CanvasRenderingContext2D, w: number, h: number, level: LevelEntry, open: boolean): void {
    const C = MENU.campaign;
    const at = panelMap(C.width, C.height, w, h);
    // The card: a soft board from cardLeft to the right edge, its content cardPad inside.
    const cardTop = C.height / 2 - UI_SPACING.edge;
    const cardBottom = -C.height / 2 + UI_SPACING.edge;
    const cardRight = C.width / 2 - UI_SPACING.edge;
    c.fillStyle = 'rgba(255, 248, 228, 0.6)';
    c.beginPath();
    c.roundRect(at.x(C.cardLeft), at.y(cardTop), at.x(cardRight) - at.x(C.cardLeft), at.y(cardBottom) - at.y(cardTop), 16);
    c.fill();
    c.strokeStyle = 'rgba(138, 90, 52, 0.3)';
    c.lineWidth = 2;
    c.stroke();
    const left = at.x(C.cardLeft + C.cardPad);
    const right = at.x(cardRight - C.cardPad);
    const width = right - left;
    const ink = open ? UI_COLORS.ink : UI_COLORS.note;
    let y = cardTop - C.cardPad;
    // The level and its name.
    drawLine(c, open ? `Level ${level.number}` : `Level ${level.number}  (locked)`, left, at.y(y - 0.6), width, 20, open ? UI_COLORS.note : UI_COLORS.warn, 'left');
    drawLine(c, level.name, left, at.y(y - 2.6), width, 34, ink, 'left');
    y -= 5.2;
    // Two labeled blocks side by side: the best stars, and the difficulty skulls.
    const half = left + width / 2;
    drawLine(c, 'Best', left, at.y(y), width / 2, 19, UI_COLORS.note, 'left');
    drawLine(c, 'Difficulty', half, at.y(y), width / 2, 19, UI_COLORS.note, 'left');
    const stars = this.progress.stars[level.number] ?? 0;
    for (let s = 0; s < 3; s++) drawStar(c, left + 17 + s * 40, at.y(y - 2), 34, s < stars);
    for (let s = 0; s < 3; s++) drawSkull(c, half + 17 + s * 40, at.y(y - 2), 36, s < level.skulls);
    y -= 4.4;
    // The twist, in one line of flavor (wrapped).
    c.font = 'italic 22px sans-serif';
    wrapText(c, level.flavor, width)
      .slice(0, 2)
      .forEach((line, i) => {
        c.font = 'italic 22px sans-serif';
        c.fillStyle = ink;
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(line, left, at.y(y - i * 1.8));
      });
    // The reward: its label, the tool turning beside its name (the model stands at rewardAt), or "???".
    if (level.reward) {
      const [rx, ry] = C.rewardAt;
      drawLine(c, 'Reward', left, at.y(ry + C.rewardHeight / 2 + 1), width, 19, UI_COLORS.note, 'left');
      const nameX = level.reward === 'mystery' ? left : at.x(rx + C.rewardHeight / 2 + 1.4);
      drawLine(c, TOOL_NAMES[level.reward], nameX, at.y(ry), right - nameX, 26, UI_COLORS.accent, 'left');
    }
    // A locked level: why, under Fight (empty tool slots are shown by the glass sign instead, when Fight is poked).
    if (!open) {
      const [fx, fy] = C.fightAt;
      drawLine(c, `Beat level ${level.number - 1} to unlock`, at.x(fx), at.y(fy - C.fightSize[1] / 2 - 1.3), width, 19, UI_COLORS.warn);
    }
  }
}
