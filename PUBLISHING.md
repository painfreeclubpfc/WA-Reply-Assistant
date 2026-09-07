# Publishing the PFC Reply Assistant privately (Chrome Web Store, Unlisted)

Goal: your team installs the extension from a **private link in one click**, it
**auto-updates**, and nobody manages loose files on their laptop. The source
stays in GitHub; the store just hosts the installable build.

**Unlisted** = it does NOT show up in search or the public store. Only people who
have the link (your team) can find and install it.

## What you need
- A Google account (use a PFC one).
- A **one-time $5** developer-registration fee (Google charges this once, ever).
- The packaged file: **`dist/pfc-reply-assistant-extension.zip`** (already built
  in this folder — that's the exact file you upload).

## Steps
1. Go to the **Chrome Web Store Developer Dashboard**:
   https://chrome.google.com/webstore/devconsole
2. Sign in → pay the **one-time $5** registration if prompted.
3. Click **Add new item** → **upload** `dist/pfc-reply-assistant-extension.zip`.
4. Fill the store listing (minimum needed):
   - **Description:** *Suggests Pain Free Club's approved replies while you chat
     on WhatsApp Web. Drafts only — you review and press send. Internal team
     tool.*
   - **Category:** Productivity.
   - **Icon:** already inside the zip (128×128). If it asks for a store icon,
     use `icons/icon128.png`.
   - **Screenshot:** take one 1280×800 screenshot of the card on WhatsApp Web
     (required — one is enough).
   - **Privacy:** it collects no data and sends nothing anywhere in Phase 1;
     with AI on, the message text goes only to your own proxy. Tick that it does
     not sell/transfer data.
5. Under **Visibility**, choose **Unlisted**.
6. **Submit for review.** Approval usually takes ~1–3 days. Google emails you.
7. When approved, you get a store URL. **Send that link to the team** → each
   person clicks **Add to Chrome** once. Done — no folders, no Developer mode.

## Updating later (when we change answers or fix selectors)
1. I bump the `version` in `manifest.json` and rebuild the zip (kept in GitHub).
2. You upload the new zip in the dashboard → **Submit**.
3. Everyone's extension **auto-updates** within a few hours. No reinstall.

## Note on the AI proxy
Phase 2's proxy (`proxy/`) is separate and already hosted off-laptop (Railway) —
publishing the extension doesn't change that. Team members just enter the proxy
URL once in the extension's Options.

## If you don't want to use the store at all
The only alternative is the per-laptop "Load unpacked" method in `README.md`
(files live on each machine). There is no way to run a browser extension without
it being installed in a browser somewhere — that's a browser rule, not our
choice.
