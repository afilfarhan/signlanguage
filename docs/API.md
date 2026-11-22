# SignTutor API Documentation

## Overview

SignTutor is a browser-based ASL learning platform with on-device ML inference. All processing happens client-side — no biometric data leaves the browser.

## Core Libraries

### `/lib/loadExternals.ts`

MediaPipe and ONNX Runtime loader with WebGPU/WASM fallback.

```typescript
// Load MediaPipe Hands + Holistic + Drawing + Camera
const mpLibs = await loadMediaPipe();

// Load ONNX Runtime (WebGPU preferred, WASM fallback)
const onnxLibs = await loadONNX();

// Get backend info
const backend = await getONNXBackend();
// { name: 'webgpu' | 'wasm', label: 'WebGPU' | 'WASM', supportsFP16: boolean, supportsGraphCapture: boolean }

// Create optimized session options
const options = createSessionOptions(backend, 'static' | 'dynamic' | 'word' | 'jz');
```

**Exports:**
- `loadMediaPipe()` - Loads MediaPipe Hands, Holistic, Drawing Utils, Camera Utils from CDN
- `loadONNX()` - Loads ONNX Runtime Web (WebGPU or WASM)
- `getONNXBackend()` - Returns detected backend info
- `createSessionOptions(backend, modelType)` - Creates optimized session options
- `detectWebGPU()` - Detects WebGPU support

### `/lib/normalize.ts`

Hand landmark normalization and feature extraction.

```typescript
// Normalize single frame landmarks (21 points → 68-dim feature vector)
const features = normalizeWithGeometry(landmarks);

// Extract finger states
const states = fingerStates(landmarks);
// { thumb: boolean, index: boolean, middle: boolean, ring: boolean, pinky: boolean }

// Check palm orientation
const orient = palmFacingCamera(landmarks);
// { facing: boolean, angle: number }

// Classify using rule-based system
const { label, confidence } = classifyRule(landmarks);

// Location label
const loc = locationLabel(landmarks);
// "neutral" | "high" | "low" | "side"
```

**Exports:**
- `normalizeWithGeometry(landmarks)` - Returns Float32Array[68]
- `fingerStates(landmarks)` - Returns finger extension states
- `palmFacingCamera(landmarks)` - Returns orientation info
- `classifyRule(landmarks)` - Rule-based classification
- `locationLabel(landmarks)` - Returns location string
- `recentMovement(buffer)` - Movement analysis
- `PATTERNS` - Reference patterns for 24 letters
- Types: `Landmark`, `FingerStates`, `FingerKey`, `MovementPoint`

### `/lib/seq-features.ts`

Sequence normalization for temporal models.

```typescript
// Normalize variable-length sequence to fixed length
const fixed = normalizeSequenceFixed(sequence, T_FRAMES);
// sequence: Float32Array[] (variable length)
// returns: Float32Array[T_FRAMES * FEATURE_DIM]
```

**Exports:**
- `normalizeSequenceFixed(sequence, targetFrames)` - Returns fixed-length feature array
- `T_FRAMES` - Static model frames (30)
- `WORD_T_FRAMES` - Word model frames (60)
- `N_LANDMARKS` - 21
- `FEATURE_DIM` - 126 (21 landmarks × 3 coords × 2 hands)
- `JZ_FRAMES` - J/Z model frames (10)
- Types: `Landmark`

### `/lib/nmm.ts`

Non-Manual Marker (NMM) feature extraction from MediaPipe Holistic.

```typescript
// Extract all NMM features from Holistic results
const nmm = extractNMMFeatures(results);
// Returns NMMFeatures object

// Get human-readable description
const descriptions = getNMMDescription(nmm);
// Returns string[] (e.g., ["question", "brow raise"])

// Check data reliability
const reliable = isNMMDataReliable(results);
// Returns boolean
```

