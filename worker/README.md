# The AI "brain" (Bruno) — free Cloudflare Worker

This gives the assistant **Bruno's brain**: baked into the Worker's system prompt
is a curated, member-safe digest of PFC's whole context (`pfc-brain.md` — who we
are, Dr. Manan, the programs, community, voice, and hard guardrails) **plus** the
approved answers from `faq.json`. So it can write a reply to **any** reasonable
member message in Pain Free Club's voice — not just the ~11 pre-written ones —
while never giving medical advice, never quoting a price, and never inventing a
link or address. It's free to host (Cloudflare Workers free tier); the only real
cost is Anthropic API usage — pennies (Haiku 4.5, and the big system prompt is
**prompt-cached**, so repeat replies are cheaper still).

You deploy the built file **`dist/pfc-worker.js`** — no command line needed.

## What "Bruno as the brain" means (and its limits)
Bruno = Claude + the repo's `knowledge/`. There's no separate always-on Bruno
server to call, so we give the Worker the *same knowledge* by baking a trimmed,
member-safe copy into its prompt. It stays inside three hard rules on purpose:
**no medical advice** (symptom/report/surgery/medicine questions → gentle
hand-off, `escalate=true`), **no prices over chat** (`needs_review=true`), and
**no invented facts** (unknown link/address/date → team confirms). Every reply is
still a **draft** a human sends.

## Rebuilding after a knowledge change
The brain and answers are inlined at build time. After editing `faq.json` or
`pfc-brain.md`:
```bash
cd projects/automations/whatsapp-web-assistant
node worker/build.mjs        # regenerates dist/pfc-worker.js
```
Then paste the new `dist/pfc-worker.js` into the Worker (**Edit code → paste →
Deploy**). Keep `pfc-brain.md` in sync with `knowledge/business/`.

## Deploy (dashboard, ~5 minutes)
1. Create a free **Cloudflare** account → **Workers & Pages** → **Create** →
   **Create Worker**. Give it a name (e.g. `pfc-reply`), click **Deploy**.
2. Click **Edit code**. Delete the sample, **paste all of `dist/pfc-worker.js`**,
   click **Deploy**.
3. Go to the Worker's **Settings → Variables and Secrets** and add:
   - **`ANTHROPIC_API_KEY`** = your Anthropic key (mark it **Encrypt / Secret**).
   - *(optional)* `SHARED_SECRET` = any password; if set, the userscript must send
     the same value (Tampermonkey menu → *PFC: set shared secret*).
   - *(optional)* `MODEL` (default `claude-haiku-4-5`), `ALLOWED_ORIGIN`
     (default `https://web.whatsapp.com`).
   Click **Deploy** again after adding variables.
4. Copy your Worker URL — it looks like
   **`https://pfc-reply.<your-subdomain>.workers.dev`**.

## Point the userscript at it
In Chrome, on WhatsApp Web, click the **Tampermonkey icon → PFC: set AI proxy
URL** → paste the Worker URL → reload the tab. The card will now **write** a
reply for any message (and the **Write with AI / Regenerate** button appears).

## Test it
Open the Worker URL + `/health` in your browser → you should see
`{"ok":true,"ai":true}`. If `ai` is false, the `ANTHROPIC_API_KEY` variable isn't
set.

## Cost & safety
- **Cloudflare:** free tier (100k requests/day) — far more than you'll use.
- **Anthropic:** you pay per reply — cents. Set a spend limit in your Anthropic
  console if you want a hard cap.
- The key lives only in the Worker's secret store, never in the browser. Every
  reply is still a **draft** — a human reviews and sends.

## Getting the answers + brain into the Worker
The approved answers (`faq.json`) and Bruno's brain (`pfc-brain.md`) are baked
into `dist/pfc-worker.js` at build time (`node worker/build.mjs`). When either
changes, rebuild and paste the new version into the Worker (**Edit code → paste →
Deploy**). (Same idea as updating the gist.)
