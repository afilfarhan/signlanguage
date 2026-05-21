"use client";

/**
 * PersonalAdapter — On-Device Personalization Layer
 *
 * Frozen ONNX backbone + small low-rank adapter trained in-browser.
 * ~1 KB state stored in localStorage.
 *
 * Architecture (ADR-005):
 *   - Input: embedding Float32Array(128) from Transformer encoder
 *   - Parameters: W (128 × n_classes), b (n_classes)
 *   - Optimizer: vanilla SGD with cross-entropy, lr=0.01
 *   - Enabled after ≥20 confirmed attempts
 */

function softmax(logits: Float32Array): Float32Array {
  const max = Math.max(...logits);
  const exps = Array.from(logits, (v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return new Float32Array(exps.map((e) => e / sum));
}

export class PersonalAdapter {
  private W: Float32Array;
  private b: Float32Array;
  private lr = 0.01;
  private attempts = 0;

  constructor(private nClasses: number, private embDim = 128) {
    // Initialize to identity-like (pass-through)
    this.W = new Float32Array(embDim * nClasses).fill(0);
    this.b = new Float32Array(nClasses).fill(0);
  }

  predict(embedding: Float32Array): Float32Array {
    // Tiny matmul: (128,) × (128, n_classes) → (n_classes,)
    const out = new Float32Array(this.nClasses);
    for (let j = 0; j < this.nClasses; j++) {
      let sum = this.b[j];
      for (let i = 0; i < this.embDim; i++) {
        sum += embedding[i] * this.W[i * this.nClasses + j];
      }
      out[j] = sum;
    }
    return out;
  }

  update(embedding: Float32Array, label: number): void {
    const logits = this.predict(embedding);
    const probs = softmax(logits);

    // Cross-entropy gradient for linear layer
    for (let j = 0; j < this.nClasses; j++) {
      const grad = probs[j] - (j === label ? 1 : 0);
      this.b[j] -= this.lr * grad;
      for (let i = 0; i < this.embDim; i++) {
        this.W[i * this.nClasses + j] -= this.lr * grad * embedding[i];
      }
    }
    this.attempts++;
  }

  serialize(): string {
    return JSON.stringify({
      W: Array.from(this.W),
      b: Array.from(this.b),
      attempts: this.attempts,
    });
  }

  static deserialize(json: string): PersonalAdapter {
    const data = JSON.parse(json) as { W: number[]; b: number[]; attempts: number };
    const nClasses = data.b.length;
    const embDim = data.W.length / nClasses;
    const adapter = new PersonalAdapter(nClasses, embDim);
    adapter.W = new Float32Array(data.W);
    adapter.b = new Float32Array(data.b);
    adapter.attempts = data.attempts;
    return adapter;
  }

  getAttempts(): number {
    return this.attempts;
  }

  getModelSizeBytes(): number {
    return this.W.length * 4 + this.b.length * 4 + 8;
  }
}

const ADAPTER_KEY = "signtutor.personal_adapter";

export function saveAdapter(adapter: PersonalAdapter): void {
  try {
    localStorage.setItem(ADAPTER_KEY, adapter.serialize());
  } catch {}
}

export function loadAdapter(nClasses: number): PersonalAdapter | null {
  try {
    const raw = localStorage.getItem(ADAPTER_KEY);
    if (raw) return PersonalAdapter.deserialize(raw);
  } catch {}
  return null;
}
