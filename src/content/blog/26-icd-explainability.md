# Idea 26: Why Explainability Matters in AI-Powered ICD Coding

## v1 — Why Explainability Matters in AI-Powered ICD Coding
*Angle: the case that accuracy isn't enough for clinical AI; explainability is the actual product*

Most people outside healthcare have never heard of ICD coding, but it's running quietly under every bill, claim, and chart they've ever generated. Every diagnosis, procedure, and encounter gets translated into a standardized code (the International Classification of Diseases), and those codes drive billing, analytics, insurance reimbursement, population health tracking, and a fair amount of clinical research.

For decades, the work has been done by trained medical coders reading clinical notes and assigning codes by hand. It's slow, expensive, and surprisingly hard. It looks like data entry but is actually closer to legal interpretation. With LLMs now capable of reading and reasoning over clinical text, automated ICD coding has become a real possibility. The promise is the obvious one: faster turnaround, less administrative burden, lower cost, more consistency, and documentation workflows that can finally scale with the volume of care being delivered.

But the headline number, accuracy, isn't actually the thing that decides whether one of these systems makes it into production.

## The problem with "black box" coding

In most AI applications, getting the answer right is the whole game. If an image classifier identifies a cat, nobody cares why. Healthcare is not like that.

If an AI system assigns the wrong diagnosis code, an unsupported severity level, or a billing-sensitive modifier, the consequences are not theoretical. Insurance claims get denied. Compliance audits flag the record. Money is lost or clawed back. Patient histories end up with diagnoses that don't reflect what actually happened, which then propagates into downstream care decisions and risk adjustment scores. A code that's "mostly right" is not the same as a code that's right.

A model that outputs a code without explanation creates a workflow nobody can defend. Coders, compliance teams, and clinicians need to know *why* a code was chosen, not as a curiosity, but as the basis for trusting the output enough to ship it.

Take a diabetes complication code as a concrete case. A human reviewer needs to be able to see, immediately: which section of the clinical note supported the diagnosis, what terminology in that section triggered the classification, and how the model distinguished between the half-dozen related ICD codes that often look almost identical. Without that, the reviewer's choice is binary. Accept on faith, or re-read the entire note from scratch. The first is unsafe; the second defeats the point of automation.

## Explainability is what makes the human-AI loop work

The strongest framing for automated ICD coding isn't "AI replaces the coder." It's AI as the first pass and the coder as the verifier. A useful system extracts evidence from the note, recommends likely codes, attaches confidence scores, highlights the supporting text spans, and explains its reasoning in a form a human can scan in seconds.

In that shape, explainability is the productivity multiplier. The coder stops searching through long notes for the relevant phrase. They look at the highlighted span, decide whether it actually supports the suggested code, and move on. The AI handles pattern matching at speed. The human handles judgment.

That balance matters more in clinical documentation than in almost any other text domain, because clinical text is genuinely messy. Physicians use shorthand. They write in incomplete phrases. They contradict themselves between the assessment and the plan. Two notes describing the same condition can look completely different. An explainable system gives the reviewer a fast way to tell when the model actually understood what the physician meant versus when it pattern-matched on a phrase and produced something that *looks* right.

## The regulatory and ethical pressure is real

The environment around healthcare AI is getting more scrutinized, not less. Hospitals, payers, and regulators are increasingly asking the same questions about any automated decision in a clinical workflow. Why was this code assigned? What evidence supported it? Can this be audited? Can a reviewer reproduce the reasoning?

These aren't abstract policy concerns. They're operational requirements. A risk adjustment score that drives Medicare Advantage reimbursement has to survive an audit. A diagnosis that flows into a patient's chart influences clinical decisions years later. Explainability is moving from "nice to have" to the thing that decides whether your system can be deployed at all.

## LLMs make this harder, not easier

Modern language models are genuinely good at clinical text. They can infer diagnoses from context, summarize patient histories, and map narrative documentation onto structured coding systems with results that would have looked like science fiction five years ago. The problem is what comes with that capability.

LLMs hallucinate reasoning. They produce inconsistent outputs across runs. They are confidently wrong in ways that are stylistically indistinguishable from being confidently right. They will generate an explanation that sounds medically plausible (citing terminology, referencing the note, walking through differential considerations) for a code that is incorrect. The fluency of the explanation is independent of its correctness.

This is the trap. If "explainability" means "the model also writes a paragraph defending its answer," you have made the system more dangerous, not less. The reviewer now has a confident-sounding justification to anchor against, which is exactly the case where errors slip through.

The way out is to ground explanations in things that can be verified independently of the model. Exact note excerpts, not paraphrases. Terminology mappings that point at the actual coding guideline. Structured reasoning that follows the same logic a human coder would apply, with each step inspectable. The goal isn't to make the AI *sound* trustworthy. It's to make it *auditable*.

## What this means for the next decade

Automated ICD coding will be a standard part of healthcare infrastructure within the next ten years. The administrative volume is too large for AI not to absorb a meaningful slice of it. That much is straightforward to predict.

What's less obvious is which systems win. It won't be the ones at the top of an accuracy benchmark. Benchmarks are necessary but not sufficient. They measure whether the model picks the right code on a held-out set, not whether a hospital's compliance team will sign off on putting it in front of a chart.

The systems that get adopted will be the ones coders, auditors, and operations leaders trust enough to actually use. Trust, in healthcare AI, doesn't come from the answer. It comes from being able to see exactly how the answer was reached, and from being able to challenge it when it's wrong.

For these systems, the explanation is the real deliverable. The code is downstream of it.
