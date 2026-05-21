export const STATIC_LETTERS = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M",
  "N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
] as const;

export const MOTION_LETTERS = ["J", "Z"] as const;

export const ASL_REF_IMAGES: Record<string, string> = {
  A: "https://upload.wikimedia.org/wikipedia/commons/2/27/Sign_language_A.svg",
  B: "https://upload.wikimedia.org/wikipedia/commons/1/18/Sign_language_B.svg",
  C: "https://upload.wikimedia.org/wikipedia/commons/e/e3/Sign_language_C.svg",
  D: "https://upload.wikimedia.org/wikipedia/commons/0/06/Sign_language_D.svg",
  E: "https://upload.wikimedia.org/wikipedia/commons/c/cd/Sign_language_E.svg",
  F: "https://upload.wikimedia.org/wikipedia/commons/8/8f/Sign_language_F.svg",
  G: "https://upload.wikimedia.org/wikipedia/commons/d/d9/Sign_language_G.svg",
  H: "https://upload.wikimedia.org/wikipedia/commons/9/97/Sign_language_H.svg",
  I: "https://upload.wikimedia.org/wikipedia/commons/1/10/Sign_language_I.svg",
  J: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Sign_language_J.svg",
  K: "https://upload.wikimedia.org/wikipedia/commons/9/97/Sign_language_K.svg",
  L: "https://upload.wikimedia.org/wikipedia/commons/d/d2/Sign_language_L.svg",
  M: "https://upload.wikimedia.org/wikipedia/commons/c/c4/Sign_language_M.svg",
  N: "https://upload.wikimedia.org/wikipedia/commons/e/e6/Sign_language_N.svg",
  O: "https://upload.wikimedia.org/wikipedia/commons/e/e0/Sign_language_O.svg",
  P: "https://upload.wikimedia.org/wikipedia/commons/0/08/Sign_language_P.svg",
  Q: "https://upload.wikimedia.org/wikipedia/commons/3/34/Sign_language_Q.svg",
  R: "https://upload.wikimedia.org/wikipedia/commons/3/3d/Sign_language_R.svg",
  S: "https://upload.wikimedia.org/wikipedia/commons/3/3f/Sign_language_S.svg",
  T: "https://upload.wikimedia.org/wikipedia/commons/1/13/Sign_language_T.svg",
  U: "https://upload.wikimedia.org/wikipedia/commons/7/7c/Sign_language_U.svg",
  V: "https://upload.wikimedia.org/wikipedia/commons/c/ca/Sign_language_V.svg",
  W: "https://upload.wikimedia.org/wikipedia/commons/8/83/Sign_language_W.svg",
  X: "https://upload.wikimedia.org/wikipedia/commons/b/b7/Sign_language_X.svg",
  Y: "https://upload.wikimedia.org/wikipedia/commons/1/1d/Sign_language_Y.svg",
  Z: "https://upload.wikimedia.org/wikipedia/commons/0/0a/Sign_language_Z.svg",
};

export type StaticLetter = (typeof STATIC_LETTERS)[number];

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
  J: "Pinky extended, traces a J shape in the air. Motion letter.",
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
  Z: "Index extended, traces a Z shape in the air. Motion letter.",
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

import { VOCABULARY_200 } from "./vocabulary_200";

export interface CurriculumItem {
  id: string;
  type: "static" | "dynamic" | "vocabulary";
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
  ...DYNAMIC_SIGNS.map((sign) => ({
    id: `dynamic-${sign}`,
    type: "dynamic" as const,
    label: sign,
    slug: sign.toLowerCase(),
    description: SIGN_DESCRIPTIONS[sign],
    prerequisites: [] as string[],
  })),
  ...VOCABULARY_200.map((v) => ({
    id: `vocab-${v.id}`,
    type: "vocabulary" as const,
    label: v.gloss,
    slug: v.id,
    description: v.description,
    prerequisites: [] as string[],
  })),
];

export function getStaticLetter(letter: string): CurriculumItem | undefined {
  return CURRICULUM.find((c) => c.type === "static" && c.label === letter.toUpperCase());
}

export function getDynamicSign(slug: string): CurriculumItem | undefined {
  return CURRICULUM.find((c) => c.type === "dynamic" && c.slug === slug.toLowerCase());
}
