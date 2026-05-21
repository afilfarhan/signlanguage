import { describe, it, expect } from "vitest";
import {
  STATIC_LETTERS,
  MOTION_LETTERS,
  isMotionLetter,
  LETTER_DESCRIPTIONS,
  MOTION_DESCRIPTIONS,
  getStaticLetter,
  getMotionLetter,
  getDynamicSign,
} from "@/lib/curriculum-v2";

describe("curriculum-v2", () => {
  it("has 24 static letters", () => {
    expect(STATIC_LETTERS).toHaveLength(24);
  });

  it("has 2 motion letters", () => {
    expect(MOTION_LETTERS).toHaveLength(2);
    expect(MOTION_LETTERS).toContain("J");
    expect(MOTION_LETTERS).toContain("Z");
  });

  it("identifies motion letters", () => {
    expect(isMotionLetter("J")).toBe(true);
    expect(isMotionLetter("Z")).toBe(true);
    expect(isMotionLetter("A")).toBe(false);
    expect(isMotionLetter("B")).toBe(false);
  });

  it("describes every static letter", () => {
    for (const l of STATIC_LETTERS) {
      expect(LETTER_DESCRIPTIONS[l]).toBeDefined();
      expect(LETTER_DESCRIPTIONS[l].length).toBeGreaterThan(0);
    }
  });

  it("describes every motion letter", () => {
    for (const l of MOTION_LETTERS) {
      expect(MOTION_DESCRIPTIONS[l]).toBeDefined();
      expect(MOTION_DESCRIPTIONS[l].length).toBeGreaterThan(0);
    }
  });

  it("finds static letters via getStaticLetter", () => {
    expect(getStaticLetter("A")?.label).toBe("A");
    expect(getStaticLetter("Z")).toBeUndefined();
  });

  it("finds motion letters via getMotionLetter", () => {
    expect(getMotionLetter("J")?.label).toBe("J");
    expect(getMotionLetter("Z")?.label).toBe("Z");
    expect(getMotionLetter("A")).toBeUndefined();
  });

  it("finds dynamic signs via getDynamicSign", () => {
    expect(getDynamicSign("hello")?.label).toBe("HELLO");
    expect(getDynamicSign("nonexistent")).toBeUndefined();
  });
});
