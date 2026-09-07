# PFC WhatsApp Reply Assistant

A tool that helps the Pain Free Club team answer members on **WhatsApp Web**. When
you open a 1:1 chat, it reads the latest incoming message and shows an **editable
draft reply** — either one of PFC's approved answers, or a fresh reply written by
**Bruno's brain** (an AI that has PFC's full context) in PFC's voice. You review,
edit, click **Insert**, and **press send yourself**.

**It never sends anything on its own.** That single rule keeps the number a
**normal** WhatsApp account — no WhatsApp Business API, no number migration, no bot
posting. It's a trained autocomplete with a knowledgeable brain, not a bot.

---

## 👉 Start here: `SETUP-GUIDE.md`
The full, step-by-step go-live + team-sharing guide. Two parts:
- **Part A (admin, once):** put the userscript in a free GitHub Gist, deploy the
  free Cloudflare Worker "brain," add your Anthropic key.
- **Part B (each teammate, 2 min):** install Tampermonkey, click the link, done.

## How it's delivered (the free stack)
- **Tampermonkey userscript** — hosted free in a **GitHub Gist**, auto-updates when
  you edit the gist. The file to paste: `dist/pfc-reply-assistant.standalone.user.js`.
- **Bruno's brain** — a free **Cloudflare Worker** (`dist/pfc-worker.js`) that holds
  the Anthropic API key server-side and writes replies grounded in PFC's knowledge.
  It can answer *any* reasonable member question, not just the pre-written ones.
- No paid hosting, nothing to keep running on a laptop, and the API key never
  touches the browser.

## The two knowledge sources (edit these to change what it says)
- **`faq.json`** — the approved answer bank (exact replies for known questions:
  recordings, app login, appointment, timings, pricing…). Highest trust — links and
  wording are copied verbatim.
- **`pfc-brain.md`** — Bruno's curated, **member-safe** PFC context (who we are,
  Dr. Manan, the programs, community, voice) plus the hard guardrails. This is what
  lets it answer novel questions on-brand.

After editing either, rebuild the Worker:
```bash
node worker/build.mjs      # regenerates dist/pfc-worker.js
```
then paste the new `dist/pfc-worker.js` into your Cloudflare Worker (Edit code →
paste → Deploy). Answer-only tweaks can also be edited straight in the gist.

## Safety (Dr. Manan's standing rules, baked in)
- **No medical advice, ever.** Symptoms, reports (MRI/X-ray), surgery, medicines →
  a gentle "our team will connect you" hand-off, never advice.
- **No prices over chat** — it says the team will share current details (prices and
  coupons change).
- **No invented facts** — it won't make up a link, address, date or phone number.
- **A human reviews and sends every reply.**

## Limitations / maintenance
- WhatsApp Web has **no public API**, so the reader in the userscript uses
  best-effort selectors. If WhatsApp changes their site and the card stops reading
  messages, it logs a `[PFC]` line to the browser console (F12) — send that and the
  selectors get re-pointed.
- It's a **per-seat** tool — it runs only where a teammate has WhatsApp Web open in
  their own browser. Not a server bot.
- Draft-assist (no auto-send, no bulk) is low-risk, but WhatsApp Web automation is
  technically unsupported — so **never add auto-send.**

## Repo layout
| Path | Role |
|---|---|
| `SETUP-GUIDE.md` | **the go-live + team-sharing guide (start here)** |
| `faq.json` | approved answer bank |
| `pfc-brain.md` | Bruno's member-safe PFC knowledge for the AI |
| `dist/pfc-reply-assistant.standalone.user.js` | the userscript you paste into the gist |
| `dist/pfc-worker.js` | the built Cloudflare Worker (Bruno's brain) — paste into Cloudflare |
| `worker/worker.template.js` + `worker/build.mjs` | Worker source + build script |
| `worker/README.md` | brain deploy details |
| `INSTALL-FREE-GIST.md` / `INSTALL-TAMPERMONKEY.md` | install walkthroughs |
| `proxy/` | optional Node/Railway alternative to the Cloudflare Worker |
| `manifest.json`, `contentScript.js`, `matcher.js`, `options.*`, `panel.css` | optional Chrome "load unpacked" extension build |
| `PUBLISHING.md` | optional Chrome Web Store publishing notes |

---
*Maintained by Bruno, Pain Free Club's AI assistant. Source of truth for the
approved answers is the "Regular Messages" tab of the Community Nurturing Master SOP.*
