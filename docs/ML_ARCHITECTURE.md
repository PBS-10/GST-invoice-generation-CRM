# ML Architecture

Speech research stays out of the production app until evaluation justifies a model. The app already parses a typed billing line and matches it to a saved product. No model is downloaded or bundled.

Related docs: [Architecture](./ARCHITECTURE.md) · [Development Roadmap](./DEVELOPMENT_ROADMAP.md)

## Separation

```
/apps/mobile     production billing
/packages/*      shared types, Zod, GST engine
/ml              research: ASR eval, datasets, experiments
```

`/ml` must not import React Native, Redux, or SQLite. The mobile app must not import PyTorch, Whisper, or IndicConformer.

Do not train an ASR model from scratch. Do not introduce an LLM unless rule-based extraction fails in measured evaluation.

## Mobile voice port (v1)

Invoice screens do not call a custom ASR model. They consume text (typed or from the **phone OS** speech recognizer), then the shared rule-based extract/match.

```
Mic → phone OS STT (expo-speech-recognition)
  → transcript text
  → extractBillingText
  → matchBillingLine (catalogue aliases)
  → invoice draft (user confirms Add to bill)
```

Implementation: `apps/mobile/src/features/voice`. Requires a development build (`expo run:android`). Expo Go keeps typed **Add in words** only.

No Whisper, IndicConformer, or `/ml` import in the app binary. Google/Apple may process audio as part of OS STT; that is outside our backend.

Example:

```
Spoken:  two kilo ari one hundred rupees
OS STT:  "two kilo ari one hundred rupees"   (or Malayalam text for ml-IN)
Extract: { productText: "ari", quantityMilli: 2000, unit: "kg", pricePaise: 10000 }
Match:   aliases ["rice","അരി","ari"] → Rice product in SQLite
```

## Research workflow

Existing pretrained model → small test set → transcription → ground truth → WER → error analysis.

Fine-tune only if pretrained accuracy is insufficient for shop speech.

```
/ml
  /asr              model runners, inference scripts
  /datasets         manifests + pointers; not full public corpora
  /experiments      run configs and notes
  /evaluation       WER, entity accuracy, product-match accuracy
```

Do not download IndicVoices, Kathbath, or Common Voice in full. Start with a small representative slice.

## ASR candidates

| Role | Model |
|---|---|
| Primary eval | AI4Bharat IndicConformer |
| Comparison | Whisper |
| Later on-device | Sherpa-ONNX, only after eval |

Target languages: Malayalam, Tamil, Hindi, English, and mixed regional + English shop speech.

Older diagrams that mention Vosk or Next.js are superseded.

## NLP

Deterministic first:

1. Normalize text (Indic NLP where useful: numerals, punctuation, whitespace).
2. Extract numbers (quantity, price).
3. Extract units (`kg`, `g`, `l`, `ml`, `pcs`, packet, and regional equivalents).
4. Extract remaining span as product text.
5. Match against `products.aliases` in SQLite (exact, then normalized, then fuzzy if needed).

```
"2 kg rice 100 rupees"
→ { productText: "rice", quantityMilli: 2000, unit: "kg", pricePaise: 10000 }
```

No LLM in this path. Add statistical/ML extractors only if rules miss a measured share of billing utterances.

## Domain dataset (later)

Public corpora are for ASR WER, not for billing language. A later domain set should look like:

```
Audio: vendor_001.wav
{
  "language": "ml",
  "speakerId": "…",
  "environment": "shop",
  "transcript": "…"
}
```

Include: Malayalam, Tamil, Hindi, English, mixed speech, product names, quantities, units, prices, noisy shops, multiple speakers/accents, fast speech.

Do not collect this until pretrained WER on a small public slice is measured.

## Metrics

| Stage | Metric |
|---|---|
| ASR | WER (and per-language WER) |
| Entity extraction | Product / quantity / unit / price accuracy |
| Product matching | Top-1 alias → `productId` accuracy |
| End-to-end | Speech → ASR → extract → match → invoice line |

Scripts live under `ml/evaluation` and `ml/asr`. They are not CI gates for `apps/mobile`. Run `python -m unittest` in those folders. Hypothesis files go in `ml/experiments/runs/`, which is gitignored.

## What v1 must not do

- Bundle ASR weights in the phone app, or call a cloud speech API from billing. Research runs in `/ml` may cache a checkpoint only when `--allow-download` is passed.
- Call a cloud speech API from the invoice path.
- Couple microphone code to invoice screens.
- Train models from scratch.
- Treat older “Whisper / Vosk / BLE PLX / Next.js” diagrams as the stack.
