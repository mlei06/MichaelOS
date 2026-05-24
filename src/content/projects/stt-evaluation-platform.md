---
id: stt-eval-platform
year: 2025
blurb: A speech-to-text benchmarking platform with a medical-aware WER metric. Drove VSee's migration off self-hosted Whisper.
role: Solo · VSee internship
tags:
  - Python
  - React
  - WebSockets
  - ML Evals
status: decision shipped
links:
  - kind: github
    label: Source
    url: https://github.com/mlei06/Speech-to-Text-Benchmark
  - kind: video
    label: Demo video
    url: https://youtu.be/XOuEOfwbQfA
hero:
  src: /media/metrics-deepgram-comparison.png
---

# The metric we had to build before we could pick an STT vendor

![Two provider result cards stacked, each showing WER, DER, medical-WER, medical precision, medical recall, medical F1, processing time, and cost.](/media/metrics-deepgram-comparison.png)

*Two Deepgram models scored on the same medical transcript. Overall WER is tied at 10.4%, but medical-WER, the metric I'll get to, splits them 4.3% to 6.4%.*

## The question my boss put on the table

My boss wanted to know if we should migrate our speech-to-text stack. We were running self-hosted Whisper on our own GPUs, transcribing patient visits, and the accuracy on medical conversations wasn't holding up.

My first instinct was the obvious one. Pick the top two or three providers, write benchmarking scripts against each, drop the numbers in a doc, recommend the winner. Two weeks of work. Done.

That instinct was wrong. It took me a few days to figure out why.

The problem wasn't picking providers. It was that there wasn't a metric I could trust to make the call. Word Error Rate, the standard yardstick, measures whether the words in the transcript match the words in the reference. In a normal conversation that's a fine proxy for "did the model get it right." In a medical conversation, it's a bad one. The model can score well on filler and conjunctions while butchering the name of the antibiotic.

Plain WER tells you which provider got more words right, not which one got more medicine right.

That gap is what turned a two-week project into a month and a half of building. Most of this post is about what I found in it.

## What VSee's STT was actually doing

I work at VSee, a telehealth company. Speech-to-text sits underneath three things our product does: live captions during a visit, post-visit transcripts, and LLM-generated clinical note summaries built on top of those transcripts.

All three depend on transcription quality differently. Live captions need to be roughly right *now*. Post-visit transcripts can be slower but need to be accurate. The clinical-note pipeline cares specifically about whether drug names and conditions survive the transcription intact, since those are the parts a doctor checks first.

The incumbent stack was raw OpenAI Whisper, self-hosted on our own GPUs. The team was paying real engineering time to keep that inference service alive. Whisper out of the box has no medical tuning, no native diarization, and mangles vocabulary it didn't see much of during training. Which is the vocabulary we cared about most.

## Why I built a platform instead of a script

I sat with the script-and-doc plan for a day before I started rewriting it in my head.

The thing that kept catching me was the question I knew leadership would ask: *did you consider X?* If I'd only tested two providers and someone asked about a third, the recommendation would visibly have a hole. The right answer to that question is "yes, here's how it scored," not "we didn't look at it." Which meant testing more providers than the two or three I'd narrow to on instinct.

Once I was testing seven or eight, the script approach got painful. Each provider had its own quirks. One needed audio preconverted to a specific sample rate. One ran in a Docker container I had to call over HTTP. One was a third-party Python tool I'd have to drive as a subprocess. Wiring those up one-off in a flat script meant the code would be a mess by the fourth one.

So I made the call: build it as a platform. One uniform interface for any provider, a web UI, a batch CLI, a metric library. Six weeks instead of two. The bet was that defensibility and reusability were worth the extra month.

