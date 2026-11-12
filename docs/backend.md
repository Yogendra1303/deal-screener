# Fund Hub as a working application

Everything a person does in Fund Hub is now saved on a server, not only in the browser that did it:
uploading a deck, changing a status, passing with a reason, writing an analyst note, setting a score by
hand, logging a signal, editing the fund rules, switching the workspace mode. Open the app in another
browser and the same state is there.

## Where saves go

The app picks one of three stores at startup and says which one on the Workspace page and in the sidebar.

| Driver | When | Where the data lives |
| --- | --- | --- |
| `supabase` | `NEXT_PUBLIC_SUPABASE_URL` and a key are set | Postgres tables plus a private storage bucket |
| `file` | No Supabase, but the disk is writable (a laptop, a container) | `data/runtime-db.json` and `data/runtime-files/` |
| `none` | Hosted on Vercel with no Supabase | Nothing server-side; each browser keeps its own copy |

With `none` the app still works end to end. It tells the person their changes live in that browser only,
instead of pretending they are shared.

## Environment variables

Put these in `.env.local` when running locally, or in the Vercel project settings when hosted. Never in
the repository and never in a chat.

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<the service_role key>
```

Optional:

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=<used only if no service role key is set>
SUPABASE_BUCKET=deal-files          # defaults to deal-files
FUNDHUB_DB_FILE=./data/runtime-db.json
FUNDHUB_FILES_DIR=./data/runtime-files
ANTHROPIC_API_KEY=<only if you want the server to run the AI itself>
ANTHROPIC_MODEL=claude-opus-5-5
```

The service role key is read on the server only; it is never sent to the browser. The anon key works too,
but then the row-level security policies at the bottom of `supabase/schema.sql` have to be uncommented,
and anyone who finds that key can read and change the data. Prefer the service role key.

## Setting up Supabase

1. Create a project at supabase.com.
2. Open the SQL editor and run the whole of `supabase/schema.sql`. It is safe to run more than once. It
   creates the tables, the indexes, the private `deal-files` bucket and the row-level security locks.
3. Copy the project URL and the `service_role` key from Settings → API into the two variables above.
4. Redeploy. The Workspace page should now say "Shared database".

## The tables

| Table | What it holds |
| --- | --- |
| `app_state` | One JSON row per screen store. This is the source of truth the app reads back. |
| `deals` | One queryable row per company: sector, stage, country, ask, status, band, founder fit, owner, and the record, intake, decision and research as JSON. |
| `deal_files` | The original deck PDF, monthly CSV and other founder files, with their path in the bucket. |
| `deal_signals` | Events logged against a company, with publisher, link and date. |
| `workspace_settings` | One row: workspace mode, fund rules, AI mode. |

`app_state` is what the app reads; the other tables are a mirror kept in step on every save by
`lib/db/project.ts`, so the database can be queried without knowing how the app stores its screens.

## API routes

| Route | Does |
| --- | --- |
| `GET/PUT /api/state/[key]` | Reads and writes one screen's store, and mirrors it into the tables |
| `GET /api/state` | Lists the stored keys |
| `DELETE /api/state` | Factory reset: wipes every blob, row and file |
| `GET/PUT /api/files/[dealId]/[fileType]` | Serves and stores an original file (32 MB limit) |
| `GET /api/deals` | Every company as a row |
| `GET/PATCH /api/deals/[id]` | One company with its files and signals; PATCH edits the editable columns |
| `GET/PUT /api/workspace` | The workspace settings row |
| `GET/POST /api/ai/run` | Runs a job on the server when an API key is set |
| `POST /api/process` | Reads a deck end to end with an API key (unchanged) |
| `GET /api/health` | Which driver is in use, whether a key is set, which model |

## The AI workbench

Two ways to run the same three AI jobs. The app does every sum either way; the AI only reads and judges.

**My Claude / ChatGPT account (no API key).** Open a pitch and choose "Run AI deck extraction", or on a
screened deal, the AI steps tab → "Run / re-run AI deck extraction". Then:

1. Click "Copy prompt & open Claude.ai" (or ChatGPT). Attach the deck PDF and paste the prompt.
2. Paste the JSON answer back and press "Validate & continue". It is checked against the app's own
   schema, so a wrong shape is refused with the field that is wrong.
3. The second prompt carries the record and what the code checks already found. Paste that answer back.
4. "Validate & apply to deal" runs the number and registry checks, turns founder conflicts into flags,
   makes the five scores and the band, and saves the deal for everyone.

The research pack works the same way, from the "Generate live research pack" button on any company,
archived ones included. A run made this way is marked "read in a Claude chat", so the screener test page
refuses to count it as a blind measurement.

**Direct API key.** Set `ANTHROPIC_API_KEY` on the server and the same buttons run the job there, with
time and cost recorded on the AI steps tab.

## Tests

`npm test` runs 218 checks, none of which call an AI or the network. `scripts/test-backend.ts` covers the
server store and its projections, the figures worked out from a monthly CSV, and the account bridge from
prompt to applied band.
