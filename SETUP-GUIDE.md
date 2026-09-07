# PFC WhatsApp Reply Assistant — Go-Live Guide

Two parts:
- **Part A — You (admin), once, ~15 min:** put the tool online + turn on Bruno's brain.
- **Part B — Each teammate, once, ~2 min:** install and use on their own laptop.

Nothing ever auto-sends. Every reply is a **draft** — a human presses send. The
WhatsApp number stays a normal number (no API migration).

---

## PART A — Admin setup (do this once)

### Step 1 — Put the tool online (free GitHub Gist)
1. Go to **https://gist.github.com** and sign in with a PFC GitHub account.
2. **Filename** box: type exactly `pfc-reply-assistant.user.js`
   (the `.user.js` ending is what makes Tampermonkey offer "Install").
3. Open `dist/pfc-reply-assistant.standalone.user.js` from this repo, copy **all**
   of it, and paste it into the gist.
4. Click **Create secret gist** (secret = only people with the link see it; the
   file has no passwords in it).
5. Click the **Raw** button (top-right of the file). The browser goes to a URL like
   `https://gist.githubusercontent.com/<you>/<id>/raw/pfc-reply-assistant.user.js`
   → **copy this URL. This is your install link** (you'll send it to the team).

### Step 2 — Turn on auto-updates (so the team never reinstalls)
1. Back on the gist, click **Edit**.
2. Find these two lines near the top:
   ```
   // @updateURL    REPLACE_WITH_YOUR_GIST_RAW_URL
   // @downloadURL  REPLACE_WITH_YOUR_GIST_RAW_URL
   ```
   Replace **both** `REPLACE_WITH_YOUR_GIST_RAW_URL` with the Raw URL from Step 1.5.
3. Don't save yet — do Step 4 in the same edit.

### Step 3 — Turn on Bruno's brain (free Cloudflare Worker)
This is the AI that writes a reply to *any* member question, in PFC's voice.
1. Create a free account at **https://cloudflare.com** → left menu **Compute (Workers)**
   → **Create** → **Create Worker**. Name it e.g. `pfc-reply` → **Deploy**.
2. Click **Edit code**. Delete the sample code. Open `dist/pfc-worker.js` from this
   repo, copy **all** of it, paste it in → **Deploy**.
3. Go to the Worker's **Settings → Variables and Secrets → Add**:
   - Name `ANTHROPIC_API_KEY`, value = your Anthropic API key, and tick
     **Encrypt** (Secret). → **Deploy** again.
   - *(optional)* Name `SHARED_SECRET`, value = any password you choose (adds a
     lock so only your script can call the Worker). Remember it for Step 4.
4. Copy your **Worker URL** — it looks like
   `https://pfc-reply.<your-name>.workers.dev`.
5. Test it: open that URL + `/health` in a browser → you should see
   `{"ok":true,"ai":true}`. If `ai` is `false`, the API key wasn't saved — redo 3.

### Step 4 — Point the tool at the brain (so the team gets zero-config)
Back in the gist edit screen (Step 2), find this line near the top of the code:
```js
  let PROXY_BASE = "";  // set later via Tampermonkey menu (PFC: set AI proxy URL)
```
Put your Worker URL between the quotes:
```js
  let PROXY_BASE = "https://pfc-reply.<your-name>.workers.dev";
```
*(If you set a `SHARED_SECRET` in Step 3, tell each teammate to also do:
Tampermonkey icon → **PFC: set shared secret** → paste the same password. If you
skipped `SHARED_SECRET`, they do nothing extra.)*

Now click **Update secret gist**. ✅ You're live.

### Step 5 — Get the Anthropic API key (if you don't have one)
1. **https://console.anthropic.com** → **API Keys** → **Create Key** → copy it.
2. **Billing → set a spend limit** (e.g. $5/month) so cost can never surprise you.
   Each drafted reply is a fraction of a cent (Haiku 4.5 + prompt caching).

---

## PART B — Each teammate (2 minutes, on their own laptop)

Send them the **Raw URL** from Step 1.5 and these three lines:
1. Install **Tampermonkey** (free): https://www.tampermonkey.net → *Add to Chrome*.
2. Open the **Raw URL** in Chrome → Tampermonkey shows an **Install** page → **Install**.
3. Open **web.whatsapp.com**, log in with the PFC support number, and use it (below).

*(Only if you set a SHARED_SECRET: after step 2, click the Tampermonkey icon →
**PFC: set shared secret** → paste the password you gave them → reload WhatsApp Web.)*

---

## How to use it (daily)
1. Open a 1:1 chat where a member asked something.
2. The **💬 PFC** button sits bottom-right. A card shows a **suggested reply** —
   an approved answer if one matches, otherwise a fresh reply Bruno wrote.
3. Read it, edit if needed → **Insert into chat** → **you press send.**
4. If it's a medical/symptom question, the draft is a gentle "our team will
   connect you" hand-off — never advice. Prices are never quoted; it says the
   team will share current details.

## Changing the answers or knowledge later
- Edit `faq.json` (approved answers) or `pfc-brain.md` (Bruno's knowledge) in the repo.
- I rebuild: `node worker/build.mjs` → new `dist/pfc-worker.js`.
- You paste the new `dist/pfc-worker.js` into the Worker (**Edit code → paste →
  Deploy**). For answer-only tweaks you can also just edit the text inside the gist;
  the team auto-updates.

## If something looks off
- **No card / no reply:** hard-refresh WhatsApp Web (Ctrl+Shift+R). Make sure only
  **one** copy of the script is enabled in Tampermonkey (delete old versions).
- **"couldn't read a message":** press F12 → **Console**, find the `[PFC]` line,
  send it to me — WhatsApp occasionally renames its page bits and I re-point the reader.
- **AI not writing:** open `<Worker URL>/health` → must say `"ai":true`.
