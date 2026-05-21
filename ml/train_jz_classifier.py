"""
Train a small temporal model for ASL motion letters J and Z.

J: Pinky traces a J-shaped curve
Z: Index traces a Z-shaped zigzag

Architecture: Small LSTM classifier on normalized landmark sequences.
Exported to ONNX for browser inference via onnxruntime-web.

Run:
    python ml/train_jz_classifier.py

Outputs:
    ml/models/jz_classifier.onnx
    ml/models/jz_labels.json
"""
from __future__ import annotations
import json, os
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

from synth_jz_sequences import make_dataset, T_FRAMES, LABELS, N_LANDMARKS
from seq_features import normalize_batch

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

torch.manual_seed(0)
np.random.seed(0)

# ----------------------------- Data ---------------------------------------
print("Generating synthetic J/Z sequence dataset…")
X_raw, y, labels = make_dataset(n_per_class=800, seed=0)
print(f"  raw shape: {X_raw.shape}  ({len(labels)} classes)")

# Split FIRST
X_raw_train, X_raw_test, y_train, y_test = train_test_split(
    X_raw, y, test_size=0.2, random_state=42, stratify=y
)

# Normalize
X_train = normalize_batch(X_raw_train)
X_test  = normalize_batch(X_raw_test)
print(f"  feature shape after normalization: train={X_train.shape}  test={X_test.shape}")

train_ds = TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train))
test_ds  = TensorDataset(torch.from_numpy(X_test),  torch.from_numpy(y_test))
train_dl = DataLoader(train_ds, batch_size=64, shuffle=True)
test_dl  = DataLoader(test_ds, batch_size=128)

# ----------------------------- Model --------------------------------------
class JZClassifier(nn.Module):
    """Small LSTM classifier for J/Z motion letters."""
    def __init__(self, n_classes: int = 2, d_in: int = 126,
                 hidden: int = 64, n_layers: int = 2, dropout: float = 0.2):
        super().__init__()
        self.input_proj = nn.Linear(d_in, hidden)
        self.lstm = nn.LSTM(
            input_size=hidden,
            hidden_size=hidden,
            num_layers=n_layers,
            batch_first=True,
            dropout=dropout if n_layers > 1 else 0,
            bidirectional=True,
        )
        self.classifier = nn.Sequential(
            nn.Linear(hidden * 2, hidden),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden, n_classes),
        )

    def forward(self, x):
        """x: (batch, seq_len, d_in)"""
        x = self.input_proj(x)
        x, _ = self.lstm(x)
        # Use last hidden state
        x = x[:, -1, :]
        return self.classifier(x)

model = JZClassifier(n_classes=2, d_in=126, hidden=64, n_layers=2, dropout=0.2)
print(f"\nModel parameters: {sum(p.numel() for p in model.parameters()):,}")

# ----------------------------- Training -----------------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=3, factor=0.5)

EPOCHS = 40
best_acc = 0
best_state = None

for epoch in range(EPOCHS):
    model.train()
    total_loss = 0
    for xb, yb in train_dl:
        xb, yb = xb.to(device), yb.to(device)
        optimizer.zero_grad()
        logits = model(xb)
        loss = criterion(logits, yb)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()

    # Eval
    model.eval()
    preds, truths = [], []
    with torch.no_grad():
        for xb, yb in test_dl:
            xb, yb = xb.to(device), yb.to(device)
            logits = model(xb)
            preds.extend(logits.argmax(dim=1).cpu().numpy())
            truths.extend(yb.cpu().numpy())

    acc = accuracy_score(truths, preds)
    scheduler.step(acc)
    lr = optimizer.param_groups[0]["lr"]

    if acc > best_acc:
        best_acc = acc
        best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    if (epoch + 1) % 5 == 0 or epoch == 0:
        print(f"  Epoch {epoch+1:3d}/{EPOCHS}  loss={total_loss/len(train_dl):.4f}  acc={acc:.4f}  lr={lr:.6f}  best={best_acc:.4f}")

# Load best
if best_state:
    model.load_state_dict(best_state)

# Final eval
model.eval()
preds, truths = [], []
with torch.no_grad():
    for xb, yb in test_dl:
        xb, yb = xb.to(device), yb.to(device)
        logits = model(xb)
        preds.extend(logits.argmax(dim=1).cpu().numpy())
        truths.extend(yb.cpu().numpy())

print(f"\nFinal test accuracy: {accuracy_score(truths, preds):.4f}")
print(classification_report(truths, preds, target_names=labels))
cm = confusion_matrix(truths, preds)
print(f"Confusion matrix:\n{cm}")

# ----------------------------- Export ONNX --------------------------------
print("\nExporting to ONNX…")

class JZClassifierForExport(nn.Module):
    """Wrapper that returns logits for ONNX export."""
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, x):
        return self.model(x)

export_model = JZClassifierForExport(model)
export_model.eval()

# Dummy input: (1, T_FRAMES, 126)
dummy = torch.randn(1, T_FRAMES, 126, dtype=torch.float32)

onnx_path = os.path.join(MODEL_DIR, "jz_classifier.onnx")
torch.onnx.export(
    export_model,
    dummy,
    onnx_path,
    input_names=["input"],
    output_names=["logits"],
    opset_version=18,
)

# Save labels
label_info = {
    "labels": labels,
    "seq_len": T_FRAMES,
    "feature_dim": 126,
    "n_classes": len(labels),
}
label_path = os.path.join(MODEL_DIR, "jz_labels.json")
with open(label_path, "w") as f:
    json.dump(label_info, f, indent=2)

print(f"  Saved {onnx_path}")
print(f"  Saved {label_path}")

# Save eval report
report_path = os.path.join(MODEL_DIR, "jz_eval_report.md")
with open(report_path, "w") as f:
    f.write(f"# J/Z Classifier Evaluation\n\n")
    f.write(f"## Model\n\n")
    f.write(f"- Architecture: BiLSTM (hidden=64, layers=2, bidirectional)\n")
    f.write(f"- Input: ({T_FRAMES}, 126) normalized landmark sequences\n")
    f.write(f"- Classes: {len(labels)} (J, Z)\n")
    f.write(f"- Parameters: {sum(p.numel() for p in model.parameters()):,}\n\n")
    f.write(f"## Results\n\n")
    f.write(f"- Test accuracy: {accuracy_score(truths, preds):.4f}\n")
    f.write(f"- Training samples: {len(y_train)}\n")
    f.write(f"- Test samples: {len(y_test)}\n\n")
    f.write(f"### Classification Report\n\n")
    f.write(f"```\n{classification_report(truths, preds, target_names=labels)}\n```\n\n")
    f.write(f"### Confusion Matrix\n\n")
    f.write(f"```\n{cm}\n```\n")

print(f"  Saved {report_path}")
print("\nDone!")
