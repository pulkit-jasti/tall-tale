// The Custom Game list page (docs/custom-mode.md section 8), in the main
// menu's spot. With no saved levels: the empty state, a small panel with the
// custom icon, two friendly lines and a big Create level button. With
// levels: a split panel like the campaign's. Left: the player's levels (a
// tap only ScrollList, the scrollbar beside it) and a round New button under
// it. Right: the selected level's card: its name, the description made from
// its settings, its skulls, the small round Edit, Duplicate, Delete and Share
// buttons with a word under each, and the big red Fight. Delete asks first,
// in the card's place: a green tick (yes) and a red cross (no), no words.
// Share says "Coming soon" for a moment; Fight plays the level (the game loads its map).
// Nothing pops over anything. Redrawn only when something changes.
import { Group, type Object3D } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import { BUTTON_SIZE, CUSTOM_GAME, MENU, POKE, UI_SPACING } from '../../config/game.js';

const BUTTON_SIZE_MIN = BUTTON_SIZE.medium;
import { describeSettings } from '../../config/levelSettings.js';
import type { HandState } from '../../player/hands.js';
import { saveCustomLevels } from '../../player/customLevels.js';
import { duplicateLevel, isFull, removeLevel, type CustomLevels } from '../../rules/customLevels.js';
import {
  armControls,
  drawLine,
  drawMenuIcon,
  FightButton,
  Panel,
  layerPage,
  PanelHeader,
  panelMap,
  PokeButton,
  ScrollList,
  truncate,
  Slider,
  UI_COLORS,
  menuCenterY,
  wrapText,
  type Control,
} from '../kit/index.js';

export type CustomListChoice = { kind: 'back' } | { kind: 'create' } | { kind: 'edit'; id: string } | { kind: 'fight'; id: string } | null;

type Action = 'edit' | 'copy' | 'trash' | 'share';
const ACTIONS: { id: Action; word: string }[] = [
  { id: 'edit', word: 'Edit' },
  { id: 'copy', word: 'Duplicate' },
  { id: 'trash', word: 'Delete' },
  { id: 'share', word: 'Share' },
];

/** A word that says something for a moment instead of its usual one ("Coming soon", "20 levels at most"). */
type Soon = { at: 'share' | 'fight' | 'new' | 'create'; text: string; left: number };

export class CustomListPanel {
  private emptyPanel: Panel;
  private emptyBack: PanelHeader;
  private create: PokeButton;
  private listPanel: Panel;
  private back: PanelHeader;
  private newButton: PokeButton;
  private list: ScrollList | null = null;
  private listHolder = new Group();
  private bar: Slider;
  private actions: { id: Action; button: PokeButton }[] = [];
  private fight: FightButton;
  private yes: PokeButton;
  private no: PokeButton;
  private selected = 0;
  private confirming = false;
  private soon: Soon | null = null;
  private listCount = -1;

  constructor(
    parent: Object3D,
    private audio: GameAudio,
    private levels: CustomLevels,
  ) {
    const E = CUSTOM_GAME.empty;
    const L = CUSTOM_GAME.list;
    const M = MENU.main;
    // The empty state.
    this.emptyPanel = new Panel(parent, {
      width: E.width,
      height: E.height,
      radius: M.radius,
      centerY: menuCenterY(E.height, M.tiltDeg),
      tiltDeg: M.tiltDeg,
      layoutWidth: Math.round(E.width * 15),
      canvasScale: 2,
    });
    // The title and Back float over each panel (navigation outside, content inside).
    this.emptyBack = new PanelHeader(audio, 'Custom Game', { back: true });
    this.emptyBack.placeAbove(E.height);
    this.create = new PokeButton(audio, { radius: E.createRadius, icon: 'plus' });
    this.create.group.position.set(E.createAt[0], E.createAt[1], 0);
    this.emptyPanel.root.add(this.emptyBack.group, this.create.group);
    // The list and its card.
    this.listPanel = new Panel(parent, {
      width: L.width,
      height: L.height,
      radius: M.radius,
      centerY: menuCenterY(L.height, M.tiltDeg),
      tiltDeg: M.tiltDeg,
      layoutWidth: Math.round(L.width * L.pxPerCm),
      canvasScale: 2,
    });
    const root = this.listPanel.root;
    this.back = new PanelHeader(audio, 'Custom Game', { back: true });
    this.back.placeAbove(L.height);
    this.newButton = new PokeButton(audio, { radius: BUTTON_SIZE_MIN, icon: 'plus' });
    this.newButton.group.position.set(L.newAt[0], L.newAt[1], 0);
    this.listHolder.position.set((L.listLeft + L.listRight) / 2, (L.listTop + L.listBottom) / 2, 0);
    this.bar = new Slider(audio, { length: L.listTop - L.listBottom - 4.6, steps: 10, value: 1, vertical: true, scrollbar: true });
    this.bar.group.position.set(L.scrollbarX, (L.listTop + L.listBottom) / 2, 0);
    this.bar.onChange = (value) => this.list?.scrollToShare(1 - value);
    root.add(this.back.group, this.newButton.group, this.listHolder, this.bar.group);
    ACTIONS.forEach(({ id }, i) => {
      const button = new PokeButton(audio, { radius: BUTTON_SIZE_MIN, icon: id });
      button.group.position.set(L.actionsX[i], L.actionsY, 0);
      root.add(button.group);
      this.actions.push({ id, button });
    });
    this.fight = new FightButton(audio, MENU.campaign.fightSize[0], MENU.campaign.fightSize[1]);
    this.fight.group.position.set(L.fightAt[0], L.fightAt[1], 0);
    this.yes = new PokeButton(audio, { radius: L.confirmRadius, icon: 'tick' });
    this.yes.setColor(L.yesColor);
    this.yes.group.position.set(L.confirmX[0], L.confirmY, 0);
    this.no = new PokeButton(audio, { radius: L.confirmRadius, icon: 'cross' });
    this.no.setColor(L.noColor);
    this.no.group.position.set(L.confirmX[1], L.confirmY, 0);
    root.add(this.fight.group, this.yes.group, this.no.group);
    // A full list: New and Create only buzz, and say why.
    const full = (at: 'new' | 'create') => () => this.say(at, `${CUSTOM_GAME.maxLevels} levels at most. Delete one first.`);
    this.newButton.onRefuse = full('new');
    this.create.onRefuse = full('create');
  }

