// ============================================================
// DOM update functions — one responsibility each.
// All element IDs are referenced through the typed helper `el()`
// so a wrong ID causes an immediate runtime throw (not a silent
// undefined that silently corrupts state).
// ============================================================

import {
  getBulletDrop, getTimeOfFlight, moaToCm,
  windDriftCm, windDirLabel, windClockPos, windClockEffect,
  scopeElevCm, scopeWindCm,
} from './physics';
import type { BreathStatus, GameState } from './types';

// ------------------------------------------------------------------
// Typed element accessor — throws if an ID is mistyped
// ------------------------------------------------------------------

function el<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id) as T | null;
  if (!element) throw new Error(`DOM element #${id} not found — check index.html`);
  return element;
}

// ------------------------------------------------------------------
// Sign-prefixed number formatter
// ------------------------------------------------------------------

function signedCm(value: number, decimals = 1): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(decimals)} cm`;
}

// ------------------------------------------------------------------
// Info panel (left)
// ------------------------------------------------------------------

export function updateInfoPanel(state: GameState): void {
  const d = state.dist;
  const drift = windDriftCm(state);
  const clock = windClockPos(state);

  el('d-dist').textContent  = `${d} m`;
  el('d-wind').textContent  = `${state.wind.speed} km/h ${windDirLabel(state)}`;
  el('d-clock').textContent = `Ore ${clock} — ${windClockEffect(clock)}`;
  el('d-temp').textContent  = `${state.temperature} °C`;
  el('d-alt').textContent   = `${state.altitude} m`;
  el('d-drop').textContent  = `${getBulletDrop(d).toFixed(1)} cm`;
  el('d-drift').textContent = signedCm(drift);
  el('d-tof').textContent   = `${getTimeOfFlight(d).toFixed(0)} ms`;
}

// ------------------------------------------------------------------
// Scope adjustment display (right panel)
// ------------------------------------------------------------------

export function updateAdjDisplay(state: GameState): void {
  const elevMoa = (state.scopeElev * 0.25).toFixed(2);
  const windMoa = (state.scopeWind * 0.25).toFixed(2);
  const prefix  = (n: number) => n >= 0 ? '+' : '';

  el('elev-disp').textContent     = `${prefix(state.scopeElev)}${elevMoa} MOA`;
  el('wind-adj-disp').textContent = `${prefix(state.scopeWind)}${windMoa} MOA`;

  const d = state.dist;
  const ecm = scopeElevCm(state);
  const wcm = scopeWindCm(state);

  // How many clicks would be needed to fully compensate
  const perClick      = moaToCm(0.25, d);
  const neededElev    = Math.round(getBulletDrop(d) / perClick);
  const neededWind    = Math.round(windDriftCm(state) / perClick);
  const missingElev   = neededElev - state.scopeElev;
  const missingWind   = neededWind - state.scopeWind;

  el('elev-cm-hint').textContent = `= ${ecm.toFixed(1)} cm @${d}m  (serve ~${neededElev} clic totali)`;
  el('wind-cm-hint').textContent = `= ${wcm.toFixed(1)} cm @${d}m  (serve ~${neededWind} clic totali)`;

  const tips: string[] = [];
  if (Math.abs(missingElev) > 0) tips.push(`Elev: ${missingElev > 0 ? '+' : ''}${missingElev} clic`);
  if (Math.abs(missingWind) > 0) tips.push(`Deriva: ${missingWind > 0 ? '+' : ''}${missingWind} clic`);

  el('adj-suggest').textContent = tips.length
    ? `💡 Suggerimento: ${tips.join(' | ')}`
    : '✓ Compensazione teoricamente corretta.';
}

// ------------------------------------------------------------------
// Breathing indicator (right panel)
// ------------------------------------------------------------------

export function updateBreathDisplay(status: BreathStatus): void {
  const fill = el<HTMLDivElement>('breath-fill');
  fill.style.width      = `${status.fill * 100}%`;
  fill.style.background = status.isOptimal ? '#30b050' : '#3a6030';

  el('breath-lbl').textContent = status.phase;

  const stateEl = el('breath-state');
  stateEl.textContent  = status.statusLabel;
  stateEl.style.color  = status.statusColor;

  el('hold-time').textContent = status.isHolding
    ? `${status.holdSeconds.toFixed(1)} s`
    : '0.0 s';
}

// ------------------------------------------------------------------
// Ammo display
// ------------------------------------------------------------------

export function updateAmmoDisplay(state: GameState): void {
  const wrap = el('ammo-wrap');
  wrap.innerHTML = '';
  for (let i = 0; i < state.totalAmmo; i++) {
    const dot = document.createElement('div');
    dot.className = i < state.ammoLeft ? 'ammo-dot' : 'ammo-dot spent';
    wrap.appendChild(dot);
  }
}

// ------------------------------------------------------------------
// Score display
// ------------------------------------------------------------------

export function updateScoreDisplay(state: GameState): void {
  const sc = state.lastShot?.score;
  const scoreBig = el('score-big');

  scoreBig.textContent = sc != null ? sc.toString() : '—';
  scoreBig.style.color = sc == null ? '#888'
    : sc >= 9 ? '#40ff70'
    : sc >= 7 ? '#c0e040'
    : sc >= 5 ? '#e0c040'
    : sc >  0 ? '#e07030'
    :            '#e03030';

  el('shots-n').textContent  = state.shotsFired.toString();
  el('total-sc').textContent = state.totalScore.toString();
  el('avg-sc').textContent   = state.shotsFired > 0
    ? (state.totalScore / state.shotsFired).toFixed(1)
    : '—';
}

// ------------------------------------------------------------------
// Shot analysis (bottom bar)
// ------------------------------------------------------------------

export function updateAnalysis(state: GameState): void {
  const ls = state.lastShot;
  if (!ls) return;

  el('an-x').textContent      = signedCm(ls.impactX);
  el('an-y').textContent      = signedCm(ls.impactY);
  el('an-breath').textContent = `${Math.sqrt(ls.aimErrX ** 2 + ls.aimErrY ** 2).toFixed(1)} cm`;
  el('an-drop').textContent   = `${ls.drop.toFixed(1)}↓ / comp ${ls.elevComp.toFixed(1)}↑`;
  el('an-wind').textContent   = `${signedCm(ls.drift)} / comp ${ls.windComp.toFixed(1)} cm`;

  const scoreEl = el('an-sc');
  scoreEl.textContent  = ls.score >= 10 ? 'X (10)' : ls.score.toString();
  scoreEl.style.color  = ls.score >= 9 ? '#40ff70'
    : ls.score >= 7 ? '#c0e040'
    : ls.score >= 5 ? '#e0c040'
    :                  '#e04040';

  // Build diagnostic message
  const diag: string[] = [];
  const breathErr = Math.sqrt(ls.aimErrX ** 2 + ls.aimErrY ** 2);
  const netY = ls.drop - ls.elevComp;
  const netX = ls.drift - ls.windComp;

  if (breathErr > 6) {
    diag.push(`Respiro: +${breathErr.toFixed(0)} cm errore — attendi NRP o trattieni il fiato`);
  } else if (breathErr > 2) {
    diag.push(`Respiro: lieve movimento (${breathErr.toFixed(0)} cm) — gestione da migliorare`);
  }
  if (Math.abs(netY) > 4) {
    diag.push(netY > 0 ? `Elevazione insufficiente (+${netY.toFixed(0)} cm drop residuo)` : `Elevazione eccessiva`);
  }
  if (Math.abs(netX) > 4) {
    diag.push(netX > 0 ? `Deriva destra non compensata (+${netX.toFixed(0)} cm)` : `Deriva sinistra non compensata (${netX.toFixed(0)} cm)`);
  }
  if (diag.length === 0) {
    diag.push(ls.score >= 9 ? '✓ Eccellente! Tecnica e regolazioni corrette.' : 'Buona precisione. Piccole variazioni residue.');
  }

  el('diag-box').textContent = diag.join(' | ');
}

// ------------------------------------------------------------------
// Flash overlay message
// ------------------------------------------------------------------

export function showFlashMessage(text: string, color: string): void {
  const overlay = el('overlay');
  overlay.textContent = text;
  overlay.style.color = color;
  overlay.classList.add('show');
  setTimeout(() => overlay.classList.remove('show'), 900);
}
