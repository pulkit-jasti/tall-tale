// The food jar (docs/giant-tools.md section 7): one shared food bar shown as
// a pot beside the left tool platforms. Eating fills it, tools empty it. The
// food shows as a little heap of food balls on the pot's mouth, one ball per
// food, that pop in and out. It lives in boardLift, so it rises with the
// board but never turns. The rules are in rules/food.ts.
import { Color, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Vector3 } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { FOOD, FOOD_JAR } from '../config/game.js';
import type { Particles } from '../fx/particles.js';
import { addFood, canAfford, createFood, eatValue, resetFood, spendFood, type FoodState } from '../rules/food.js';
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';
import { cloneStatic, loadTemplate } from './models.js';
import { foodBallGeometry, post } from './shapes.js';
import type { Stage } from './stage.js';

const temp = new Vector3();
const matrix = new Matrix4();
const color = new Color();

export class FoodJar {
  readonly state: FoodState = createFood(FOOD);
  private root = new Group();
  private balls!: InstancedMesh;
  /** Each ball's spot on the heap (jar space, cm) and its scale now (0 hidden, 1 shown). */
  private spots: Vector3[] = [];
  private scales: number[] = [];
  private height: number = FOOD_JAR.height;
  /** Called after food goes in or out. */
  onChange: () => void = () => {};

  constructor(
    private stage: Stage,
    private audio: GameAudio,
    private particles: Particles,
  ) {}

  get food(): number {
    return this.state.food;
  }

  async load(): Promise<void> {
    const pot = await loadTemplate('props/mini-dungeon/pot.glb', { height: FOOD_JAR.height });
    this.height = pot.size.y;
    const a = degToRad(FOOD_JAR.angleDeg);
    this.root.position.set(polarX(FOOD_JAR.radius, a), FOOD_JAR.bottomY, polarZ(FOOD_JAR.radius, a));
    this.root.add(cloneStatic(pot));
    // Standing above the board: a post reaches down to it.
    if (FOOD_JAR.bottomY > 0) this.root.add(post(FOOD_JAR.bottomY));
    this.buildHeap();
    this.stage.boardLift.add(this.root);
  }

  /** One ball per food, in layers on the pot's mouth, bottom first. */
  private buildHeap(): void {
    const count = this.state.max;
    const size = FOOD_JAR.ballSize;
    const material = new MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true });
    this.balls = new InstancedMesh(foodBallGeometry(), material, count);
    let layer = 0;
    let inLayer = 0;
    const base = this.height - FOOD_JAR.heapSink + size / 2;
    for (let i = 0; i < count; i++) {
      const layers = FOOD_JAR.layers;
      const perLayer = layers[Math.min(layer, layers.length - 1)];
      // A ring of balls with one in the middle on the bottom layer; smaller rings above.
      const ring = perLayer >= 4 ? perLayer - 1 : perLayer;
      const r = inLayer === ring ? 0 : perLayer === 1 ? 0 : size * (perLayer >= 4 ? 1.05 : 0.6);
      const angle = (inLayer / Math.max(1, ring)) * Math.PI * 2 + layer * 0.6;
      this.spots.push(new Vector3(Math.cos(angle) * r, base + layer * size * 0.75, Math.sin(angle) * r));
      this.scales.push(0);
      this.balls.setColorAt(i, color.setHex(FOOD_JAR.ballColors[i % FOOD_JAR.ballColors.length]));
      inLayer++;
      if (inLayer >= perLayer) {
        layer++;
        inLayer = 0;
      }
    }
    this.balls.frustumCulled = false;
    this.root.add(this.balls);
    // Start with the balls already in place.
    for (let i = 0; i < count; i++) this.scales[i] = i < this.state.food ? 1 : 0;
    this.placeBalls();
  }

  /** A new battle: back to the starting food. */
  reset(): void {
    resetFood(this.state, FOOD);
    this.onChange();
  }

  /** A goblin was eaten. Returns the food that went in (0 when the jar is full). */
  eat(seasoned: boolean): number {
    return this.add(eatValue(FOOD, seasoned));
  }

  add(amount: number): number {
    const added = addFood(this.state, amount);
    if (added > 0) {
      this.pop(6);
      this.audio.play('foodAdded', this.topWorld(temp));
      this.onChange();
    }
    return added;
  }

  canAfford(cost: number): boolean {
    return canAfford(this.state, cost);
  }

  /** Takes the cost out. False when there is not enough. */
  spend(cost: number): boolean {
    if (!spendFood(this.state, cost)) return false;
    this.spent();
    return true;
  }

  /** Food was taken out of the state directly (a tool's first use, see rules/food.ts useTool). */
  spent(): void {
    this.pop(10);
    this.onChange();
  }

  /** The top of the pot's mouth (world), for the tutorial marker. */
  topWorld(out: Vector3): Vector3 {
    out.set(0, this.height, 0).add(this.root.position);
    return this.stage.boardLift.localToWorld(out);
  }

  update(dt: number): void {
    const step = dt / FOOD_JAR.popTime;
    let changed = false;
    for (let i = 0; i < this.scales.length; i++) {
      const target = i < this.state.food ? 1 : 0;
      const s = this.scales[i];
      if (s === target) continue;
      this.scales[i] = target > s ? Math.min(1, s + step) : Math.max(0, s - step);
      changed = true;
    }
    if (changed) this.placeBalls();
  }

  private placeBalls(): void {
    for (let i = 0; i < this.spots.length; i++) {
      const t = this.scales[i];
      // A little overshoot while popping in.
      const s = t <= 0 ? 0 : t >= 1 ? 1 : Math.sin(t * Math.PI * 0.5) * (1 + 0.25 * Math.sin(t * Math.PI));
      matrix.makeScale(s, s, s).setPosition(this.spots[i]);
      this.balls.setMatrixAt(i, matrix);
    }
    this.balls.instanceMatrix.needsUpdate = true;
  }

  private pop(count: number): void {
    this.particles.burst(this.topWorld(temp), FOOD_JAR.popColors, count, 0.2);
  }
}
