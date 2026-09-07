# Free install — no server, no $5 (GitHub Gist + Tampermonkey)

This is the simplest, fully-free way to run Part 1 (suggests your approved
replies; no AI yet). Nothing to pay, nothing to keep on the laptop, and it
auto-updates when you edit the gist.

You'll use the file: **`dist/pfc-reply-assistant.standalone.user.js`**

## One-time setup (you, ~5 minutes)

### A. Put the file online in a free Gist
1. Go to **https://gist.github.com** (sign in with a PFC GitHub account).
2. **Filename:** type `pfc-reply-assistant.user.js`
3. **Paste** the entire contents of `pfc-reply-assistant.standalone.user.js`.
4. Click **Create secret gist** (secret = not searchable; only people with the
   link can see it — fine, it has no passwords in it).
5. On the gist page, click the **Raw** button (top-right of the file). Your
   browser goes to a URL like:
   `https://gist.githubusercontent.com/<you>/<id>/raw/pfc-reply-assistant.user.js`
   **Copy that URL** — that's your install link.

### B. (Recommended) switch on auto-updates
1. Back on the gist, click **Edit**.
2. Near the top find these two lines:
   ```
   // @updateURL    REPLACE_WITH_YOUR_GIST_RAW_URL
   // @downloadURL  REPLACE_WITH_YOUR_GIST_RAW_URL
   ```
   Replace **both** `REPLACE_WITH_YOUR_GIST_RAW_URL` with the Raw URL you copied.
3. Click **Update secret gist**. (Now, whenever you edit the gist later, everyone
   auto-updates.)

## Each team member (2 minutes, once)
1. Install **Tampermonkey** (free): https://www.tampermonkey.net → *Add to Chrome*.
2. Open the **Raw URL** (from step A5) in Chrome → Tampermonkey shows an
   **Install** page → click **Install**.
3. Open **web.whatsapp.com** and log in (use the WhatsApp **Business** number).

## Using it (daily)
1. Open a chat where someone asked something (e.g. "where's the recording?").
2. The **PFC Reply Assistant** card appears bottom-right with the approved reply.
3. Edit if needed → **Insert into chat** → **you press send.** Nothing sends by
   itself.

## Changing the answers later
1. Edit `faq.json` in the repo and tell me — I rebuild the file, **or** you edit
   the answer text directly inside the gist.
2. Save the gist. Everyone's copy auto-updates (Tampermonkey re-checks
   periodically; to update instantly: Tampermonkey → Dashboard → *Check for
   userscript updates*).

## Adding the AI button later (still free, optional)
The AI "Compose" button is off in this build. When you want it, we run a free
**Cloudflare Worker** for it and you paste its URL via the Tampermonkey menu
(**PFC: set AI proxy URL**). Nothing to do now.

## Still to fill
The **clinic location** answer has a `[TEAM: paste address]` note — give me the
real address + timings and I'll finish it (I won't invent one).
