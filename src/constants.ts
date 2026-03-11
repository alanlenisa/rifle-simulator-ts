import type { BallisticTable, Ring, Scenario } from './types';

// ------------------------------------------------------------------
// Ballistic look-up table
// .308 Win / 7.62×51 mm NATO, 175 gr Sierra MatchKing
// Standard conditions: 15 °C, sea level, ICAO atmosphere
// Zero: 100 m
// ------------------------------------------------------------------
export const BDATA: BallisticTable = {
  distances: [50,   100,  150,  200,  250,  300,   400,   500,   600,   800],
  drop:      [-5.1,  0.0,  6.8, 16.8, 31.5, 51.8, 115.2, 207.5, 337.8, 721.0],
  tof:       [59,   121,  187,  258,  333,  415,   597,   799,  1026,  1551],
  wdpk:      [0.19, 0.42, 0.70, 1.04, 1.44, 1.91,  3.02,  4.40,  6.12, 10.42],
} as const;

// ------------------------------------------------------------------
// Target rings — ordered OUTSIDE → INSIDE (largest r first).
// calcScore() in physics.ts iterates in reverse to find the
// innermost ring that contains the hit, avoiding the "always 0"
// bug that plagued the plain-HTML version.
// ------------------------------------------------------------------
export const RINGS: readonly Ring[] = [
  { r: 50.5, s:  0, fill: '#c8c0a0', stroke: '#a0a090' }, // outer white / miss zone
  { r: 40.5, s:  2, fill: '#bcb4a0', stroke: '#a0a090' },
  { r: 30.5, s:  4, fill: '#b0a89a', stroke: '#909080' },
  { r: 22.5, s:  6, fill: '#606060', stroke: '#505050' },
  { r: 15.5, s:  7, fill: '#4a4a4a', stroke: '#3a3a3a' },
  { r: 10.5, s:  8, fill: '#202020', stroke: '#1a1a1a' },
  { r:  7.0, s:  9, fill: '#181818', stroke: '#101010' },
  { r:  4.0, s: 10, fill: '#141414', stroke: '#0a0a0a' },
  { r:  1.2, s: 10, fill: '#e8e0c0', stroke: '#e8e0c0' }, // X-ring bull
] as const;

// ------------------------------------------------------------------
// Preset scenarios
// ------------------------------------------------------------------
export const SCENARIOS: Readonly<Record<string, Scenario>> = {
  p100: { name: 'Poligono 100 m',      dist: 100, ws:  0, wd: 270, temp: 20, alt:    0, ammo: 10 },
  p300: { name: 'Campo 300 m',         dist: 300, ws:  8, wd: 270, temp: 15, alt:    0, ammo: 10 },
  p500: { name: 'Campo 500 m',         dist: 500, ws: 15, wd: 315, temp: 12, alt:  500, ammo:  8 },
  p800: { name: 'Lungo raggio 800 m',  dist: 800, ws: 20, wd: 225, temp: 10, alt: 1000, ammo:  5 },
} as const;

export const BREATH_PERIOD_S = 4.2; // seconds per full breath cycle
export const SCOPE_MAGNIFICATION = 10;
