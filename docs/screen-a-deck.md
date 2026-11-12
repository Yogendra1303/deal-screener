# Screen any deck without an API key

The AI steps run in a Claude chat (or Claude Code session) on your own account. The app's code then runs
the same checks, scores and bands as the live app. The result shows in Pitches marked "Read in Claude chat".

Use public decks for testing. Founder profile and registry checks only know the fictional sample data, so a
real deck shows "not found" there rather than a made-up match.

1. Pick a short id, for example `acme`. Put the PDF at `public/decks/acme.pdf`.
2. Write `data/chat-run/acme.form.json`. Leave out anything the founder didn't give:

   ```json
   {
     "receivedAt": "2026-10-29T10:00:00Z",
     "deckFile": "acme.pdf",
     "sheetFile": null,
     "form": {
       "companyName": "Acme",
       "website": "",
       "country": "India",
       "sector": "B2B software",
       "stage": "Seed",
       "amountUsd": null,
       "founders": [{ "name": "Founder Name", "profileUrl": "" }],
       "email": ""
     }
   }
   ```

   `country`, `sector` and `stage` use the lists in `lib/types.ts`.
3. Read the deck into `data/chat-run/acme.record.json`, following the rules in `lib/extract.ts` and the
   shape of `DealRecordSchema` in `lib/schema.ts`. Every number needs its page and a short exact quote.
   Anything the deck doesn't say is null. Never guess.
4. Run `npm run chat-run -- context acme`. Give its output to Claude and save the answer as
   `data/chat-run/acme.assessment.json` (`AssessmentSchema`).
5. Optional: research the market with web search and save `data/chat-run/acme.research.json`
   (`ResearchSchema`). Only real sources with working links.
6. Run `npm run chat-run -- build`, then restart the app. The pitch appears in Pitches with nobody on it;
   an analyst picks it up with "I'll take it".
