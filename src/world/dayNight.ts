// Day and night (docs/mvp.md, "Day and night cycle"). Blends everything
// that changes with the time of day: the sky (dome, sun, moon, stars, ringed
// planet, cloud tint), the one real light (sun or moon: direction, color,
// strength), the fog color, the soft sky fill, the night rim on the units and
// the terrain fade.
//
// The game picks the time from the waves (src/rules/dayNight.ts). A change
// takes DAY_NIGHT.changeSeconds, eased, and only runs between waves. When
// nothing changes it does nothing, so a wave costs no extra time.
import { Color, type DirectionalLight, type Fog, type Scene } from 'three';
import { DAY_NIGHT, type TimeOfDay } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import { setTerrainLook } from '../fx/nightFade.js';
import { setNightRim } from '../fx/nightRim.js';
import { skyDirection, type Sky } from './sky.js';

const tint = new Color();
const terrain = new Color();
const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
/** The light sits this far from the board's middle (meters), toward its direction. */
const LIGHT_DISTANCE = 7;

export class DayNight {
  private from: TimeOfDay = 'morning';
  private to: TimeOfDay = 'morning';
  /** How far the change from `from` to `to` is (0 to 1, 1 = done). */
  private t = 1;
  private fill = DAY_NIGHT.looks.morning.fill;
  private lightLevel = 0;

  constructor(
    private sky: Sky | null,
    private light: DirectionalLight,
    private fog: Fog,
    private scene: Scene,
  ) {
    this.apply();
  }

  /** How bright the night lights are now (windows, torches, lanterns: 0 = off, 1 = full). */
  get lights(): number {
    return this.lightLevel;
  }

  /** The time of day it is, or is changing to. */
  get time(): TimeOfDay {
    return this.to;
  }

  /** Moves to `time` over DAY_NIGHT.changeSeconds, or jumps there at once with `snap` (a new battle). */
  show(time: TimeOfDay, snap = false): void {
    if (!DAY_NIGHT.enabled) time = 'morning';
    if (snap) {
      this.from = this.to = time;
      this.t = 1;
      this.apply();
      return;
    }
    if (time === this.to) return;
    // A new change halfway through another (debug only) starts from the nearer end.
    this.from = this.t < 0.5 ? this.from : this.to;
    this.to = time;
    this.t = 0;
    mark('time of day');
    console.info(`[day night] ${this.from} to ${time}`);
  }

  update(dt: number): void {
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / DAY_NIGHT.changeSeconds);
      this.apply();
    }
    // IWSDK sets the fill once when its sky light loads, so it is set again every frame (a plain number).
    this.scene.environmentIntensity = this.fill;
  }

  private apply(): void {
    // Eased in and out, so it starts and ends softly.
    const t = this.t * this.t * (3 - 2 * this.t);
    const a = DAY_NIGHT.looks[this.from];
    const b = DAY_NIGHT.looks[this.to];
    this.sky?.apply(this.from, this.to, t);
    skyDirection(lerp(a.lightAt[0], b.lightAt[0], t), lerp(a.lightAt[1], b.lightAt[1], t), this.light.position).multiplyScalar(
      LIGHT_DISTANCE,
    );
    this.light.color.setHex(a.lightColor).lerp(tint.setHex(b.lightColor), t);
    this.light.intensity = lerp(a.lightIntensity, b.lightIntensity, t);
    // The haze is the dome's horizon color.
    this.fog.color.setHex(a.domeHorizon).lerp(tint.setHex(b.domeHorizon), t);
    this.fill = lerp(a.fill, b.fill, t);
    this.scene.environmentIntensity = this.fill;
    setNightRim(lerp(a.rim, b.rim, t));
    terrain.setHex(a.terrainTint).multiplyScalar(a.terrainBright).lerp(tint.setHex(b.terrainTint).multiplyScalar(b.terrainBright), t);
    setTerrainLook(terrain, lerp(a.terrainGrey, b.terrainGrey, t));
    this.lightLevel = lerp(a.lights, b.lights, t);
  }
}
