// ============================================================
// Pure physics functions — no side effects, no DOM access.
// All functions are typed so that wrong argument order is
// caught at compile time.
// ============================================================

import { BDATA, RINGS } from './constants';
import type { GameState } from './types';

const DEG_TO_RAD = Math.PI / 180;

// ------------------------------------------------------------------
// Linear interpolation over a ballistic lookup table column
// ------------------------------------------------------------------
function lerpTable(table: readonly number[], dist: number): number {
  const xs = BDATA.distances;
  if (dist <= xs[0]) return table[0];
  if (dist >= xs[xs.length - 1]) return table[xs.length - 1];
  for (let i = 0; i < xs.length - 1; i++) {
    if (dist >= xs[i] && dist <= xs[i + 1]) {
      const t = (dist - xs[i]) / (xs[i + 1] - xs[i]);
      return table[i] + t * (table[i + 1] - table[i]);
    }
  }
  return 0; // unreachable given the guards above
}

/** Bullet drop in cm below 100 m zero (positive = below POA) */
export function getBulletDrop(dist: number): number {
  return lerpTable(BDATA.drop, dist);
}

/** Time of flight in milliseconds */
export function getTimeOfFlight(dist: number): number {
  return lerpTable(BDATA.tof, dist);
}

/** Wind drift coefficient: cm per km/h of pure 90° crosswind */
function getWdpk(dist: number): number {
  return lerpTable(BDATA.wdpk, dist);
}

// ------------------------------------------------------------------
// MOA / angular helpers
// ------------------------------------------------------------------

/** Convert MOA to centimetres at a given distance */
export function moaToCm(moa: number, dist: number): number {
  return moa * 2.908 * (dist / 100);
}

// ------------------------------------------------------------------
// Wind geometry
// ------------------------------------------------------------------

/**
 * Angle (degrees) between the wind's travel direction and the
 * bullet's travel direction (firing North = 0°).
 * 90° / 270° = full crosswind; 0° / 180° = head/tail wind.
 */
function windCrossAngleDeg(state: GameState): number {
  const windTravelDir = (state.wind.direction + 180) % 360;
  let angle = windTravelDir - 0; // firing direction = North = 0
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

/**
 * Signed wind drift in cm at an arbitrary distance.
 * Used by the trajectory renderer to sample the drift curve.
 * Positive = drift to the right.
 */
export function windDriftCmAtDist(dist: number, windSpeed: number, windDirection: number): number {
  if (dist < 1) return 0;
  const windTravelDir = (windDirection + 180) % 360;
  const crossComponent = Math.sin(windTravelDir * DEG_TO_RAD);
  return windSpeed * crossComponent * getWdpk(dist);
}

/**
 * Signed wind drift in cm at the current scenario distance.
 * Positive = drift to the right of the target.
 */
export function windDriftCm(state: GameState): number {
  const angleDeg = windCrossAngleDeg(state);
  // sin gives the lateral component; its sign gives direction (right/left)
  const crossComponent = Math.sin(angleDeg * DEG_TO_RAD);
  return state.wind.speed * crossComponent * getWdpk(state.dist);
}

/** Compass label for wind origin (e.g. "W", "NW") */
export function windDirLabel(state: GameState): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  return dirs[Math.round(state.wind.direction / 45) % 8];
}

/** Clock position (1–12) of the wind relative to a shooter facing North */
export function windClockPos(state: GameState): number {
  const rel = (state.wind.direction + 180) % 360; // where wind is going TO
  const clock = Math.round(rel / 30) % 12;
  return clock === 0 ? 12 : clock;
}

/** Short description of the clock-angle effect */
export function windClockEffect(clock: number): string {
  if (clock === 3 || clock === 9) return '90° — effetto massimo';
  if (clock === 6 || clock === 12) return 'testa/coda — nessuna deriva';
  return 'componente parziale';
}

// ------------------------------------------------------------------
// Scope compensation
// ------------------------------------------------------------------

/** cm of elevation compensation dialed in (positive = moves impact UP) */
export function scopeElevCm(state: GameState): number {
  return moaToCm(state.scopeElev * 0.25, state.dist);
}

/** cm of windage compensation dialed in (positive = moves impact RIGHT) */
export function scopeWindCm(state: GameState): number {
  return moaToCm(state.scopeWind * 0.25, state.dist);
}

// ------------------------------------------------------------------
// Scoring
// ------------------------------------------------------------------

/**
 * Given a radial distance from the target centre (in cm),
 * returns the score for the innermost ring that contains the hit.
 *
 * NOTE: RINGS is ordered outside→inside (largest r first).
 * We iterate in REVERSE so we find the smallest ring first — this
 * was the bug in the original HTML version that always returned 0.
 */
export function calcScore(distFromCenterCm: number): number {
  for (let i = RINGS.length - 1; i >= 0; i--) {
    if (distFromCenterCm <= RINGS[i].r) return RINGS[i].s;
  }
  return 0; // complete miss
}
