// ============================================================
// Game — owns the GameState, the game loop, input handling,
// and the shoot() logic. Delegates rendering and DOM updates
// to the specialised modules.
// ============================================================

import { SCENARIOS } from './constants';
import {
  getBulletDrop, windDriftCm, scopeElevCm, scopeWindCm,
  calcScore,
} from './physics';
import { updateBreathing } from './breathing';
import { ScopeRenderer, renderWindCompass } from './renderer';
import { TrajectoryRenderer } from './trajectoryRenderer';
import {
  updateInfoPanel, updateAdjDisplay, updateBreathDisplay,
  updateAmmoDisplay, updateScoreDisplay, updateAnalysis,
  showFlashMessage,
} from './ui';
import type { GameState } from './types';

// ------------------------------------------------------------------
// Initial game state factory
// ------------------------------------------------------------------

function createInitialState(): GameState {
  return {
    dist: 300,
    wind: { speed: 8, direction: 270 },
    temperature: 15,
    altitude: 0,
    totalAmmo: 10,
    ammoLeft: 10,
    scopeElev: 0,
    scopeWind: 0,
    breathPhase: 0,
    holdingBreath: false,
    holdTime: 0,
    swayX: 0,
    swayY: 0,
    hitMarkers: [],
    lastShot: null,
    shotsFired: 0,
    totalScore: 0,
    fired: false,
    flashTime: 0,
    showGrid: false,
  };
}

// ------------------------------------------------------------------
// Game class
// ------------------------------------------------------------------

export class Game {
  private readonly state: GameState = createInitialState();
  private readonly renderer: ScopeRenderer;
  private readonly trajectoryRenderer: TrajectoryRenderer;
  private lastTimestamp: number = 0;

  constructor() {
    this.renderer = new ScopeRenderer('scope-canvas');
    this.trajectoryRenderer = new TrajectoryRenderer('trajectory-canvas');
    this.resize();
    this.bindInputs();
    this.loadScenario('p300');
  }

  // ----------------------------------------------------------------
  // Main loop
  // ----------------------------------------------------------------

  start(): void {
    this.lastTimestamp = performance.now();
    requestAnimationFrame(ts => this.loop(ts));
  }

  private loop(timestamp: number): void {
    const dt = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;

    const breathStatus = updateBreathing(this.state, dt);
    updateBreathDisplay(breathStatus);
    this.renderer.render(this.state);

    requestAnimationFrame(ts => this.loop(ts));
  }

  // ----------------------------------------------------------------
  // Resize
  // ----------------------------------------------------------------

  resize(): void {
    const container = document.getElementById('scope-area');
    if (container) this.renderer.resize(container);
  }

  // ----------------------------------------------------------------
  // Shooting
  // ----------------------------------------------------------------

  private shoot(): void {
    const s = this.state;
    if (s.ammoLeft <= 0) { showFlashMessage('SCARICO!', '#e05030'); return; }
    if (s.fired) return;

    s.fired = true;
    s.ammoLeft--;
    s.shotsFired++;
    s.flashTime = Date.now();

    const scale = this.renderer.targetScale(s.dist);

    // Aim error in cm (reticle is offset from target centre by current sway)
    const aimErrX = s.swayX / scale;
    const aimErrY = s.swayY / scale;

    // Ballistic contributions
    const drop     = getBulletDrop(s.dist);   // cm, positive = below POA
    const elevComp = scopeElevCm(s);           // cm, positive = raises impact
    const drift    = windDriftCm(s);           // cm, signed (positive = right)
    const windComp = scopeWindCm(s);           // cm, positive = shifts impact right

    // Total signed offset from target centre (cm)
    const impactX = aimErrX + drift    - windComp;
    const impactY = aimErrY + drop     - elevComp;
    const distFromCenter = Math.sqrt(impactX ** 2 + impactY ** 2);
    const score = calcScore(distFromCenter);

    s.totalScore += score;
    s.hitMarkers.push({ dx: impactX, dy: impactY, t: Date.now(), score });
    s.lastShot = { aimErrX, aimErrY, drop, elevComp, drift, windComp, impactX, impactY, distFromCenter, score };

    updateAnalysis(s);
    updateAmmoDisplay(s);
    updateScoreDisplay(s);

    // Show trajectory panel with the ballistic curves for this shot
    this.trajectoryRenderer.render(s, s.lastShot);
    this.trajectoryRenderer.show();

    const scoreColors: Record<number, string> = {
      10: '#30ff60', 9: '#80ff40', 8: '#c0e030', 7: '#e0c030', 6: '#e08030',
    };
    const label = score >= 10 ? 'X BULLSEYE!' : score >= 8 ? `${score}  BUONO!` : score > 0 ? `${score}` : 'MANCATO!';
    showFlashMessage(label, scoreColors[score] ?? '#e04020');

    setTimeout(() => { s.fired = false; }, 200);
  }

