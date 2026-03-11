// ============================================================
// Canvas rendering — scope view and wind compass.
// No game logic here; everything is driven by what's passed in.
// ============================================================

import { RINGS } from './constants';
import type { GameState, HitMarker } from './types';

const DEG_TO_RAD = Math.PI / 180;
const TWO_PI = Math.PI * 2;

// ------------------------------------------------------------------
// Scope renderer
// ------------------------------------------------------------------

export class ScopeRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private scopeSize: number = 0;
  private scopeRadius: number = 0;

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId);
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error(`#${canvasId} is not a canvas`);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot acquire 2D rendering context');
    this.canvas = canvas;
    this.ctx = ctx;
  }

  resize(containerEl: HTMLElement): void {
    const size = Math.max(380, Math.min(660, Math.min(containerEl.clientWidth, containerEl.clientHeight) - 10));
    this.scopeSize = size;
    this.scopeRadius = size / 2;
    this.canvas.width = size;
    this.canvas.height = size;
  }

  /** Pixels-per-cm scale factor for the target at a given distance */
  targetScale(dist: number): number {
    return (this.scopeRadius * 0.62 / 50.5) * (100 / dist);
  }

  render(state: GameState): void {
    const cx = this.scopeRadius;
    const cy = this.scopeRadius;

    this.ctx.fillStyle = '#080c06';
    this.ctx.fillRect(0, 0, this.scopeSize, this.scopeSize);

    // Clip everything to the circular scope aperture
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, this.scopeRadius - 3, 0, TWO_PI);
    this.ctx.clip();

    this.drawBackground(cx, cy, state.dist);
    // Sway: the scene shifts — target moves, reticle stays at center
    const sc = this.targetScale(state.dist);
    this.drawTarget(cx - state.swayX, cy - state.swayY, sc, state.hitMarkers);
    this.drawMuzzleFlash(state.flashTime);

    this.ctx.restore(); // end clip

    this.drawVignette(cx, cy);
    this.drawReticle(cx, cy, state.showGrid);
    this.drawWindIndicator(cx, cy, state);
  }

  // ----------------------------------------------------------------
  // Scene background
  // ----------------------------------------------------------------

  private drawBackground(_cx: number, cy: number, dist: number): void {
    const SS = this.scopeSize;
    const sky = this.ctx.createLinearGradient(0, 0, 0, cy + 15);
    sky.addColorStop(0, '#c8d0be');
    sky.addColorStop(1, '#d8ddc8');
    this.ctx.fillStyle = sky;
    this.ctx.fillRect(0, 0, SS, cy + 15);

    this.ctx.fillStyle = '#607038';
    this.ctx.fillRect(0, cy + 15, SS, SS - (cy + 15));

    // Distance haze — increases with range
    const haze = Math.min(0.55, (dist - 100) / 1200);
    this.ctx.fillStyle = `rgba(200,210,218,${haze})`;
    this.ctx.fillRect(0, 0, SS, cy + 15);
  }

  // ----------------------------------------------------------------
  // Target
  // ----------------------------------------------------------------

  private drawTarget(cx: number, cy: number, scale: number, hits: readonly HitMarker[]): void {
    // Rings drawn outside → inside
    for (let i = 0; i < RINGS.length; i++) {
      const ring = RINGS[i];
      const px = ring.r * scale;

      this.ctx.beginPath();
      this.ctx.arc(cx, cy, px, 0, TWO_PI);
      this.ctx.fillStyle = ring.fill;
      this.ctx.fill();
      this.ctx.strokeStyle = ring.stroke;
      this.ctx.lineWidth = 0.5;
      this.ctx.stroke();

      // Score label if there's enough space
      if (i > 0 && ring.s > 0) {
        const prevPx = RINGS[i - 1].r * scale;
        const bandH = prevPx - px;
        if (px > 7 && bandH > 8) {
          const isDark = ring.fill === '#202020' || ring.fill === '#181818' || ring.fill === '#141414';
          this.ctx.fillStyle = isDark ? '#706040' : '#303828';
          this.ctx.font = `${Math.max(8, Math.min(11, bandH * 0.65))}px Courier New`;
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText(ring.s.toString(), cx, cy - (px + prevPx) / 2);
        }
      }
    }

    // Subtle crosshair lines on target face
    const outerPx = RINGS[0].r * scale;
    this.ctx.strokeStyle = 'rgba(80,60,60,0.25)';
    this.ctx.lineWidth = 0.5;
    this.ctx.beginPath();
    this.ctx.moveTo(cx - outerPx, cy); this.ctx.lineTo(cx + outerPx, cy);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy - outerPx); this.ctx.lineTo(cx, cy + outerPx);
    this.ctx.stroke();

    // Hit markers
    for (const hit of hits) {
      this.drawHitMarker(cx + hit.dx * scale, cy + hit.dy * scale, hit.t, scale);
    }
  }

  private drawHitMarker(hx: number, hy: number, timestamp: number, scale: number): void {
    const age = (Date.now() - timestamp) / 1000;
    const alpha = Math.max(0.4, 1 - age * 0.08);
    this.ctx.strokeStyle = `rgba(255,70,70,${alpha})`;
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(hx, hy, 3 + scale * 0.5, 0, TWO_PI);
    this.ctx.stroke();
    const hl = 5;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(hx - hl, hy); this.ctx.lineTo(hx + hl, hy);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(hx, hy - hl); this.ctx.lineTo(hx, hy + hl);
    this.ctx.stroke();
  }

  // ----------------------------------------------------------------
  // Muzzle flash overlay
  // ----------------------------------------------------------------

  private drawMuzzleFlash(flashTime: number): void {
    if (flashTime === 0) return;
    const age = Date.now() - flashTime;
    if (age < 90) {
      this.ctx.fillStyle = `rgba(255,200,100,${(1 - age / 90) * 0.28})`;
      this.ctx.fillRect(0, 0, this.scopeSize, this.scopeSize);
    }
  }

  // ----------------------------------------------------------------
  // Vignette + circular mask
  // ----------------------------------------------------------------

  private drawVignette(cx: number, cy: number): void {
    const R = this.scopeRadius;
    const SS = this.scopeSize;

    // Radial gradient darkening
    const g = this.ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.65, 'rgba(0,0,0,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0.9)');
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, SS, SS);

    // Mask outside the circle to solid black
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, R, 0, TWO_PI);
    this.ctx.rect(0, 0, SS, SS);
    this.ctx.fillStyle = '#000';
    this.ctx.fill('evenodd');
    this.ctx.restore();

    // Scope rim
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, R, 0, TWO_PI);
    this.ctx.strokeStyle = '#181818';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();
  }

  // ----------------------------------------------------------------
  // Reticle (mil-dot duplex)
  // ----------------------------------------------------------------

  private drawReticle(cx: number, cy: number, showGrid: boolean): void {
    const R = this.scopeRadius;
    const gap = 18;
    const milPx = R / 6.28; // 1 mil ≈ scope_radius / 2π  (approximate)

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(15,15,8,0.88)';
    this.ctx.lineWidth = 1.4;

    // Horizontal arms
    this.ctx.beginPath();
    this.ctx.moveTo(cx - R * 0.82, cy); this.ctx.lineTo(cx - gap, cy);
    this.ctx.moveTo(cx + gap, cy);      this.ctx.lineTo(cx + R * 0.82, cy);
    this.ctx.stroke();

    // Vertical arms
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy - R * 0.82); this.ctx.lineTo(cx, cy - gap * 0.8);
    this.ctx.moveTo(cx, cy + gap * 0.8); this.ctx.lineTo(cx, cy + R * 0.82);
    this.ctx.stroke();

    // Optional mil grid
    if (showGrid) {
      this.ctx.strokeStyle = 'rgba(10,10,5,0.4)';
      this.ctx.lineWidth = 0.5;
      for (let m = -4; m <= 4; m++) {
        if (m === 0) continue;
        this.ctx.beginPath();
        this.ctx.moveTo(cx + m * milPx, cy - R * 0.7);
        this.ctx.lineTo(cx + m * milPx, cy + R * 0.7);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(cx - R * 0.7, cy + m * milPx);
        this.ctx.lineTo(cx + R * 0.7, cy + m * milPx);
        this.ctx.stroke();
      }
    }

    // Mil-dots along crosshair arms
    for (let i = 1; i <= 4; i++) {
      for (const side of [-1, 1] as const) {
        this.ctx.beginPath();
        this.ctx.arc(cx + side * i * milPx, cy, 2.2, 0, TWO_PI);
        this.ctx.fillStyle = 'rgba(15,15,8,0.88)';
        this.ctx.fill();
        if (i <= 3) {
          this.ctx.beginPath();
          this.ctx.arc(cx, cy + side * i * milPx, 2.2, 0, TWO_PI);
          this.ctx.fill();
        }
      }
    }

    // Centre pip
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 1.4, 0, TWO_PI);
    this.ctx.fill();

    this.ctx.restore();
  }

  // ----------------------------------------------------------------
  // Wind indicator (small arrow inside scope)
  // ----------------------------------------------------------------

  private drawWindIndicator(cx: number, cy: number, state: GameState): void {
    if (state.wind.speed === 0) return;

    // Compute the lateral wind component
    const windTravelDir = (state.wind.direction + 180) % 360;
    const cross = Math.sin(windTravelDir * DEG_TO_RAD);
    if (Math.abs(cross) < 0.05) return;

    const ix = cx - this.scopeRadius * 0.52;
    const iy = cy + this.scopeRadius * 0.72;
    const len = 16 + state.wind.speed * 0.7;
    const dir = cross > 0 ? 0 : Math.PI; // 0 = right, PI = left

    this.ctx.save();
    this.ctx.translate(ix, iy);
    this.ctx.strokeStyle = 'rgba(180,210,255,0.65)';
    this.ctx.lineWidth = 1.5;

    this.ctx.beginPath();
    this.ctx.moveTo(-Math.cos(dir) * len * 0.3, 0);
    this.ctx.lineTo(Math.cos(dir) * len, 0);
    this.ctx.stroke();

    const hd = 0.45, hl = 7;
    this.ctx.beginPath();
    this.ctx.moveTo(Math.cos(dir) * len, 0);
    this.ctx.lineTo(Math.cos(dir) * len - hl * Math.cos(dir - hd), -hl * Math.sin(dir - hd));
    this.ctx.moveTo(Math.cos(dir) * len, 0);
    this.ctx.lineTo(Math.cos(dir) * len - hl * Math.cos(dir + hd), -hl * Math.sin(dir + hd));
    this.ctx.stroke();

    this.ctx.fillStyle = 'rgba(180,210,255,0.7)';
    this.ctx.font = '9px Courier New';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${state.wind.speed} km/h`, 0, -9);

    this.ctx.restore();
  }
}

// ------------------------------------------------------------------
// Wind compass (separate small canvas)
// ------------------------------------------------------------------

export function renderWindCompass(canvasId: string, state: GameState): void {
  const canvas = document.getElementById(canvasId);
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2 - 4;

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TWO_PI);
  ctx.fillStyle = '#060606';
  ctx.fill();
  ctx.strokeStyle = '#1e1e18';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Tick marks
  ctx.strokeStyle = '#252520';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 12; i++) {
    const a = i * 30 * DEG_TO_RAD;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(a) * (R - 10), cy - Math.cos(a) * (R - 10));
    ctx.lineTo(cx + Math.sin(a) * (R - 4),  cy - Math.cos(a) * (R - 4));
    ctx.stroke();
  }

  // Cardinal labels
  ctx.fillStyle = '#455535';
  ctx.font = '8px Courier New';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', cx,     cy - R + 7);
  ctx.fillText('S', cx,     cy + R - 7);
  ctx.fillText('E', cx + R - 7, cy);
  ctx.fillText('W', cx - R + 7, cy);

  if (state.wind.speed > 0) {
    const toRad = ((state.wind.direction + 180) % 360) * DEG_TO_RAD;
    const ex = cx + Math.sin(toRad) * R * 0.6;
    const ey = cy - Math.cos(toRad) * R * 0.6;
    const sx = cx - Math.sin(toRad) * R * 0.3;
    const sy = cy + Math.cos(toRad) * R * 0.3;

    ctx.strokeStyle = '#4080c0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
    ctx.stroke();

    const hd = 0.4, hl = 7;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - hl * Math.sin(toRad - hd), ey + hl * Math.cos(toRad - hd));
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - hl * Math.sin(toRad + hd), ey + hl * Math.cos(toRad + hd));
    ctx.stroke();

    ctx.fillStyle = '#5090c0';
    ctx.font = '9px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.wind.speed.toString(), cx, cy);
  } else {
    ctx.fillStyle = '#333';
    ctx.font = '9px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CALM', cx, cy);
  }
}
