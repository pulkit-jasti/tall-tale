// Win and lose rules (docs/castle-rules.md). Plain functions on a small state
// object, so they can be tested without Three.js. The flags only show it.

export type BattlePhase = 'playing' | 'won' | 'lost';

export interface BattleRules {
  /** Castle health at the start (the top of the red flag's pole). */
  maxHealth: number;
  /** Share of the missing health repaired in each breather (0.35 = 35%). Part of it, never all. */
  repairShare: number;
}

export interface BattleState {
  phase: BattlePhase;
  health: number;
  maxHealth: number;
  /** Waves cleared so far (the blue flag's notch). */
  wavesCleared: number;
  totalWaves: number;
}

export function createBattle(totalWaves: number, rules: BattleRules): BattleState {
  return { phase: 'playing', health: rules.maxHealth, maxHealth: rules.maxHealth, wavesCleared: 0, totalWaves };
}

/** The castle takes damage. At zero health the battle is lost. */
export function damageCastle(state: BattleState, amount: number): void {
  if (state.phase !== 'playing' || amount <= 0) return;
  state.health = Math.max(0, state.health - amount);
  if (state.health === 0) state.phase = 'lost';
}

/**
 * A wave is cleared: the wave flag climbs a notch. After the last wave the
 * battle is won. Otherwise the breather starts and repairs part of the damage.
 */
export function clearWave(state: BattleState, rules: BattleRules): void {
  if (state.phase !== 'playing') return;
  state.wavesCleared = Math.min(state.totalWaves, state.wavesCleared + 1);
  if (state.wavesCleared >= state.totalWaves) {
    state.phase = 'won';
    return;
  }
  state.health += (state.maxHealth - state.health) * rules.repairShare;
}

/** Debug: the castle falls right away. */
export function loseCastle(state: BattleState): void {
  damageCastle(state, state.health);
}

/** Castle health as a share from 0 (fallen) to 1 (full). */
export const healthShare = (state: BattleState): number => state.health / state.maxHealth;
