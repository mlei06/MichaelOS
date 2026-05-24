---
id: duke-dine
year: 2025
blurb: A nutrition + workout tracker for Duke students. LLM agents over the dining database. 3 months from grant to 100+ daily users.
role: Co-founder · 3 engineers
tags:
  - Next.js
  - Postgres
  - LLM Agents
  - Docker
  - Full-stack
status: live · 100+ users
links:
  - kind: demo
    label: dukedine.com
    url: https://dukedine.com
hero:
  src: /media/duke-dine-logo.png
---

# Nobody uses NetNutrition

![Duke Dine logo: a circular badge with the Duke Blue Devil holding a fork and knife, wearing a white apron with the Duke "D" and the wordmark "DukeDine."](/media/duke-dine-logo.png)

Every Duke student technically has access to a database of macros for every dining hall item on campus. It's called NetNutrition. It runs on CBORD, the same vendor that powers many American university dining systems, and it has had a public-facing search UI since the late 2000s.

I have never met a Duke student who uses it.

Search barely works. There's no way to log meals. No history. No personalization. The page visibly hasn't been touched in years. If you actually want to track what you ate at the Marketplace last Tuesday, you can either copy the macros by hand into MyFitnessPal, which doesn't know what a Duke dining hall is, or you can give up. In my experience almost everyone does.

A friend pulled me aside at the end of last semester: *what if there were a better way to track what we're actually eating at Duke?* He didn't have a spec. He had a working theory: the data was already public, the social problem was real, and nobody had built the thing.

## A friend, a grant, and a deadline

Three of us applied to Duke Colab for a small grant and got $1,000 to build it. The benchmark for success wasn't a grade. It was real Duke students using it daily. We gave ourselves three months to ship.

I worked across the whole stack. I'll write here about the parts I think were the most interesting: the data ingestion we had to invent because there was no API, the schema design I had to throw out and redo, and the AI feature that ended up doing more for daily friction than anything else we built.

## The four endpoints CBORD doesn't document

The first problem was that NetNutrition has no public API. Naively fetching the landing URL gives you an HTML page with no menu data in it, the menus are loaded by JavaScript after the user clicks something. So I opened Chrome devtools on NetNutrition with the Network tab filtered to XHR, and clicked through the UI manually. Pick a restaurant, watch the request fire, inspect the form data, inspect the response. After about a dozen clicks the pattern was obvious.

The interactive UI hides everything behind JavaScript `onclick` handlers like `unitsSelectUnit(24)`, `menuListSelectMenu(1057)`, and `getItemNutritionLabel(267090803)`. Each handler submits a form-encoded POST and injects a chunk of HTML back into the page. Once I had the four endpoints mapped, the whole scraper was a couple of hundred lines of Python and BeautifulSoup against a single `requests.Session`.

The four are: `POST /Unit/SelectUnitFromUnitsList` (give it a unit ID, get back a JSON payload of "panels" containing the menu list as embedded HTML), `POST /Menu/SelectMenu` (give it a menu ID, get back the items as embedded HTML), `POST /NutritionDetail/ShowItemNutritionLabel` (give it an item ID and a unit ID, get back the FDA-style nutrition label as HTML), and `POST /Unit/GetHoursOfOperationMarkup` for hours. The only HTML scraping is the landing page, where restaurant IDs are encoded in the onclick attributes of restaurant links. After that it's JSON-paneled POSTs all the way down.

The session is sticky on purpose. CBORD stores the selected unit on the server side, so menu calls only work after a unit-selection POST has been made first. The first time I tried hitting `/Menu/SelectMenu` cold, the server returned a blank response and I lost an afternoon to it. Once the session order was right, things worked.

## Three schemas before I admitted what was wrong

Once the scraper was producing clean data, I had to figure out how to store it. My first instinct was straightforward relational normalization: `restaurants → menus → categories → items`. Foreign keys all the way down. Items live inside categories, categories inside menus, menus inside restaurants.

The trouble started immediately. Dining halls have one menu per day, a different breakfast, lunch, and dinner each day. Cafés have multiple static menus with no dates. Single-menu spots have categories directly under the restaurant, with no intermediate menu at all. I tried three different schemas: a nullable `menu_id`, a polymorphic association, and a single container table. Each one fit one restaurant shape and broke another.

After the third try I realized I was solving the wrong problem. I was forcing a rigid hierarchy onto data whose *items* were stable but whose *organization* was a per-restaurant presentation concern. The items existed at every restaurant. The way they got grouped didn't.

So I pivoted. Items became first-class. The menu and category layout, which day, which section, which order, went into a single JSONB column on the restaurant. Items dedupe naturally; menus are just views; new restaurants with weird shapes plug in with no migration.

What I'd been modeling was the presentation layer, not the data layer.

## Then it got used

We shipped at the end of month three. Students started logging meals.

And almost immediately the friction shifted. The complaint stopped being "I can't find what I ate"; the menus were there, the macros were there. It became "tapping items takes too long." Filling a meal still meant scrolling a category list and clicking each thing. Realistic Duke lunches have four or five items in them. Five taps wasn't unreasonable, but five taps three times a day adds up to enough friction that people lapsed after a week.

I knew what to build next.

## Type a sentence, get a meal

The Blue Devil meal agent is the most user-visible AI feature we've shipped. The user types a sentence, *"turkey and rice from Farmstead, a kale salad with some dressing, and an apple"*, or speaks it via voice-to-text, and the system returns a fully structured meal with macros grounded in real Duke menu rows wherever possible. No category scrolling. No quantity sliders.

