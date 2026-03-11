// ============================================================
// Trajectory panel — two side-by-side mini-plots showing the
// bullet path on the vertical plane (drop) and horizontal
// plane (wind drift), rendered after each shot.
// ============================================================

import { getBulletDrop, moaToCm, windDriftCmAtDist } from './physics';
import type { GameState, ShotResult } from './types';

const N_SAMPLES = 60;

interface Point { dist: number; cm: number; }

// ------------------------------------------------------------------
// Sample the corrected trajectory at N_SAMPLES distances
// ------------------------------------------------------------------

function sampleVertical(state: GameState): Point[] {
  return Array.from({ length: N_SAMPLES + 1 }, (_, i) => {
    const d = (i / N_SAMPLES) * state.dist;
    if (d < 1) return { dist: 0, cm: 0 }; // at the muzzle: no drop, no correction
    const drop = getBulletDrop(d);
    const comp = moaToCm(state.scopeElev * 0.25, d);
    return { dist: d, cm: drop - comp }; // positive = below corrected POA
  });
}

function sampleHorizontal(state: GameState): Point[] {
  return Array.from({ length: N_SAMPLES + 1 }, (_, i) => {
    const d = (i / N_SAMPLES) * state.dist;
    if (d < 1) return { dist: 0, cm: 0 };
    const drift = windDriftCmAtDist(d, state.wind.speed, state.wind.direction);
    const comp  = moaToCm(state.scopeWind * 0.25, d);
    return { dist: d, cm: drift - comp }; // positive = right of corrected POA
  });
}

// ------------------------------------------------------------------
// Renderer
// ------------------------------------------------------------------

