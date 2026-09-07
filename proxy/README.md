# AI Compose proxy (Phase 2)

A tiny Node server that lets the extension's **"Compose with AI"** button work
without ever putting the Anthropic API key in the browser. It takes a member's
message, asks Claude (default `claude-haiku-4-5`) to pick/adapt one of the
**approved answers in `../faq.json`**, and returns the suggested reply. The
extension still only drafts it — a human reviews and sends.

The model is instructed to answer **only** from the approved bank, keep links and
facts verbatim, and route anything medical to the safe hand-off (`escalate`).

## Run locally (to test)
```bash
cd proxy
cp .env.example .env          # put your real ANTHROPIC_API_KEY in .env
npm install
node --env-file=.env server.js
# -> PFC Reply Assistant proxy on :8787
```
Health check: `curl localhost:8787/health` → `{"ok":true,...}`
Test compose:
```bash
curl -s localhost:8787/compose -H 'content-type: application/json' \
  -d '{"message":"kal ka recording kaha milega"}' | jq
```

Then in the extension **Options**: tick *Enable AI compose*, set Proxy URL to
`http://localhost:8787`, Save, reload the WhatsApp Web tab.

## Deploy on Railway (reuses your existing Railway account)
1. **New Project → Deploy from GitHub repo** → pick `painfreeclubpfc/WA-Reply-Assitant`
   (branch `main`).
2. Open the service → **Settings → Root Directory** and set it to:
   `proxy`
   (build + start + `railway.json` all live there; it's self-contained).
3. **Settings → Networking → Generate Domain** to get a public HTTPS URL.
4. **Variables** (all optional at first):
   - `ANTHROPIC_API_KEY` — only needed for the "Compose with AI" button. Leave it
     unset and the proxy still hosts the userscript + answers; AI just stays off.
   - `SHARED_SECRET` — optional; if set, the userscript must send the same value.
   - `MODEL` (default `claude-haiku-4-5`), `ALLOWED_ORIGIN` (default WhatsApp Web).
5. Deploy. `railway.json` sets the start command (`npm start`) and a `/health`
   check, so there's nothing else to configure.
6. Your install link for the team is:
   **`https://<your-domain>/pfc-reply-assistant.user.js`**  → see
   `../INSTALL-TAMPERMONKEY.md`.

## Security notes
- The key lives only in the server env, never in the extension.
- CORS is locked to `ALLOWED_ORIGIN` (default `https://web.whatsapp.com`).
- Set `SHARED_SECRET` so only your extension (which sends `x-pfc-key`) can call
  it — CORS alone won't stop a non-browser caller.
- Cost: Haiku 4.5 is ~$1 / $5 per million input/output tokens; each reply is a
  few hundred tokens, so this runs to cents. Bump `MODEL` to a larger model only
  if you want richer paraphrasing.

## Alternative: n8n instead of this server
If you'd rather not run a Node service, the same thing can be an n8n webhook on
your existing Railway n8n: **Webhook → HTTP Request (Anthropic Messages API,
key in n8n credentials) → Respond to Webhook** with the CORS header. This
`server.js` is the simpler, self-contained option; pick one.
