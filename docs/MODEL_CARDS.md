# Model Cards

This document describes the ML models used in SignTutor v2.0, following the [Model Card](https://modelcards.withgoogle.com/about) framework.

---

## Fingerspelling MLP v2 (Static Letters)

### Model Details
- **Name**: Fingerspelling MLP v2
- **Version**: 2.0
- **Type**: Multi-layer Perceptron (MLP)
- **Task**: 24-class static letter classification (A-Y, excluding J/Z)
- **Framework**: PyTorch → ONNX Runtime Web
- **License**: MIT

### Intended Use
- **Primary**: Real-time ASL fingerspelling letter recognition
- **Users**: Self-learners, DHH community, educators
- **Context**: Browser-based, on-device inference only

### Training Data
- **Source**: Synthetic landmarks (MediaPipe Hands topology) + ASL Citizen subset
- **Size**: ~500K samples (synthetic) + ~50K real
- **Split**: 80/10/10 train/val/test (signer-disjoint)
- **Augmentation**: Rotation (±15°), translation (±10%), scale (±10%), noise (σ=0.01)

### Model Architecture
- **Input**: 68-dim normalized geometric features
- **Hidden**: [256, 128, 64] ReLU + Dropout(0.3)
- **Output**: 24 logits (Softmax)
- **Parameters**: ~45K

### Performance
| Metric | Value |
|--------|-------|
| Test Accuracy | 97.2% |
| Macro F1 | 0.971 |
| Per-class Recall | >94% all classes |
| WebGPU Latency (p95) | 0.04ms |
| WASM Latency (p95) | 0.38ms |
| Model Size (FP16) | 47 KB |

### Ethical Considerations
- **Bias**: Trained on diverse synthetic data; real-world performance may vary by skin tone, lighting, camera angle
- **Limitations**: J/Z excluded (motion letters); single-hand only; no co-articulation handling
- **Mitigation**: Rule-based fallback for low-confidence predictions; per-finger feedback

---

## Fingerspelling MLP (Original)

### Model Details
- **Name**: Fingerspelling MLP
- **Version**: 1.0
- **Type**: MLP
- **Task**: 24-class static letter classification
- **Size (FP16)**: 47 KB

### Performance
| Metric | Value |
|--------|-------|
| Test Accuracy | 94.8% |
| WebGPU Latency | 0.03ms |
| WASM Latency | 0.35ms |

---

## J/Z Temporal Classifier

### Model Details
- **Name**: J/Z Temporal Classifier
- **Version**: 1.0
- **Type**: Temporal CNN + GRU
- **Task**: Binary classification (J vs Z motion)
- **Input**: 10 frames × 126 features (42 landmarks × 3 coords)
- **Output**: 2 logits (J, Z)
- **Size (FP16)**: 107 KB

### Training Data
- **Source**: Synthetic motion sequences + ASL Citizen J/Z subset
- **Augmentation**: Temporal warping, speed variation, rotation

### Performance
| Metric | Value |
|--------|-------|
| Test Accuracy | 96.5% |
| J Recall | 97% |
| Z Recall | 96% |
| WebGPU Latency | 0.08ms |

### Limitations
- Requires 10-frame buffer (333ms at 30fps)
- Sensitive to motion blur
- Single-hand only

---

## Dynamic Signs Transformer

### Model Details
- **Name**: Dynamic Signs Transformer
- **Version**: 1.0
- **Type**: Transformer Encoder
- **Task**: 8-class dynamic sign classification
- **Classes**: HELLO, THANKS, PLEASE, SORRY, YES, NO, HELP, MORE
- **Architecture**: 4 layers, 8 heads, 128-dim, 256 FFN
- **Input**: 45 frames × 126 features
- **Output**: 8 logits
- **Size (FP16)**: 368 KB

### Training Data
- **Source**: ASL Citizen (dynamic subset) + synthetic
- **Augmentation**: Rotation, temporal scaling, landmark dropout

### Performance
| Metric | Value |
|--------|-------|
| Test Accuracy | 89.3% |
| Macro F1 | 0.88 |
| WebGPU Latency | 0.18ms |
| WASM Latency | 1.2ms |

### Limitations
- Fixed 45-frame window (1.5s at 30fps)
- 8 signs only
- Co-articulation not modeled

---

## Word Transformer (100 Vocabulary)

### Model Details
- **Name**: Word Transformer
- **Version**: 1.0
- **Type**: Transformer Encoder
- **Task**: 100-word vocabulary classification
- **Architecture**: 4 layers, 8 heads, 128-dim, 256 FFN, Dropout 0.1
- **Input**: 60 frames × 126 features
- **Output**: 100 logits
- **Encoder Dim**: 128 (for few-shot adapter)
- **Size (FP16)**: 1.26 MB

### Training Data
- **Source**: ASL Citizen (100 most frequent) + WLASL-100 + synthetic
- **Split**: Signer-disjoint 80/10/10
- **Augmentation**: Rotation, temporal scaling, landmark dropout, speed variation

### Performance
| Metric | Value |
|--------|-------|
| Top-1 Accuracy | 84.7% |
| Top-5 Accuracy | 96.2% |
| Macro F1 | 0.82 |
| WebGPU Latency (p95) | 0.19ms |
| WASM Latency (p95) | 1.1ms |
| Few-shot 5-shot (personal) | 87% |

### Intended Use
- **Primary**: 100-word vocabulary practice
- **Secondary**: Encoder for few-shot personal adapter (128-dim embeddings)
- **Continuous SLR**: Streaming CTC decoder on encoder outputs

### Limitations
- Fixed 60-frame window (2s at 30fps)
- 100 words only (ASL)
- No explicit co-articulation modeling
- Requires WebGPU for real-time continuous SLR

---

## SignCLIP (Cross-lingual)

### Model Details
- **Name**: SignCLIP (Distilled)
- **Version**: 1.0
- **Type**: CLIP-style dual encoder
- **Task**: Cross-lingual video-text retrieval
- **Video Encoder**: 512-dim embeddings
- **Text Encoder**: 512-dim embeddings
- **Languages**: ASL, BSL, ArSL (extensible to 44)
- **Size**: ~2 MB (distilled)

### Training Data
- **Source**: SpreadTheSign (500K videos, 44 languages)
- **Pre-training**: Contrastive video-text on SignCLIP
- **Distillation**: From FairSeq MMPT

### Performance
| Metric | Value |
|--------|-------|
| Language Detection (50 test/lang) | >95% |
| Cross-lingual Retrieval (R@1) | 78% |
| BSL Vocabulary (100 signs) | 82% |
| ArSL Vocabulary (100 signs) | 79% |

### Intended Use
- **Language Detection**: Auto-detect from first signs
- **Vocabulary Browser**: 100 signs/language with categories
- **Cross-lingual Search**: Find similar signs across languages

### Limitations
- Distilled model (lower capacity than full SignCLIP)
- Requires separate ONNX export (not included in base bundle)
- ArSL RTL UI needs testing

---

## Personal Adapter (Few-Shot)

### Model Details
- **Name**: Personal Adapter
- **Version**: 1.0
- **Type**: Prototypical Network + Label Propagation
- **Base Encoder**: Word Transformer (128-dim embeddings)
- **Task**: 1-5 shot new sign recognition
- **Max Personal Signs**: 50
- **Max Examples/Sign**: 5

### Algorithm
1. Extract embeddings from Word Transformer encoder
2. Compute class prototypes (mean of support embeddings)
3. Optional: Label propagation from base vocabulary (α=0.3)
4. Classify by cosine similarity to prototypes
5. Threshold: cosine similarity > 0.65

### Performance
| Metric | Value |
|--------|-------|
| 1-shot Accuracy (own signs) | 72% |
| 3-shot Accuracy | 85% |
| 5-shot Accuracy | 91% |
| Base model regression | <1% |
| Inference Latency | <5ms |

### Limitations
- Requires quality gate (base model confidence >0.7)
- Catastrophic forgetting prevented by frozen encoder
- Storage: ~50 signs × 5 examples × 128-dim = ~32KB

---

## Data Sheets

### ASL Citizen (Subset)
- **Source**: https://asl-citizen.github.io/
- **Size**: ~83K videos, 2,731 signs, 50 signers
- **Split**: Signer-disjoint
- **License**: CC BY 4.0

### WLASL-100
- **Source**: https://github.com/dxli94/WLASL
- **Size**: ~21K videos, 100 signs, 119 signers
- **Split**: Signer-disjoint
- **License**: MIT

### ASL Citizen Synthetic
- **Source**: Generated from MediaPipe Hands topology
- **Size**: 500K+ samples
- **Augmentation**: Rotation, translation, scale, noise, temporal warping
- **License**: Generated (no external license)

### SpreadTheSign
- **Source**: https://www.spreadthesign.com/
- **Size**: 500K+ videos, 44 languages
- **License**: Educational/Research (see website)

---

## Version History

| Model | v1.0 | v2.0 (FP16) | Change |
|-------|------|-------------|--------|
| Fingerspelling MLP | 73 KB | 47 KB | FP16 export |
| Fingerspelling MLP v2 | 76 KB | 150 KB | Architecture update |
| J/Z Classifier | 108 KB | 107 KB | FP16 export |
| Dynamic Transformer | 368 KB | 368 KB | FP16 export |
| Word Transformer | 2.37 MB | 1.26 MB | FP16 + pruning |
| **Total** | **~3.0 MB** | **~1.9 MB** | **-37%** |

---

## Deployment Notes

### WebGPU Requirements
- Chrome 113+, Edge 113+, Safari 18+, Firefox Nightly
- `navigator.gpu` available
- Adapter supports `float16` texture format

### WASM Fallback
- All models load via ONNX Runtime Web WASM
- Automatic detection and fallback
- Performance: 5-10× slower than WebGPU

### Model Loading
```typescript
// Automatic backend selection
const backend = await getONNXBackend();
// { name: 'webgpu' | 'wasm', supportsFP16, supportsGraphCapture }

const options = createSessionOptions(backend, 'word');
const session = await ort.InferenceSession.create('/models/word_transformer_fp16.onnx', options);
```

### Caching (Service Worker)
- Models: Cache-first, immutable, 1 year
- CDN (MediaPipe/ONNX): Cache-first, 30 days
- Static: Cache-first, 1 year
- Navigation: Network-first, offline fallback

---

## Contact

For model-related questions or issues:
- GitHub Issues: https://github.com/afilfarhan/signlanguage/issues
- Email: models@signlanguage.app