---
id: bitbucket-code-review
year: 2025
blurb: An AI code reviewer that takes the first pass on PRs. In production on 3 Bitbucket repos at VSee, including the main product repo.
role: Solo · VSee internship
tags:
  - Python
  - FastAPI
  - OpenAI
  - Bitbucket
  - EC2
status: in production
links:
  - kind: github
    label: Source
    url: https://github.com/mlei06/Bitbucket-Code-Review
hero:
  src: /media/output-bitbucket-report.png
---

# I shipped an AI code reviewer at my internship. Then I shipped it again.

![Bitbucket Code Insights report card showing an AI code review with status NEEDS ATTENTION, summary metrics (Must-Fix, Should-Fix, Risk, Files, Lines, Model, Review Time, Tokens), and two Medium-severity annotations linked to specific source lines.](/media/output-bitbucket-report.png)
*The bot's verdict on a real PR, posted to Bitbucket's Reports tab.*

I was halfway through reviewing my fourth PR of the morning when I caught myself about to write the same comment for the third time that week. Something like "consider null-checking this before you dereference it." A real bug, but not a bug that needed me, specifically, with a CS degree in progress and three other PRs in my queue, to flag. It needed any competent reviewer, or a tool that could approximate one for the first pass and free me up for the stuff that actually required judgment.

That afternoon I started reading Bitbucket's webhook documentation.

About a month later I had a working AI code reviewer on the team's test repo. Today it runs on the company's main product repository plus two sister repos, reviewing real PRs from real engineers. This is the part where I tell you what happened in between.

## Where I started

This was my internship. I was on a team that pushed daily to the company's main product repo, the codebase that gets the most traffic in the org and the most attention from senior reviewers. Review was a bottleneck, the way it usually is at a company that takes review seriously. PRs sat for hours waiting for someone with enough context to look at them.

I'd been on both ends of this. My own PRs sat in the queue, and I was reviewing my teammates' work, which is where I started noticing how much of code review is the same kind of work over and over. Style nits. Off-by-ones. Functions that handled three cases but not the fourth one staring at me from line 90. None of that requires deep context, just a careful reader and twenty minutes.

I pitched the idea to my manager: an AI service that takes the first pass, posts its findings to the PR as Bitbucket Code Insights annotations and inline comments, and frees up human reviewers for the work that actually needs them. He said go.

I owned the project. He reviewed my code and handled DevOps.

## Building v1, and what it taught me about webhooks

I'd never set up a webhook before. The Bitbucket docs tell you what events you can subscribe to (PR created, PR updated, comment added, the usual list) and what the payload looks like. They don't tell you how to actually develop against one when the events are coming from someone else's system. That was the first real problem.

You can't point a Bitbucket webhook at `localhost`. It needs a publicly reachable URL. I didn't have one. My laptop wasn't exposed to the internet and the project didn't have any cloud infrastructure yet.

So I registered a webhook on the project's own Bitbucket repo and pointed it at [webhook.site](https://webhook.site), a free service that captures incoming HTTP requests so you can look at them. Then I'd open a dummy PR, watch the payload land in the webhook.site dashboard, copy the JSON out, and POST it to my locally-running API with curl.

![Bitbucket "Edit webhook" screen titled "Public Payload Server" with a webhook.site URL, secret configured, status Active, and a column of trigger checkboxes covering push, PR lifecycle, and comment events.](/media/v1-webhook-setup.png)
*Configuring the Bitbucket webhook in v1, pointed at webhook.site because I didn't have a public endpoint of my own yet.*

This worked, in the sense that I could finally see what real Bitbucket payloads looked like (headers, signatures, JSON shape) instead of faking them locally and getting it wrong. But every iteration of my code now took a multi-step copy-paste loop: edit code, restart the local server, open Bitbucket, create a PR, switch tabs to webhook.site, copy the payload, paste it into a curl command. Do that twenty times in an afternoon and you start wondering whether there's a better way.

![webhook.site request inspector showing a captured POST from Bitbucket-Webhooks/2.0 with full request headers (event key, HMAC signature, hook UUID) and the start of a JSON repository payload.](/media/v1-payload-received.png)
*A real PR-update payload landing on webhook.site. I'd open this, copy the JSON, and manually POST it to my local API. Every time.*