**NMMFeatures:**
```typescript
interface NMMFeatures {
  // Eyebrows
  leftBrowRaise: number;      // 0-1
  rightBrowRaise: number;     // 0-1
  browFurrow: number;         // 0-1
  browInnerDistance: number;  // normalized
  
  // Eyes
  leftEyeOpenness: number;    // 0-1
  rightEyeOpenness: number;   // 0-1
  eyeGazeLeftRight: number;   // -1 to 1
  eyeGazeUpDown: number;      // -1 to 1 (always 0 currently)
  
  // Mouth
  mouthOpen: number;          // 0-1
  mouthWidth: number;         // 0-1
  mouthHeight: number;        // 0-1
  mouthCornerRaise: number;   // 0-1 (smile)
  mouthPucker: number;        // 0-1
  mouthTension: number;       // 0-1
  
  // Head pose
  headPitch: number;          // degrees
  headYaw: number;            // degrees
  headRoll: number;           // degrees
  
  // Grammatical markers
  isQuestion: boolean;        // yes/no question (brow raise)
  isWhQuestion: boolean;      // wh-question (brow furrow)
  isNegation: boolean;        // head shake
  isAffirmation: boolean;     // head nod
  isTopic: boolean;           // topic marking
}
```

**Exports:**
- `extractNMMFeatures(results)` - Returns NMMFeatures
- `getNMMDescription(features)` - Returns string[]
- `isNMMDataReliable(results)` - Returns boolean
- `FACE_LANDMARKS` - MediaPipe Face Mesh landmark indices
- `POSE_LANDMARKS` - MediaPipe Pose landmark indices
- Types: `NMMFeatures`, `MediaPipeHolisticResults`

### `/lib/streaming-ctc.ts`

Streaming CTC decoder for continuous sign language recognition.

```typescript
// Create beam search decoder
const decoder = createASLDecoder(labels);
// or
const decoder = new StreamingCTCDecoder(labels, {
  blankId: labels.length,
  beamWidth: 10,
  threshold: 1e-4,
  minSignDuration: 3,
  maxSignDuration: 60,
  mergeRepeated: true
});

// Process frame logits
const segments = decoder.step(logits);
// Returns DecodedSegment[]

// Get full transcript
const transcript = decoder.getFullTranscript();
// Returns DecodedSegment[]
```

**DecodedSegment:**
```typescript
interface DecodedSegment {
  label: string;
  startFrame: number;
  endFrame: number;
  confidence: number;
  nmmTags?: string[];  // ["question", "negation", ...]
}
```

**Exports:**
- `StreamingCTCDecoder` - Beam search CTC decoder
- `GreedyCTCDecoder` - Fast greedy decoder
- `createASLDecoder(labels)` - Factory for ASL-configured decoder
- Types: `CTCConfig`, `DecodedSegment`, `Hypothesis`

### `/lib/personal-adapter.ts`

Few-shot personal adapter for custom sign learning.

```typescript
// Create adapter
const adapter = createPersonalAdapter({
  embeddingDim: 128,
  maxPersonalSigns: 50,
  maxExamplesPerSign: 5,
  minQualityThreshold: 0.7,
  cosineThreshold: 0.35,
  useLabelPropagation: true
});

// Initialize with encoder session
await adapter.initialize(encoderSession, onnxLibs, baseVocabLabels);

// Add examples (1-5 per sign)
await adapter.addExamples("MYNAME", sequences);
// sequences: Float32Array[][] (each: [T, 126])

// Recognize from embedding
const results = adapter.recognize(embedding);
// Returns RecognitionResult[]
```

**RecognitionResult:**
```typescript
interface RecognitionResult {
  label: string;
  confidence: number;  // 0-1
  isPersonal: boolean;
  distance: number;
}
```

**Exports:**
- `PersonalAdapter` - Main adapter class
- `createPersonalAdapter(config)` - Factory
- `SupportExample` - Example with embedding
- `PersonalModel` - Serialized model for persistence
- Types: `AdapterConfig`, `RecognitionResult`

### `/lib/personal-db.ts`

IndexedDB persistence for personal models.

```typescript
// Save personal model
await savePersonalModel(model);

// Load personal model
const model = await loadPersonalModel();

// List all personal signs
const signs = await listPersonalSigns();
// Returns { label, exampleCount, createdAt, updatedAt }[]

// Delete a sign
await deletePersonalSign(label);

// Export/import
const json = await exportPersonalData();
await importPersonalData(json);

// Clear all
await clearPersonalData();

// Storage estimate
const { usage, quota } = await getStorageEstimate();
```

### `/lib/signclip.ts`

SignCLIP cross-lingual embeddings for multi-language support.

