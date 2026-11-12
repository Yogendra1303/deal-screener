# Fund Hub (prototype)

One place for a venture fund and the companies it works with, built around how a partner and an analyst
actually work. A left menu with five places:

| Place | Its one job |
| --- | --- |
| **This week** (`/`) | Partner view: what needs a decision, what to watch, open questions, what changed. Analyst view: my queue (questions for me, reports to read, founders to chase, pitches to screen) |
| **Deals** (`/deals`) | Every inbound pitch. AI reads each deck into one standard record, code checks it against the founder's sheet, form, registry and profiles, and it gets a band: **Priority**, **Review** or **Outside focus** |
| **Portfolio** (`/portfolio`) | One line per backed company on what needs attention, runway, revenue trend and owner. "What's missing" is a tab here |
| **Compare** (`/compare`) | Companies as rows, standard metrics as columns, one currency, every cell opens its sources |
| **Sources and agents** (`/sources`) | What the hub reads, what each agent does, what's built, and a log of who did what |

Pitches and portfolio companies share one company page: a header with who at the fund knows them, a
five-line brief where every line cites its source, key numbers, open questions between partner and analyst,
and tabs for the detail. Click any number to open the evidence panel: every source with its page and quote,
the code's working, and a box to ask a teammate about it.

Every number carries one of five labels:

| Label | Meaning |
| --- | --- |
| Claimed | Only the founder says it (deck, form, call) |
| Reported | From the founder's monthly report or numbers sheet |
| Checked | A second, independent source agrees |
| Conflict | Two sources disagree. A person decides; nothing is corrected |
| Missing | Expected or asked for, not received |

Fund rules, the screener test (accuracy on ten planted-mistake decks) and founder resources sit under
Settings.

**AI sorts and explains. People decide.**

Everything in this repo is fictional sample data: the companies, their founders, numbers, registry records
and profiles. Real registry and profile lookups aren't built yet. The portfolio side makes no AI calls.

## How it decides

| Part | Who does it |
| --- | --- |
| Read the deck into the standard record (with page and quote for each fact) | AI |
| Compare deck vs sheet, form, registry; deck maths (ARR vs MRR, runway vs cash and burn) | Plain code |
| Fit with the fund's written rules (stage, country, sector, round size) | Plain code |
| Traction and team judgement, founder-claim checks, questions for the founder | AI, with reasons and evidence |
| Band | Plain code from the five scores |
| Final call | The analyst |

Rules the code follows:

- Bands, not a 0 to 100 score. A failed fit rule means Outside focus. Strong traction with at least a
  mixed team means Priority. Everything else is Review.
- Conflicts never move a deck down. They add a red badge so a person looks.
- The AI never edits the founder's numbers and never works one number out from another.
- No background proxies: school, gender, age and so on are not used anywhere.

## Cards (home, portfolio, pitches)

