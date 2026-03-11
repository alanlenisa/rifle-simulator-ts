// ============================================================
// Breathing simulation — updates swayX/swayY in GameState
// and returns a BreathStatus for the UI to display.
// ============================================================

import { BREATH_PERIOD_S } from './constants';
import type { BreathStatus, GameState } from './types';

const TWO_PI = Math.PI * 2;

export function updateBreathing(state: GameState, dt: number): BreathStatus {
  if (state.holdingBreath) {
    state.holdTime += dt;
    applyHoldSway(state);
    return buildHoldStatus(state.holdTime);
  }

  // Resume normal breathing
  state.holdTime = 0;
  state.breathPhase = (state.breathPhase + dt / BREATH_PERIOD_S) % 1;
  return applyNormalSway(state);
}

// ------------------------------------------------------------------
// Normal breathing sway
// ------------------------------------------------------------------

function applyNormalSway(state: GameState): BreathStatus {
  const p = state.breathPhase;
  let phase: string;
  let fill: number;
  let amplitude: number;

  if (p < 0.38) {
    phase = '↑ INSPIRA';
    fill = p / 0.38;
    amplitude = 0.35 + 0.65 * Math.sin((p / 0.38) * Math.PI);
  } else if (p < 0.48) {
    phase = '— PAUSA';
    fill = 1;
    amplitude = 0.85;
  } else if (p < 0.88) {
    phase = '↓ ESPIRA';
    fill = 1 - (p - 0.48) / 0.40;
    amplitude = 0.55 + 0.45 * Math.sin(((p - 0.48) / 0.40) * Math.PI);
  } else {
    // Natural Respiratory Pause — optimal firing window
    phase = '◉ NRP';
    fill = 0.03;
    amplitude = 0.04 + 0.18 * ((p - 0.88) / 0.12);
  }

  // Lissajous-style sway pattern (two out-of-phase sine waves)
  const t = p * TWO_PI;
  state.swayY = 24 * amplitude * Math.sin(t + 0.4);
  state.swayX =  7 * amplitude * Math.sin(t * 0.65 + 1.2);

  // Superimpose subtle heartbeat (~1.1 Hz)
  const hb = performance.now() / 1000;
  state.swayY += 1.8 * Math.sin(hb * 1.1 * TWO_PI);
  state.swayX += 0.9 * Math.sin(hb * 1.1 * TWO_PI + 1.5);

  const isOptimal = p >= 0.88;
  return {
    isHolding: false,
    phase,
    fill,
    isOptimal,
    holdSeconds: 0,
    statusLabel: isOptimal ? '◉ MOMENTO OTTIMALE' : 'Respiro normale',
    statusColor: isOptimal ? '#40ff60' : '#b8c090',
  };
}

// ------------------------------------------------------------------
// Breath-hold sway
// Windows:
//   0 – 1.5 s  stabilisation (amplitude drops from 0.40 → 0.08)
//   1.5 – 4 s  optimal window (amplitude ≈ 0.08)
//   4 – 7 s    tremor builds
//   > 7 s      strong tremor
// ------------------------------------------------------------------

function applyHoldSway(state: GameState): void {
  const held = state.holdTime;
  let amplitude: number;

  if (held < 1.5)      amplitude = 0.40 - (held / 1.5) * 0.32;
  else if (held < 4.0) amplitude = 0.08;
  else if (held < 7.0) amplitude = 0.08 + ((held - 4.0) / 3.0) * 0.55;
  else                 amplitude = Math.min(1.5, 0.63 + (held - 7.0) * 0.12);

  const t = performance.now() / 1000;
  const freq = 1.0 + held * 0.06; // tremor frequency rises with time

  state.swayY = 24 * amplitude * Math.sin(t * freq * TWO_PI * 1.2 + 0.8);
  state.swayX =  8 * amplitude * Math.sin(t * freq * TWO_PI + 0.3);

  if (held > 4.5) {
    const tremor = (held - 4.5) * 0.6;
    state.swayY += tremor * Math.sin(t * 8.5 * TWO_PI);
    state.swayX += tremor * 0.6 * Math.sin(t * 7.3 * TWO_PI + 1.8);
  }
}

function buildHoldStatus(held: number): BreathStatus {
  let statusLabel: string;
  let statusColor: string;

  if (held < 1.5)      { statusLabel = 'Stabilizzazione';      statusColor = '#c0d880'; }
  else if (held < 4.0) { statusLabel = '◉ FINESTRA OTTIMALE';  statusColor = '#40ff60'; }
  else if (held < 7.0) { statusLabel = 'Tremore iniziale';     statusColor = '#d0a030'; }
  else                 { statusLabel = 'TREMORE FORTE!';        statusColor = '#e05030'; }

  return {
    isHolding: true,
    phase: 'APNEA',
    fill: 0,
    isOptimal: held >= 1.5 && held < 4.0,
    holdSeconds: held,
    statusLabel,
    statusColor,
  };
}