  get visible(): boolean {
    return this.emptyPanel.visible || this.listPanel.visible;
  }

  /** Opens on the empty state or the list; `selectId` selects that level (after a save), else the newest. */
  show(selectId: string | null = null): void {
    this.confirming = false;
    this.soon = null;
    const index = selectId ? this.levels.levels.findIndex((l) => l.id === selectId) : 0;
    this.selected = Math.max(0, index);
    this.refreshPage(true);
  }

  hide(): void {
    this.emptyPanel.visible = false;
    this.listPanel.visible = false;
  }

  update(hands: HandState[], dt: number): CustomListChoice {
    if (this.soon) {
      this.soon.left -= dt;
      if (this.soon.left <= 0) {
        this.soon = null;
        this.paint();
      }
    }
    if (this.emptyPanel.visible) {
      this.emptyPanel.update(dt);
      if (this.emptyBack.update(hands, dt)) return { kind: 'back' };
      if (this.create.update(hands, dt)) return { kind: 'create' };
      return null;
    }
    if (!this.listPanel.visible) return null;
    this.listPanel.update(dt);
    if (this.back.update(hands, dt)) return { kind: 'back' };
    if (this.confirming) {
      if (this.yes.update(hands, dt)) this.deleteSelected();
      else if (this.no.update(hands, dt)) this.setConfirming(false);
      return null;
    }
    if (this.newButton.update(hands, dt)) return { kind: 'create' };
    this.bar.update(hands, dt);
    this.list?.update(hands, dt);
    const level = this.levels.levels[this.selected];
    for (const { id, button } of this.actions) {
      if (!button.update(hands, dt) || !level) continue;
      if (id === 'edit') return { kind: 'edit', id: level.id };
      if (id === 'copy') this.duplicateSelected();
      else if (id === 'trash') this.setConfirming(true);
      else this.say('share', 'Coming soon');
    }
    // Fight: the game loads the level's map and plays its waves (docs/custom-mode.md section 11).
    if (this.fight.update(hands, dt) && level) return { kind: 'fight', id: level.id };
    return null;
  }

  /** Every control on the shown page (to arm them when it opens or changes). */
  private get controls(): Control[] {
    if (this.emptyPanel.visible) return [this.emptyBack, this.create];
    const list = this.list ? [this.list] : [];
    return this.confirming ? [this.back, this.yes, this.no] : [this.back, this.newButton, this.bar, ...list, ...this.actions.map((a) => a.button), this.fight];
  }

  /** Shows the empty state or the list for the levels there are now. `pop`: the panel pops in (a page opened). */
  private refreshPage(pop: boolean): void {
    const empty = this.levels.levels.length === 0;
    this.emptyPanel.visible = empty;
    this.listPanel.visible = !empty;
    const full = isFull(this.levels);
    for (const b of [this.newButton, this.create]) {
      b.locked = full;
      b.setColor(full ? MENU.campaign.lockedColor : POKE.color);
    }
    if (!empty) {
      this.selected = Math.min(this.selected, this.levels.levels.length - 1);
      this.buildList();
      this.list!.redraw();
    }
    this.showConfirmButtons();
    // Drawn like the settings page: on top, in the page's own order (no flicker on taps). Again after a list rebuild.
    layerPage(this.emptyPanel.root);
    layerPage(this.listPanel.root);
    if (pop) (empty ? this.emptyPanel : this.listPanel).popIn(0.25);
    this.paint();
    armControls(this.controls);
  }