export class TrajectoryRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId);
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error(`#${canvasId} not a canvas`);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot acquire 2D context');
    this.canvas = canvas;
    this.ctx = ctx;
  }

  render(state: GameState, shot: ShotResult): void {
    const W = this.canvas.width;
    const H = this.canvas.height;

    this.ctx.clearRect(0, 0, W, H);

    // Panel background
    this.ctx.fillStyle = 'rgba(6,9,6,0.93)';
    this.roundRect(0, 0, W, H, 5);
    this.ctx.fill();
    this.ctx.strokeStyle = '#2a3020';
    this.ctx.lineWidth = 1;
    this.roundRect(0, 0, W, H, 5);
    this.ctx.stroke();

    // Divider
    const half = Math.floor(W / 2);
    this.ctx.strokeStyle = '#1e231a';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(half, 4);
    this.ctx.lineTo(half, H - 4);
    this.ctx.stroke();

    // Ballistic-only impact (no aim error)
    const ballisticY = shot.drop  - shot.elevComp; // vertical residual
    const ballisticX = shot.drift - shot.windComp; // horizontal residual

    this.drawPanel(
      0, 0, half, H,
      sampleVertical(state),
      ballisticY,    // curve endpoint
      shot.impactY,  // actual impact (includes aim error)
      state.dist,
      'PIANO VERTICALE',
      '#c07830',     // orange = elevation/gravity
    );

    this.drawPanel(
      half + 1, 0, half - 1, H,
      sampleHorizontal(state),
      ballisticX,
      shot.impactX,
      state.dist,
      'PIANO ORIZZONTALE',
      '#3888c8',     // blue = wind
    );
  }

  // ----------------------------------------------------------------
  // Single panel (vertical OR horizontal plane)
  // ----------------------------------------------------------------

  private drawPanel(
    ox: number, oy: number, W: number, H: number,
    points: Point[],
    ballisticImpact: number, // cm, ballistic only (endpoint of curve)
    actualImpact: number,    // cm, total (including aim error)
    targetDist: number,
    title: string,
    curveColor: string,
  ): void {
    const PAD = { l: 28, r: 10, t: 14, b: 16 };
    const plotW = W - PAD.l - PAD.r;
    const plotH = H - PAD.t - PAD.b;

    // Auto-scale Y to fit all values (curve + both impact marks)
    const allY = points.map(p => p.cm).concat([ballisticImpact, actualImpact, 0]);
    let yMin = Math.min(...allY);
    let yMax = Math.max(...allY);
    const span = Math.max(yMax - yMin, 8);
    yMin -= span * 0.18;
    yMax += span * 0.18;

    const toX = (d: number)  => ox + PAD.l + (d / targetDist) * plotW;
    const toY = (cm: number) => oy + PAD.t + ((cm - yMin) / (yMax - yMin)) * plotH;

    // ---- Title ----
    this.ctx.fillStyle = '#556045';
    this.ctx.font = '8px Courier New';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(title, ox + W / 2, oy + 9);

    // ---- Zero reference line (dashed) ----
    const zeroY = toY(0);
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(90,110,70,0.45)';
    this.ctx.lineWidth = 0.8;
    this.ctx.setLineDash([3, 3]);
    this.ctx.beginPath();
    this.ctx.moveTo(ox + PAD.l, zeroY);
    this.ctx.lineTo(ox + PAD.l + plotW, zeroY);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.restore();

    // ---- Target-distance vertical line (dashed) ----
    const txLine = toX(targetDist);
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(80,80,80,0.5)';
    this.ctx.lineWidth = 0.8;
    this.ctx.setLineDash([2, 3]);
    this.ctx.beginPath();
    this.ctx.moveTo(txLine, oy + PAD.t);
    this.ctx.lineTo(txLine, oy + PAD.t + plotH);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.restore();

    // ---- Axes ----
    this.ctx.strokeStyle = '#303530';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(ox + PAD.l, oy + PAD.t);
    this.ctx.lineTo(ox + PAD.l, oy + PAD.t + plotH);
    this.ctx.lineTo(ox + PAD.l + plotW, oy + PAD.t + plotH);
    this.ctx.stroke();

    // ---- Y-axis labels ----
    this.ctx.fillStyle = '#3a4535';
    this.ctx.font = '7px Courier New';
    this.ctx.textAlign = 'right';
    this.labelIfRoom(ox + PAD.l - 2, toY(yMax), `${yMax.toFixed(0)}`);
    this.labelIfRoom(ox + PAD.l - 2, toY(0),    '0',   zeroY);
    this.labelIfRoom(ox + PAD.l - 2, toY(yMin), `${yMin.toFixed(0)}`);

    // ---- X-axis labels ----
    this.ctx.fillStyle = '#3a4535';
    this.ctx.font = '7px Courier New';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('0', ox + PAD.l, oy + H - 3);
    this.ctx.fillText(`${targetDist}m`, ox + PAD.l + plotW, oy + H - 3);

    // ---- Trajectory curve ----
    this.ctx.strokeStyle = curveColor;
    this.ctx.lineWidth = 1.6;
    this.ctx.beginPath();
    let first = true;
    for (const p of points) {
      const x = toX(p.dist);
      const y = toY(p.cm);
      if (first) { this.ctx.moveTo(x, y); first = false; }
      else        this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    // ---- Ballistic-only impact (hollow circle = "where physics alone lands it") ----
    const bx = toX(targetDist);
    const by = toY(ballisticImpact);
    this.ctx.strokeStyle = curveColor;
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
    this.ctx.stroke();

    // ---- Actual impact (filled red dot = what really happened, aim error included) ----
    const ax = toX(targetDist);
    const ay = toY(actualImpact);
    this.ctx.fillStyle = '#e03030';
    this.ctx.beginPath();
    this.ctx.arc(ax, ay, 3.5, 0, Math.PI * 2);
    this.ctx.fill();

    // Crosshair on actual impact
    const hl = 5;
    this.ctx.strokeStyle = 'rgba(220,60,60,0.7)';
    this.ctx.lineWidth = 0.8;
    this.ctx.beginPath();
    this.ctx.moveTo(ax - hl, ay); this.ctx.lineTo(ax + hl, ay);
    this.ctx.moveTo(ax, ay - hl); this.ctx.lineTo(ax, ay + hl);
    this.ctx.stroke();

    // ---- Impact value label ----
    const sign = (v: number) => v >= 0 ? '+' : '';
    const labelY = ay < oy + PAD.t + plotH / 2 ? ay + 10 : ay - 4;
    this.ctx.fillStyle = '#e06060';
    this.ctx.font = 'bold 8px Courier New';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`${sign(actualImpact)}${actualImpact.toFixed(0)}cm`, ax + 5, labelY);

    // If aim error moved the impact away from ballistic, draw a connecting line
    if (Math.abs(actualImpact - ballisticImpact) > 1.5) {
      this.ctx.strokeStyle = 'rgba(180,50,50,0.45)';
      this.ctx.lineWidth = 0.8;
      this.ctx.setLineDash([2, 2]);
      this.ctx.beginPath();
      this.ctx.moveTo(bx, by);
      this.ctx.lineTo(ax, ay);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    // ---- Legend (bottom-left of panel) ----
    const lx = ox + PAD.l + 2;
    const ly = oy + PAD.t + plotH - 2;
    // Hollow circle = ballistic
    this.ctx.strokeStyle = curveColor; this.ctx.lineWidth = 1;
    this.ctx.beginPath(); this.ctx.arc(lx + 3, ly - 3, 2.5, 0, Math.PI * 2); this.ctx.stroke();
    this.ctx.fillStyle = '#3a4535'; this.ctx.font = '7px Courier New'; this.ctx.textAlign = 'left';
    this.ctx.fillText('bal.', lx + 8, ly);
    // Filled red = actual
    this.ctx.fillStyle = '#e03030';
    this.ctx.beginPath(); this.ctx.arc(lx + 28, ly - 3, 2.5, 0, Math.PI * 2); this.ctx.fill();
    this.ctx.fillStyle = '#3a4535';
    this.ctx.fillText('reale', lx + 33, ly);
  }

  // Only draw Y label if it won't overlap with the zero line label
  private labelIfRoom(x: number, y: number, text: string, avoidY?: number): void {
    if (avoidY !== undefined && Math.abs(y - avoidY) < 8) return;
    this.ctx.fillText(text, x, y + 3);
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.arcTo(x + w, y, x + w, y + r, r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.arcTo(x, y + h, x, y + h - r, r);
    this.ctx.lineTo(x, y + r);
    this.ctx.arcTo(x, y, x + r, y, r);
    this.ctx.closePath();
  }

  show(): void { this.canvas.classList.add('visible'); }
  hide(): void { this.canvas.classList.remove('visible'); }
}
