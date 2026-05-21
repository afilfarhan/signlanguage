# ADR-007: CTC vs. Transformer-Decoder for Continuous SLR

## Status
Accepted (W8 — Continuous-Sign Research Preview)

## Context
Continuous sign language recognition (sentence-level) is harder than isolated sign classification. We need a research preview that is clearly labelled and does not affect the production trust budget.

## Decision
- Use a **CTC encoder-decoder Transformer** for continuous SLR.
- Datasets: How2Sign or RWTH-PHOENIX-2014T.
- Decode with greedy beam search (beam width = 5).
- Gate: WER ≤ 0.50 on held-out test set.
- UI: `/research/continuous` behind an interstitial that explains this is a preview, with expected accuracy lower than trained models. No verdict, no scoring — only live transcription.

## Rejected Alternatives
- Transformer-decoder with forced alignment: too slow for real-time browser inference.
- End-to-end CTC with no beam search: bad WER, not viable.

## Consequences
- Continuous model is kept out of the production pipeline and excluded from sitemap.
- Route has `noindex,nofollow` meta tag.
- If WER > 0.50, the gate fails and defers with a tracking issue.