After a few days of it I gave up and provisioned an EC2 instance, deployed the service there, and pointed the webhook directly at the EC2 endpoint. New loop: push code, redeploy, open a test PR, watch the review appear on Bitbucket. The speed difference wasn't 2x; it was more like 10x. Most of the rest of v1 happened in the week after that switchover.

## The line-number problem

The hardest problem in v1 was getting the model to put its findings on the right lines.

A code review tool that says "there's a bug on line 1342" is only useful if line 1342 is actually the line with the bug. In Bitbucket's Code Insights annotations, an issue gets pinned to a specific row of code. That's the whole point of inline annotations. So the model had to output line numbers, and those line numbers had to be right in the *new* version of the file (post-diff), not relative to the diff hunk.

My first approach was the obvious one. I gave the LLM the raw unified diff, with its `@@` hunk headers, `+` and `-` lines, and unchanged context lines, and asked it to report new-file line numbers in its output. This failed constantly. The model would say "line 1342" when the actual line was 1338. Or 1356. Or 1340. The errors had a pattern, though, which is what gave it away. The model was mentally applying the hunk header (`@@ -1340,5 +1340,7 @@`) and then trying to count context lines and addition lines to derive the new-file number. It was bad at the arithmetic in roughly the way you'd be bad at it if you were skim-reading a long diff under time pressure.

I tried more elaborate prompts. "Think step by step about the hunk header." "Count the lines explicitly before you cite one." Marginal improvement. Still wrong often enough that the annotations were untrustworthy, and an untrustworthy annotation is worse than no annotation. Reviewers learn to ignore the bot if it points at the wrong code even once.

The fix came when I stopped treating this as a model problem. Line-number arithmetic from a diff isn't reasoning; it's deterministic computation that a few lines of Python can do perfectly. So I did the math in code. Before sending the diff to the LLM, I walked through it once and prepended each new-file line with its actual line number, like `1342 | label = …`, `1343 | spacer = …`, and so on. The model didn't have to derive line numbers anymore. It could read them off the line.

That function still lives in the codebase. It's called `_annotate_diff_with_new_file_lines`. The change took maybe two hours and fixed line-citation reliability in one shot. The lesson here (that an LLM failing at a deterministic sub-task usually means the sub-task should be done in code, not prompted better) has shown up over and over in the prompt-engineering work I've done since.

## V2, making it a real reviewer

V1 ran end-to-end: take a diff, run it through OpenAI, post line-cited issues back to a Bitbucket PR. Running and being useful are different things, and v2 was mostly about closing that gap.

The bot kept fighting with developers it shouldn't have been fighting with. A developer would push back on a flag ("this is by design, not a bug"), push a new commit, and the bot would happily re-raise the same flag on the next review pass, having forgotten the entire conversation. From the bot's perspective every review was a fresh read of a fresh diff. From the developer's perspective the bot was tone-deaf.

There was a technical version of the problem (the bot was stateless) and a social version of it (the bot was rude), and the fix was the same in both cases. Thread the prior review's issues and the developer's replies into the next review's prompt, character-budgeted so it doesn't blow out the context window. Now the bot sees "I raised X last time and the developer said it's by design" and skips raising X, or sees "the developer says it's fixed in this commit" and verifies against the new diff. That change made the biggest dent in developer experience of anything in v2. Nothing gets a bot ignored faster than having it re-litigate the same point three reviews in a row.

Next came giving the bot the ability to actually vote. Up to v2 it only commented. We wanted to upgrade it so that an "Approve" verdict would toggle an actual Bitbucket approval and a "Request changes" verdict would formally request changes. Branch protection was set up to count the bot's approval as a sufficient reviewer vote.

That created a case I didn't immediately see, and once I did I couldn't unsee. On a fifty-file refactor where the bot's first pass found nothing flagrant, a programmatic Approve would let the PR land with no human review at all. The point at which you most want a human to look at a change is exactly the point where the bot is most likely to wave it through.

