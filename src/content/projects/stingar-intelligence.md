---
id: stingar-intelligence
year: 2025
blurb: Unifying firewall block telemetry across multiple platforms at Duke. AI-driven persistence ranking + coordinated-campaign detection.
role: Engineer · Forewarned
tags:
  - Security
  - Microservices
  - AI
  - Infra
status: in progress
links:
  - kind: demo
    label: STINGAR live stats
    url: https://forewarned.io/live-statistics/
  - kind: docs
    label: Duke STINGAR
    url: https://stingar.security.duke.edu/
hero:
  src: /media/stingar-cover.png
---

# Blog Draft — Looking Across Four Firewalls At Once

![STINGAR logo: a stylized blue-and-black hornet over a honeycomb of white hexagons, with the wordmark "STINGAR™" above.](/media/stingar-cover.png)

> Working draft. Voice: technical but accessible to a security-curious
> audience. Pull facts from `narrative.md`.

## Hook

**TODO** — open with a concrete moment. Example shape: *"On a typical
Tuesday, Duke's network blocks roughly X connection attempts. Four different
control planes log them, and until recently nobody could see them in one
place."*

## The silo problem

Most security teams don't have one firewall — they have several, plus cloud
security groups, plus edge routers, plus whatever the latest acquisition
brought along. Each one is logging blocks. Each one has its own API. None of
them know about each other.

That means a single attacker, probing patiently across four entry points
over a week, looks like noise on each individual device and only becomes a
"campaign" when a human happens to stitch the logs together.

## STINGAR's existing answer

Forewarned's STINGAR platform has been solving a related slice of this for
nine years: shared threat intelligence across **80+ partner institutions**,
with sub-second automated blocking driven by honeypot signals. If an IP hits
a honeypot at one partner, every partner's defenses learn about it almost
immediately.

What STINGAR didn't yet do — and what this project adds — is **unify the
block telemetry that already exists inside one institution** across the
different platforms enforcing it.

## What we built

**TODO** — describe the architecture (microservices, normalized schema, AI
pattern layer, dashboard). Use the diagram from `narrative.md`.

## What it changes

**TODO** — concrete examples of attacks the unified view catches that the
device-by-device view didn't. Persistence ranking. Coordinated-campaign
clustering.

## Lessons

**TODO** — 2-3 things you learned. Examples:
- Normalizing across security platforms is *interesting* — the APIs disagree
  on what a "block" even is.
- AI in security ops lives or dies by false-positive rate; operator trust is
  a feature, not an afterthought.
- Working on live production security data changes how you think about
  testing.

## What's next

**TODO** — open questions, future work, generalizing beyond Duke to the rest
of Forewarned's 80+ partners.
