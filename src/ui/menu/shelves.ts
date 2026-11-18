// The tool shelf and the loadout stand (right), and the achievements shelf
// (left) of the home screen (docs/menus.md sections 5 and 6). Only the menu
// panel is in front. All in the menu's group in boardLift (cm, never turns,
// sized with the reach check), every grab spot in the reach band.
//
//   Tool shelf (right, the back row, higher): wooden pedestals, one spot per
//   pick tool. Loadout stand (right, the front row, nearer and lower): the
//   very platforms the tools stand on in battle, so what is put here is what
//   the battle shows. The slingshot and the horn are fixed on the first two
//   (a grab buzzes); the other two start empty and glow.
//   No tool has a spot of its own: grab one (fist or pinch) and bring it to
//   any stand slot or shelf spot. While it is close enough, that platform
//   glows with a tick; let go and it snaps in with a click and a puff. A tool
//   already there moves to where the new one came from. Let go anywhere else
//   and it glides back. Held in a fist a tool grows to full size in its real
//   grip (HOLD.poses), with a tag (its name and what it does). A locked tool
//   is a grey silhouette: a grab buzzes and the tag says which level unlocks
//   it. A newly unlocked tool glows until it is grabbed once.
//   Achievements shelf (left, v3 2.6): 16 trophies (the Kenney trophy
//   model) in two even rows: the 8 secret abilities high, the 8 regular
//   achievements low. Dimmed until earned; an unfound secret has a "?" over
//   it. A grab shows its tag: a secret's name and riddle, a regular one's
//   goal, and once earned what it does or taught. A counter above.
//   The tool shelf ends with a "More coming soon" card.
//
// Its own grab code (no goblins or tools in the menu): the same pinch and
// fist switches as everything else, the same Idle, Ready and Held looks.
import {
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  type Camera,
  type CanvasTexture,
  type MeshBasicMaterial,
  type WebGLRenderer,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import type { GameAudio } from '../../audio/sound.js';
import { ACHIEVEMENT_LIST, GOALS, SECRETS, type Achievement } from '../../config/achievements.js';
import { MENU, RENDER_ORDER, TOOLS } from '../../config/game.js';
import { LEVELS } from '../../config/levels.js';
import type { Particles } from '../../fx/particles.js';
import { applyTouchState, type TouchState } from '../../player/feedback.js';
import type { HandState } from '../../player/hands.js';
import { note } from '../../debug/notes.js';
import { holdMatrix, type HoldName } from '../../player/hold.js';
import { degToRad, polarX, polarZ } from '../../rules/boardMath.js';
import { canMoveTo, PICK_TOOLS, placeOf, SHELF_SPOTS, toolUnlocked, type PickTool, type Place, type Progress } from '../../rules/campaign.js';
import { cloneStatic, type ModelTemplate } from '../../world/models.js';
import { flatMaterial, post } from '../../world/shapes.js';
import type { Stage } from '../../world/stage.js';
import { canvasPlane, canvasTexture } from '../kit/canvas.js';
import { drawOnTop } from '../kit/onTop.js';
import { drawLine, UI_COLORS } from '../kit/text.js';
import { drawIconCentered, drawNineSlice } from '../uiImages.js';
import type { CampaignPanel } from './campaignPanel.js';

export type DisplayName = PickTool;

/**
 * A display copy of a tool (its own materials), its origin at the end the
 * hand holds, along +y; the grip's middle (cm up from there); how far its
 * origin rests above a platform top; and how it is turned resting at an angle.
 */
export interface DisplayModel {
  model: Object3D;
  materials: MeshStandardMaterial[];
  gripMid: number;
  lift: number;
  /** null: it faces the seat (a trophy). */
  turn: ((angleDeg: number, out: Quaternion) => Quaternion) | null;
}

/** The trophies on the shelf (v3 2.6: 8 secret abilities and 8 regular achievements). */
export const TROPHY_COUNT = ACHIEVEMENT_LIST.length;

const TOOL_TAGS: Record<DisplayName, [string, string]> = {
  swatter: ['Fly swatter', 'Swat groups on the wall.'],
  pepper: ['Pepper shaker', 'Pepper the ground by the wall.'],
  drum: ['Drum', 'Stuns every goblin.'],
  slingshot: ['Slingshot', 'Shoot pebbles far.'],
  horn: ['War horn', 'Call, boost or move knights.'],
  magnet: ['Magnet', 'Pull gear off goblins.'],
  glass: ['Magnifying glass', 'Grow plants, burn goblins.'],
  sugar: ['Sugar cubes', 'Lure goblins to a spot.'],
};
const POOF = [0xffffff, 0xf2c230, 0xddd6c8];
/** v3 2.2: no fixed tools on the stand any more: all 4 slots are free. */
const FIXED: DisplayName[] = [];

/** Which level unlocks a tool (its reward), as the locked tag says it. */
function unlockText(tool: PickTool): string {
  const level = LEVELS.find((l) => l.reward === tool);
  return level ? `Beat level ${level.number} to unlock` : 'Unlocks in the campaign';
}

/** A place a tool can be put: where its top is (menu group cm), the angle it faces from, and the materials that glow. */
interface Spot {
  place: Place;
  top: Vector3;
  angle: number;
  materials: MeshStandardMaterial[];
}

interface Item {
  /** 'preview': a full-size copy of a reward tool, held after a grab off the campaign card (src/ui/menu/campaignPanel.ts). */
  kind: 'tool' | 'fixed' | 'trophy' | 'preview';
  name: DisplayName | null;
  model: Object3D;
  materials: MeshStandardMaterial[];
  /** Grip middle in the model (cm). */
  gripMid: number;
  /** How far the origin rests above a platform top (cm, at its size there), and how it turns resting at an angle. */
  lift: number;
  turn: ((angleDeg: number, out: Quaternion) => Quaternion) | null;
  /** Where it sits (menu group cm), how it is turned there, and its size there. */
  home: Vector3;
  homeQuat: Quaternion;
  homeScale: number;
  locked: boolean;
  touch: TouchState;
  /** Gliding home: time left (seconds), from where. */
  glide: number;
  from: Vector3;
  fromQuat: Quaternion;
  fromScale: number;
  /** Size while held in a fist (grows from homeScale to 1). */
  heldScale: number;
  /** v3 2.6: a trophy's achievement, its colors when earned, and its "?" (an unfound secret). */
  achievement?: Achievement;
  colors?: number[];
  question?: Mesh;
}

interface Holder {
  hand: HandState;
  item: Item;
  viaPinch: boolean;
  openTime: number;
  lostTime: number;
  /** A pinch keeps the pose it grabbed at. */
  offset: Matrix4;
  /** The spot it would snap to if let go now (it glows), or null. */
  target: Spot | null;
}

const temp = new Vector3();
const temp2 = new Vector3();
const handMatrix = new Matrix4();
const matrix = new Matrix4();
const unit = new Vector3(1, 1, 1);
const scaleOut = new Vector3();
const UP = new Vector3(0, 1, 0);

/** A spot `radius` out at `angleDeg` (0 front, positive right), `y` up, in the menu group (cm). */
const spot = (radius: number, angleDeg: number, y: number): Vector3 => {
  const a = degToRad(angleDeg);
  return new Vector3(polarX(radius, a), y, polarZ(radius, a));
};

/** Turned to face the seat from `angleDeg`. */
const facing = (angleDeg: number, out = new Quaternion()): Quaternion => out.setFromAxisAngle(UP, -degToRad(angleDeg));

export class Shelves {
  readonly group = new Group();
  private items: Item[] = [];
  private tools = new Map<PickTool, Item>();
  /** Every place a pick tool can go: the 2 free stand slots, then the shelf spots. */
  private spots: Spot[] = [];
  private holders: Holder[] = [];
  /** Ready look per hand: the item a hand hovers. */
  private hover = new Map<HandState, Item>();
  /** The hovered items this frame (reused, no allocation). */
  private hovered = new Set<Item>();
  private tag: Mesh;
  /** Every tag, drawn once at the start (drawTags). */
  private tagTextures = new Map<string, CanvasTexture>();
  private tagFor: Item | null = null;
  /** A refused grab shows its tag this long (seconds). */
  private tagLeft = 0;
  private counter: { canvas: HTMLCanvasElement; texture: CanvasTexture };
  /** The count the counter shows now (-1: not drawn yet), so it redraws only when it changes. */
  private counted = -1;
  private trophies: Item[] = [];
  private time = 0;
  /** A tool was let go over a place it may go: the game moves it there (and the one there to where it came from), then calls layout(). */
  onDrop: (tool: PickTool, to: Place) => void = () => {};
  /** A tool was grabbed (a new one stops glowing). */
  onGrabTool: (tool: PickTool) => void = () => {};

  constructor(
    parent: Object3D,
    private stage: Stage,
    private audio: GameAudio,
    private particles: Particles,
    models: Record<DisplayName, DisplayModel>,
    templates: { trophy: ModelTemplate; platform: ModelTemplate },
    private progress: Progress,
  ) {
    const S = MENU.shelves;
    const T = MENU.stand;
    parent.add(this.group);
    // The loadout stand (right, front row): the battle's own platforms on posts.
    T.angles.forEach((angle, i) => {
      const materials = this.platform(templates.platform, T.radius, angle, T.y);
      if (i < FIXED.length) this.addItem('fixed', FIXED[i], models[FIXED[i]], spot(T.radius, angle, T.y), angle, S.displayScale);
      else this.spots.push({ place: { where: 'stand', i: i - FIXED.length }, top: spot(T.radius, angle, T.y), angle, materials });
    });
    // The tool shelf (right, back row): a wooden pedestal per spot.
    // v3 2.2: two rows (8 tools), the upper one a little farther back so the lower one never hides it.
    for (let i = 0; i < SHELF_SPOTS; i++) {
      const row = Math.floor(i / S.tools.angles.length);
      const angle = S.tools.angles[i % S.tools.angles.length];
      const radius = S.tools.radius + row * S.tools.rowBack;
      const y = S.tools.y + row * S.tools.rowUp;
      const materials = [this.pedestal(radius, angle, y, S.plankDepth)];
      this.spots.push({ place: { where: 'shelf', i }, top: spot(radius, angle, y), angle, materials });
    }
    this.card(S.tools.radius, S.tools.cardAngle, S.tools.y + 4);
    // The pick tools, wherever the progress puts them (layout).
    const silhouette = flatMaterial(0x7a756c);
    for (const name of PICK_TOOLS) {
      const item = this.addItem('tool', name, models[name], new Vector3(), 0, S.displayScale);
      item.model.userData.silhouette = silhouette;
      this.tools.set(name, item);
    }
    // The achievements shelf (left, v3 2.6): the regular achievements on the low row, the secret abilities on the
    // high row, dimmed until earned (refreshTrophies), a "?" over each unfound secret, a counter above.
    const R = S.trophies;
    const rows: [Achievement[], number[], number, number][] = [
      [GOALS, R.lowAngles, R.lowRadius, R.lowY],
      [SECRETS, R.highAngles, R.highRadius, R.highY],
    ];
    const questionTexture = this.questionTexture();
    for (const [list, angles, radius, y] of rows) {
      list.forEach((achievement, i) => {
        const angle = angles[i] ?? angles[angles.length - 1];
        this.pedestal(radius, angle, y, R.plank);
        const model = cloneStatic(templates.trophy);
        const materials = ownMaterials(model, 1);
        const item = this.addItem('trophy', null, { model, materials, gripMid: templates.trophy.size.y * 0.4, lift: 0, turn: null }, spot(radius, angle, y), angle, 1);
        item.achievement = achievement;
        item.colors = materials.map((m) => m.color.getHex());
        if (achievement.secret) {
          const q = canvasPlane(questionTexture, R.questionSize, R.questionSize);
          (q.material as MeshBasicMaterial).depthWrite = false;
          q.renderOrder = 1;
          q.position.copy(spot(radius, angle, y + templates.trophy.size.y + R.questionAbove + R.questionSize / 2));
          q.quaternion.copy(facing(angle));
          this.group.add(q);
          item.question = q;
        }
        this.trophies.push(item);
      });
    }
    const midAngle = (R.highAngles[0] + R.highAngles[R.highAngles.length - 1]) / 2;
    this.counter = this.sign(R.highRadius, midAngle, R.highY + R.height + R.questionSize + 8, 16, 5);
    // The tag over a held thing.
    this.drawTags();
    this.tag = canvasPlane(this.tagTextures.get(this.trophyKey(this.trophies[0]))!, S.tagWidth, S.tagHeight);
    // On top and never writing depth: a see-through plane that writes depth hid the clouds behind it (they blinked).
    drawOnTop(this.tag, RENDER_ORDER.labels);
    this.tag.visible = false;
    this.group.add(this.tag);
    // Everything starts where the saved places say, without gliding there.
    this.layout();
    for (const item of this.items) this.home(item);
  }

  /** Puts every pick tool where the progress says (a stand slot or a shelf spot); locked ones grey. Moved ones glide there. */
  layout(): void {
    for (const name of PICK_TOOLS) {
      const item = this.tools.get(name)!;
      const place = placeOf(this.progress, name);
      const at = place && this.spotOf(place);
      if (!at) continue;
      const home = temp.copy(at.top);
      home.y += item.lift;
      if (!item.home.equals(home)) {
        this.startGlide(item);
        item.home.copy(home);
      }
      this.restTurn(item, at.angle, item.homeQuat);
      const locked = !toolUnlocked(this.progress, name);
      if (locked !== item.locked) {
        item.locked = locked;
        // Locked: one grey material on every mesh. Unlocked: its own materials back.
        item.model.traverse((o) => {
          const mesh = o as Mesh;
          if (mesh.isMesh) mesh.material = locked ? (item.model.userData.silhouette as MeshStandardMaterial) : mesh.userData.own;
        });
      }
    }
    this.refreshTrophies();
  }

  /**
   * v3 2.6: each trophy's look from the saved achievements: earned ones in
   * full color, the rest dimmed, a "?" over each unfound secret; the counter
   * redraws only when the count changed.
   */
  refreshTrophies(): void {
    let earned = 0;
    for (const item of this.trophies) {
      const has = !!item.achievement && this.progress.trophies.includes(item.achievement.id);
      if (has) earned++;
      item.materials.forEach((m, i) => m.color.setHex(item.colors![i]).multiplyScalar(has ? 1 : TOOLS.dimShare));
      if (item.question) item.question.visible = !has;
    }
    if (earned !== this.counted) {
      this.counted = earned;
      this.drawCounter(earned);
    }
  }

  /** The tag key of a trophy: its achievement, earned or not. */
  private trophyKey(item: Item): string {
    const a = item.achievement;
    return a ? `trophy|${a.id}|${this.progress.trophies.includes(a.id) ? 1 : 0}` : 'trophy';
  }

  /** The "?" over an unfound secret (the Kenney question icon), drawn once and shared. */
  private questionTexture(): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    drawIconCentered(canvas.getContext('2d')!, 'question', 64, 64, 120, '#7a3fb0');
    return canvasTexture(canvas, 4);
  }

  /** The top of the first empty stand slot (world), or null when both are filled. */
  emptySlotWorld(out: Vector3): Vector3 | null {
    const empty = this.spots.find((s) => s.place.where === 'stand' && !this.progress.loadout[s.place.i]);
    return empty ? this.group.localToWorld(out.copy(empty.top)) : null;
  }

  /** Drops whatever is held (the menu closes): it is home at once. */
  releaseAll(): void {
    for (const h of this.holders) this.home(h.item);
    this.holders = [];
    this.tag.visible = false;
    this.tagFor = null;
    if (this.previewShowing) this.endPreview(this.previewShowing);
  }

  update(hands: HandState[], dt: number, head: Vector3): void {
    this.time += dt;
    this.group.updateWorldMatrix(true, true);
    this.followReward();
    // Held things follow their hand, or snap or glide once it opens (backwards: a let go removes it from the list).
    for (let i = this.holders.length - 1; i >= 0; i--) this.updateHeld(this.holders[i], dt);
    // Grabs, and the Ready look for a hand near something.
    for (const hand of hands) {
      if (!hand.tracked || this.holders.some((h) => h.hand === hand)) {
        this.hover.delete(hand);
        continue;
      }
      const near = this.nearest(hand);
      // A finger coming near something it can pick up: a soft tick (with the Ready glow below).
      if (near && near !== this.hover.get(hand)) this.audio.play('readyTick', undefined, 0.7, 0.05);
      if (near) this.hover.set(hand, near);
      else this.hover.delete(hand);
      const closing = hand.fist.started || hand.pinch.started;
      if (!near || !closing) continue;
      if (near.kind === 'fixed' || near.locked) {
        // Fixed on the stand, or locked: a buzz and its tag.
        this.audio.play('locked', undefined, 1, 0.4);
        this.showTag(near, 2);
        continue;
      }
      this.grab(hand, near, !hand.fist.started);
    }
    // Looks: held, ready (a hand near), idle. No "new tool" glow (the developer, 2026-11-18: with every
    // tool unlocked from the start the magnet, glass, drum and sugar pulsed on the shelf for no reason).
    this.hovered.clear();
    for (const item of this.hover.values()) this.hovered.add(item);
    for (const item of this.items) {
      let state: TouchState = 'idle';
      if (this.holders.some((h) => h.item === item)) state = 'held';
      else if (this.hovered.has(item) && !item.locked) state = 'ready';
      if (state !== item.touch) {
        item.touch = state;
        applyTouchState(item.materials, state);
      }
      // A reward preview at rest is the card's small copy: that one shows the Ready glow.
      if (item.kind === 'preview' && this.rewardNow?.tool === item.name) {
        const cardState: TouchState = this.hovered.has(item) && !item.model.visible ? 'ready' : 'idle';
        if (cardState !== this.cardTouch) {
          this.cardTouch = cardState;
          applyTouchState(this.rewardNow.materials, cardState);
        }
      }
      if (item.glide > 0) this.updateGlide(item, dt);
    }
    this.glowSpots();
    // The tag over the last held (or refused) thing, turned to the eyes.
    this.tagLeft = Math.max(0, this.tagLeft - dt);
    const shown = this.holders[this.holders.length - 1]?.item ?? (this.tagLeft > 0 ? this.tagFor : null);
    this.tag.visible = !!shown;
    if (shown) {
      this.gripLocal(shown, temp);
      this.tag.position.copy(temp).setY(temp.y + MENU.shelves.tagAbove);
      this.tag.lookAt(head);
    }
  }

  // ---- Building ----

  /** A thing resting at `at` (menu group cm, a platform top), facing from `angleDeg`, at size `scale`. */
  private addItem(kind: Item['kind'], name: DisplayName | null, d: DisplayModel, at: Vector3, angleDeg: number, scale: number): Item {
    const item: Item = {
      kind,
      name,
      model: d.model,
      materials: d.materials,
      gripMid: d.gripMid,
      lift: d.lift * scale,
      turn: d.turn,
      home: at.clone().setY(at.y + d.lift * scale),
      homeQuat: new Quaternion(),
      homeScale: scale,
      locked: false,
      touch: 'idle',
      glide: 0,
      from: new Vector3(),
      fromQuat: new Quaternion(),
      fromScale: scale,
      heldScale: scale,
    };
    this.restTurn(item, angleDeg, item.homeQuat);
    // Each mesh remembers its own material, for the grey silhouette swap (layout).
    d.model.traverse((o) => {
      if ((o as Mesh).isMesh) o.userData.own = (o as Mesh).material;
    });
    this.group.add(d.model);
    this.home(item);
    this.items.push(item);
    return item;
  }

  /** How a thing rests at `angleDeg`: a tool as on its battle platform, a trophy facing the seat. */
  private restTurn(item: Item, angleDeg: number, out: Quaternion): Quaternion {
    return item.turn ? item.turn(angleDeg, out) : facing(angleDeg, out);
  }

  private spotOf(place: Place): Spot | null {
    return this.spots.find((s) => s.place.where === place.where && s.place.i === place.i) ?? null;
  }

  /** A battle platform (the hexagon top on a post), its top at `y`. Returns its own materials (for the glow). */
  private platform(template: ModelTemplate, radius: number, angleDeg: number, y: number): MeshStandardMaterial[] {
    const at = spot(radius, angleDeg, y);
    const stand = cloneStatic(template);
    const materials = ownMaterials(stand, 1);
    stand.position.set(at.x, y - template.size.y, at.z);
    const stem = post(y - template.size.y);
    stem.position.set(at.x, stem.position.y + y - template.size.y, at.z);
    this.group.add(stand, stem);
    return materials;
  }

  /** A little wooden stand: a flat top `size` wide at `y` on a post down to the board. Returns its material. */
  private pedestal(radius: number, angleDeg: number, y: number, size: number): MeshStandardMaterial {
    const S = MENU.shelves;
    const at = spot(radius, angleDeg, y);
    const material = flatMaterial(S.plankColor);
    const top = new Mesh(new BoxGeometry(size, S.plankThick, size), material);
    top.position.copy(at).setY(y - S.plankThick / 2);
    top.quaternion.copy(facing(angleDeg));
    const stem = post(y - S.plankThick);
    stem.position.set(at.x, stem.position.y + y - S.plankThick, at.z);
    this.group.add(top, stem);
    return material;
  }

  /** A sign on a post, facing the seat, with a canvas to draw on. */
  private sign(radius: number, angleDeg: number, y: number, width: number, height: number): { canvas: HTMLCanvasElement; texture: CanvasTexture } {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * 30);
    canvas.height = Math.round(height * 30);
    const texture = canvasTexture(canvas, 4);
    const plane = canvasPlane(texture, width, height);
    // Never writes depth, so the clouds behind it never blink (it still hides behind nearer things).
    (plane.material as MeshBasicMaterial).depthWrite = false;
    plane.renderOrder = 1;
    plane.position.copy(spot(radius, angleDeg, y));
    plane.quaternion.copy(facing(angleDeg));
    const stem = post(y - height / 2);
    stem.position.set(plane.position.x, stem.position.y + y - height / 2, plane.position.z);
    this.group.add(plane, stem);
    return { canvas, texture };
  }

  /** The "More coming soon" card at the end of a shelf. */
  private card(radius: number, angleDeg: number, y: number): void {
    const { canvas, texture } = this.sign(radius, angleDeg, y + 4, 12, 7);
    const c = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    parchment(c, w, h);
    drawLine(c, 'More', w / 2, h * 0.36, w * 0.8, h * 0.24, UI_COLORS.ink);
    drawLine(c, 'coming soon', w / 2, h * 0.64, w * 0.8, h * 0.2, UI_COLORS.note);
    texture.needsUpdate = true;
  }

  private drawCounter(earned: number): void {
    const { canvas, texture } = this.counter;
    const c = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    c.clearRect(0, 0, w, h);
    parchment(c, w, h);
    // A Kenney trophy before the count.
    const icon = h * 0.62;
    drawIconCentered(c, 'trophy', w * 0.1 + icon / 2, h / 2, icon, '#b07a10');
    drawLine(c, `Trophies  ${earned} / ${TROPHY_COUNT}`, w * 0.1 + icon + (w * 0.8 - icon) / 2, h / 2, w * 0.8 - icon, h * 0.42, UI_COLORS.ink);
    texture.needsUpdate = true;
  }

  /** Glows: the spot a held tool would snap to (bright), an empty stand slot (a gold pulse), the rest none. */
  private glowSpots(): void {
    const pulse = 0.4 + 0.6 * Math.max(0, Math.sin(this.time * 4));
    const G = MENU.shelves.snapGlow;
    for (const s of this.spots) {
      const target = this.holders.some((h) => h.target === s);
      const empty = s.place.where === 'stand' && !this.progress.loadout[s.place.i];
      for (const m of s.materials) {
        if (target) {
          m.emissive.setHex(G.color);
          m.emissiveIntensity = G.intensity;
        } else if (empty) {
          m.emissive.setHex(MENU.stand.emptyGlow);
          m.emissiveIntensity = pulse * 0.6;
        } else {
          m.emissiveIntensity = 0;
        }
      }
    }
  }

  // ---- Grabbing ----

  /** The grip's middle (menu group cm). */
  private gripLocal(item: Item, out: Vector3): Vector3 {
    item.model.localToWorld(out.set(0, item.gripMid, 0));
    return this.group.worldToLocal(out);
  }

  /** The nearest thing a hand could grab, within MENU.shelves.grabRadius of its palm or pinch. */
  /** Debug: each tool's grip middle (world m), locked or not, and what each tracked hand is near now. */
  debugGrips(hands: HandState[]): string[] {
    const lines: string[] = [
      `[shelf] update clock ${this.time.toFixed(2)} s, holders ${this.holders.map((h) => `${h.hand.side}:${h.item.kind}/${h.item.name} visible ${h.item.model.visible}`).join('; ') || 'none'}`,
    ];
    const f = (v: Vector3): string => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    for (const item of this.items) {
      if (item.kind !== 'tool') continue;
      item.model.localToWorld(temp.set(0, item.gripMid, 0));
      lines.push(`[shelf] ${item.name} grip ${f(temp)}${item.locked ? ' LOCKED' : ''} visible ${item.model.visible} held ${this.holders.some((h) => h.item === item)}`);
    }
    for (const s of this.spots) {
      this.group.localToWorld(temp.copy(s.top));
      lines.push(`[shelf] spot ${s.place.where} ${s.place.i} at ${f(temp)} holds ${s.place.where === 'stand' ? this.progress.loadout[s.place.i] : '-'}`);
    }
    for (const holder of this.holders) lines.push(`[shelf] holder ${holder.hand.side} target ${holder.target ? `${holder.target.place.where} ${holder.target.place.i}` : 'none'}`);
    for (const hand of hands) {
      const near = hand.tracked ? this.nearest(hand) : null;
      lines.push(`[shelf] hand ${hand.side} tracked ${hand.tracked} palm ${f(hand.palm)} pinch ${hand.pinch.on} fist ${hand.fist.on} near ${near?.name ?? 'none'}`);
    }
    return lines;
  }

  private nearest(hand: HandState): Item | null {
    const radius = MENU.shelves.grabRadius * this.stage.boardScale;
    let best: Item | null = null;
    let bestD = radius;
    for (const item of this.items) {
      if (this.holders.some((h) => h.item === item)) continue;
      // A preview can be grabbed only off the card that shows it now (and not while it glides back).
      if (item.kind === 'preview' && (item.name !== this.rewardNow?.tool || item.glide > 0)) continue;
      item.model.localToWorld(temp.set(0, item.gripMid, 0));
      const d = Math.min(temp.distanceTo(hand.palm), temp.distanceTo(hand.pinchPoint));
      if (d < bestD) {
        bestD = d;
        best = item;
      }
    }
    return best;
  }

  private grab(hand: HandState, item: Item, viaPinch: boolean): void {
    item.model.updateMatrixWorld(true);
    handMatrix.compose(viaPinch ? hand.pinchPoint : hand.palm, hand.quaternion, unit);
    const offset = new Matrix4().copy(handMatrix).invert().multiply(item.model.matrixWorld);
    this.holders.push({ hand, item, viaPinch, openTime: 0, lostTime: 0, offset, target: null });
    if (import.meta.env.DEV) note(`[shelf] grab ${item.kind}/${item.name} with ${hand.side} ${viaPinch ? 'pinch' : 'fist'}`);
    item.glide = 0;
    item.heldScale = item.model.scale.x;
    this.audio.play('grab', hand.palm);
    this.showTag(item, 0);
    if (item.kind === 'tool' && item.name) this.onGrabTool(item.name as PickTool);
    // A reward off the card: the full-size copy comes into the hand, the card's small one hides meanwhile.
    if (item.kind === 'preview') {
      item.model.visible = true;
      this.rewardNow?.showOnCard(false);
      this.previewShowing = item;
    }
  }

  private updateHeld(holder: Holder, dt: number): void {
    const { hand, item } = holder;
    holder.lostTime = hand.tracked ? 0 : holder.lostTime + dt;
    holder.openTime = hand.fist.on || hand.pinch.on || !hand.tracked ? 0 : holder.openTime + dt;
    if (holder.lostTime > 0.6 || holder.openTime >= MENU.shelves.releaseHold) {
      this.letGo(holder);
      return;
    }
    if (!hand.tracked) return;
    // Letting go: it stays where it is, with the slot it would snap to (2026-11-17, found in the emulator: the
    // pinch point moves several cm as the fingers open, so the tool drifted off the slot during the release,
    // lost its target and glided back to the shelf; nothing could be put on the stand).
    if (holder.openTime > 0) return;
    const name = item.name;
    // A tool in a fist (a reward preview too) is held the way it is held in real life, growing to full size.
    // A pinch keeps it as it was grabbed (its size and angle), easy to turn and look around.
    if (!holder.viaPinch && (item.kind === 'tool' || item.kind === 'preview') && name) {
      // A fist holds a tool the way it is held in real life, growing to full size.
      item.heldScale += (1 - item.heldScale) * Math.min(1, dt * 8);
      holdMatrix(hand, name as HoldName, 0.01 * this.stage.boardScale * item.heldScale, handMatrix);
    } else {
      handMatrix.compose(holder.viaPinch ? hand.pinchPoint : hand.palm, hand.quaternion, unit).multiply(holder.offset);
    }
    matrix.copy(this.group.matrixWorld).invert().multiply(handMatrix);
    matrix.decompose(item.model.position, item.model.quaternion, scaleOut);
    item.model.scale.setScalar(scaleOut.x);
    // The spot it would snap to now: that platform glows, with a tick when it changes.
    let target = item.kind === 'tool' && name ? this.snapTarget(item, name as PickTool) : null;
    // A slot once targeted stays targeted until the tool is clearly away from it (1.8 times the drop radius):
    // as the fingers open the pinch point slides a couple of cm before the pinch reads as open, and the tool
    // lost its slot in that moment and went back to the shelf (found in the emulator, 2026-11-17).
    if (!target && holder.target) {
      item.model.localToWorld(temp.set(0, item.gripMid, 0));
      const away = this.group.localToWorld(temp2.copy(holder.target.top)).distanceTo(temp);
      if (away < MENU.shelves.dropRadius * this.stage.boardScale * 1.8) target = holder.target;
    }
    if (target && target !== holder.target) this.audio.play('readyTick', undefined, 1, 0.05);
    holder.target = target;
  }

  /** The nearest place the held tool may go (not where it is, not a locked tool's spot when it would push that onto the stand), within dropRadius of its grip. */
  private snapTarget(item: Item, tool: PickTool): Spot | null {
    item.model.localToWorld(temp.set(0, item.gripMid, 0));
    let best: Spot | null = null;
    let bestD = MENU.shelves.dropRadius * this.stage.boardScale;
    for (const s of this.spots) {
      if (!canMoveTo(this.progress, tool, s.place)) continue;
      const d = this.group.localToWorld(temp2.copy(s.top)).distanceTo(temp);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  /** Let go: over a place it may go it snaps in (a click, a puff); else it glides back to where it was. */
  private letGo(holder: Holder): void {
    this.holders = this.holders.filter((h) => h !== holder);
    const item = holder.item;
    const target = holder.target;
    if (import.meta.env.DEV) note(`[shelf] let go ${item.kind}/${item.name} target ${target ? `${target.place.where} ${target.place.i}` : 'none'} open ${holder.openTime.toFixed(2)} lost ${holder.lostTime.toFixed(2)}`);
    this.startGlide(item);
    if (!target || item.kind !== 'tool' || !item.name) return;
    const at = this.group.localToWorld(temp2.copy(target.top));
    this.particles.burst(at, POOF, 12, 0.16);
    this.audio.play('buttonClick', at);
    this.audio.play('toolPoof', at);
    if (target.place.where === 'stand') this.audio.play('cheer', at, 0.6);
    this.onDrop(item.name as PickTool, target.place);
  }

  /** The tag over a thing: one of the tags drawn at the start (only its picture changes, nothing is drawn now). */
  private showTag(item: Item, seconds: number): void {
    this.tagLeft = seconds;
    this.tagFor = item;
    const key = item.kind === 'trophy' ? this.trophyKey(item) : item.locked ? `${item.name}|locked` : item.name!;
    const material = this.tag.material as MeshBasicMaterial;
    const texture = this.tagTextures.get(key);
    if (texture && material.map !== texture) material.map = texture;
  }

  /**
   * Every tag there can be, drawn once at the start (each its own texture).
   * The first grab of a thing used to draw and upload its tag, and that frame
   * hitched: the view (the clouds too) flickered once per thing.
   */
  private drawTags(): void {
    const S = MENU.shelves;
    const tags: [string, string, string, boolean][] = [];
    for (const name of Object.keys(TOOL_TAGS) as DisplayName[]) {
      tags.push([name, TOOL_TAGS[name][0], TOOL_TAGS[name][1], false]);
      if ((PICK_TOOLS as string[]).includes(name)) tags.push([`${name}|locked`, TOOL_TAGS[name][0], unlockText(name as PickTool), true]);
    }
    const page = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(S.tagWidth * 40);
      canvas.height = Math.round(S.tagHeight * 40);
      const c = canvas.getContext('2d')!;
      parchment(c, canvas.width, canvas.height);
      return [canvas, c];
    };
    for (const [key, title, line, locked] of tags) {
      const [canvas, c] = page();
      const w = canvas.width;
      const h = canvas.height;
      drawLine(c, title, w / 2, h * 0.34, w * 0.88, h * 0.26, UI_COLORS.ink);
      drawLine(c, line, w / 2, h * 0.68, w * 0.88, h * 0.2, locked ? UI_COLORS.warn : UI_COLORS.note);
      this.tagTextures.set(key, canvasTexture(canvas, 4));
    }
    // v3 2.6: each trophy's two tags: before it is earned (a secret's riddle, a regular one's goal) and after.
    for (const a of ACHIEVEMENT_LIST) {
      for (const has of [0, 1]) {
        const [canvas, c] = page();
        const w = canvas.width;
        const h = canvas.height;
        const [first, second] = has ? a.earned : a.hint;
        drawLine(c, has || !a.secret ? a.name : `? ${a.name} ?`, w / 2, h * 0.27, w * 0.88, h * 0.22, has ? UI_COLORS.ink : a.secret ? '#7a3fb0' : UI_COLORS.ink);
        drawLine(c, first, w / 2, h * 0.57, w * 0.88, h * 0.17, UI_COLORS.note);
        drawLine(c, second, w / 2, h * 0.78, w * 0.88, h * 0.17, UI_COLORS.note);
        this.tagTextures.set(`trophy|${a.id}|${has}`, canvasTexture(canvas, 4));
      }
    }
  }

  /**
   * Uploads every tag and compiles the tag's shader now (the game calls it at
   * setup), so the first time a tag shows costs nothing.
   */
  warm(renderer: WebGLRenderer, scene: Object3D, camera: Camera): void {
    for (const texture of this.tagTextures.values()) renderer.initTexture(texture);
    const wasVisible = this.group.visible;
    this.tag.visible = true;
    // Each tool's other look (locked grey or its own colors) too: flipping "Unlock all tools" swapped to a
    // material never compiled, and that frame flickered (2026-11-17).
    const swapped: [Mesh, Mesh['material']][] = [];
    for (const item of this.tools.values()) {
      item.model.traverse((o) => {
        const mesh = o as Mesh;
        const other = (item.locked ? mesh.userData.own : item.model.userData.silhouette) as MeshStandardMaterial | undefined;
        if (!mesh.isMesh || !other) return;
        swapped.push([mesh, mesh.material]);
        mesh.material = other;
      });
    }
    renderer.compile(scene, camera);
    for (const [mesh, material] of swapped) mesh.material = material;
    this.tag.visible = false;
    this.group.visible = wasVisible;
  }

  // ---- Going home ----

  private home(item: Item): void {
    item.glide = 0;
    item.model.position.copy(item.home);
    item.model.quaternion.copy(item.homeQuat);
    item.model.scale.setScalar(item.homeScale);
  }

  private startGlide(item: Item): void {
    item.glide = MENU.shelves.returnTime;
    item.from.copy(item.model.position);
    item.fromQuat.copy(item.model.quaternion);
    item.fromScale = item.model.scale.x;
  }

  private updateGlide(item: Item, dt: number): void {
    item.glide = Math.max(0, item.glide - dt);
    const t = 1 - item.glide / MENU.shelves.returnTime;
    const s = t * t * (3 - 2 * t);
    item.model.position.lerpVectors(item.from, item.home, s);
    item.model.quaternion.slerpQuaternions(item.fromQuat, item.homeQuat, s);
    item.model.scale.setScalar(item.fromScale + (item.homeScale - item.fromScale) * s);
    // A reward preview back on the card: the card's own small copy shows again.
    if (item.glide <= 0 && item.kind === 'preview') this.endPreview(item);
  }

  // ---- Reward previews (a tool grabbed off the campaign card) ----

  /** Where the card's reward is (or null): the game links it (Menu). */
  rewardSource: () => ReturnType<CampaignPanel['rewardShown']> = () => null;
  private rewardNow: ReturnType<CampaignPanel['rewardShown']> = null;
  private previewShowing: Item | null = null;
  /** The card's reward copy's look now (Ready while a hand is near it). */
  private cardTouch: TouchState = 'idle';
  private previews = new Map<PickTool, Item>();

  /** A full-size copy of each pick tool to hold when it is grabbed off the card (hidden until then). */
  addPreviews(models: Partial<Record<PickTool, DisplayModel>>): void {
    for (const [tool, d] of Object.entries(models) as [PickTool, DisplayModel][]) {
      const item = this.addItem('preview', tool, { ...d, lift: 0, turn: null }, new Vector3(), 0, 1);
      item.model.visible = false;
      this.previews.set(tool, item);
    }
  }

  /**
   * Every frame: the reward previews rest exactly where the card's small copy
   * is (its world pose), so a grab picks it up from there and a let go glides
   * it back there.
   */
  private followReward(): void {
    const source = this.rewardSource();
    // The card changed or closed while a preview was out: it goes away at once.
    if (this.previewShowing && (!source || source.tool !== this.previewShowing.name) && !this.holders.some((h) => h.item === this.previewShowing)) {
      this.endPreview(this.previewShowing);
    }
    // A new card: its copy starts without the Ready glow (the old one is cleared).
    if (source?.model !== this.rewardNow?.model) {
      if (this.rewardNow) applyTouchState(this.rewardNow.materials, 'idle');
      this.cardTouch = 'idle';
    }
    this.rewardNow = source;
    if (!source) return;
    const item = this.previews.get(source.tool);
    if (!item) return;
    source.model.updateWorldMatrix(true, false);
    matrix.copy(this.group.matrixWorld).invert().multiply(source.model.matrixWorld);
    matrix.decompose(item.home, item.homeQuat, scaleOut);
    item.homeScale = scaleOut.x;
    if (!item.model.visible) this.home(item);
  }

  private endPreview(item: Item): void {
    item.model.visible = false;
    item.glide = 0;
    if (this.previewShowing === item) this.previewShowing = null;
    this.rewardNow?.showOnCard(true);
    this.rewardSource()?.showOnCard(true);
  }
}

/** The parchment behind a sign or tag (a plain fill if the image did not load). */
function parchment(c: CanvasRenderingContext2D, w: number, h: number): void {
  if (drawNineSlice(c, 'panel', 0, 0, w, h, 12, 24)) return;
  c.fillStyle = '#e8d7b0';
  c.fillRect(0, 0, w, h);
}

/** Gives a model's meshes their own copies of their materials (so their looks are their own), colors times `shade`. */
function ownMaterials(model: Object3D, shade: number): MeshStandardMaterial[] {
  const materials: MeshStandardMaterial[] = [];
  const copies = new Map<unknown, MeshStandardMaterial>();
  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    let copy = copies.get(mesh.material);
    if (!copy) {
      copy = (mesh.material as MeshStandardMaterial).clone();
      copy.color.multiplyScalar(shade);
      copies.set(mesh.material, copy);
      materials.push(copy);
    }
    mesh.material = copy;
  });
  return materials;
}
