export const T_FRAMES = 45;
export const N_LANDMARKS = 21;
export const FEATURE_DIM = N_LANDMARKS * 3 * 2;

export const JZ_FRAMES = 30;

export function normalizeSequence(buf: Float32Array[]): Float32Array {
  const T = buf.length;
  const WRIST = 0;
  const MIDDLE_MCP = 9;
  const pos = new Float32Array(T * N_LANDMARKS * 3);

  const anchor_x = buf[0][WRIST * 3 + 0];
  const anchor_y = buf[0][WRIST * 3 + 1];
  const anchor_z = buf[0][WRIST * 3 + 2];

  for (let t = 0; t < T; t++) {
    for (let j = 0; j < N_LANDMARKS; j++) {
      pos[(t * N_LANDMARKS + j) * 3 + 0] = buf[t][j * 3 + 0] - anchor_x;
      pos[(t * N_LANDMARKS + j) * 3 + 1] = buf[t][j * 3 + 1] - anchor_y;
      pos[(t * N_LANDMARKS + j) * 3 + 2] = buf[t][j * 3 + 2] - anchor_z;
    }
  }

  const mx = pos[(0 * N_LANDMARKS + MIDDLE_MCP) * 3 + 0];
  const my = pos[(0 * N_LANDMARKS + MIDDLE_MCP) * 3 + 1];
  let scale = Math.hypot(mx, my);
  if (scale < 1e-6) scale = 1.0;
  for (let i = 0; i < pos.length; i++) pos[i] /= scale;

  const out = new Float32Array(T * FEATURE_DIM);
  for (let t = 0; t < T; t++) {
    for (let j = 0; j < N_LANDMARKS * 3; j++) {
      out[t * FEATURE_DIM + j] = pos[t * N_LANDMARKS * 3 + j];
      const v = t === 0 ? 0 : pos[t * N_LANDMARKS * 3 + j] - pos[(t - 1) * N_LANDMARKS * 3 + j];
      out[t * FEATURE_DIM + N_LANDMARKS * 3 + j] = v;
    }
  }
  return out;
}

/** Normalize a sequence to exactly targetLen frames (pad or trim), returns (targetLen * 126) Float32Array */
export function normalizeSequenceFixed(buf: Float32Array[], targetLen: number): Float32Array {
  const WRIST = 0;
  const MIDDLE_MCP = 9;
  const T = buf.length;

  const anchor_x = buf[0][WRIST * 3 + 0];
  const anchor_y = buf[0][WRIST * 3 + 1];
  const anchor_z = buf[0][WRIST * 3 + 2];

  const pos = new Float32Array(T * N_LANDMARKS * 3);
  for (let t = 0; t < T; t++) {
    for (let j = 0; j < N_LANDMARKS; j++) {
      pos[(t * N_LANDMARKS + j) * 3 + 0] = buf[t][j * 3 + 0] - anchor_x;
      pos[(t * N_LANDMARKS + j) * 3 + 1] = buf[t][j * 3 + 1] - anchor_y;
      pos[(t * N_LANDMARKS + j) * 3 + 2] = buf[t][j * 3 + 2] - anchor_z;
    }
  }

  const mx = pos[(0 * N_LANDMARKS + MIDDLE_MCP) * 3 + 0];
  const my = pos[(0 * N_LANDMARKS + MIDDLE_MCP) * 3 + 1];
  let scale = Math.hypot(mx, my);
  if (scale < 1e-6) scale = 1.0;
  for (let i = 0; i < pos.length; i++) pos[i] /= scale;

  // Pad or trim to targetLen
  const out = new Float32Array(targetLen * N_LANDMARKS * 6);
  for (let t = 0; t < targetLen; t++) {
    const srcT = t < T ? t : T - 1;
    for (let j = 0; j < N_LANDMARKS * 3; j++) {
      out[t * N_LANDMARKS * 6 + j] = pos[srcT * N_LANDMARKS * 3 + j];
      const v = srcT === 0 ? 0 : pos[srcT * N_LANDMARKS * 3 + j] - pos[(srcT - 1) * N_LANDMARKS * 3 + j];
      out[t * N_LANDMARKS * 6 + N_LANDMARKS * 3 + j] = v;
    }
  }
  return out;
}
