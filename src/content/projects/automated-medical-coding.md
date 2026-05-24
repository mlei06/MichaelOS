---
id: explainable-medical-coding
year: 2025
blurb: A self-hosted service that predicts ICD/CPT codes from clinical notes and returns token-level evidence spans for every prediction.
role: Solo
tags:
  - FastAPI
  - PyTorch
  - RoBERTa-PM
  - Captum
  - Healthcare
status: shipped
links:
  - kind: github
    label: Source
    url: https://github.com/mlei06/Explainable-Medical-Coding
  - kind: video
    label: Demo video
    url: https://youtu.be/XOuEOfwbQfA
hero:
  src: /media/ui-evidence-spans-acute-mi.png
---

# What explainable medical coding actually requires

![Screenshot of a two-pane medical coding interface. Left pane titled "Highlighted Note" shows a discharge summary for an acute-MI patient, with two passages highlighted in blue: an EKG finding describing ST elevations consistent with inferior STEMI, and a diagnosis line reading "ST elevation myocardial infarction (inferior wall)". Right pane titled "Assigned Codes" lists three AI-suggested ICD-9 codes (410.41, 401.9, 250.00), with the top code expanded to show an explanation reading "Documented Inferior STEMI treated as initial episode with emergent PCI and admission." A "Finalized Codes" section at the bottom shows two accepted codes ready to submit.](/media/ui-evidence-spans-acute-mi.png)

*The demo UI on an acute-MI sample note. The model picked 410.41 — Acute MI of inferior wall, initial episode — and the highlights point at the EKG finding and the diagnosis line that drove the prediction.*

## Why medical coding is hard, and why explainability isn't optional

Medical coding is the work of turning a physician's free-text note into the discrete billing codes — ICD-10 for diagnoses, CPT for procedures — that determine how a hospital, clinic, or physician group gets paid. The same codes drive regulatory reporting, quality measurement, and fraud detection. The U.S. healthcare system has run on this translation layer for decades, and for most of those decades it has run on trained human coders.

Humans are the right tool for a job where the source material is messy and the rules change constantly, but they don't scale cheaply. CMS estimated $31.7 billion in improper Medicare Fee-for-Service payments in 2024 — a 7.7% error rate — and most of those errors weren't fraud. They were documentation gaps and coding mistakes. Meanwhile the DOJ recovered $1.7 billion from healthcare fraud cases that same year. The stakes for getting coding right keep going up, and the volume keeps growing.

Automating this with ML is obvious. What's less obvious is that medical coding has a much stricter bar than most ML-replaces-humans pitches.

A model that just outputs an ICD code is useless. An auditor will ask why that code was chosen. A billing reviewer needs to see the supporting text. A clinician asked to sign off on a coded encounter has to be able to glance at the suggestion and confirm it's right. None of that works without **evidence** — a pointer from each predicted code back to the specific phrase in the medical record that supports it.

Black-box prediction fails this bar by definition. So does post-hoc explanation that doesn't survive contact with the source text. What the use case requires is explainable AI in a particular shape: each code linked to the words in the note that drove it, with reasoning a human can audit in seconds. That's the bar the project I'm going to describe was built against.

## What I built

A self-hosted HTTP service that predicts ICD-9, ICD-10, and CPT codes from clinical notes and returns, for every predicted code, the token-level evidence spans inside the original text that support it. Two prediction paths sit behind one API: a fine-tuned PLMICD model based on RoBERTa-PM, and a parallel GPT-5 path constrained by OpenAI's JSON schema mode. The response shape is identical across both, so the same UI renders the result regardless of which path produced the codes.

The PLM side was built on top of `JoakimEdin/explainable-medical-coding`, the best-in-class academic repo for PLMICD plus explainability at the time. The work wasn't training the model. The model already existed. The work was turning research code into a deployable service — a FastAPI app with an environment-driven model registry that supports hot-swap, in-process `lru_cache` model loading keyed by `(model_path, device)`, warm-on-startup via a FastAPI lifespan, a split between liveness (`/v1/healthz`) and readiness (`/v1/readyz`) so unready pods don't take traffic, and weights mounted at runtime rather than baked into the Docker image so model upgrades skip the rebuild. None of that is novel. All of it stacked together is what determines whether the academic repo becomes a service.

But the production scaffolding wasn't where the interesting problem turned out to be.

## Per-token attributions aren't what a clinician can read

PLMICD tokenizes clinical notes with RoBERTa BPE. The eleven Captum-based explainability methods the repo exposes — gradient × input, integrated gradients, gradient × attention, LIME, KernelSHAP, occlusion, and the rest — each produce a per-token attribution score for each predicted code. So for the EKG line in the acute-MI sample, the model's "explanation" out of the box looks like a vector of numbers over BPE fragments: `ĠEKG`, `Ġreve`, `aled`, `ĠST`, `Ġele`, `vations`. Three different numbers under `Ġpne`, `umo`, `nia`. Word boundaries marked by little `Ġ` characters because that's how RoBERTa encodes "this token starts a new word."

