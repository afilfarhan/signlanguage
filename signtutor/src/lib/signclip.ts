/**
 * SignCLIP: Cross-Lingual Sign Language Embeddings
 * 
 * Based on CLIP-style contrastive learning for sign language recognition.
 * Provides cross-lingual embedding space for ASL, BSL, ArSL, and other sign languages.
 * 
 * Since we don't have the actual SignCLIP pre-trained weights, this implementation
 * provides a compatible interface with a distilled ONNX model approach.
 * In production, replace with actual SignCLIP weights from:
 * https://github.com/J22Melody/fairseq/tree/main/examples/MMPT
 */

// ONNX Runtime types (avoiding direct dependency)
interface ONNXInferenceSession {
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array }>>;
}

interface ONNXRuntimeLibs {
  InferenceSession: {
    create(path: string, options?: unknown): Promise<ONNXInferenceSession>;
  };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown;
}

export interface SignLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  rtl?: boolean;
}

export const SUPPORTED_LANGUAGES: SignLanguage[] = [
  { code: 'ASL', name: 'American Sign Language', nativeName: 'ASL', flag: '🇺🇸' },
  { code: 'BSL', name: 'British Sign Language', nativeName: 'BSL', flag: '🇬🇧' },
  { code: 'ArSL', name: 'Arabic Sign Language', nativeName: 'لغة الإشارة العربية', flag: '🇸🇦', rtl: true },
];

export interface SignCLIPConfig {
  embeddingDim: number;
  maxSequenceLength: number;
  featureDim: number; // 126 (42 landmarks * 3)
  languages: string[];
}

export interface SignCLIPModel {
  // Video encoder: outputs embeddingDim-dim embedding from sequence
  encodeVideo(frames: Float32Array[]): Promise<Float32Array>;
  // Text encoder: text prompt → embeddingDim-dim embedding
  encodeText(text: string): Promise<Float32Array>;
  // Language detection from video embedding
  detectLanguage(embedding: Float32Array): Promise<string>;
  // Search for similar signs across languages
  search(queryEmb: Float32Array, k: number): { label: string; lang: string; score: number }[];
  // Get supported languages
  getLanguages(): SignLanguage[];
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

/**
 * Create SignCLIP model using ONNX Runtime
 * In production, load actual SignCLIP ONNX model
 */
export class SignCLIPONNX implements SignCLIPModel {
  private session: ONNXInferenceSession | null = null;
  private onnxLibs: ONNXRuntimeLibs | null = null;
  private config: SignCLIPConfig;
  private languagePrompts: Map<string, Float32Array> = new Map();
  private vocabularyEmbeddings: Map<string, { label: string; lang: string; embedding: Float32Array }[]> = new Map();

  constructor(config: Partial<SignCLIPConfig> = {}) {
    this.config = {
      embeddingDim: config.embeddingDim ?? 512,
      maxSequenceLength: config.maxSequenceLength ?? 60,
      featureDim: config.featureDim ?? 126,
      languages: config.languages ?? ['ASL', 'BSL', 'ArSL'],
    };
  }

  async initialize(onnxLibs: ONNXRuntimeLibs, modelPath: string): Promise<void> {
    this.onnxLibs = onnxLibs;
    this.session = await onnxLibs.InferenceSession.create(modelPath, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });

    // Pre-compute language prompt embeddings for detection
    await this.precomputeLanguagePrompts();
  }

  private async precomputeLanguagePrompts(): Promise<void> {
    for (const lang of this.config.languages) {
      const prompt = `sign language: ${lang}`;
      const emb = await this.encodeText(prompt);
      this.languagePrompts.set(lang, emb);
    }
  }

