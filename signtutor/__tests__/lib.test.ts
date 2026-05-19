import { describe, it, expect } from "vitest";
import {
  normalize,
  fingerStates,
  inSameGroup,
  classifyRule,
  palmFacingCamera,
  locationLabel,
  COLLISION_GROUPS,
  PATTERNS,
} from "@/lib/normalize";
import { normalizeSequence, N_LANDMARKS, FEATURE_DIM } from "@/lib/seq-features";

describe("normalize", () => {
  it("returns Float32Array of length 63", () => {
    const lm = Array.from({ length: 21 }, (_, i) => ({ x: i * 0.01, y: 0.5, z: 0 }));
    const out = normalize(lm);
    expect(out).toBeInstanceOf(Float32Array);
    expect(out.length).toBe(63);
  });

  it("zero-centers on wrist", () => {
    const lm = Array.from({ length: 21 }, (_, i) => ({ x: i * 0.01 + 0.3, y: 0.5, z: 0 }));
    const out = normalize(lm);
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[1]).toBeCloseTo(0, 5);
    expect(out[2]).toBeCloseTo(0, 5);
  });

  it("scales by wrist→middle-MCP distance", () => {
    const lm = Array.from({ length: 21 }, (_, i) => ({ x: i * 0.01, y: i * 0.01, z: 0 }));
    const out = normalize(lm);
    const mx = out[9 * 3];
    const my = out[9 * 3 + 1];
    const scale = Math.hypot(mx, my);
    expect(scale).toBeCloseTo(1, 4);
  });
});

describe("fingerStates", () => {
  it("returns all five fingers", () => {
    const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    const states = fingerStates(lm);
    expect(Object.keys(states)).toEqual(["thumb", "index", "middle", "ring", "pinky"]);
  });
});

describe("inSameGroup", () => {
  it("returns true for identical letters", () => {
    expect(inSameGroup("A", "A")).toBe(true);
  });

  it("returns true for collision group members", () => {
    expect(inSameGroup("A", "E")).toBe(true);
    expect(inSameGroup("A", "S")).toBe(true);
  });

  it("returns false for unrelated letters", () => {
    expect(inSameGroup("A", "B")).toBe(false);
  });
});

describe("classifyRule", () => {
  it("returns ranked list with probabilities", () => {
    const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    const { ranked, states } = classifyRule(lm);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].prob).toBeGreaterThanOrEqual(0);
    expect(states).toHaveProperty("thumb");
  });
});

describe("palmFacingCamera", () => {
  it("returns facing and magnitude", () => {
    const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    const result = palmFacingCamera(lm);
    expect(result).toHaveProperty("facing");
    expect(result).toHaveProperty("magnitude");
    expect(typeof result.facing).toBe("boolean");
  });
});

describe("locationLabel", () => {
  it("returns upper for low y", () => {
    const lm = [{ x: 0.5, y: 0.2, z: 0 }];
    expect(locationLabel(lm)).toBe("upper");
  });

  it("returns middle for neutral y", () => {
    const lm = [{ x: 0.5, y: 0.5, z: 0 }];
    expect(locationLabel(lm)).toContain("middle");
  });

  it("returns lower for high y", () => {
    const lm = [{ x: 0.5, y: 0.8, z: 0 }];
    expect(locationLabel(lm)).toBe("lower");
  });
});

describe("normalizeSequence", () => {
  it("returns correct output shape", () => {
    const T = 45;
    const buf = Array.from({ length: T }, () =>
      new Float32Array(N_LANDMARKS * 3).map((_, i) => i * 0.001),
    );
    const out = normalizeSequence(buf);
    expect(out).toBeInstanceOf(Float32Array);
    expect(out.length).toBe(T * FEATURE_DIM);
  });

  it("first-frame wrist anchors output to zero", () => {
    const T = 10;
    const buf = Array.from({ length: T }, (_, t) => {
      const arr = new Float32Array(N_LANDMARKS * 3);
      arr[0] = 0.5 + t * 0.01;
      arr[1] = 0.6;
      arr[2] = -0.01;
      return arr;
    });
    const out = normalizeSequence(buf);
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[1]).toBeCloseTo(0, 5);
    expect(out[2]).toBeCloseTo(0, 5);
  });

  it("velocity of frame 0 is zero", () => {
    const T = 5;
    const buf = Array.from({ length: T }, (_, t) => {
      const arr = new Float32Array(N_LANDMARKS * 3);
      for (let j = 0; j < N_LANDMARKS * 3; j++) arr[j] = t * 0.01 + j * 0.001;
      return arr;
    });
    const out = normalizeSequence(buf);
    for (let j = 0; j < N_LANDMARKS * 3; j++) {
      const vel = out[0 * FEATURE_DIM + N_LANDMARKS * 3 + j];
      expect(vel).toBeCloseTo(0, 5);
    }
  });
});

describe("COLLISION_GROUPS", () => {
  it("A/E/M/N/S/T group exists", () => {
    const group = COLLISION_GROUPS.find((g) => g.includes("A") && g.includes("E"));
    expect(group).toBeDefined();
    expect(group).toContain("M");
    expect(group).toContain("N");
    expect(group).toContain("S");
    expect(group).toContain("T");
  });
});

describe("PATTERNS", () => {
  it("covers all STATIC_LETTERS", () => {
    const letters = ["A","B","C","D","E","F","G","H","I","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y"];
    for (const l of letters) {
      expect(PATTERNS[l]).toBeDefined();
      expect(Object.keys(PATTERNS[l])).toEqual(["thumb","index","middle","ring","pinky"]);
    }
  });
});
