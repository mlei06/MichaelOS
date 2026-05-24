---
id: elasticsearch-mcp
year: 2025
blurb: An MCP server that lets non-technical teams query Elasticsearch in English. Nine hardcoded tools beat one flexible-LLM-writes-ESQL tool.
role: Solo · VSee internship
tags:
  - MCP
  - TypeScript
  - Elasticsearch
  - Zod
status: in production
hero:
  src: /media/tool-top-change.png
---

# Why I stopped letting the LLM write its own queries

![Three back-to-back chat exchanges in Open WebUI. Each user prompt asks about top accounts or groups by visit change; the assistant replies with a ranked list of identifiers and percentage changes, citing the `top_change` tool as the source.](/media/tool-top-change.png)
*Three natural-language questions in a row, all answered by the same hardcoded `top_change` tool. The LLM figured out which scope (account vs. group) and which direction (increase vs. decrease) from the question alone.*

The first sign something was wrong: the model had just told me, correctly, what fields lived in the index. It had called the schema-discovery tool I'd given it, summarized the response, listed the field names back on the right side of my screen. Then in the next message it wrote an ESQL query against a field that didn't exist.

Not in the summary. Not in the index. The name just sounded like the kind of thing a visit-timestamp field would be called, and the model had reached for it the way you'd guess a coworker's middle name.

I closed the chat and opened a new one. Same thing.

## Why this mattered at all

I was interning at VSee, where product-usage telemetry, visits, subscription tier, OS breakdown, ratings, account and group identifiers, all gets piped into Elasticsearch under a `stats-*` index pattern. Operations, customer success, and the analysts kept needing answers from that data, but every question routed back through engineering. Mostly the same questions: top accounts this month, visit trends for a specific group, subscription distribution. An engineer would write the ESQL, run it, paste the answer into a Slack thread.

The project was supposed to kill that loop. VSee already ran a self-hosted LLM platform (Open WebUI), and I'd just shipped a web-search integration for it. This was meant to be the same shape: non-technical teams ask in English, the LLM calls into Elasticsearch, the answer comes back.

Which meant the LLM had to query Elasticsearch reliably. If it couldn't, the project was dead. There's no version of self-serve analytics where engineering still has to double-check every result.

## The flexible design, and why I thought it would work

My first cut gave the model three tools. One to list index names. One to discover field names within an index. One to execute arbitrary ESQL the model wrote itself.

The theory was clean. ESQL is expressive enough to answer almost anything you'd want from the `stats-*` data: top-N rollups, time-series buckets, filtered aggregations. The model already knew ESQL syntax from training data. The only piece it couldn't know was VSee's specific schema, which indices existed under `stats-*`, which fields lived in each one, what the field names actually were.

So the discovery tools were there to plug that gap. The flow I had in my head: user asks "top 5 accounts by visits last month," model recognizes it needs the schema, calls the field-discovery tool, gets back the real field names, composes the ESQL against those real field names, executes it. Three tools, fully general, covering anything anyone might ever want to ask.

I wasn't being lazy. The appeal was that I wouldn't have to enumerate every possible question up front. The model would, in principle, handle any new question that came in. Compare that to a world where every new analytical request meant a new tool: one for "top decreases this quarter," then another for "top decreases this year," then another for "top decreases by group instead of account." That sounded exhausting and brittle.

If you'd asked me at the start of week one, I'd have told you the flexible design was obviously right.

## What actually happened

Two weeks in, I had not produced one reliable end-to-end query.

The failure mode wasn't subtle. The model would call the field-discovery tool, parrot the fields back, then write an ESQL query against a field that wasn't in the response it had just received. Sometimes the invented field sounded plausible (`visit_date` when the real one was `createdtime`). Sometimes it paired a real name with the wrong index. Sometimes it was a field that had never existed anywhere, that the model had made up because the query needed something there.

I tried prompting harder. Told the model in increasingly direct language to use only the fields the discovery tool returned. Structured the discovery output more carefully: JSON instead of prose, smaller chunks, explicit "ONLY these fields exist" framing. Called discovery twice, once at the top of the conversation, once right before the query. None of it held.

My read on what was actually breaking: working memory. The model knew the field names the instant it summarized them. By the time it had to compose a multi-clause ESQL query like `FROM stats-visits | WHERE … | STATS COUNT(*) BY …`, the discovery output was three or four turns back in context. ESQL syntax was pulling hard on training-data priors. And "what's a plausible field name for visit timestamps" turned out to be a stronger signal than "what field names did this tool tell me about a minute ago."

The discovery tools were supposed to fix the schema problem. After two weeks the only thing I had evidence for was that they didn't.

## The reframe

What finally cracked it was a one-sentence shift: stop trying to give the LLM the schema, and do the schema work *for* it.

