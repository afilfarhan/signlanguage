# Research Summary — Extending ASL Pipeline from Alphabet to Words & Sentences

> Phase 1 research conducted via TinyFish MCP search, May 2026.

---

## 1.1 Dataset Research

### WLASL (Word-Level American Sign Language)
- **Source**: https://dxli94.github.io/WLASL/ — WACV 2020 Best Paper Honourable Mention
- **Size**: 2,000 ASL words, 21,000+ video clips, 119 unique signers
- **Modality**: RGB video (MP4)
- **Licence**: Research use (CC BY 4.0 via Kaggle mirror)
- **Download**: https://www.kaggle.com/datasets/risangbaskoro/wlasl-processed
- **Suitability**: Excellent for word-level ISLR. Already scaffolded in `ml/data/wlasl.py`. The 2,000-class full dataset is large; subsets of 100–500 words are common in papers. Signer-disjoint splits already implemented.

### MS-ASL (Microsoft ASL)
- **Source**: https://www.microsoft.com/en-us/research/project/ms-asl/
- **Size**: 1,000 ASL signs, 25,000+ annotated videos, 222 unique signers
- **Modality**: RGB video (MP4)
- **Licence**: Microsoft Research Data Licence (free for research)
- **Download**: https://www.microsoft.com/en-us/download/details.aspx?id=100121
- **Suitability**: Good for cross-dataset evaluation. Already scaffolded in `ml/data/msasl.py`. Signer-independent splits provided. Better video quality than WLASL.

### ASL Citizen (NeurIPS 2023)
- **Source**: https://www.microsoft.com/en-us/research/project/asl-citizen/
- **Size**: ~84,000 videos, 2,700+ distinct signs, crowdsourced from Deaf community
- **Modality**: RGB video
- **Licence**: Free for research
- **Download**: https://www.kaggle.com/datasets/abd0kamel/asl-citizen
- **Suitability**: Best for ISLR. Largest crowdsourced isolated sign dataset. Includes phonological annotations (WLASL-LEX). Ideal for extending beyond the 8-sign synthetic vocabulary.

### How2Sign (Sentence-Level)
- **Source**: https://how2sign.github.io/ — CVPR 2021
- **Size**: 80+ hours, 35,000+ sentence-level clips, ~1,000 vocabulary
- **Modality**: RGB video + depth + Holistic landmarks (pre-extracted MediaPipe)
- **Licence**: Research use
- **Download**: https://how2sign.github.io/ (request access); HuggingFace mirror with pre-extracted landmarks: https://huggingface.co/datasets/PSewmuthu/How2Sign_Holistic
- **Suitability**: Best for sentence-level/CSLR. Pre-extracted MediaPipe Holistic landmarks available on Kaggle/HuggingFace, which directly matches our pipeline's input format. Average 162 frames (5.4s) per sentence.

### RWTH-PHOENIX-Weather 2014
- **Source**: https://www-i6.informatik.rwth-aachen.de/~koller/RWTH-PHOENIX/
- **Size**: ~5,300 sentences, 1,200 gloss vocabulary, ~600K frames
- **Modality**: RGB video
- **Licence**: Research use (requires registration)
- **Suitability**: Gold standard CSLR benchmark but **German Sign Language (DGS)**, not ASL. Useful for architecture benchmarking only, not for ASL deployment.

### ChicagoFSWild+
- **Source**: https://github.com/signlanguage-processing/ChicagoFSWild
- **Size**: ~160 signers, fingerspelling-focused
- **Modality**: RGB video
- **Suitability**: Already scaffolded in `ml/data/chicago_fs.py`. Fingerspelling-only, not word-level.

### Recommendation
- **Primary word-level dataset**: ASL Citizen (84K videos, 2.7K signs, best quality)
- **Secondary word-level dataset**: WLASL (2K words, widely benchmarked)
- **Sentence-level dataset**: How2Sign (ASL, MediaPipe landmarks pre-extracted)
- **Cross-eval**: MS-ASL (signer-independent test set)

---

## 1.2 Model Architecture Research

### Transformer Encoder (SOTA for ISLR)
- **Papers**: Li et al. (WACV 2020), Video Vision Transformers (ViViT, 2025), Ensemble Transformer (2025)
- **Performance**: 62.6% top-10 on WLASL-2000 (pose-based), up to 78% top-1 on smaller subsets
- **Pros**: Captures long-range temporal dependencies, parallelizable, already in our codebase (`SignTransformer`, `DynamicTransformerV2`)
- **Cons**: O(n²) attention for long sequences, fixed-length window needed
- **CPU feasibility**: Small Transformers (d_model=128, 4 layers) run at 30+ FPS on CPU

### LSTM/GRU (Good for real-time)
- **Papers**: Attention-based LSTM (94.7% on small vocab), STGCN-LSTM (hybrid)
- **Performance**: Competitive on small vocabularies (<100 words), lower on 2K-word benchmarks
- **Pros**: Naturally handles variable-length sequences, O(n) inference, low memory
- **Cons**: Struggles with very long sequences, sequential (not parallelizable)
- **CPU feasibility**: Excellent — already used for J/Z classifier in codebase
- **Our J/Z model**: BiLSTM hidden=64, 2 layers — validates this approach

