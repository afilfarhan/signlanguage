/**
 * Streaming CTC Decoder for Continuous Sign Language Recognition
 * 
 * Implements beam search decoding with CTC (Connectionist Temporal Classification)
 * for real-time sign sequence recognition from frame-level embeddings.
 */

export interface CTCConfig {
  blankId: number;
  beamWidth: number;
  threshold: number;           // Prune hypotheses below this probability
  minSignDuration: number;     // Minimum frames for a sign to be valid
  maxSignDuration: number;     // Maximum frames for a sign
  mergeRepeated: boolean;      // Merge repeated non-blank tokens
}

export interface DecodedSegment {
  label: string;
  startFrame: number;
  endFrame: number;
  confidence: number;
  nmmTags?: string[];          // Non-manual marker tags (question, negation, etc.)
}

export interface Hypothesis {
  tokens: number[];
  prob: number;
  lastFrame: number;           // Frame index where this hypothesis was last updated
  blankRun: number;            // Consecutive blank frames
  completedSegments: DecodedSegment[]; // Finalized segments
}

/**
 * Streaming CTC Decoder using prefix beam search
 */
export class StreamingCTCDecoder {
  private hypotheses: Hypothesis[];
  private config: CTCConfig;
  private labels: string[];
  private frameIndex: number;
  private pendingHypotheses: Hypothesis[] = [];

  constructor(labels: string[], config: Partial<CTCConfig> = {}) {
    this.labels = labels;
    this.frameIndex = 0;
    
    // Default config - blank is last label (vocab_size)
    this.config = {
      blankId: config.blankId ?? labels.length,
      beamWidth: config.beamWidth ?? 10,
      threshold: config.threshold ?? 1e-4,
      minSignDuration: config.minSignDuration ?? 3,
      maxSignDuration: config.maxSignDuration ?? 60,
      mergeRepeated: config.mergeRepeated ?? true,
    };

    this.hypotheses = [{
      tokens: [],
      prob: 1.0,
      lastFrame: 0,
      blankRun: 0,
      completedSegments: [],
    }];
  }

  /**
   * Process a single frame's logits (probabilities over vocabulary + blank)
   * Returns newly completed segments
   */
  step(logits: Float32Array): DecodedSegment[] {
    const newHypotheses: Hypothesis[] = [];
    const completedSegments: DecodedSegment[] = [];

    for (const hyp of this.hypotheses) {
      // Expand with top-k tokens
      const topK = this.getTopK(logits, this.config.beamWidth * 2);

      for (const { token, prob: tokenProb } of topK) {
        if (tokenProb < this.config.threshold) continue;

        const newProb = hyp.prob * tokenProb;
        if (newProb < this.config.threshold) continue;

        let newTokens = [...hyp.tokens];
        let newBlankRun = hyp.blankRun;
        const newCompleted = [...hyp.completedSegments];

        if (token === this.config.blankId) {
          // Blank token - extend blank run
          newBlankRun++;
        } else {
          // Non-blank token
          const lastToken = newTokens[newTokens.length - 1];
          
          // CTC merge rule: don't add if same as last non-blank
          if (this.config.mergeRepeated && lastToken === token) {
            // Just extend the current token's duration implicitly
          } else {
            newTokens.push(token);
          }
          
          // Check if we completed a sign (blank run after non-blank)
          if (hyp.blankRun >= this.config.minSignDuration && hyp.tokens.length > 0) {
            // Finalize the last token as a segment
            const segment = this.createSegment(hyp, this.frameIndex - hyp.blankRun);
            if (segment) {
              newCompleted.push(segment);
            }
            // Reset for new sign
            newTokens = [token];
          }
          newBlankRun = 0;
        }

        newHypotheses.push({
          tokens: newTokens,
          prob: newProb,
          lastFrame: this.frameIndex,
          blankRun: newBlankRun,
          completedSegments: newCompleted,
        });
      }
    }

    // Prune and merge hypotheses
    this.hypotheses = this.pruneAndMerge(newHypotheses);

    // Extract newly completed segments
    const newSegments = this.extractNewSegments();
    completedSegments.push(...newSegments);

    this.frameIndex++;
    return completedSegments;
  }

  /**
   * Get top-k tokens by probability
   */
  private getTopK(logits: Float32Array, k: number): { token: number; prob: number }[] {
    const probs = new Float32Array(logits.length);
    const max = Math.max(...logits);
    let sumExp = 0;
    for (let i = 0; i < logits.length; i++) {
      probs[i] = Math.exp(logits[i] - max);
      sumExp += probs[i];
    }
    for (let i = 0; i < probs.length; i++) {
      probs[i] /= sumExp;
    }

    const indexed = Array.from(probs).map((prob, token) => ({ token, prob }));
    indexed.sort((a, b) => b.prob - a.prob);
    return indexed.slice(0, k);
  }

  /**
   * Prune hypotheses below threshold and merge identical token sequences
   */
  private pruneAndMerge(hypotheses: Hypothesis[]): Hypothesis[] {
    // Group by token sequence
    const groups = new Map<string, Hypothesis>();
    
    for (const hyp of hypotheses) {
      const key = hyp.tokens.join(',');
      const existing = groups.get(key);
      if (!existing || hyp.prob > existing.prob) {
        groups.set(key, hyp);
      }
    }

    // Sort by probability and keep top beamWidth
    const sorted = Array.from(groups.values())
      .sort((a, b) => b.prob - a.prob)
      .slice(0, this.config.beamWidth);

    return sorted;
  }

