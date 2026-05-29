# Architecture Decision Record — Word & Sentence Recognition Extension

> ADR for extending SignTutor's ASL pipeline from alphabet (A–Z) to word-level and sentence-level recognition.

---

## 2.1 Input & Feature Extraction Layer

### Decision: Keep MediaPipe Hands (not Holistic) for v1

**Rationale**: The existing pipeline uses MediaPipe Hands (21 landmarks × 3 coords = 63 values per hand). Adding full Holistic (543 landmarks including face + pose) would:
- Triple the input dimension → larger model, slower inference
- Require face detection (privacy concerns for webcam app)
- Pose landmarks add minimal value for isolated word recognition where hand motion dominates

**For v2**: Consider adding pose landmarks (33 upper-body only) for signs that involve body locations (e.g., "PLEASE" touches chest, "THANKS" starts at chin). This adds 33×3 = 99 values, bringing total to 63 + 99 = 162 per frame.

### Input Tensor Shape

| Component | Landmarks | Coords | Per-Frame Dims |
|-----------|-----------|--------|----------------|
| Hand (dominant) | 21 | 3 | 63 positions |
| Hand velocities | 21 | 3 | 63 velocities |
| **Total per frame** | | | **126 floats** |

- **Sequence shape**: `(T, 126)` where T = window size in frames
- **Batch shape**: `(B, T, 126)`

### Normalization Pipeline (unchanged)

1. Translate entire sequence by first-frame wrist position (preserves trajectory)
2. Scale by first-frame wrist→middle-MCP distance (removes hand size)
3. Append per-frame velocity (delta vs previous frame)
4. Contract: identical in Python (`seq_features.py`) and JS (browser inference)

---

## 2.2 Temporal Modelling Layer

### Decision: Transformer Encoder over fixed-length frame buffer (Option B)

**Options considered**:

| Option | Latency | Accuracy (100-class) | Complexity | Real-time? |
|--------|---------|---------------------|------------|------------|
| A: Sliding window + LSTM/GRU | Low | Good | Low | Yes |
| **B: Transformer encoder** | **Medium** | **Best** | **Medium** | **Yes** |
| C: TCN | Low | Good | Low | Yes |
| D: Hybrid CNN-LSTM | Medium | Good | High | Marginal |

**Chosen: Option B — Transformer Encoder**

**Justification**:
1. Already in the codebase (`DynamicTransformerV2`) — proven, tested, ONNX-exported
2. Better accuracy on word-level tasks than LSTM (demonstrated in literature)
3. Parallelizable — no sequential dependency during inference
4. Pre-LN architecture for training stability
5. Exposed embedding output for future personalization (PersonalAdapter)

**Hyperparameters**:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `window_size` (T) | 60 frames | ~2s @ 30 FPS, covers most isolated signs (WLASL avg 1.5–2.5s) |
| `stride` | 15 frames | 500ms slide — good overlap for sign boundary detection |
| `d_model` | 128 | Matches v2 Transformer, good accuracy/size tradeoff |
| `n_heads` | 8 | Standard for d_model=128 (16 dims per head) |
| `n_layers` | 4 | Sufficient for 60-frame sequences |
| `ff_dim` | 256 | 2× d_model (standard ratio) |
| `dropout` | 0.1 | Standard |
| `max_len` | 60 | Must match window_size |

**Padding strategy**: Pad shorter sequences with zeros to T=60. The learned positional embedding handles variable-length within the window.

---

## 2.3 Classification Head

### Decision: Softmax over N vocabulary words (word-level first), CTC later

**Word-level (v1 — implemented now)**:
- **Head**: `nn.Linear(d_model, vocab_size)` → softmax
- **Loss**: Cross-entropy
- **Output**: Single predicted word per window
- **Why first**: Simpler, easier to evaluate, maps directly to the existing ISLR architecture

**Sentence-level (v2 — planned)**:
- **Head**: CTC loss over gloss sequence
- **Architecture**: Same Transformer encoder → `nn.Linear(d_model, vocab_size + 1)` (extra blank class)
- **Output**: Sequence of gloss labels per video
- **Why later**: Requires sentence-level data (How2Sign) and more complex evaluation (WER)

### Tradeoff Summary

| Aspect | Softmax (word) | CTC (sentence) |
|--------|---------------|----------------|
| Data requirement | Isolated sign clips | Continuous sentence clips |
| Evaluation | Top-1 / Top-5 accuracy | WER (word error rate) |
| Training complexity | Simple | Medium (alignment) |
| Real-time inference | Per-window classification | Streaming decode |
| Vocabulary growth | Add classes, retrain head | Add classes, retrain head |

---

## 2.4 Segmentation / Boundary Detection

### V1: Sliding Window + Confidence Thresholding + Cooldown

