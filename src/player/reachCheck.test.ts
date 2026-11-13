import { describe, expect, it } from 'vitest';
import { CALIBRATION } from '../config/game.js';
import type { HandState } from './hands.js';
import { ReachCheck } from './reachCheck.js';

const head = { x: 0, y: 1.2, z: 0 };
/** A fake hand, `forward` meters in front of the head. */
const hand = (forward: number, tracked = true): HandState => ({ tracked, pinchPoint: { x: 0, y: 1.05, z: -forward } }) as unknown as HandState;

function run(check: ReachCheck, seconds: number, hands: () => HandState[], dt = 1 / 72): void {
  for (let t = 0; t < seconds; t += dt) check.update(dt, hands(), head as never);
}

describe('reach check', () => {
  it('gives the player time to read: an arm already out does not count until readSeconds pass', () => {
    const check = new ReachCheck();
    check.start();
    run(check, CALIBRATION.readSeconds * 0.8, () => [hand(0.6), hand(0.2)]);
    expect(check.phase).toBe('waiting');
  });

  it('needs the hand far enough out', () => {
    const check = new ReachCheck();
    check.start();
    run(check, CALIBRATION.readSeconds + 2, () => [hand(CALIBRATION.startReach - 0.05), hand(0.2)]);
    expect(check.phase).toBe('waiting');
  });

  it('waits while the hand still moves, counts once it is still, and finishes', () => {
    const check = new ReachCheck();
    check.start();
    let t = 0;
    // Still adjusting: the hand sways 10 cm back and forth, quickly.
    run(check, CALIBRATION.readSeconds + 2, () => {
      t += 1 / 72;
      return [hand(0.55 + 0.05 * Math.sin(t * 12)), hand(0.2)];
    });
    expect(check.phase).toBe('settling');
    // Then it holds still: the countdown starts and runs out.
    run(check, CALIBRATION.stillFor + 0.6, () => [hand(0.55), hand(0.2)]);
    expect(check.phase).toBe('counting');
    run(check, CALIBRATION.holdSeconds + 0.2, () => [hand(0.55), hand(0.2)]);
    expect(check.phase).toBe('done');
    expect(check.reach).toBeGreaterThan(0.5);
  });

  it('stops the countdown if the hand starts moving a lot again', () => {
    const check = new ReachCheck();
    check.start();
    run(check, CALIBRATION.readSeconds + CALIBRATION.stillFor + 0.5, () => [hand(0.55), hand(0.2)]);
    expect(check.phase).toBe('counting');
    let t = 0;
    run(check, 0.8, () => {
      t += 1 / 72;
      return [hand(0.55 + 0.08 * Math.sin(t * 15)), hand(0.2)];
    });
    expect(check.phase).not.toBe('counting');
    expect(check.phase).not.toBe('done');
  });
});