  /** The list is made again when the number of levels changes (its canvas is sized to them). */
  private buildList(): void {
    const count = this.levels.levels.length;
    if (this.list && count === this.listCount) return;
    const L = CUSTOM_GAME.list;
    if (this.list) {
      this.listHolder.remove(this.list.group);
      this.list.group.traverse((o) => {
        const mesh = o as { geometry?: { dispose(): void }; material?: { dispose(): void; map?: { dispose(): void } } };
        mesh.geometry?.dispose();
        mesh.material?.map?.dispose();
        mesh.material?.dispose();
      });
    }
    this.listCount = count;
    this.list = new ScrollList(this.audio, {
      width: L.listRight - L.listLeft,
      height: L.listTop - L.listBottom,
      rowHeight: L.rowHeight,
      rowGap: L.rowGap,
      count,
      drawRow: (c, i, w, h) => this.drawRow(c, i, w, h),
      swipe: false,
    });
    this.list.onSelect = (i) => {
      if (i === this.selected) return;
      this.selected = i;
      this.list!.redraw();
      this.paint();
    };
    this.listHolder.add(this.list.group);
    const rowsShown = (L.listTop - L.listBottom) / (L.rowHeight + L.rowGap);
    this.bar.group.visible = count > Math.floor(rowsShown);
    this.bar.setValue(1);
    this.list.scrollToTop();
  }

  private setConfirming(on: boolean): void {
    this.confirming = on;
    this.showConfirmButtons();
    this.paint();
    armControls(this.controls);
  }

  private showConfirmButtons(): void {
    this.yes.group.visible = this.no.group.visible = this.confirming;
    for (const { button } of this.actions) button.group.visible = !this.confirming;
    this.fight.group.visible = !this.confirming;
  }

  private duplicateSelected(): void {
    const level = this.levels.levels[this.selected];
    if (!level) return;
    const copy = duplicateLevel(this.levels, level.id, Date.now());
    if (!copy) {
      this.say('new', `${CUSTOM_GAME.maxLevels} levels at most. Delete one first.`);
      return;
    }
    saveCustomLevels();
    this.selected = this.levels.levels.indexOf(copy);
    this.refreshPage(false);
  }

  private deleteSelected(): void {
    const level = this.levels.levels[this.selected];
    this.confirming = false;
    if (level) {
      const next = removeLevel(this.levels, level.id);
      saveCustomLevels();
      this.selected = Math.max(0, next);
    }
    this.refreshPage(this.levels.levels.length === 0);
  }

  private say(at: Soon['at'], text: string): void {
    this.soon = { at, text, left: CUSTOM_GAME.soonTime };
    this.paint();
  }

  private paint(): void {
    if (this.emptyPanel.visible) this.emptyPanel.paint((c, w, h) => this.drawEmpty(c, w, h));
    else if (this.listPanel.visible) this.listPanel.paint((c, w, h) => this.drawList(c, w, h));
  }

  private drawEmpty(c: CanvasRenderingContext2D, w: number, h: number): void {
    const E = CUSTOM_GAME.empty;
    const at = panelMap(E.width, E.height, w, h);
    // The custom icon in a soft circle, then two friendly lines.
    c.fillStyle = 'rgba(255, 248, 228, 0.75)';
    c.beginPath();
    c.arc(at.x(0), at.y(E.iconY), 3.2 * at.px, 0, Math.PI * 2);
    c.fill();
    drawMenuIcon(c, 'custom', at.x(0), at.y(E.iconY), 4.2 * at.px, UI_COLORS.note);
    drawLine(c, 'No battles of your own yet.', at.x(0), at.y(E.lineY[0]), w - 4 * UI_SPACING.edge * at.px, 22, UI_COLORS.ink);
    drawLine(c, 'Pick the map, the waves and the rules.', at.x(0), at.y(E.lineY[1]), w - 4 * UI_SPACING.edge * at.px, 18, UI_COLORS.note);
    const word = this.soon?.at === 'create' ? this.soon.text : 'Create level';
    const wordY = E.createAt[1] - E.createRadius * POKE.rimScale - UI_SPACING.labelGap - 0.7;
    drawLine(c, word, at.x(0), at.y(wordY), w - 4 * UI_SPACING.edge * at.px, 19, this.soon?.at === 'create' ? UI_COLORS.warn : UI_COLORS.accent);
  }