The model is good at one specific thing in this setup. It can map a natural-language intent ("which 3 groups saw the highest visit decrease this year") onto a small, well-named set of capabilities. That's a translation problem, and language models are reliable at it.

The model is bad at a different specific thing. It can't compose valid, schema-correct queries against a database it doesn't have memorized. That's a recall problem under load, and language models are unreliable at it.

The flexible design had asked the model to do both at once. The recall problem was killing the translation problem.

If I took the recall problem out, if every tool already knew exactly which fields it queried and the model only had to pick a tool and supply a handful of arguments, the model could spend all its capacity on what it was good at. The trade-off was scope: I'd have to predict which queries mattered. After two weeks of nothing working, "predict the queries that matter" was starting to sound less like a limitation and more like a feature.

## What the hardcoded design looks like

Nine MCP tools. Each one a dedicated function with a Zod-validated argument schema and a tailored Elasticsearch aggregation underneath. The names map directly onto kinds of questions: `get_visit_trends`, `get_subscription_breakdown`, `get_platform_breakdown`, `get_rating_distribution`, `top_change`, `get_usage_leaderboard`, `get_usage_profile`, `find_entities_by_metric`, `get_index_fields`.

The schema, all 22 fields in the `stats-*` data, lives in `utils/field-constants.ts` as plain constants. The tools import them and build queries from them. The model never sees a field name. It picks among nine tools and supplies a handful of typed arguments: a date range, a metric name from an enum, a top-N count. That's the whole surface it interacts with.

I picked the nine tools by going back to the people who would actually use the system and asking what they kept needing: top accounts, trends for specific clients, platform breakdowns, subscription distributions. The tool catalog wasn't theoretical. Every entry on it was a question someone had been bottlenecked on for months.

The flexible design's strongest argument was supposed to be that it would handle new questions without code changes. The hardcoded design's strongest argument turned out to be that it handled the *real* questions, the recurring ones that were the actual problem, without any of them breaking.

![Open WebUI chat. User prompt: "subscription distribution in last year." Assistant reply: a bulleted list of subscription tiers with document counts (No subscription recorded: 2,984,112; Basic: 1,247,891; Standard: 893,440; Premium: 512,337; Enterprise: 129,774), followed by an offer to break it down further.](/media/tool-subscription-breakdown.png)
*One English prompt, one clean breakdown. The follow-up offer ("I can slice it by month or by account/group") is the model on top of structured tool output, not pretending to be a database.*

The conversational behavior on top of the tool calls is the part I'd underestimated. The tools return structured data, buckets, counts, identifiers. The model wraps that in a paragraph of natural-language interpretation, telling you which months were strong, where the trend turned, what's worth following up on. The interpretation is anchored because the data is real, and the model has nothing to hallucinate because it isn't writing the query.

![Open WebUI chat. User prompt asking for the visit trend for a specific customer over the last year. Assistant reply: a nine-month list of monthly visit counts with provider and patient counts, total and average for the year, and a paragraph summarizing the trend — rising January through April, steady in May, sharp decline from June onward with both visits and active providers dropping.](/media/tool-visit-trends.png)
*Visit trends for a specific account over the last year. The numbers come from `get_visit_trends`; the read of the trajectory ("rising January through April, sharp decline from June onward") is the LLM on top.*

## What surprised me, and what I'd do differently

The thing I most underestimated was how much giving up the flexibility helped. I'd expected the hardcoded design to feel limiting, to need new tools every other week, to grow into a sprawling list I'd have to maintain. It didn't. Nine tools covered the questions, and the catalog has barely moved since, because the catalog was sourced from real questions instead of imagined ones.

The piece I'd want to revisit is whether a hybrid would work today, or with a stronger model. Hardcoded tools for the predictable questions, plus an escape hatch for genuinely novel ones, backed by smarter schema retrieval (maybe a typed query DSL the model writes against instead of raw ESQL). The flexible design failed for one specific reason, working-memory recall under composition. That reason might not be load-bearing forever. I'd want to test it the same way I tested v1: build it, see what breaks.

## What I took out of it

If I were starting another LLM-tool project from scratch tomorrow: give the model freedom only where it has the context to use that freedom well. Everywhere else, do the constraint work yourself and let the model handle the part it's good at.

---

**Image redaction status**

The following images are referenced in the post but still live in `media/_raw/`. Redact before publishing:

- `tool-top-change.png`, scrub account/group identifiers (`konsultamd-rm`, `just4me`, `allibhoy`, `lsh-wa`, `hcc`, `prod`, `lacounty`, `uih`, `qatar`) and the partial ES index name.
- `tool-subscription-breakdown.png`, confirm subscription-tier names are safe to publish; absolute document counts may need rounding or scrubbing.
- `tool-visit-trends.png`, replace `lifestance` (publicly traded company name) with a synthetic account label; scrub the partial ES index name. Note: the alt text for this image contains an em dash from the manifest, strip when copying into the redacted version.
