// A pose switch with two thresholds and a short hold, so hand poses do not
// flicker (docs/controls-and-ui.md, "Reliability rules"). No Three.js here.

export class PoseSwitch {
  on = false;
  started = false;
  ended = false;
  private timer = 0;

  constructor(
    private holdOn: number,
    private holdOff: number,
  ) {}

  /**
   * `wantOn`: the value is past the start threshold.
   * `wantOff`: the value is past the end threshold.
   */
  update(wantOn: boolean, wantOff: boolean, dt: number): void {
    this.started = false;
    this.ended = false;
    if (!this.on) {
      this.timer = wantOn ? this.timer + dt : 0;
      if (this.timer >= this.holdOn) {
        this.on = true;
        this.started = true;
        this.timer = 0;
      }
    } else {
      this.timer = wantOff ? this.timer + dt : 0;
      if (this.timer >= this.holdOff) {
        this.on = false;
        this.ended = true;
        this.timer = 0;
      }
    }
  }

  /** Ends the pose right away (for lost tracking). */
  forceOff(): void {
    this.started = false;
    this.ended = this.on;
    this.on = false;
    this.timer = 0;
  }
}