  /**
   * Extract newly completed segments from hypotheses
   */
  private extractNewSegments(): DecodedSegment[] {
    const segments: DecodedSegment[] = [];
    
    for (const hyp of this.hypotheses) {
      for (const seg of hyp.completedSegments) {
        // Check if this segment is new (not already extracted)
        // We use a simple heuristic: if endFrame is recent
        if (seg.endFrame >= this.frameIndex - 10) {
          segments.push(seg);
        }
      }
    }
    return segments;
  }

  /**
   * Create a segment from a completed hypothesis
   */
  private createSegment(hyp: Hypothesis, endFrame: number): DecodedSegment | null {
    if (hyp.tokens.length === 0) return null;
    
    const lastToken = hyp.tokens[hyp.tokens.length - 1];
    if (lastToken === this.config.blankId || lastToken >= this.labels.length) return null;

    const label = this.labels[lastToken];
    const startFrame = Math.max(0, endFrame - this.config.maxSignDuration);
    
    return {
      label,
      startFrame,
      endFrame,
      confidence: hyp.prob,
      nmmTags: [], // Will be filled by NMM integration
    };
  }

  /**
   * Get current best hypothesis transcript
   */
  getCurrentTranscript(): DecodedSegment[] {
    if (this.hypotheses.length === 0) return [];
    
    const bestHyp = this.hypotheses[0];
    const segments = [...bestHyp.completedSegments];
    
    // Add current pending token if any
    if (bestHyp.tokens.length > 0) {
      const lastToken = bestHyp.tokens[bestHyp.tokens.length - 1];
      if (lastToken !== this.config.blankId && lastToken < this.labels.length) {
        segments.push({
          label: this.labels[lastToken],
          startFrame: bestHyp.lastFrame,
          endFrame: this.frameIndex,
          confidence: bestHyp.prob,
          nmmTags: [],
        });
      }
    }
    
    return segments;
  }

  /**
   * Get full transcript including completed and pending
   */
  getFullTranscript(): DecodedSegment[] {
    return this.getCurrentTranscript();
  }

  /**
   * Reset decoder state
   */
  reset(): void {
    this.hypotheses = [{
      tokens: [],
      prob: 1.0,
      lastFrame: 0,
      blankRun: 0,
      completedSegments: [],
    }];
    this.frameIndex = 0;
  }

  /**
   * Update NMM tags for recent segments
   */
  updateNMMTags(segments: DecodedSegment[], nmmTags: string[]): void {
    for (const seg of segments) {
      if (seg.nmmTags) {
        seg.nmmTags = [...new Set([...seg.nmmTags, ...nmmTags])];
      }
    }
  }

  /**
   * Get config for debugging
   */
  getConfig(): CTCConfig {
    return { ...this.config };
  }
}

/**
 * Factory function to create decoder with standard ASL vocabulary config
 */
export function createASLDecoder(labels: string[]): StreamingCTCDecoder {
  return new StreamingCTCDecoder(labels, {
    blankId: labels.length,      // Blank is index after last label
    beamWidth: 10,
    threshold: 1e-4,
    minSignDuration: 3,
    maxSignDuration: 60,
    mergeRepeated: true,
  });
}

/**
 * Simple greedy decoder alternative (faster, less accurate)
 */
export class GreedyCTCDecoder {
  private labels: string[];
  private blankId: number;
  private prevToken: number = -1;
  private blankCount: number = 0;
  private currentSignFrames: number = 0;
  private segments: DecodedSegment[] = [];
  private frameIndex: number = 0;

  constructor(labels: string[], blankId?: number) {
    this.labels = labels;
    this.blankId = blankId ?? labels.length;
  }

  step(logits: Float32Array): DecodedSegment[] {
    // Get argmax
    let maxProb = -Infinity;
    let maxToken = 0;
    for (let i = 0; i < logits.length; i++) {
      if (logits[i] > maxProb) {
        maxProb = logits[i];
        maxToken = i;
      }
    }

    const newSegments: DecodedSegment[] = [];

    if (maxToken === this.blankId) {
      this.blankCount++;
      this.currentSignFrames = 0;
    } else {
      if (maxToken !== this.prevToken) {
        // New token
        if (this.prevToken !== -1 && this.prevToken !== this.blankId && this.currentSignFrames >= 3) {
          // Complete previous sign
          newSegments.push({
            label: this.labels[this.prevToken],
            startFrame: this.frameIndex - this.currentSignFrames - this.blankCount,
            endFrame: this.frameIndex - this.blankCount,
            confidence: maxProb,
            nmmTags: [],
          });
        }
        this.currentSignFrames = 1;
        this.prevToken = maxToken;
      } else {
        // Same token continued
        this.currentSignFrames++;
      }
      this.blankCount = 0;
    }

    this.frameIndex++;
    this.segments.push(...newSegments);
    return newSegments;
  }

  getTranscript(): DecodedSegment[] {
    return [...this.segments];
  }

  getFullTranscript(): DecodedSegment[] {
    return this.getTranscript();
  }

  reset(): void {
    this.prevToken = -1;
    this.blankCount = 0;
    this.currentSignFrames = 0;
    this.segments = [];
    this.frameIndex = 0;
  }
}