**How it works**:
1. Buffer incoming frames into a rolling window of size T=60
2. Every stride=15 frames, run the Transformer on the window
3. If `max(softmax) >= 0.75`, emit the predicted word
4. Apply a **cooldown** of 1.5 seconds (45 frames) to prevent duplicate detections
5. If confidence < 0.75, fall back to alphabet (fingerspelling) mode

**Fallback heuristic — Wrist velocity threshold**:
- Compute `||wrist[t] - wrist[t-1]||` per frame
- When velocity drops below `0.01` (palm-width units) for ≥5 consecutive frames, the hand is at rest → likely a sign boundary
- This is used as a secondary signal: when velocity is low AND confidence is high → strong detection

### V2: Learned Segmentation (future)
- Train an MS-TCN boundary detector on How2Sign
- Predict per-frame boundary probability
- Use as input to a CTC decoder for sentence-level recognition

---

## 2.5 Vocabulary Scope

### V1: Top 100 ASL Words

Starting vocabulary selected from the most frequently used ASL words in conversation, filtered by availability in ASL Citizen / WLASL:

```json
[
  "HELLO", "GOODBYE", "YES", "NO", "PLEASE", "THANKS", "SORRY", "HELP",
  "WANT", "NEED", "LIKE", "LOVE", "KNOW", "THINK", "FEEL", "SEE",
  "HEAR", "SAY", "TELL", "ASK", "GIVE", "TAKE", "COME", "GO",
  "EAT", "DRINK", "SLEEP", "WORK", "PLAY", "LEARN", "TEACH", "READ",
  "WRITE", "BUY", "PAY", "OPEN", "CLOSE", "STOP", "START", "WAIT",
  "FRIEND", "FAMILY", "MOTHER", "FATHER", "BABY", "HOME", "SCHOOL",
  "FOOD", "WATER", "GOOD", "BAD", "HAPPY", "SAD", "ANGRY", "SCARED",
  "BIG", "SMALL", "NEW", "OLD", "FAST", "SLOW", "HOT", "COLD",
  "MAN", "WOMAN", "BOY", "GIRL", "PERSON", "NAME", "WHAT", "WHERE",
  "WHEN", "WHO", "HOW", "WHY", "HOW-MUCH", "HOW-MANY", "MORE", "LESS",
  "ALL", "NONE", "EVERY", "SAME", "DIFFERENT", "MAYBE", "ALWAYS", "NEVER",
  "TODAY", "TOMORROW", "YESTERDAY", "NOW", "BEFORE", "AFTER", "WITH", "WITHOUT",
  "CAN", "CANNOT", "MUST", "SHOULD", "TRY", "FINISH"
]
```

### Vocabulary Expansion Strategy

1. **Add new words**: Append to `vocab_v1.json`, increase `vocab_size` in model config, reinitialize the classification head with the old weights (zero-init new rows)
2. **Partial retraining**: Freeze the Transformer encoder, only train the new classification head for 5–10 epochs
3. **Full retraining**: Fine-tune the entire model when vocabulary changes significantly (>20% growth)
4. **Versioned vocab**: Each vocabulary file is versioned (`vocab_v1.json`, `vocab_v2.json`) to ensure model-vocab compatibility

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Input (Webcam)                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              MediaPipe Hands                             │
│         21 landmarks × 3 coords per frame               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│          seq_features.normalize_sequence()               │
│   Translate → Scale → Append velocities → (T, 126)      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│          Rolling Frame Buffer (T=60, stride=15)         │
└────────────────────┬────────────────────────────────────┘
                     │
           ┌─────────┴─────────┐
           ▼                   ▼
┌────────────────────┐ ┌────────────────────┐
│  ALPHABET MODE     │ │  WORD MODE         │
│  fingerspell_mlp   │ │  WordTransformer   │
│  (68-dim input)    │ │  (60 × 126 input)  │
│  Single frame      │ │  Sequence          │
└────────┬───────────┘ └────────┬───────────┘
         │                      │
         ▼                      ▼
┌─────────────────────────────────────────────────────────┐
│              Unified Output Router                       │
│  confidence < 0.75 → alphabet mode                       │
│  confidence ≥ 0.75 → word mode + cooldown               │
└─────────────────────────────────────────────────────────┘
```

---

## Compatibility with Existing Pipeline

| Component | Existing | New | Changed? |
|-----------|----------|-----|----------|
| `features.py` | Static normalization | Unchanged | No |
| `seq_features.py` | Sequence normalization | Unchanged | No |
| `fingerspell_mlp_v2.onnx` | Alphabet model | Unchanged | No |
| `dynamic_signs_transformer.onnx` | 8-sign dynamic model | Superseded by word model | New model file |
| `hand_gesture_detector.py` | Python inference | Updated to unified recogniser | Yes |
| `synth_sequences.py` | 8-class synthetic data | Extended to 100 classes | New file |
