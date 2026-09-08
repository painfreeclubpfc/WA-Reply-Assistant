# How it's wired (v0.5) — one backend, auto-updating

The whole system is now **one backend** with a **thin client**, so you update
content in exactly one place and it appears everywhere automatically.

```
   You tell Bruno a change
            │
            ▼
   GitHub repo (this repo)  ──push──►  Cloudflare Worker "pf-reply"
   faq.json · library.json                (auto-rebuilds & redeploys)
   pfc-brain.md                                   │
                                                  │ serves:
                                                  │   POST /compose  (AI brain)
                                                  │   GET  /faq      (approved answers)
                                                  │   GET  /library  (177 polls/msgs)
                                                  ▼
                          Tampermonkey userscript (thin client)
                          — carries NO content, fetches it all live —
                                                  ▼
                                    WhatsApp Web (draft only, human sends)
```

## Why this fixes the "update in 3 places" problem
- **The userscript (gist) carries no content anymore.** It just calls the Worker.
  So it almost never changes — no more gist + Tampermonkey edits for content.
- **All content lives only in the Worker** (`faq.json`, `library.json`,
  `pfc-brain.md`, baked in at build).
- **The Worker auto-deploys from this GitHub repo.** When Bruno pushes a content
  change, Cloudflare rebuilds and redeploys on its own. You paste nothing.

Net: **you tell Bruno → Bruno pushes → live everywhere within minutes.**

## The pieces
- `worker/worker.template.js` + `worker/build.mjs` → `dist/pfc-worker.js` — the backend.
- `pfc-reply-assistant.user.js` + `build-userscript.mjs` → `dist/…standalone.user.js` — the thin client.
- `faq.json` — approved answers (brain's ground truth + `/faq`).
- `library.json` — polls/challenges/messages (`/library`), generated from the Master SOP.
- `pfc-brain.md` — Bruno's member-safe PFC knowledge (system prompt).
- `wrangler.toml` — lets Cloudflare auto-deploy the Worker from Git.

## One-time setup to make it hands-off
1. **Connect the repo to the Worker** (Cloudflare → Workers → `pf-reply` →
   Settings → Build/Deployments → Connect GitHub → pick `WA-Reply-Assistant`,
   branch `main`, build command `node worker/build.mjs`). After this, every push
   auto-deploys.
2. **Update the gist once** with the v0.5 thin client (it never needs content
   edits again). Set its `PROXY_BASE` to the Worker URL once.

After that, content changes are push-only. The AI key stays a Worker secret and
survives every redeploy.
