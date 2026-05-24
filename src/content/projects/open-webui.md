---
id: open-webui-mcp
year: 2025
blurb: VSee's company-wide internal LLM platform. Open WebUI + MCPO + 8 MCP servers, BAA-compliant, on-prem. 80+ engineers.
role: Solo · VSee internship
tags:
  - MCP
  - Open WebUI
  - Vertex AI
  - Platform
status: live company-wide
links:
  - kind: demo
    label: ask.vsee.com
    url: https://ask.vsee.com/
hero:
  src: /media/pivot-vanilla-tool-overcalls-searxng.png
---

# The day my chatbot searched the web for "3+5"

![Open WebUI chat where the user has asked "3+5=?" and the assistant, gemini-2.5-flash, shows a chain-of-tool-use UI labeled "Searching the web," "Searching," "Retrieved 3 sources," followed by a verbose response citing math-help websites; the searxng web-search tool is shown enabled in a Tools toggle at the bottom of the screen.](/media/pivot-vanilla-tool-overcalls-searxng.png)
*The bug that drove the pivot. gemini-2.5-flash firing the web-search tool to answer "3+5".*

## 3+5

One morning at my desk, I was sanity-checking a tool I'd just wired into VSee's internal Open WebUI. The tool was a private SearXNG instance, a self-hosted meta-search engine we ran on-prem so our LLM could reach the open web without phoning out to Google's servers from a healthcare network.

I typed `3+5=?` into the chat as a baseline. The model was gemini-2.5-flash, the simplest thing on hand.

The response panel rendered "Searching the web." Then "Retrieved 3 sources." Then a paragraph about how the answer was 8, citing calculatorsoup.com.

I sat there for a second. The model had just gone to the open web to confirm that three plus five is eight. That was the moment I knew the tool layer was broken.

## Why this mattered

Step back a layer. VSee is a healthcare-video-software company. We handle PHI, which means SaaS LLM products (ChatGPT Enterprise, Claude Team, the regular Gemini API) were off the table when this work started. Some of those vendors will sign a BAA for narrow configurations, but the configurations that are actually BAA-acceptable are narrow enough that "just buy a seat" was never a real answer. Compliance's read was that the clean path was to self-host the UI on-prem and route LLM calls through a BAA-cleared backend. Vertex AI on `us-central1`, specifically; the standard Gemini API isn't BAA-acceptable, but Vertex on certain regions is.

Open WebUI was already deployed for exactly that reason. It's an open-source chat UI we control, talking to a BAA-cleared model, and no patient-shaped data crosses a vendor boundary it shouldn't.

The platform satisfied compliance, but it didn't do much beyond that. The 80-plus engineers using it could ask the model questions and get text back, same as in any chat product. What they couldn't do was let the model look anything up: no Bitbucket access, no Confluence, no Asana, no internal Elasticsearch analytics. My job was to extend the platform with tools so the chat could actually work.

If we'd been free to point at any SaaS, the tool layer wouldn't have been mine to design. We weren't. So I started with the obvious thing, Open WebUI's built-in tool system. That's where the 3+5 came from.

## What I tried first

Open WebUI ships with a tool framework. You write a Python function, decorate it, register it in the admin UI, and the model can call it. It's a lovely piece of design for the case where you have one tool. I had one tool, SearXNG, and that part worked fine.

The trouble started when I added the second.

The second was a Bitbucket lookup, so the model could fetch the diff on a commit when someone asked about a PR. I wrote the function, registered it, and asked the chat to look up a commit. The model called Bitbucket. Then it also called SearXNG. Then it hallucinated a tool call that didn't exist, with parameters that looked like a mashup of Bitbucket's and SearXNG's argument schemas.

I poked at it for a few days. The schemas were colliding in subtle ways. Open WebUI was concatenating tool definitions into the system prompt, and the model was treating the whole concatenation as a soup of available calls. There was no isolation between tools, either; they all ran in the same Python process as Open WebUI itself, which meant a poorly-behaved tool could crash the chat. And the worst part: anything I built was locked in. The Bitbucket lookup was a Python function inside Open WebUI's tool registry. If anyone else at the company wanted the same capability in a different LLM setup (Claude Desktop, say, or someone's personal Cursor), they'd have to rewrite it.

That was the first quiet alarm. The 3+5 was the second, louder one. The model wasn't getting strong signal about when to use a tool, because the descriptions all looked similar and the tool-firing decision was happening downstream of any thoughtful gating. Add Bitbucket and the model went tool-happy. A third tool seemed likely to make it worse.

A week in: vanilla tools worked, but every addition made them a little worse. I didn't like where the curve was heading.

## The shift

MCP, Anthropic's Model Context Protocol, had shown up a few months earlier and was starting to feel like it was designed for exactly the shape of this problem. Each tool runs as its own server process, exposing a standard JSON-RPC surface. The model talks to those servers through a generic client. The tool definitions live in the servers, not in the host application. And anything you build is reusable across any MCP-compatible client: Claude Desktop, Cursor, anyone's personal LLM rig.