  // ----------------------------------------------------------------
  // Scope clicks
  // ----------------------------------------------------------------

  adjustScope(axis: 'elev' | 'wind', delta: number): void {
    const s = this.state;
    if (axis === 'elev') s.scopeElev = Math.max(-240, Math.min(240, s.scopeElev + delta));
    else                 s.scopeWind = Math.max(-240, Math.min(240, s.scopeWind + delta));
    updateAdjDisplay(s);
  }

  // ----------------------------------------------------------------
  // Scenario loading
  // ----------------------------------------------------------------

  loadScenario(key: string): void {
    const sc = SCENARIOS[key];
    if (!sc) return;
    const s = this.state;

    s.dist        = sc.dist;
    s.wind        = { speed: sc.ws, direction: sc.wd };
    s.temperature = sc.temp;
    s.altitude    = sc.alt;
    s.totalAmmo   = sc.ammo;
    s.ammoLeft    = sc.ammo;
    s.scopeElev   = 0;
    s.scopeWind   = 0;
    s.hitMarkers  = [];
    s.lastShot    = null;

    updateInfoPanel(s);
    updateAdjDisplay(s);
    updateAmmoDisplay(s);
    updateScoreDisplay(s);
    renderWindCompass('wind-canvas', s);
    this.trajectoryRenderer.hide();
    showFlashMessage('PRONTO', '#4080ff');
  }

  resetSession(): void {
    const s = this.state;
    s.shotsFired = 0;
    s.totalScore = 0;
    s.hitMarkers = [];
    s.lastShot   = null;
    s.ammoLeft   = s.totalAmmo;
    updateAmmoDisplay(s);
    updateScoreDisplay(s);
    showFlashMessage('RESET', '#4080ff');
  }

  reload(): void {
    this.state.ammoLeft = this.state.totalAmmo;
    updateAmmoDisplay(this.state);
    showFlashMessage('RICARICATO', '#4090ff');
  }

  toggleGrid(): void {
    this.state.showGrid = !this.state.showGrid;
  }

  // ----------------------------------------------------------------
  // Input binding
  // ----------------------------------------------------------------

  private bindInputs(): void {
    // Scope canvas click → shoot
    const canvas = document.getElementById('scope-canvas');
    canvas?.addEventListener('click', () => this.shoot());

    // Buttons (scope adjustments)
    document.getElementById('elev-p1')?.addEventListener('click', () => this.adjustScope('elev', +1));
    document.getElementById('elev-m1')?.addEventListener('click', () => this.adjustScope('elev', -1));
    document.getElementById('elev-p4')?.addEventListener('click', () => this.adjustScope('elev', +4));
    document.getElementById('elev-m4')?.addEventListener('click', () => this.adjustScope('elev', -4));
    document.getElementById('wind-p1')?.addEventListener('click', () => this.adjustScope('wind', +1));
    document.getElementById('wind-m1')?.addEventListener('click', () => this.adjustScope('wind', -1));
    document.getElementById('wind-p4')?.addEventListener('click', () => this.adjustScope('wind', +4));
    document.getElementById('wind-m4')?.addEventListener('click', () => this.adjustScope('wind', -4));

    // Scenario / utility buttons
    document.getElementById('btn-load')?.addEventListener('click', () => {
      const sel = document.getElementById('scenario-sel') as HTMLSelectElement | null;
      if (sel) this.loadScenario(sel.value);
    });
    document.getElementById('btn-theory')?.addEventListener('click', () => {
      document.getElementById('modal')!.style.display = 'block';
    });
    document.getElementById('btn-close-modal')?.addEventListener('click', () => {
      document.getElementById('modal')!.style.display = 'none';
    });
    document.getElementById('btn-close-modal-2')?.addEventListener('click', () => {
      document.getElementById('modal')!.style.display = 'none';
    });
    document.getElementById('grid-toggle')?.addEventListener('click', () => this.toggleGrid());

    // Keyboard
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (!this.state.holdingBreath) { this.state.holdingBreath = true; this.state.holdTime = 0; }
          break;
        case 'Enter':
          this.shoot();
          break;
        case 'KeyR':
          this.reload();
          break;
        case 'KeyN':
          this.resetSession();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.adjustScope('elev', +1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.adjustScope('elev', -1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.adjustScope('wind', +1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.adjustScope('wind', -1);
          break;
      }
    });

    document.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        this.state.holdingBreath = false;
      }
    });

    window.addEventListener('resize', () => this.resize());
  }
}
