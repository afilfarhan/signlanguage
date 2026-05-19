import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { normalize } from "@/lib/normalize";

interface ParitySample {
  landmarks: number[][];
  expected_normalized_first6: number[];
  expected_normalized_l2: number;
}

const paritySamples: Record<string, ParitySample> = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "public/models/parity_samples.json"), "utf8"),
);

const TOL = 1e-3;

describe("normalize() JS↔Python parity", () => {
  for (const [letter, sample] of Object.entries(paritySamples)) {
    it(`${letter}: first-6 drift < ${TOL} and L2 drift < ${TOL}`, () => {
      const lm = sample.landmarks.map((pt: number[]) => ({
        x: pt[0],
        y: pt[1],
        z: pt[2],
      }));
      const feats = normalize(lm);

      let driftFirst6 = 0;
      for (let i = 0; i < 6; i++) {
        driftFirst6 = Math.max(driftFirst6, Math.abs(feats[i] - sample.expected_normalized_first6[i]));
      }

      let l2 = 0;
      for (let i = 0; i < feats.length; i++) l2 += feats[i] * feats[i];
      l2 = Math.sqrt(l2);
      const l2Drift = Math.abs(l2 - sample.expected_normalized_l2);

      expect(driftFirst6).toBeLessThan(TOL);
      expect(l2Drift).toBeLessThan(TOL);
    });
  }
});