### TCN (Temporal Convolutional Network)
- **Papers**: Renz et al. (2021) — MS-TCN for sign segmentation, CNN-TCN hybrid (2024)
- **Performance**: Good for segmentation and boundary detection
- **Pros**: Fully parallelizable, fixed-size receptive field, causal variants for streaming
- **Cons**: Less expressive for very long sequences than Transformers
- **CPU feasibility**: Best of all — pure conv, no recurrence, no attention

### I3D / 3D CNN
- **Papers**: I3D from action recognition adapted for SLR (Sarhan et al. 2020), Hand-Pose-Guided 3D Pooling (WACV 2021)
- **Performance**: 35–50% top-1 on WLASL-2000 (RGB-based, not landmark-based)
- **Pros**: Captures spatiotemporal features from raw pixels
- **Cons**: Very heavy compute, requires GPU, not compatible with our landmark-based pipeline
- **CPU feasibility**: Poor — not suitable for our CPU-first deployment target
- **Verdict**: Skip — our pipeline is landmark-based, not RGB-based

### SignBERT / SignBERT+
- **Source**: Hu et al. (ICCV 2021), Hu et al. (TPAMI 2023)
- **Architecture**: Hand-model-aware BERT pre-training on hand sequences, then fine-tune for SLR
- **Performance**: SOTA on WLASL-100 and WLASL-300
- **Pros**: Pre-trained representations transfer well; hand prior improves accuracy
- **Cons**: Complex pre-training pipeline, not directly compatible with our lightweight ONNX deployment
- **Verdict**: Consider for future (v2) when pre-trained weights are available

### Recommendation
- **Word-level (ISLR)**: **Transformer Encoder** (option A) — already in codebase, proven, ONNX-exportable, CPU-feasible at small scale
- **Sentence-level (CSLR)**: **LSTM + CTC** (option B) — simpler, lower latency, better for streaming/real-time
- **Segmentation**: **TCN** or simple velocity heuristic for v1

---

## 1.3 Segmentation & Temporal Modelling Research

### Sign Spotting & Temporal Segmentation
- **Problem**: Continuous sign language contains signs + transition/coarticulation frames. Need to identify where one sign ends and the next begins.
- **Learned segmentation**: MS-TCN (Renz et al., 2021) uses temporal convolutions for boundary detection. Achieves ~60% F1 on PHOENIX boundaries.
- **Heuristic segmentation**: Wrist velocity threshold — when hands pause or return to rest position, a boundary is likely. Simple, zero-training, good as a baseline.
- **Online segmentation**: "Towards Online CSLR" (EMNLP 2024) proposes using an ISLR model with sliding window + confidence thresholding to detect signs in streaming video. No explicit boundary model needed.

### Gloss-Level vs Word-Level
- **Gloss**: The sign-level label (how the sign is written in sign language notation). There is NOT a 1:1 mapping between English words and ASL glosses — one English word may have multiple ASL signs depending on context.
- **Word-level**: Maps directly to English word. Simpler for end users but loses linguistic nuance.
- **Our approach**: We use gloss-level labels (matching WLASL/ASL Citizen conventions) but present them as "words" to the user.

### Transition / Co-articulation Frames
- **Problem**: Between consecutive signs, the hands transition through intermediate poses not belonging to either sign (co-articulation).
- **Solutions**:
  1. CTC loss naturally handles transitions by emitting "blank" tokens
  2. Explicit boundary detection (TCN, velocity threshold)
  3. Sliding window with overlap — classify each window independently, then deduplicate
- **For v1**: Sliding window + confidence threshold + cooldown is simplest and most robust

---

## 1.4 Transfer Learning Research

### From Fingerspelling to Words
- **Key insight**: Fingerspelling models learn hand shape representations (finger extension, curl, spread). These are directly reusable for word-level recognition, since ASL words are composed of hand configurations + motion patterns.
- **Evidence**: Transfer learning in sign language (Washington Univ. paper) shows that features learned on one aspect (hand shape) transfer to other SLR tasks.
- **Practical approach**: The existing `fingerspell_mlp_v2` model's normalization pipeline (wrist-relative, palm-width scaled) is already used by the dynamic model. The hand shape encoding (63 normalized landmarks + 5 geometry features) can serve as the per-frame feature backbone.

### Feature Reuse Strategy
1. **Normalization pipeline**: Already shared between static (alphabet) and dynamic (word) models via `features.py` and `seq_features.py`
2. **Hand shape encoder**: The MLP's first hidden layer (256→128) learns a compressed hand shape representation. Could be frozen and used as a feature extractor, but the MLP is sklearn-based (not PyTorch), making direct weight reuse awkward.
3. **Better approach**: Since the Transformer already takes 126-dim (positions + velocities) per frame and achieves good accuracy, we **do not need to explicitly import MLP weights**. The normalization pipeline IS the shared representation. Both models use the same MediaPipe landmarks → normalize → (positions + velocities) pipeline.

### Recommendation
- **No explicit weight transfer** needed — the normalization contract (`seq_features.normalize_sequence`) IS the transfer mechanism
- Both alphabet and word models share the same input representation
- For future v2: Consider pre-training a hand shape autoencoder on all available landmark data, then fine-tuning for each task