I didn't want Open WebUI to know about every MCP server individually, so I put MCPO in front of them. MCPO is an MCP-aware proxy. From Open WebUI's side, it's one tool endpoint. Behind it, an arbitrary number of MCP servers can sit, each running in its own process with its own environment, dispatched to based on which tool the user's question matches.

I rewrote the SearXNG integration first, as a smoke test. It took an afternoon, most of which was figuring out MCPO's config format. The Bitbucket integration came next, this time using an open-source Bitbucket MCP someone else had already published. A few hours: drop the server config into MCPO's JSON, set the env vars and OAuth credentials, restart.

I asked the chat `3+5=?` again. The model answered 8 and did not search the web.

I don't know with certainty why the tool-use behavior improved. The plausible reasons: MCP servers expose richer tool descriptions than Open WebUI's vanilla schema, running each tool in its own process eliminates the cross-tool-definition soup, and the protocol's separation of concerns gives the model cleaner signal about what each tool is for. Probably all three. What I can say is that on identical models with identical prompts, the indiscriminate firing stopped.

The pivot cost about a week of rework, and that's the part of this story I'd most want a younger version of me to hear. Vanilla tools weren't broken in any obvious way. They were getting a little worse with each addition, and the present pain wasn't bad enough to justify rewriting around. The temptation to push through was real. But the curve was the thing to pay attention to, not the current data point.

## What it unlocked

Once MCP was the foundation, integrating a new tool dropped from "write Python, debug schema collisions, restart Open WebUI" to "add a server to MCPO's config, set env vars, done." Hours instead of days.

I shipped eight servers behind MCPO: Bitbucket, Slack, Asana, Google Drive, SearXNG, internal Elasticsearch analytics, fetch, sequential-thinking. Seven of those were open-source projects someone else maintained. I read their READMEs, plugged in the config, dealt with auth, moved on.

![Open WebUI chat window showing an LLM response that has performed code review on a Bitbucket commit; the response is organized into Behavior, Strengths, and Issues and suggested fixes sections, followed by a snippet of the reviewed Python tool-server configuration code.](/media/mcp-bitbucket-targeted-commit-review.png)
*The Bitbucket MCP doing a targeted code review on a commit, structured Behavior / Strengths / Issues sections, straight from the chat.*

The one I built from scratch was the Elasticsearch analytics MCP. VSee runs all its product telemetry (visit counts, subscription tiers, platform breakdowns, ratings) through an internal Elasticsearch cluster. Non-technical teams needed answers from that data and had no way to get them without pinging engineering. I built nine analytics tools, schema-pinned and parameter-validated, so the model could let support folks and analysts ask in English and get well-formed answers back. That one took about a month.

![Open WebUI chat where a user asks for the visit trend for a specific customer over the last year; the assistant replies with a nine-month list of monthly visit counts with provider and patient counts, total and average for the year, and a paragraph summarizing the trend (rising January through April, steady in May, sharp decline from June onward with both visits and active providers dropping).](/media/tool-visit-trends.png)
*Support team's bread-and-butter: ask one sentence in English, get the customer's visit trend back as structured data plus a written read of the trajectory. No engineering ticket, no ESQL.*

Hours per open-source server, a month for the one I had to build myself. That's the ratio that made the platform feasible for a company our size. If we'd had to build all eight from scratch, this project wouldn't have shipped.

The platform is the company-wide internal LLM tool at VSee now. Validation came in passing. Support team members told me how much nicer it was to query Elastic in plain English. Engineers reach for the Bitbucket MCP routinely to pull "the PRs I'm reviewing" without leaving chat. No demo, no launch, just a slow drumbeat.

## What stuck with me

The lesson I'd want to keep is boring. Vanilla tools worked for one tool. They got noticeably worse for two. By six, they would have been unworkable. The signal was there from the second tool, but the present pain didn't look catastrophic, and that's the trap.

The broader thing is that designing for AI keeps having this shape. You don't call the model the way you'd call a function. It runs your tools on its own initiative, and the protocol between you and it has to account for that. MCP's bet, separate processes, standard surface, model-driven dispatch, is the right one, and the easy-now path was wrong from the second tool onward.

I answered `3+5` correctly with the same model, on the same hardware, by changing what the model could reach through. That's the part I keep coming back to.

---

*Publishing notes (delete before posting):*

- *Images used:* `media/pivot-vanilla-tool-overcalls-searxng.png` (cover, publish-ready); `media/mcp-bitbucket-targeted-commit-review.png` (inline §"What it unlocked", **redaction not yet done**, per MANIFEST.md the commit URL, workspace name, and a few repo paths still leak; scrub before publishing); `media/tool-visit-trends.png` (inline §"What it unlocked", **file lives in the Elasticsearch MCP project's `media/` dir**, copy or symlink it into this project's `media/` before publishing, or update the path).
- *Word count:* ~1600 words.
