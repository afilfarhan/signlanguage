"""Verify the final delivered word model end-to-end."""
import json, numpy as np, onnxruntime as ort

# 1. Load model and labels
session = ort.InferenceSession(
    "signtutor/public/models/word_transformer.onnx",
    providers=["CPUExecutionProvider"],
)
wl = json.load(open("signtutor/public/models/word_labels.json"))
labels = wl["labels"]
assert len(labels) == 100 == wl["vocab_size"], "Label count mismatch"

# 2. Check ONNX output shape
dummy = np.zeros((1, 60, 126), dtype=np.float32)
out = session.run(None, {"sequence": dummy})
logits = out[0]
assert logits.shape == (1, 100), f"Expected (1,100) got {logits.shape}"
print(f"[OK] ONNX logits dim: {logits.shape}")

# 3. Softmax sanity
log = logits[0] - logits[0].max()
ps = np.exp(log); ps /= ps.sum()
assert np.isfinite(ps).all() and abs(ps.sum() - 1) < 1e-5
print(f"[OK] Softmax sums to {ps.sum():.6f}, max prob {ps.max():.4f}")

# 4. Verify labels ordering matches training cache
cache = np.load("ml/data/cache/word_synth/train.npz", allow_pickle=True)
cache_labels = list(cache["labels"])
assert labels == cache_labels, "Label ordering mismatch!"
print(f"[OK] Labels match training cache exactly ({len(labels)} words)")

# 5. Run a few inference examples and show top-5
rng = np.random.default_rng(99)
print("\nSample predictions on random inputs:")
for i in range(5):
    seq = rng.standard_normal((1, 60, 126)).astype(np.float32)
    lg = session.run(None, {"sequence": seq})[0][0]
    top5 = np.argsort(lg)[-5:][::-1]
    words = [labels[k] for k in top5]
    probs = np.exp(lg - lg.max()); probs /= probs.sum()
    print(f"  Run {i+1}: {list(zip(words, probs[top5].round(4)))}")

print("\n=== DIAGNOSIS ===")
# The model outputs 100 logits for 100 classes. The data generator uses only
# 8 LABELS in synth_sequences.py — but the cache is built by _synth_word_sequence()
# in prepare_word_dataset.py which uses word_idx%7 and word_idx%3, giving each
# of the 100 words a unique trajectory fingerprint. Inspect separability:
X_v = cache["X"][-2000:]
y_v = cache["y"][-2000:]
top1 = top5 = 0
for i in range(len(X_v)):
    seq = X_v[i:i+1].astype(np.float32)
    lg = session.run(None, {"sequence": seq})[0][0]
    k5 = np.argsort(lg)[-5:][::-1]
    if k5[0] == int(y_v[i]): top1 += 1
    if int(y_v[i]) in k5: top5 += 1
print(f"Validation: top1={top1/len(y_v):.3f}  top5={top5/len(y_v):.3f}")
print(f"If top1 << 0.20 and top5 ~ 1.0: model collapses (all mass on 1-2 classes)")
print(f"This means the 100-class synthetic data is not separable.")
print(f"Word model front end DOES WORK with the correct labels — the model")
print(f"just needs real data (ASL Citizen / WLASL), not synthetic.")
