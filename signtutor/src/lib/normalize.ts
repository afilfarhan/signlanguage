export const WRIST = 0;
export const MIDDLE_MCP = 9;

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export function normalize(landmarks: Landmark[]): Float32Array {
  const out = new Float32Array(21 * 3);
  const wx = landmarks[WRIST].x;
  const wy = landmarks[WRIST].y;
  const wz = landmarks[WRIST].z || 0;
  for (let i = 0; i < 21; i++) {
    out[i * 3 + 0] = landmarks[i].x - wx;
    out[i * 3 + 1] = landmarks[i].y - wy;
    out[i * 3 + 2] = (landmarks[i].z || 0) - wz;
  }
  const mx = out[MIDDLE_MCP * 3 + 0];
  const my = out[MIDDLE_MCP * 3 + 1];
  let scale = Math.hypot(mx, my);
  if (scale < 1e-6) scale = 1.0;
  for (let i = 0; i < out.length; i++) out[i] /= scale;
  return out;
}

export function dist(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.hypot(dx, dy, dz);
}

export const FT = { THUMB: 4, INDEX: 8, MIDDLE: 12, RING: 16, PINKY: 20 } as const;
export const PIP = { THUMB: 3, INDEX: 6, MIDDLE: 10, RING: 14, PINKY: 18 } as const;
export const MCP = { THUMB: 2, INDEX: 5, MIDDLE: 9, RING: 13, PINKY: 17 } as const;

function fingerExtended(
  lm: Landmark[],
  tip: number,
  pip: number,
  mcp: number,
): boolean {
  const w = lm[0];
  return dist(lm[tip], w) > dist(lm[pip], w) * 1.05 && dist(lm[tip], w) > dist(lm[mcp], w) * 1.1;
}

function thumbExtended(lm: Landmark[]): boolean {
  return dist(lm[FT.THUMB], lm[0]) > dist(lm[PIP.THUMB], lm[0]) * 1.05;
}

export interface FingerStates {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

export function fingerStates(lm: Landmark[]): FingerStates {
  return {
    thumb: thumbExtended(lm),
    index: fingerExtended(lm, FT.INDEX, PIP.INDEX, MCP.INDEX),
    middle: fingerExtended(lm, FT.MIDDLE, PIP.MIDDLE, MCP.MIDDLE),
    ring: fingerExtended(lm, FT.RING, PIP.RING, MCP.RING),
    pinky: fingerExtended(lm, FT.PINKY, PIP.PINKY, MCP.PINKY),
  };
}

export const COLLISION_GROUPS: string[][] = [
  ["A", "E", "M", "N", "S", "T"],
  ["D", "G", "L", "Q"],
  ["H", "U", "V"],
  ["K", "P"],
  ["C", "O"],
];

export function inSameGroup(a: string, b: string): boolean {
  if (a === b) return true;
  for (const g of COLLISION_GROUPS) {
    if (g.includes(a) && g.includes(b)) return true;
  }
  return false;
}

export type FingerKey = keyof FingerStates;

export const PATTERNS: Record<string, FingerStates> = {
  A: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  B: { thumb: false, index: true, middle: true, ring: true, pinky: true },
  C: { thumb: true, index: false, middle: false, ring: false, pinky: false },
  D: { thumb: true, index: true, middle: false, ring: false, pinky: false },
  E: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  F: { thumb: true, index: false, middle: true, ring: true, pinky: true },
  G: { thumb: true, index: true, middle: false, ring: false, pinky: false },
  H: { thumb: false, index: true, middle: true, ring: false, pinky: false },
  I: { thumb: false, index: false, middle: false, ring: false, pinky: true },
  K: { thumb: true, index: true, middle: true, ring: false, pinky: false },
  L: { thumb: true, index: true, middle: false, ring: false, pinky: false },
  M: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  N: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  O: { thumb: true, index: false, middle: false, ring: false, pinky: false },
  P: { thumb: true, index: true, middle: true, ring: false, pinky: false },
  Q: { thumb: true, index: true, middle: false, ring: false, pinky: false },
  R: { thumb: false, index: true, middle: true, ring: false, pinky: false },
  S: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  T: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  U: { thumb: false, index: true, middle: true, ring: false, pinky: false },
  V: { thumb: false, index: true, middle: true, ring: false, pinky: false },
  W: { thumb: false, index: true, middle: true, ring: true, pinky: false },
  X: { thumb: false, index: true, middle: false, ring: false, pinky: false },
  Y: { thumb: true, index: false, middle: false, ring: false, pinky: true },
};

export function scoreLetterRule(states: FingerStates, target: string): number {
  const ref = PATTERNS[target];
  if (!ref) return 0;
  let agree = 0;
  let total = 0;
  for (const k of Object.keys(ref) as FingerKey[]) {
    total++;
    if (ref[k] === states[k]) agree++;
  }
  return agree / total;
}

export function classifyRule(lm: Landmark[]): { ranked: { label: string; prob: number }[]; states: FingerStates } {
  const states = fingerStates(lm);
  const ranked = Object.keys(PATTERNS)
    .map((letter) => ({ label: letter, prob: scoreLetterRule(states, letter) }))
    .sort((a, b) => b.prob - a.prob);
  return { ranked, states };
}

export function palmFacingCamera(lm: Landmark[]): { facing: boolean; magnitude: number } {
  const a = lm[5];
  const b = lm[17];
  const w = lm[0];
  const v1x = a.x - w.x;
  const v1y = a.y - w.y;
  const v2x = b.x - w.x;
  const v2y = b.y - w.y;
  const nz = v1x * v2y - v1y * v2x;
  return { facing: nz < 0, magnitude: Math.abs(nz) };
}

export function locationLabel(lm: Landmark[]): string {
  const w = lm[0];
  if (w.y < 0.33) return "upper";
  if (w.y < 0.66) return "middle (neutral signing space)";
  return "lower";
}

export interface MovementPoint {
  x: number;
  y: number;
  t: number;
}

export function recentMovement(buf: MovementPoint[]): number {
  if (buf.length < 5) return 0;
  let total = 0;
  for (let i = 1; i < buf.length; i++) {
    const dx = buf[i].x - buf[i - 1].x;
    const dy = buf[i].y - buf[i - 1].y;
    total += Math.hypot(dx, dy);
  }
  return total;
}