  /**
   * Encode video frames to embedding
   * frames: Array of Float32Array [T, featureDim] where T <= maxSequenceLength
   */
  async encodeVideo(frames: Float32Array[]): Promise<Float32Array> {
    if (!this.session || !this.onnxLibs) {
      throw new Error('SignCLIP not initialized');
    }

    // Pad or truncate to maxSequenceLength
    const T = this.config.maxSequenceLength;
    const D = this.config.featureDim;
    const input = new Float32Array(T * D);
    
    const framesToUse = Math.min(frames.length, T);
    for (let t = 0; t < framesToUse; t++) {
      input.set(frames[t], t * D);
    }

    const tensor = new this.onnxLibs.Tensor('float32', input, [1, T, D]);
    const output = await this.session.run({ input: tensor });
    
    // Output should be [1, embeddingDim]
    const embedding = output.embedding?.data || output.output?.data || output[0]?.data;
    if (!embedding) {
      throw new Error('Unexpected model output format');
    }
    return new Float32Array(embedding);
  }

  /**
   * Encode text prompt to embedding
   * In production, this would use the text encoder part of SignCLIP
   * For now, we use a simple deterministic hash-based embedding
   */
  async encodeText(text: string): Promise<Float32Array> {
    // Simple deterministic embedding from text hash
    const embedding = new Float32Array(this.config.embeddingDim);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    
    // Use hash as seed for pseudo-random embedding
    let seed = Math.abs(hash);
    for (let i = 0; i < this.config.embeddingDim; i++) {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      embedding[i] = (seed / 4294967296) * 2 - 1; // [-1, 1]
    }
    
    // Normalize
    let norm = 0;
    for (let i = 0; i < this.config.embeddingDim; i++) {
      norm += embedding[i] * embedding[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < this.config.embeddingDim; i++) {
        embedding[i] /= norm;
      }
    }
    
    return embedding;
  }

  /**
   * Detect sign language from video embedding
   */
  async detectLanguage(embedding: Float32Array): Promise<string> {
    let bestLang = 'ASL';
    let bestScore = -1;

    for (const [lang, promptEmb] of this.languagePrompts) {
      const score = cosineSimilarity(embedding, promptEmb);
      if (score > bestScore) {
        bestScore = score;
        bestLang = lang;
      }
    }

    return bestLang;
  }

