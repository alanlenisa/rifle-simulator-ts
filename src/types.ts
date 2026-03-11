// ============================================================
// All shared TypeScript interfaces for the rifle simulator.
// Centralizing types here prevents the "use undefined variable"
// class of bugs that plagued the plain-HTML version.
// ============================================================

export interface Wind {
  /** km/h */
  speed: number;
  /** Degrees — where wind comes FROM (0=N, 90=E, 180=S, 270=W) */
  direction: number;
}

export interface HitMarker {
  /** cm offset from target center; positive X = right */
  dx: number;
  /** cm offset from target center; positive Y = down */
  dy: number;
  /** timestamp in ms (Date.now()) */
  t: number;
  score: number;
}

export interface ShotResult {
  /** cm error introduced by breathing sway (X axis) */
  aimErrX: number;
  /** cm error introduced by breathing sway (Y axis) */
  aimErrY: number;
  /** cm bullet drop at distance (positive = below POA) */
  drop: number;
  /** cm elevation compensation dialed into scope */
  elevComp: number;
  /** cm wind drift, signed (positive = right) */
  drift: number;
  /** cm windage compensation dialed into scope */
  windComp: number;
  /** total cm impact offset from target center (X axis) */
  impactX: number;
  /** total cm impact offset from target center (Y axis) */
  impactY: number;
  /** radial cm distance from target center */
  distFromCenter: number;
  score: number;
}

export interface GameState {
  dist: number;
  wind: Wind;
  temperature: number;
  altitude: number;
  totalAmmo: number;
  ammoLeft: number;
  /** Quarter-MOA clicks; positive = up */
  scopeElev: number;
  /** Quarter-MOA clicks; positive = right */
  scopeWind: number;
  /** 0..1 position in breath cycle */
  breathPhase: number;
  holdingBreath: boolean;
  /** Seconds breath has been held */
  holdTime: number;
  /** Canvas-pixel sway offset (scene moves opposite to this) */
  swayX: number;
  swayY: number;
  hitMarkers: HitMarker[];
  lastShot: ShotResult | null;
  shotsFired: number;
  totalScore: number;
  /** Debounce flag — true while the shot animation is playing */
  fired: boolean;
  /** Date.now() timestamp of muzzle flash, 0 when inactive */
  flashTime: number;
  showGrid: boolean;
}

export interface Scenario {
  name: string;
  dist: number;
  /** Wind speed km/h */
  ws: number;
  /** Wind direction degrees */
  wd: number;
  temp: number;
  alt: number;
  ammo: number;
}

export interface Ring {
  /** Physical radius in cm (reference: 100 m target) */
  r: number;
  /** Score value for this ring */
  s: number;
  fill: string;
  stroke: string;
}

export interface BallisticTable {
  distances: readonly number[];
  /** cm below 100 m zero (positive = drop) */
  drop: readonly number[];
  /** time of flight in ms */
  tof: readonly number[];
  /** cm drift per km/h of PURE 90° crosswind */
  wdpk: readonly number[];
}

/** Status returned by the breathing system each tick */
export interface BreathStatus {
  isHolding: boolean;
  /** Label for the breath-bar (e.g. "↑ INSPIRA", "◉ NRP") */
  phase: string;
  /** 0..1 fill fraction for the breath indicator bar */
  fill: number;
  isOptimal: boolean;
  holdSeconds: number;
  statusLabel: string;
  statusColor: string;
}
