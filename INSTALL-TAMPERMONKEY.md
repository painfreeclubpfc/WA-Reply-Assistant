# Install via Tampermonkey (no $5, nothing to manage, auto-updating)

This is the recommended way to run the PFC Reply Assistant. The tool becomes a
"userscript" hosted on your Railway proxy. Your team installs it once from a
link; whenever we change the code or answers and redeploy, **every install
auto-updates** — no reinstall, no files on anyone's laptop, no store fee.

## One-time setup (you, once)
1. **Deploy the proxy** in `proxy/` to Railway (see `proxy/README.md`). It hosts
   three things: the userscript, the live answers, and (optionally) the AI
   button. It runs fine **without** an Anthropic key — you only need the key if
   you want the "Compose with AI" button.
2. Note your proxy's public URL, e.g. `https://pfc-assistant.up.railway.app`.
   Your install link is that URL + `/pfc-reply-assistant.user.js`.

## Each team member (2 minutes, once)
1. Install **Tampermonkey** — the free browser add-on:
   https://www.tampermonkey.net (Chrome/Edge). One click, no cost.
2. Open the install link in the browser:
   `https://<your-proxy-url>/pfc-reply-assistant.user.js`
3. Tampermonkey shows an **install page** → click **Install**.
4. Open **web.whatsapp.com** (log in with the WhatsApp **Business** number).
   When a member's message matches, the **PFC Reply Assistant** card appears.
   Review the draft → **Insert into chat** → you press send.

That's it. No folders, no Developer mode, no $5.

## Turning on the AI button (optional)
1. Set `ANTHROPIC_API_KEY` on the Railway proxy (and optionally `SHARED_SECRET`).
2. If you set a `SHARED_SECRET`: in the browser, Tampermonkey menu (the icon) →
   **PFC: set shared secret** → paste the same value.
3. The **Compose with AI** button on the card works. Toggle it any time via
   Tampermonkey menu → **PFC: toggle AI compose**.

## Updating answers or code (you / me)
1. Edit `faq.json` (answers/links) or the code in the repo.
2. Redeploy the proxy (Railway redeploys on git push).
3. Tampermonkey re-checks the script periodically and **auto-updates everyone**.
   To update instantly, a user can open the Tampermonkey dashboard →
   **Utilities → Check for userscript updates**.

## How this keeps your number safe
Same as the extension: it only **drafts** into the compose box — you always press
send. Nothing is auto-sent, no WhatsApp API, no fake client. See the risk note in
the main `README.md`.

## Honest notes
- Tampermonkey itself runs in each person's Chrome (there's no way to run a
  WhatsApp-Web helper without something in the browser — only a server bot avoids
  that, and it changes your number).
- The proxy must stay running (Railway) since it hosts the script + answers.
- If WhatsApp redesigns their web page and the card stops appearing, the DOM
  selectors need a quick update — ping me; I change one file and redeploy, and
  everyone auto-updates.
