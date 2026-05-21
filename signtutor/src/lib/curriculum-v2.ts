// v2 curriculum extension: 24 static letters + J, Z motion letters + 200 dynamic signs

export const STATIC_LETTERS = [
  "A","B","C","D","E","F","G","H","I","K","L","M",
  "N","O","P","Q","R","S","T","U","V","W","X","Y",
] as const;

export const MOTION_LETTERS = ["J", "Z"] as const;

export function isMotionLetter(letter: string): boolean {
  return MOTION_LETTERS.includes(letter as typeof MOTION_LETTERS[number]);
}

export type StaticLetter = (typeof STATIC_LETTERS)[number];
export type MotionLetter = (typeof MOTION_LETTERS)[number];
export type AllLetter = StaticLetter | MotionLetter;

export const ASL_REF_IMAGES: Record<string, string> = {
  A: "/refs/asl/fingerspelling/A.svg",
  B: "/refs/asl/fingerspelling/B.svg",
  C: "/refs/asl/fingerspelling/C.svg",
  D: "/refs/asl/fingerspelling/D.svg",
  E: "/refs/asl/fingerspelling/E.svg",
  F: "/refs/asl/fingerspelling/F.svg",
  G: "/refs/asl/fingerspelling/G.svg",
  H: "/refs/asl/fingerspelling/H.svg",
  I: "/refs/asl/fingerspelling/I.svg",
  J: "/refs/asl/fingerspelling/J.svg",
  K: "/refs/asl/fingerspelling/K.svg",
  L: "/refs/asl/fingerspelling/L.svg",
  M: "/refs/asl/fingerspelling/M.svg",
  N: "/refs/asl/fingerspelling/N.svg",
  O: "/refs/asl/fingerspelling/O.svg",
  P: "/refs/asl/fingerspelling/P.svg",
  Q: "/refs/asl/fingerspelling/Q.svg",
  R: "/refs/asl/fingerspelling/R.svg",
  S: "/refs/asl/fingerspelling/S.svg",
  T: "/refs/asl/fingerspelling/T.svg",
  U: "/refs/asl/fingerspelling/U.svg",
  V: "/refs/asl/fingerspelling/V.svg",
  W: "/refs/asl/fingerspelling/W.svg",
  X: "/refs/asl/fingerspelling/X.svg",
  Y: "/refs/asl/fingerspelling/Y.svg",
  Z: "/refs/asl/fingerspelling/Z.svg",
};

export const LETTER_DESCRIPTIONS: Record<string, string> = {
  A: "Closed fist, thumb resting alongside index, palm forward.",
  B: "Flat hand, fingers extended and together, thumb folded across palm.",
  C: "Curved hand forming a C shape, palm to the side.",
  D: "Index extended up, other fingers and thumb meet to form a circle.",
  E: "All fingertips curled to touch the thumb across the palm.",
  F: "Thumb and index touch in a circle, other three fingers extended up.",
  G: "Index extended sideways, thumb parallel, other fingers closed.",
  H: "Index and middle extended together sideways, others closed.",
  I: "Pinky extended up, all other fingers and thumb closed.",
  K: "Index up, middle out at angle, thumb between, others closed.",
  L: "Index up, thumb out, other fingers curled. Forms an L.",
  M: "Thumb tucked under index, middle, and ring, pinky out.",
  N: "Thumb tucked under index and middle, ring and pinky closed.",
  O: "All fingers curled to touch the thumb, forms an O.",
  P: "Like K but pointed downward.",
  Q: "Like G but pointed downward.",
  R: "Index and middle crossed, others closed.",
  S: "Closed fist with thumb across the front of the fingers.",
  T: "Closed fist with thumb tucked between index and middle.",
  U: "Index and middle extended together up, others closed.",
  V: "Index and middle extended apart up, others closed. Peace.",
  W: "Index, middle, and ring extended up, pinky and thumb closed.",
  X: "Index bent into a hook, others closed.",
  Y: "Thumb and pinky extended, index/middle/ring curled. Hang loose.",
};

export const MOTION_DESCRIPTIONS: Record<string, string> = {
  J: "Start with hand in 'I' shape. Draw a J arc downward then curl left.",
  Z: "Point index finger forward. Draw a Z shape in the air (right → diagonal down-left → right).",
};

export const DYNAMIC_SIGNS = [
  "HELLO",
  "GOODBYE",
  "YES",
  "NO",
  "PLEASE",
  "THANKS",
  "SORRY",
  "HELP",
] as const;

export type DynamicSign = (typeof DYNAMIC_SIGNS)[number];

export const SIGN_DESCRIPTIONS: Record<string, string> = {
  HELLO: "Right hand starts near forehead, salutes outward.",
  GOODBYE: "Open hand at chest height, fingers wave (curl/uncurl).",
  YES: "Closed fist, nods up-down twice.",
  NO: "Index and middle extended, snap closed twice.",
  PLEASE: "Flat hand on chest, small circular motion.",
  THANKS: "Flat hand starts at chin, moves outward.",
  SORRY: "Closed fist on chest, small circular motion.",
  HELP: "Closed fist lifts upward (on a flat palm in real ASL).",
};

export interface CurriculumItem {
  id: string;
  type: "static" | "dynamic";
  label: string;
  slug: string;
  description: string;
  prerequisites: string[];
}

export const CURRICULUM: CurriculumItem[] = [
  ...STATIC_LETTERS.map((letter) => ({
    id: `static-${letter}`,
    type: "static" as const,
    label: letter,
    slug: letter.toLowerCase(),
    description: LETTER_DESCRIPTIONS[letter],
    prerequisites: [] as string[],
  })),
  ...MOTION_LETTERS.map((letter) => ({
    id: `motion-${letter}`,
    type: "dynamic" as const,
    label: letter,
    slug: letter.toLowerCase(),
    description: MOTION_DESCRIPTIONS[letter],
    prerequisites: [] as string[],
  })),
  ...DYNAMIC_SIGNS.map((sign) => ({
    id: `dynamic-${sign}`,
    type: "dynamic" as const,
    label: sign,
    slug: sign.toLowerCase(),
    description: SIGN_DESCRIPTIONS[sign],
    prerequisites: [] as string[],
  })),
];

export function getStaticLetter(letter: string): CurriculumItem | undefined {
  return CURRICULUM.find((c) => c.type === "static" && c.label === letter.toUpperCase());
}

export function getMotionLetter(letter: string): CurriculumItem | undefined {
  return CURRICULUM.find((c) => c.type === "dynamic" && c.label === letter.toUpperCase() && isMotionLetter(letter));
}

export function getDynamicSign(slug: string): CurriculumItem | undefined {
  return CURRICULUM.find((c) => c.type === "dynamic" && c.slug === slug.toLowerCase());
}