![Screenshot of the platform's home view: a drag-and-drop upload area at the top and a grid of eight provider cards below it.](/media/ui-upload-and-providers.png)

*The landing view, drag in an audio file plus a reference transcript, pick the providers, hit go. Skynet shows disabled here because the local sidecar wasn't running.*

## The metric problem

This is the part I'm proudest of.

Word Error Rate works the way you'd guess. Align the reference and the hypothesis, count substitutions, deletions, and insertions, divide by the length of the reference. A 10% WER means roughly one word in ten was wrong. It's a fine high-level number.

But it's a terrible deciding number when the words aren't all worth the same.

Medical visits are mostly conversation. *"So, um, how long has that been going on?" "About a week, started after the new prescription."* The clinically important words are *week* and *prescription*. The rest is conversational glue. A provider that nails the glue and stumbles on the drug name scores the same on plain WER as one that does the reverse, but only one of them can feed into a clinical note.

I needed a metric that scored providers on the part of the conversation that mattered.

What I built was a medical-aware WER. The pipeline runs both transcripts through a biomedical NER model, one trained to recognize drug and disease names in clinical text. That gives me a list of medical entities in each transcript. From there I can compute WER restricted to just those words. The medicine, not the glue.

The tricky piece was matching entities across transcripts. The naive version is "find the same drug at the same position in both." That falls apart fast: different providers chunk speech slightly differently, and "amoxicillin" can land 8 milliseconds later in one transcript than another. Treating that as a mismatch punishes providers for cosmetic differences that have nothing to do with whether they got the drug right.

So I added a tolerance window. Within a couple hundred milliseconds, entities pair up; outside it, they count as errors. That single design choice is what made the metric trustworthy rather than nominally precise.

When I ranked providers by overall WER and by medical-WER, the rankings weren't the same. The medical-WER ranking was the one that matched what product needed. Without that metric I'd have pointed at a winner that scored well on filler and been wrong.

## One interface, eight different providers

The metric was one half. The provider abstraction was the other.

The eight providers I wrapped didn't behave alike. Two were cloud APIs. One had a 10MB file ceiling and required a specific audio format. One ran in a Docker container I called over HTTP. One was a third-party Python tool I shelled out to as a subprocess. One was an open model I ran in-process. One was a local WebSocket service.

If I'd written the rest of the platform against each provider's native shape, the metric code, the UI, and the export logic would all have grown an eight-way branch doing basically the same thing eight slightly different ways. So I drew a thin line at the front. Every provider implements one method: *transcribe audio, return a uniform result object.* The messiness lives inside each adapter and stays there.

The piece I'm proudest of is buried inside that result object. Speaker diarization, figuring out who said what when, comes back in a different shape from every provider. Some give per-word speaker IDs, some give start-and-end segments, some hand back a separate format entirely. I normalized all of those into a single standard format the moment the result object was constructed, so nothing downstream ever had to ask which provider it came from.

The proof the abstraction was right showed up when I added the seventh provider. The work was a couple of hours: write the adapter, register it, optionally add a UI card. Everything else just kept working.

## First time with WebSockets

Up to this point, everything I'd built was request and response. The browser sends data, the server responds, done.

Two of VSee's three STT surfaces didn't work like that. Live captions and the in-call transcript were streaming. If I wanted the platform to evaluate streaming behavior, I needed a streaming path. Which meant WebSockets, which I had never used.

The first day was disorienting. A request-response endpoint has one input, one output, a clear boundary. A WebSocket is a long-lived conversation, both sides can send frames at any time, the connection has a lifecycle separate from any single message, and errors aren't HTTP status codes. They're conditions you have to watch for inside the stream.

The bug I lost the most time to was the one where everything looked fine. Connection open. Browser sending audio. Server listening. Nothing coming back. No error, no timeout, just silence. It turned out the audio frames were the wrong format for the provider's streaming endpoint, and the endpoint was quietly discarding them. The fix was small. The hour I spent staring at it was not.

By the end of the project the streaming path felt routine. But I remember the first interim transcript coming back through the socket, words appearing on the page in real time, one chunk at a time, and feeling like I'd crossed into a different category of system.

## The streaming surprise

What I didn't expect was how much the streaming path changed the evaluation itself.

A finished transcript hides a lot. Two providers can end up at the same final WER and take very different paths there. One might lock in a stable transcript in the first second and only refine the tail. The other might emit a confidently wrong interim transcript for five seconds, then yank half of it back when more context arrives. To a user watching live captions, those are completely different experiences. To a final WER number, they look identical.

So I added live WER recomputation. As interim transcripts came back, I scored them against the reference in real time. You could watch a provider's WER climb high during the wobbly part of the stream and settle as the audio kept coming. How a provider's accuracy converged was a property of the provider you couldn't see any other way.

It mattered for the recommendation. One provider that looked competitive on the offline number turned out noticeably worse in the live regime. If I'd only evaluated offline, I'd have been silently wrong about it.

Demo: [youtu.be/XOuEOfwbQfA](https://youtu.be/XOuEOfwbQfA).

## What landed

The recommendation went through. VSee migrated off self-hosted Whisper onto Deepgram. The clinical-note pipeline got noticeably better on the part that mattered. The team stopped paying ongoing engineering cost to keep an inference service alive.

What I didn't predict at the start is what happened to the platform afterward. It survived the decision. It's still the standing tool at VSee for evaluating any new STT provider, the next time someone asks the same question, the answer is a re-run, not a rebuild.

If I'd written it as a script, none of that would be true. I'd have shipped faster and we'd be doing this again from scratch the next time.

The takeaway isn't about transcription, or evaluation, or platforms-versus-scripts in the abstract. It's that the work of answering a question is sometimes the work of building the instrument that can answer it. The metric I needed didn't exist, so I built it. The fair comparison didn't exist, so I built the abstraction. The streaming evaluation didn't exist, so I built the streaming path. None of that was the work I thought I was signing up for. All of it was the work the question actually required.
