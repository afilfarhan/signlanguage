/* JS↔Python feature-parity check, runnable in Node.
 * Mirrors the normalize() that ships in prototype/index.html and verifies
 * its output matches the Python reference (ml/features.py) on the canonical
 * samples in prototype/models/parity_samples.json.
 *
 * Run from the repo root:
 *   node ci/run_parity.mjs | tee ci/parity.log
 */
import { readFileSync } from 'fs';

const WRIST = 0, MIDDLE_MCP = 9;
function normalize(landmarks){
  const out = new Float32Array(21 * 3);
  const wx = landmarks[WRIST].x, wy = landmarks[WRIST].y, wz = (landmarks[WRIST].z || 0);
  for (let i = 0; i < 21; i++){
    out[i*3+0] = landmarks[i].x - wx;
    out[i*3+1] = landmarks[i].y - wy;
    out[i*3+2] = (landmarks[i].z || 0) - wz;
  }
  const mx = out[MIDDLE_MCP*3+0], my = out[MIDDLE_MCP*3+1];
  let scale = Math.hypot(mx, my); if (scale < 1e-6) scale = 1.0;
  for (let i = 0; i < out.length; i++) out[i] /= scale;
  return out;
}

const parity = JSON.parse(readFileSync('prototype/models/parity_samples.json', 'utf8'));
const tol = 1e-3;
let pass = 0, fail = 0;
for (const [letter, sample] of Object.entries(parity)){
  const lm = sample.landmarks.map(pt => ({x: pt[0], y: pt[1], z: pt[2]}));
  const feats = normalize(lm);
  let driftFirst6 = 0;
  for (let i = 0; i < 6; i++){
    driftFirst6 = Math.max(driftFirst6, Math.abs(feats[i] - sample.expected_normalized_first6[i]));
  }
  let l2 = 0; for (let i = 0; i < feats.length; i++) l2 += feats[i] * feats[i];
  l2 = Math.sqrt(l2);
  const l2Drift = Math.abs(l2 - sample.expected_normalized_l2);
  const ok = driftFirst6 < tol && l2Drift < tol;
  console.log(`${ok ? '✓' : '✗'} ${letter}  first6_drift=${driftFirst6.toExponential(2)}  l2_drift=${l2Drift.toExponential(2)}`);
  if (ok) pass++; else fail++;
}
console.log(`\n${pass}/${pass+fail} samples within tolerance ${tol}`);
process.exit(fail > 0 ? 1 : 0);