Home is a grid of cards, one job each (decisions, missing reports, low on cash, numbers that don't match, new pitches, questions). Click a card and a side panel opens with only the companies behind it; the rest of the page dims. Company and pitch cards show a health word (Needs help, Watch, Healthy), cash left, revenue and report status, with red flags for missing MIS reports and numbers that don't match. Company pages open with section cards that say what's inside before you click. Code: `components/cards.tsx`.

## Sign in (demo)

Two roles, two homes. Demo accounts (also listed on the login page):

| Account | Password | Role | Sees |
|---|---|---|---|
| kabir@fundhub.demo | partner123 | Partner | This week (decisions, watch list, team strip), Team page with each analyst's load and read-only queue, Fund rules |
| riya@fundhub.demo | analyst123 | Analyst | My work: files from founders, numbers to fix, partner's questions, reports to read, founders to chase. Only their own companies and pitches, plus new pitches nobody has picked up |
| arjun@fundhub.demo | analyst123 | Analyst | Same, for Arjun's companies |

The check runs in the browser (`lib/auth.ts`), so it is not security. A real build would use Google or Microsoft sign-in with roles checked on the server.

## Founder links and the data room

Founders never sign in. The fund starts every conversation with a link (`lib/links.ts`, `components/links-store.tsx`):

- **Send us your pitch** (`/founder/pitch`): the one public link. Name, email, deck; the rest is optional. With `?ref=riya` it is an analyst's own link and the pitch goes straight to them. It lands in Pitches as "Not read yet".
- **Document request** (`/founder/request/<token>`): an analyst picks open lines from a pitch's Diligence tab (or the Data room) and gets a private link. The founder sees one upload box per item and can answer "I don't have this" or "I'll send it later". Ask once: anything already sent or already asked is left out.
- **Monthly report** (`/founder/<company>`): unchanged.

What comes back shows in the **Data room** (More menu): per company, what was shared (with its AI status), what is missing, and what we still need. New files are marked new until someone checks them; a checked file counts as a second source on the diligence checklist. Partners see every company and the pipeline (where pitches come from, how far each got, who is on what, what was asked); analysts see their own. Only analysts add pitches and send requests.

Prototype limits: links and files are saved in this browser only (open the founder link in another tab of the same browser), links are not secret, and files sent through links are not read by AI until an API key is set.

## Run it on your laptop

You need Node.js 20.12 or newer and an Anthropic API key.

```bash
npm install
cp .env.example .env.local      # then put your key in .env.local
npm test                        # checks the maths, rules and health score, no AI calls, free
npm run dev                     # open http://localhost:3000 (or: npm run dev -- -p 3100)
```

Set a monthly spend limit on your key in the Anthropic Console before you start.
`.env.local` is ignored by git. Never commit it.

### Process the ten sample decks

From the queue page, click **Process all**, or run it from the terminal so the results are saved in the
repo and the hosted demo shows them without spending credits:

```bash
npm run process-samples                  # decks without a result yet
npm run process-samples -- --research    # also run the web research pack
npm run process-samples -- --force       # redo all of them
npm run process-samples -- --only ledgerly,rostrly
```

This writes `data/sample-results.json` and prints how many planted issues were caught. Commit that file.
Then open **Results** to see caught issues, false alarms, numbers read right and time and cost per deck.

### Without an API key

`npm run chat-run` lets you run the AI steps in a Claude chat instead of the API. Save the chat's answers in
`data/chat-run/<deck>.record.json`, `.assessment.json` and optionally `.research.json`, then run
`npm run chat-run -- build`. The app's own code does the checks, scores and bands. These results are marked
"screened in chat" and show no time or cost. Ledgerly ships screened this way. Any other deck works too:
see `docs/screen-a-deck.md`.

## Put it online (Vercel)

1. Push this repo to GitHub.
2. In Vercel, import the repo. The defaults work.
3. Add `ANTHROPIC_API_KEY` under Project settings, Environment variables. Redeploy.
4. Share the link. Anyone with it can process decks on your key, so keep the spend limit on.

## Portfolio side

| Screen | What it shows |
| --- | --- |
| Portfolio | One plain line per company on what needs attention (runway under 9 months, gone quiet, form vs MIS, plan miss, waiting on the fund), runway, revenue trend, owner |
| What's missing | A grid of companies against months; click a square to see what arrived and send a reminder |
| Company page | Overview (brief, key numbers, questions), Numbers, Reporting, Documents, Activity |
| Founder page (`/founder/<id>`) | What the founder sees: what's due, send a report, ask for help, their own health and why |
| Founder resources | Templates, playbooks, office hours and partner perks, plus every founder ask |

Reporting health is plain code in `lib/portfolio/health.ts`. It gives bands with reasons, never a number:

- Company: **On track**, **Slipping** (a report more than 10 days late, or under 75% of what was asked in
  3 months), **Gone quiet** (no report for 60 days, or 2 of the last 3 missing), **Too early** (under 2 due).
- Fund: **Slow** when reports wait more than 7 days to be read (typical), an ask is open over 14 days, or
  no note in a quarter. Otherwise **Responsive**.
- It never moves the investment band. Every threshold sits in `HEALTH_RULES` so it can be tuned.

The prototype runs on a fixed demo date (29 Oct 2026) so the sample data always reads the same. What you do
in the demo (send a report, mark one read, ask or answer a question, switch partner and analyst) is saved in
this browser; "Reset demo changes" at the bottom of the left menu clears it.

## Limits

- Hosted uploads are capped at about 4.4 MB per deck (Vercel's request limit). On localhost the cap is 32 MB.
- Uploaded decks, overrules, fund rules and hand checks are saved in the browser only. There is no
  database or login.
- Registry and profile checks only work for the sample companies. Research uses live web search.
- Expected bands in the answer key are our own judgement, not a fund's.

## Cost (estimate)

Roughly $0.20 to $0.50 per deck with `claude-opus-5-5` at medium effort, and about $0.50 to $1.50 more
for the research pack. Each deck page shows the measured time and cost of every step.
Set `AI_EFFORT=low` in `.env.local` to make it cheaper and faster.

## Where things are

```
app/               pages (this week, deals, deal, compare, sources, portfolio, founder, settings) and API routes
components/        left menu, evidence panel, shared company page parts, stores
lib/provenance.ts  the five labels on every number, with sources and the code's working
lib/compare.ts     compare grid maths and sample exchange rates
lib/brief.ts       the five-line cited brief for each company
lib/questions.ts   partner and analyst questions (fictional seeds)
lib/team.ts        the fund's people and "who knows them"
lib/agents.ts      sources, agents, metric definitions and the activity log
lib/portfolio/     portfolio types, fictional data, reporting health, flags, attention lines, timeline
lib/extract.ts     AI reads the deck into the standard record
lib/checks.ts      code checks: deck vs sheet, form, registry, deck maths
lib/rules.ts       fit rules, scores and bands
lib/assess.ts      AI judgement on traction and team, founder checks, questions
lib/research.ts    web research pack (competitors, market size, red flags)
lib/pipeline.ts    runs the steps in order
lib/evaluate.ts    scores the screener against the answer key
scripts/           sample deck builder, sample processor, chat-run, tests
data/              sample index, answer key, fictional registry and profile records
public/samples/    the ten sample decks (PDF) and monthly sheets (CSV)
```

To rebuild the sample decks after editing `scripts/sample-companies.mjs`, install Playwright
(`npm i -D playwright && npx playwright install chromium`) and run `npm run make-samples`.