  /** A level's description: the player's own, or one made from its settings when they left it empty. */
  private description(i: number): string {
    const level = this.levels.levels[i];
    return level ? level.description || describeSettings(level.level.meta.settings) : '';
  }

  private drawRow(c: CanvasRenderingContext2D, i: number, w: number, h: number): void {
    const level = this.levels.levels[i];
    if (!level) return;
    const selected = i === this.selected;
    const pad = h * 0.18;
    c.fillStyle = selected ? MENU.campaign.selectedColor : 'rgba(255, 248, 228, 0.85)';
    c.beginPath();
    c.roundRect(2, 2, w - 4, h - 4, h * 0.18);
    c.fill();
    c.strokeStyle = selected ? '#8a5a14' : 'rgba(138, 90, 52, 0.35)';
    c.lineWidth = selected ? 4 : 2;
    c.stroke();
    drawLine(c, level.name, pad, h * 0.34, w - pad * 2, h * 0.26, UI_COLORS.ink, 'left');
    // The description under the name, whole when it fits, else cut short with "...".
    c.font = `italic ${Math.round(h * 0.2)}px sans-serif`;
    c.fillStyle = UI_COLORS.note;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(truncate(c, this.description(i), w - pad * 2), pad, h * 0.7);
  }

  private drawList(c: CanvasRenderingContext2D, w: number, h: number): void {
    const L = CUSTOM_GAME.list;
    const at = panelMap(L.width, L.height, w, h);
    // New, its word beside it (or why it is locked).
    const newWordX = at.x(L.newAt[0] + BUTTON_SIZE_MIN * POKE.rimScale + UI_SPACING.labelGap);
    const fullNote = this.soon?.at === 'new';
    drawLine(c, fullNote ? this.soon!.text : 'New level', newWordX, at.y(L.newAt[1]), at.x(L.scrollbarX + 1.6) - newWordX, fullNote ? 14 : 18, fullNote ? UI_COLORS.warn : UI_COLORS.accent, 'left');
    // The card.
    const cardTop = L.height / 2 - UI_SPACING.edge;
    const cardBottom = -L.height / 2 + UI_SPACING.edge;
    const cardRight = L.width / 2 - UI_SPACING.edge;
    c.fillStyle = 'rgba(255, 248, 228, 0.6)';
    c.beginPath();
    c.roundRect(at.x(L.cardLeft), at.y(cardTop), at.x(cardRight) - at.x(L.cardLeft), at.y(cardBottom) - at.y(cardTop), 16);
    c.fill();
    c.strokeStyle = 'rgba(138, 90, 52, 0.3)';
    c.lineWidth = 2;
    c.stroke();
    const left = at.x(L.cardLeft + L.cardPad);
    const right = at.x(cardRight - L.cardPad);
    const width = right - left;
    const level = this.levels.levels[this.selected];
    if (!level) return;
    if (this.confirming) {
      // The delete question in the card's place: the buttons under it say yes and no without words.
      const mid = (left + right) / 2;
      drawLine(c, `Delete ${level.name}?`, mid, at.y(9), width, 26, UI_COLORS.ink);
      drawLine(c, 'This cannot be undone.', mid, at.y(6.2), width, 19, UI_COLORS.warn);
      return;
    }
    let y = cardTop - L.cardPad;
    drawLine(c, 'Your level', left, at.y(y - 0.6), width, 16, UI_COLORS.note, 'left');
    drawLine(c, level.name, left, at.y(y - 2.5), width, 28, UI_COLORS.ink, 'left');
    y -= 5.2;
    // The description: the player's own, or one made from the settings (wrapped to three lines).
    const description = this.description(this.selected);
    c.font = 'italic 19px sans-serif';
    wrapText(c, description, width)
      .slice(0, 3)
      .forEach((line, i) => {
        c.font = 'italic 19px sans-serif';
        c.fillStyle = UI_COLORS.ink;
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(line, left, at.y(y - i * 1.6));
      });
    // A word under each small button (Share's says "Coming soon" for a moment).
    const wordY = L.actionsY - BUTTON_SIZE_MIN * POKE.rimScale - UI_SPACING.labelGap - 0.6;
    ACTIONS.forEach(({ id, word }, i) => {
      const soon = id === 'share' && this.soon?.at === 'share';
      drawLine(c, soon ? this.soon!.text : word, at.x(L.actionsX[i]), at.y(wordY), 6.2 * at.px, soon ? 14 : 16, soon ? UI_COLORS.warn : UI_COLORS.accent);
    });
    if (this.soon?.at === 'fight') {
      const [fx, fy] = L.fightAt;
      drawLine(c, this.soon.text, at.x(fx), at.y(fy + MENU.campaign.fightSize[1] / 2 + 1.1), width, 16, UI_COLORS.warn);
    }
  }
}
