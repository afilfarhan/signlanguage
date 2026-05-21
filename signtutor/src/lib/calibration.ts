"use client";

/**
 * Calibration Layer — Temperature Scaling for Model Confidence
 *
 * After training, fit a scalar T on the validation set such that
 *   logits_cal = logits / T
 * improves calibration (ECE ≤ 0.05).
 */

export class CalibrationLayer {
  private T: number;

  constructor(initialT = 1.0) {
    this.T = initialT;
  }

  /** Apply temperature scaling to raw logits */
  calibrate(logits: Float32Array): Float32Array {
    return new Float32Array(Array.from(logits, (v) => v / this.T));
  }

  /** Set temperature from fitted val-set value */
  setTemperature(t: number): void {
    this.T = t;
  }

  getTemperature(): number {
    return this.T;
  }
}

/** Compute Expected Calibration Error (ECE) from confidence and accuracy bins */
export function computeECE(
  confidences: number[],
  accuracies: number[],
  nBins = 10,
): number {
  const bins: { confSum: number; accSum: number; count: number }[] = Array.from(
    { length: nBins },
    () => ({ confSum: 0, accSum: 0, count: 0 }),
  );

  for (let i = 0; i < confidences.length; i++) {
    const binIdx = Math.min(nBins - 1, Math.floor(confidences[i] * nBins));
    bins[binIdx].confSum += confidences[i];
    bins[binIdx].accSum += accuracies[i];
    bins[binIdx].count++;
  }

  let ece = 0;
  let total = 0;
  for (const bin of bins) {
    if (bin.count === 0) continue;
    const avgConf = bin.confSum / bin.count;
    const avgAcc = bin.accSum / bin.count;
    ece += bin.count * Math.abs(avgAcc - avgConf);
    total += bin.count;
  }

  return total > 0 ? ece / total : 0;
}

/** Binary search for T that minimizes ECE on validation data */
export function fitTemperature(
  logits: Float32Array[],
  labels: number[],
): number {
  let bestT = 1.0;
  let bestECE = Infinity;

  for (let t = 0.5; t <= 5.0; t += 0.05) {
    const confidences: number[] = [];
    const accuracies: number[] = [];

    for (let i = 0; i < logits.length; i++) {
      const cal = Array.from(logits[i], (v) => v / t);
      const maxLogit = Math.max(...cal);
      const exps = cal.map((v) => Math.exp(v - maxLogit));
      const sum = exps.reduce((a, b) => a + b, 0);
      const probs = exps.map((e) => e / sum);
      const pred = probs.indexOf(Math.max(...probs));
      const conf = Math.max(...probs);
      confidences.push(conf);
      accuracies.push(pred === labels[i] ? 1 : 0);
    }

    const ece = computeECE(confidences, accuracies);
    if (ece < bestECE) {
      bestECE = ece;
      bestT = t;
    }
  }

  return bestT;
}