  /**
   * Search for similar signs in vocabulary
   */
  search(queryEmb: Float32Array, k: number): { label: string; lang: string; score: number }[] {
    const results: { label: string; lang: string; score: number }[] = [];

    for (const [lang, embeddings] of this.vocabularyEmbeddings) {
      for (const { label, embedding } of embeddings) {
        const score = cosineSimilarity(queryEmb, embedding);
        results.push({ label, lang, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  /**
   * Register vocabulary embeddings for a language
   */
  async registerVocabulary(lang: string, labels: string[], embeddings: Float32Array[]): Promise<void> {
    if (!this.vocabularyEmbeddings.has(lang)) {
      this.vocabularyEmbeddings.set(lang, []);
    }
    const vocab = this.vocabularyEmbeddings.get(lang)!;
    for (let i = 0; i < labels.length; i++) {
      vocab.push({ label: labels[i], lang, embedding: embeddings[i] });
    }
  }

  getLanguages(): SignLanguage[] {
    return SUPPORTED_LANGUAGES.filter(l => this.config.languages.includes(l.code));
  }

  getConfig(): SignCLIPConfig {
    return { ...this.config };
  }
}

/**
 * Factory function to create SignCLIP model
 */
export function createSignCLIP(config?: Partial<SignCLIPConfig>): SignCLIPONNX {
  return new SignCLIPONNX(config);
}

/**
 * Multi-language vocabulary manager
 */
export interface LanguageVocabulary {
  labels: string[];
  descriptions: Record<string, string>;
  categories: Record<string, string[]>;
}

export interface MultiLangVocabulary {
  [lang: string]: LanguageVocabulary;
}

export const DEFAULT_MULTILANG_VOCAB: MultiLangVocabulary = {
  ASL: {
    labels: ['HELLO', 'THANKS', 'PLEASE', 'SORRY', 'YES', 'NO', 'HELP', 'MORE', 'DONE', 'GOOD'],
    descriptions: {
      HELLO: 'Wave hand near forehead',
      THANKS: 'Touch chin and extend forward',
      PLEASE: 'Rub chest in circle',
      SORRY: 'Fist rub chest in circle',
      YES: 'Fist nod up and down',
      NO: 'Index and middle tap thumb',
      HELP: 'Fist on palm, lift both',
      MORE: 'Fingertips touch together',
      DONE: 'Hands flip out',
      GOOD: 'Flat hand from chin forward',
    },
    categories: {
      greetings: ['HELLO', 'THANKS', 'PLEASE'],
      basics: ['YES', 'NO', 'SORRY'],
      needs: ['HELP', 'MORE', 'DONE', 'GOOD'],
    },
  },
  BSL: {
    labels: ['HELLO', 'THANKS', 'PLEASE', 'SORRY', 'YES', 'NO', 'HELP', 'MORE', 'DONE', 'GOOD'],
    descriptions: {
      HELLO: 'Wave hand near head (two-handed)',
      THANKS: 'Flat hand from chin forward (BSL style)',
      PLEASE: 'Flat hand rub chest',
      SORRY: 'Fist rub chest',
      YES: 'Fist nod',
      NO: 'Two fingers tap thumb',
      HELP: 'Thumb up on palm, lift',
      MORE: 'Fingers tap together',
      DONE: 'Hands brush apart',
      GOOD: 'Thumb up',
    },
    categories: {
      greetings: ['HELLO', 'THANKS', 'PLEASE'],
      basics: ['YES', 'NO', 'SORRY'],
      needs: ['HELP', 'MORE', 'DONE', 'GOOD'],
    },
  },
  ArSL: {
    labels: ['مرحبا', 'شكرا', 'من فضلك', 'آسف', 'نعم', 'لا', 'مساعدة', 'المزيد', 'انتهى', 'جيد'],
    descriptions: {
      'مرحبا': 'Hand wave near head',
      'شكرا': 'Hand from chin forward',
      'من فضلك': 'Hand rub chest',
      'آسف': 'Fist rub chest',
      'نعم': 'Head nod',
      'لا': 'Index finger side to side',
      'مساعدة': 'Hand on palm lift',
      'المزيد': 'Fingers tap',
      'انتهى': 'Hands separate',
      'جيد': 'Thumbs up',
    },
    categories: {
      greetings: ['مرحبا', 'شكرا', 'من فضلك'],
      basics: ['نعم', 'لا', 'آسف'],
      needs: ['مساعدة', 'المزيد', 'انتهى', 'جيد'],
    },
  },
};

/**
 * Language detection from user's first signs
 */
export class LanguageDetector {
  private signclip: SignCLIPModel;
  private detectionHistory: string[] = [];
  private readonly historySize = 10;
  private readonly confidenceThreshold = 0.7;

  constructor(signclip: SignCLIPModel) {
    this.signclip = signclip;
  }

  async detect(embedding: Float32Array): Promise<{ language: string; confidence: number } | null> {
    const lang = await this.signclip.detectLanguage(embedding);
    this.detectionHistory.push(lang);
    if (this.detectionHistory.length > this.historySize) {
      this.detectionHistory.shift();
    }

    // Require consistent detection
    const counts = new Map<string, number>();
    for (const l of this.detectionHistory) {
      counts.set(l, (counts.get(l) || 0) + 1);
    }

    let bestLang = '';
    let bestCount = 0;
    for (const [l, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        bestLang = l;
      }
    }

    const confidence = bestCount / this.detectionHistory.length;
    if (confidence >= this.confidenceThreshold) {
      return { language: bestLang, confidence };
    }
    return null;
  }

  reset(): void {
    this.detectionHistory = [];
  }

  getCurrentLanguage(): string | null {
    if (this.detectionHistory.length === 0) return null;
    const counts = new Map<string, number>();
    for (const l of this.detectionHistory) {
      counts.set(l, (counts.get(l) || 0) + 1);
    }
    let best = '';
    let max = 0;
    for (const [l, c] of counts) {
      if (c > max) { max = c; best = l; }
    }
    return best;
  }
}

/**
 * Get vocabulary for a language
 */
export function getVocabulary(lang: string): LanguageVocabulary | null {
  return DEFAULT_MULTILANG_VOCAB[lang] || null;
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): SignLanguage[] {
  return SUPPORTED_LANGUAGES;
}

/**
 * Get language by code
 */
export function getLanguage(code: string): SignLanguage | undefined {
  return SUPPORTED_LANGUAGES.find(l => l.code === code);
}