My first design instinct was wrong. I'd already built a single-shot Claude vision call for nutrition labels (picture in, structured macros out), and I assumed I could reuse the same shape. But that pattern works for nutrition labels because nutrition labels *are* nutrition. A meal description isn't. "Turkey from Farmstead" doesn't carry its macros in the words; the macros live in our `items` table. A single-shot LLM call would have produced confident-looking guesses from the model's training memory, which is not the same thing as the macros Duke actually publishes.

So I built it as a tool-use loop instead. The agent has three tools, and on each turn it picks one. `search_food_db(query, restaurant?)` searches our Duke items table first and USDA second. `request_clarification(question, options, reason, macro_delta_kcal)` is for genuine ambiguity. `record_meal` is the final commit, where every dish carries an explicit `source: 'db_match' | 'estimated'` flag and an optional `db_food_id` linking back to a real row.

The prompt design that took the longest to get right was the search tool's parameters. The model wanted to write things like `search_food_db("turkey from Farmstead")`, natural in English, but it kills the match, because Duke item names never include the restaurant. I had to split the parameters: `query` is the food only ("turkey", "kale salad"), and `restaurant` is a separate optional filter. The system prompt is explicit about this. It also lists the Duke restaurants by name (The Farmstead, Sprout, JBs, Beyu Blue Coffee, Marketplace, Twinnies, Saladelia, Skillet), because partial-name matching only works if the model knows the canonical form.

The next thing I learned: the model often wants to issue several searches in one turn. For a three-dish meal it will emit three `search_food_db` calls in parallel. Bedrock's protocol requires every `tool_use` ID in an assistant turn to have a matching `tool_result` in the next user turn, or the conversation 400s on the next round. The route handler runs all the searches with `Promise.all` and emits the results in matching order. A three-dish meal usually completes in two model turns.

The cost-discipline piece is the one I'm proudest of. Most clarification-asking agents I'd seen are happy to ask "did you want white rice or jasmine rice?" But that question costs the user a round trip for a five-calorie swing. So the `request_clarification` tool requires a `macro_delta_kcal` argument: an honest estimate of how much the answer would shift the meal's macros. If the model tries to ask a question with a delta below 150 kcal, the route rejects the tool call with an `is_error: true` tool_result that tells it to make a defensible assumption and commit instead. The model has to justify the cost of asking.

Behind the agent sits a deterministic post-validator. Before any meal payload leaves the server, three non-LLM checks run. The 4-4-9 rule recomputes calories from protein and carbs and fat; if the agent's stated calories diverge by more than max(20 kcal, 15%), the macros win and the calories get rewritten. Every `db_food_id` marked as a Duke match is verified to exist via a single SQL query that also pulls the canonical restaurant name and item name; invalid IDs get downgraded to `source: 'estimated'` with a note explaining the downgrade. Meal-level totals are always recomputed from the corrected dish rows. The agent's totals are advisory only.

The model is the orchestrator, and the menu rows are the source of truth.

## The other half

About halfway through the project, DukeDine grew a second half. The nutrition side has clean relational data: menus, items, macros, logs. The strength training side doesn't. When you finish a lift you don't fill out a form. You jot something into your notes app: `bench 225x5x3, last set felt heavy, 6hrs sleep, 200mg pre`. That's prose with structure buried inside.

So we built Iron Logic, a set of eight Claude agents that turn brain-dumps into per-set workout data, run RAG over your reflections, and answer questions like "how was my squat in February" with cited dates. Every agent in the system is built around the same adversarial pattern: a commit tool, and a `request_clarification` tool, and a forced choice between them. The pattern across the two halves of the product turned out to be the load-bearing AI lesson of the whole project. Code is precise; prompts are not. The only way to make a probabilistic system feel trustworthy is to deny it the option of returning ambiguous text.

That's its own post. I'll write that one separately.

## "Works locally" and "works in production" are different products

Until DukeDine I had never deployed a full-stack app. I had run `npm start` locally and called it shipping. By the end I was running multi-stage Docker builds, docker-compose on a single EC2 instance, nginx behind Cloudflare DNS with SSL, GitHub Actions auto-pushing path-filtered images to Docker Hub, and a 290-line deploy CLI that I'm probably the most proud of in the entire infra layer.

The deploy CLI's trick is small but it has saved me at least four times. After it pulls the new image and recreates the container, it cross-checks the running container's image SHA against the SHA of the freshly-pulled tag using `docker inspect`. If they don't match (and they sometimes don't, in subtle ways involving compose caching and ordering), the deploy is marked failed and the script exits non-zero. "Deploy succeeded" actually has to mean it deployed. I have been burned exactly once by the silent variant of this failure, where the container restarted on the previous image and the script printed green and went home. That was the morning I wrote the SHA check.

## Where it landed

DukeDine has 100+ active Duke users and is still growing. Both halves are live. We took it from zero to production in three months and we've been releasing new versions since: vision-based meal scanning, brain-dump splitting across multiple days, an auto-logging pipeline that reads receipt emails from your Duke dining account.

## What's next

We're nowhere near finished. Next on the list:

- Polishing the mobile app and getting it past TestFlight
- A real caching layer in front of the hot read paths
- Scaling to other CBORD universities (about half of American campuses run on it, the data is there, nobody is using it)
- More external nutrition sources beyond Panera and McDonald's
- ML over the daily macro and workout data to predict goal progress and flag plateaus

Long term, I want DukeDine to work for any university student trying to eat intentionally, not just at Duke.

## What it taught me

A handful of things I expect to carry into everything I build next: how real systems break in production and why deploys have to verify themselves, how to design a schema when the data refuses to fit a clean hierarchy, how to put an LLM in front of structured data without making the LLM the source of truth, how to make a probabilistic system feel trustworthy by denying it the option of ambiguous output, and how to take a vague idea and turn it into a live product 100+ people actually use.

DukeDine showed me the difference between writing code and building systems, which turns out to be most of the work.