The fix is a complexity gate, which I think is one of the more important design calls in the whole project. When the diff exceeds twenty files or eight hundred changed lines (configurable), the bot keeps its verbal "Approve" in the comment so the reviewer can see what it thought, but it does *not* toggle the Bitbucket approval. The PR still needs a human. The bot is allowed to vote, but it's not allowed to be the only sufficient vote on something large.

The last piece was security, which is short but real. Once the bot was about to start receiving real webhook traffic from the company's main product repo, the EC2 endpoint was sitting on the public internet. Anyone who happened to know the IP could POST a webhook-shaped JSON at it. Without verification the bot would happily review the forged payload, burning LLM budget on fake PRs and serving as a free LLM endpoint for anyone who had done a port scan.

The fix is HMAC signature verification, which Bitbucket supports natively. Bitbucket and my service share a secret. Bitbucket signs every webhook by computing an HMAC-SHA256 of the body with the secret and sending the result in an `X-Hub-Signature` header. My service recomputes the same HMAC on the raw body and rejects anything where the signatures don't match. The secret never crosses the wire, only proof that the sender knew it.

## Where it landed

The bot is in production on three Bitbucket repos: the company's main product repository (the highest-traffic codebase in the org) plus two sister repos. It's reviewed something north of a hundred PRs at the time of writing and the volume keeps going up.

![Bitbucket PR comment from an AI bot account titled "AI Review Completed" with sections for Overall Decision, Key Reasons, Coverage, two structured Issue blocks (file, line, severity, description, suggested change), and Model & Usage metadata.](/media/output-pr-comment.png)
*The same review as a PR comment, with line-cited issues that actually point at the right lines now.*

A review comes back in seconds. The annotations are pinned to the actual lines that contain the issue, which they weren't before I rewrote how the diff gets handed to the model. Developers can dismiss findings, reply with feedback, and the bot reads those replies on the next review pass. When it disagrees enough to refuse approval on a big change, it says so but lets a human do the actual approving. That's the gap between a tool people grudgingly tolerate and one they reach for on purpose.

## What I'm taking with me

Friction in your own dev loop is worth listening to earlier than I did. The webhook.site copy-paste loop seemed annoying-but-fine on day one, slightly worse on day two, intolerable on day three. The right time to invest in EC2 was day one. I waited until day three. When a workflow keeps generating friction now, I try to ask earlier whether the workflow is wrong, not whether I should tolerate it faster.

When an LLM is failing at a deterministic sub-task, the move is usually to do that sub-task in code rather than prompt it better. The line-citation problem was a clean version of this. The model couldn't reliably count lines through a diff because it shouldn't have been asked to count lines through a diff in the first place. That's what a `for` loop is for. The same shape keeps showing up in other prompt-engineering work I've done since, and the answer is almost always to move the deterministic part out of the prompt.

And the moment you give an automated thing the ability to act, you have to design for the cases where it should defer. The complexity gate is the version of this lesson I'm most likely to reach for in interviews, because it generalizes. Any AI feature that can take an action also has to know when it shouldn't, and that boundary is something you have to draw yourself.

The bot is still running, and it still flags my old code occasionally.

<!--
PUBLISHING NOTES, remove before publishing.

Word count: ~2,180 words. Within Standard range (1500–2500).

Images referenced (eventual filenames in media/):
- media/output-bitbucket-report.png  , cover
- media/v1-webhook-setup.png         , §3 inline
- media/v1-payload-received.png      , §3 inline
- media/output-pr-comment.png        , §6 inline

REDACTION STATUS: at time of writing, all four images are unredacted in media/_raw/. Before publishing, scrub each per the checklist in media/MANIFEST.md:
- output-bitbucket-report.png, report title contains "VSee AI Code Review"; repo line "vsee-vsee-code-review"; file paths reveal product internals.
- v1-payload-received.png, Raw Content panel reveals "vsee-vsee-code-review" repo name; IPv6 source IP and webhook UUIDs in headers.
- output-pr-comment.png, bot name "VSee AI Bot"; file paths "VSeeMessenger/Windows/Chat/...".
- v1-webhook-setup.png, webhook.site URL UUID worth scrubbing (low sensitivity otherwise).

Once redacted, move from media/_raw/ to media/ with the filenames referenced above and this note can be deleted.
-->