```typescript
// Create SignCLIP model
const signclip = createSignCLIP();
await signclip.initialize(onnxLibs, "/models/signclip.onnx");

// Encode video
const embedding = await signclip.encodeVideo(frames);

// Encode text prompt
const textEmb = await signclip.encodeText("sign language: BSL");

// Detect language
const lang = await signclip.detectLanguage(embedding);
// Returns "ASL" | "BSL" | "ArSL"

// Search vocabulary
const results = signclip.search(queryEmb, 5);
// Returns { label, lang, score }[]
```

**Supported Languages:**
- ASL (American Sign Language) - 🇺🇸
- BSL (British Sign Language) - 🇬🇧
- ArSL (Arabic Sign Language) - 🇸🇦 (RTL)

**Exports:**
- `SignCLIPONNX` - ONNX-based implementation
- `createSignCLIP(config)` - Factory
- `LanguageDetector` - Auto-detection from video
- `getVocabulary(lang)` - Returns vocabulary for language
- `getSupportedLanguages()` - Returns SignLanguage[]
- Types: `SignLanguage`, `SignCLIPConfig`, `SignCLIPModel`, `MultiLangVocabulary`, `LanguageVocabulary`

## Model Cards

### Fingerspelling MLP (`fingerspell_mlp_fp16.onnx`)
- **Task**: 24-class static letter classification
- **Input**: [1, 68] Float32 (normalized landmarks)
- **Output**: [1, 24] logits
- **Classes**: A-Y (excludes J, Z)
- **Size**: ~47 KB (FP16)
- **Latency**: <0.05ms WebGPU, <0.5ms WASM

### Fingerspelling MLP v2 (`fingerspell_mlp_v2_fp16.onnx`)
- **Task**: 24-class with improved accuracy
- **Input**: [1, 68] Float32
- **Output**: [1, 24] logits
- **Size**: ~150 KB (FP16)

### J/Z Temporal Classifier (`jz_classifier.onnx`)
- **Task**: J vs Z motion classification
- **Input**: [1, 10, 126] Float32 (10 frames × 42 landmarks × 3)
- **Output**: [1, 2] logits
- **Size**: ~107 KB
- **Latency**: <0.1ms

### Dynamic Signs Transformer (`dynamic_signs_transformer_fp16.onnx`)
- **Task**: 8-class dynamic sign classification
- **Input**: [1, 45, 126] Float32
- **Output**: [1, 8] logits
- **Size**: ~368 KB (FP16)
- **Latency**: <0.2ms WebGPU

### Word Transformer (`word_transformer_fp16.onnx`)
- **Task**: 100-word vocabulary classification
- **Input**: [1, 60, 126] Float32
- **Output**: [1, 100] logits
- **Encoder**: 4 layers, 8 heads, 128-dim
- **Size**: ~1.26 MB (FP16)
- **Latency**: <0.2ms WebGPU, ~1ms WASM

## WebGPU Configuration

```typescript
// Session options for WebGPU
const options = {
  executionProviders: ['webgpu'],
  graphOptimizationLevel: 'all',
  enableMemPattern: true,
  enableCpuMemArena: true,
  'webgpu.enableGraphCapture': true,  // For static-shape models
  'webgpu.contextOptions': { /* WebGPU context options */ }
};
```

**Models with Graph Capture:**
- Static MLP (fingerspelling)
- J/Z classifier
- Other static-shape models

**Models without Graph Capture:**
- Dynamic Transformer (variable sequence length)
- Word Transformer (variable sequence length)

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| WordTransformer WebGPU | <0.2ms p95 | HUD p95 |
| WordTransformer WASM | <1ms p95 | HUD p95 |
| Static MLP WebGPU | <0.05ms | HUD p95 |
| Model bundle (FP16) | <2MB total | Network tab |
| NMM detection | >85% 4-class | Test set |
| Few-shot 5-shot | >85% personal | User study n=10 |
| Lighthouse Accessibility | ≥95 | CI |
| PWA Offline | Yes | Manual test |

## Browser Support

| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| WebGPU | 113+ | 113+ | 18+ | Nightly |
| MediaPipe | ✅ | ✅ | ✅ | ✅ |
| ONNX Runtime Web | ✅ | ✅ | ✅ | ✅ |
| IndexedDB | ✅ | ✅ | ✅ | ✅ |
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| PWA Install | ✅ | ✅ | ✅ | ✅ |

## Privacy

- **Zero biometric data egress** — all inference on-device
- **No accounts required** — fully local
- **IndexedDB only** — personal models stay in browser
- **Service Worker** — models cached for offline use
- **No analytics/tracking** — privacy by default