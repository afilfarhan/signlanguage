/**
 * Language Bundle Management (W7 — Multi-Language Beta)
 *
 * Each language has its own ONNX bundle. Models are loaded on demand
 * when the user switches languages. Prefetch on hover of language selector.
 */

export type SupportedLanguage = "asl" | "bsl" | "arsl";

export interface LanguageBundle {
  code: SupportedLanguage;
  name: string;
  displayName: string;
  beta: boolean;
  modelPath: string;
  labelsPath: string;
  seqLen: number;
  description: string;
}

export const LANGUAGE_BUNDLES: Record<SupportedLanguage, LanguageBundle> = {
  asl: {
    code: "asl",
    name: "ASL",
    displayName: "American Sign Language",
    beta: false,
    modelPath: "/models/dynamic_transformer_v2.onnx",
    labelsPath: "/models/dynamic_labels.json",
    seqLen: 45,
    description: "Primary model — full accuracy",
  },
  bsl: {
    code: "bsl",
    name: "BSL",
    displayName: "British Sign Language",
    beta: true,
    modelPath: "/models/bsl_dynamic_transformer_v1.onnx",
    labelsPath: "/models/bsl_dynamic_labels.json",
    seqLen: 45,
    description: "Beta — accuracy lower than ASL model",
  },
  arsl: {
    code: "arsl",
    name: "ArSL",
    displayName: "Arabic Sign Language",
    beta: true,
    modelPath: "/models/arsl_dynamic_transformer_v1.onnx",
    labelsPath: "/models/arsl_dynamic_labels.json",
    seqLen: 45,
    description: "Beta — accuracy lower than ASL model",
  },
};

export function getLanguageBundle(lang: string): LanguageBundle | undefined {
  return LANGUAGE_BUNDLES[lang as SupportedLanguage];
}

export function isBetaLanguage(lang: string): boolean {
  return LANGUAGE_BUNDLES[lang as SupportedLanguage]?.beta ?? false;
}

export function getAllLanguages(): LanguageBundle[] {
  return Object.values(LANGUAGE_BUNDLES);
}