That representation is fine for a paper. It's useless to a clinician. What a clinician needs to see is *the EKG finding lit up in their note* — the actual phrase, in the original text, with its original spelling and spacing — so they can glance at a predicted code, glance at the highlight, and decide if the code is right. The gap between per-token attribution scores and clinician-readable evidence spans is what the entire UX of explainable medical coding rests on, and the academic repo had no reason to bridge it. The repo has no UI.

The first instinct was to color the subwords directly: pick the top-K BPE tokens by attribution score, color those characters in the note. This produced highlights that looked like ransom-note lettering — half of "pneumonia," the second half of "myocardial," stray spaces between adjacent tokens. Technically faithful to the model. Useless to a person.

The second instinct was a contiguity rule: if two high-attribution tokens are adjacent in the BPE stream, merge them into one span. Better, still wrong. It produced spans that ended mid-word because nothing forced them to expand to word boundaries. It also got worse, not better, on longer phrases — model attribution per token drops as a phrase grows (the signal spreads out), so a six-token medical phrase often had one or two tokens fall below the threshold and break the span into pieces.

The fix took five things working together. BPE `Ġ` markers had to drive a word-boundary expansion rule, so a span that ended mid-subword pushed out to the next word start. The character-offset math had to tolerate weird whitespace, abbreviations, all-caps headers, and line breaks. Adjacent high-attribution tokens needed a merge rule plus a threshold, applied jointly rather than separately. The aggregation logic differed per explainability method — gradient methods give signed values that can cancel within a span, LIME and KernelSHAP give weights, occlusion gives differences — so the mapping had to be one piece of glue that did the right thing for all eleven. And the threshold itself had to be calibrated per method, because a "high" score on integrated gradients is a different number than a "high" score on LIME.

The code that does this lives in `utils/explainable_medical_coding/utils/tokenizer.py` and the span-emission path in `PLM_explainer_service.py`. It's maybe 200 lines in total. It's also the single most important 200 lines in the project. Without it, the eleven Captum methods are eleven different ways to produce numbers no clinician will look at. With it, every predicted code points at the literal phrase in the note that drove it, and the demo UI looks like the screenshot at the top of this post.

What carries from this: per-token attributions aren't evidence until somebody can read them.

## Design choices that matter for compliance, not just engineering

A few smaller decisions are worth naming, because each one maps to a real compliance or audit need that black-box coding tools struggle with.

**Dual prediction paths behind one API.** `POST /v1/predict` runs the local PLM. `POST /v1/predict/llm` runs GPT-5, constrained via OpenAI's JSON schema mode (`src/utils/llm_explainer.py`) to return the exact same shape as the PLM path: `{icd_codes: [{code, description, probability, explanation: {spans, tokens}}], cpt_codes: [...]}`. Clients pick cost, latency, and data-residency posture per call. A deployment where PHI can't leave the perimeter runs PLM-only. A deployment with broader code-coverage needs hits the LLM path. Auditability lives on the response side; the request side decides where computation happens.

**Structured output for the LLM path.** Free-text LLM output is unauditable by construction — there's no machine-checkable mapping from the model's prose to a billing code. Constraining GPT-5 to a JSON schema with explicit `evidence_spans` per code closes that gap. Every LLM-predicted code carries the same span structure as a PLM-predicted code, so the UI and the audit trail don't care which path produced the result.

**Hot-swap model registry.** Coding rules change. CMS guidance changes. A model that was right last quarter may need to be replaced. Environment-driven registry (`MODEL_REGISTRY=name=path,...`) plus runtime-mounted weights means swapping a model is a deploy change, not a code change or a rebuild. The version of the model that produced a given code is auditable from logs without rebuilding history.

**Stateless service, structured logs.** No database. No session state. Every request is logged with a `request_id` and tenant scope. Reproducing a prediction means replaying the input through the same model version — which is recoverable from logs.

Each of these reads like routine API design. Each of them is also load-bearing for the compliance story. Auditability isn't a feature; it's a property of the whole surface.

## What's still open

The PLM path uses gradient × attention as the default explainability method, chosen because it looked good on five sample notes. I don't have data on which method clinicians actually prefer once they're using the system on real notes. I don't have a span-F1 number against MDACE-style ground truth, so I can't quantify how often the highlighted phrase is *the* right phrase versus *a* plausible one. I don't have a head-to-head latency or cost comparison between the local PLM path and the GPT-5 path under realistic loads — the dual-path design assumes the trade-off is worth exposing, but the slope is unmeasured.

The work I'd want next isn't more model. It's the year of usage data that tells me whether the highlights stay right when the notes stop being samples.
