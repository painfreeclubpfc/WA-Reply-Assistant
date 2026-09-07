/* PFC Reply Assistant — content script for WhatsApp Web.
 *
 * Watches the open chat, reads the latest INCOMING message, matches it against
 * the approved answers in faq.json, and shows an editable "Suggested reply" card.
 * You review/edit and click Insert — it drops the text into WhatsApp's compose
 * box UNSENT. It never sends anything on its own.
 *
 * WhatsApp Web ships no public API, so the DOM selectors below are best-effort
 * and may need updating when WhatsApp changes their site (see README).
 */
(function () {
  "use strict";

  const CARD_ID = "pfc-assistant-card";
  let FAQ = null;
  let SETTINGS = { minScore: 1 };
  let lastSignature = "";       // last incoming message we suggested for
  let dismissedSignature = "";  // message the user dismissed (don't nag)

  // ---- load knowledge base + settings ------------------------------------
  async function boot() {
    try {
      const res = await fetch(chrome.runtime.getURL("faq.json"));
      FAQ = await res.json();
    } catch (e) {
      console.warn("[PFC] could not load faq.json", e);
      return;
    }
    try {
      SETTINGS = await new Promise((r) =>
        chrome.storage.sync.get(
          { minScore: 1, aiEnabled: false, proxyUrl: "", sharedSecret: "" },
          r
        )
      );
    } catch (_) { /* defaults */ }
    startObserving();
  }

  // ---- read the chat ------------------------------------------------------
  function getChatTitle() {
    const h =
      document.querySelector('#main header [title]') ||
      document.querySelector('#main header span[dir="auto"]');
    return h ? (h.getAttribute("title") || h.textContent || "").trim() : "";
  }

  function getLatestIncomingText() {
    const main = document.querySelector("#main");
    if (!main) return "";
    const incoming = main.querySelectorAll(".message-in");
    if (!incoming.length) return "";
    const last = incoming[incoming.length - 1];
    // Prefer the selectable text span; fall back to the row's innerText.
    const span =
      last.querySelector("span.selectable-text") ||
      last.querySelector(".copyable-text span") ||
      last;
    let text = (span.innerText || span.textContent || "").trim();
    // strip a trailing time stamp like "10:34 pm" that can leak into innerText
    text = text.replace(/\s*\b\d{1,2}:\d{2}\s?(am|pm)?\.?$/i, "").trim();
    return text;
  }

  // ---- insert into WhatsApp's compose box --------------------------------
  function getComposeBox() {
    return (
      document.querySelector('#main footer div[contenteditable="true"]') ||
      document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
      document.querySelector('#main div[contenteditable="true"]')
    );
  }

  function insertText(text) {
    const box = getComposeBox();
    if (!box) return false;
    box.focus();
    // Paste-event injection preserves line breaks in WhatsApp's editor.
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      const ev = new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      box.dispatchEvent(ev);
      if (box.textContent && box.textContent.length) return true;
    } catch (_) { /* fall through */ }
    // Fallback: execCommand insertText.
    try {
      document.execCommand("insertText", false, text);
      return true;
    } catch (_) {
      return false;
    }
  }

  // ---- the suggestion card ------------------------------------------------
  function removeCard() {
    const el = document.getElementById(CARD_ID);
    if (el) el.remove();
  }

  function renderCard(result, incomingText) {
    removeCard();
    const intent = result.intent;

    const card = document.createElement("div");
    card.id = CARD_ID;

    const head = document.createElement("div");
    head.className = "pfc-head";
    head.innerHTML =
      '<span class="pfc-dot"></span><span class="pfc-title">PFC Reply Assistant</span>' +
      '<span class="pfc-cat">' + escapeHtml(intent.category || "") + "</span>";
    const close = document.createElement("button");
    close.className = "pfc-x";
    close.textContent = "×";
    close.title = "Dismiss";
    close.onclick = () => {
      dismissedSignature = lastSignature;
      removeCard();
    };
    head.appendChild(close);
    card.appendChild(head);

    const meta = document.createElement("div");
    meta.className = "pfc-meta";
    meta.textContent = "Detected: " + truncate(incomingText, 90);
    card.appendChild(meta);

    if (intent.needs_answer) {
      const warn = document.createElement("div");
      warn.className = "pfc-warn";
      warn.textContent =
        intent.category === "Safety"
          ? "⚠ Medical/clinical — do not advise. Suggesting a safe hand-off; review before sending."
          : "⚠ No approved answer yet — review/edit before sending.";
      card.appendChild(warn);
    }

    const ta = document.createElement("textarea");
    ta.className = "pfc-text";
    ta.value = intent.answer || "";
    ta.rows = Math.min(12, (intent.answer || "").split("\n").length + 2);
    card.appendChild(ta);

    const actions = document.createElement("div");
    actions.className = "pfc-actions";

    const insertBtn = button("Insert into chat", "pfc-primary", () => {
      const ok = insertText(ta.value);
      if (ok) {
        insertBtn.textContent = "Inserted ✓";
        setTimeout(removeCard, 700);
      } else {
        insertBtn.textContent = "Couldn't insert — Copy instead";
      }
    });
    const copyBtn = button("Copy", "", async () => {
      try {
        await navigator.clipboard.writeText(ta.value);
        copyBtn.textContent = "Copied ✓";
        setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
      } catch (_) {
        copyBtn.textContent = "Copy failed";
      }
    });
    const aiReady = SETTINGS.aiEnabled && SETTINGS.proxyUrl;
    const aiBtn = button("Compose with AI", aiReady ? "" : "pfc-ghost", null);
    if (!aiReady) {
      aiBtn.disabled = true;
      aiBtn.title = "Turn on AI compose in the extension Options and set a Proxy URL.";
    } else {
      aiBtn.title = "Ask Claude for a reply grounded in the approved answers.";
      aiBtn.onclick = async () => {
        aiBtn.disabled = true;
        const original = aiBtn.textContent;
        aiBtn.textContent = "Composing…";
        try {
          const out = await composeWithAI(incomingText);
          if (out && out.reply) {
            ta.value = out.reply;
            ta.rows = Math.min(14, out.reply.split("\n").length + 2);
          } else if (out && out.escalate) {
            ta.value =
              "Thank you for reaching out 🙏 Let me get the right person from our team to help you with this. Could you share your name and the best time to reach you?";
          }
          if (out && out.needs_review) {
            let w = card.querySelector(".pfc-warn");
            if (!w) {
              w = document.createElement("div");
              w.className = "pfc-warn";
              ta.parentNode.insertBefore(w, ta);
            }
            w.textContent = "⚠ AI draft — review carefully before sending.";
          }
          aiBtn.textContent = original;
        } catch (e) {
          aiBtn.textContent = "AI failed — check proxy";
        } finally {
          aiBtn.disabled = false;
        }
      };
    }

    actions.appendChild(insertBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(aiBtn);
    card.appendChild(actions);

    const foot = document.createElement("div");
    foot.className = "pfc-foot";
    foot.textContent = "Drafts only — you review & press send.";
    card.appendChild(foot);

    document.body.appendChild(card);
  }

  function button(label, cls, onclick) {
    const b = document.createElement("button");
    b.className = "pfc-btn " + (cls || "");
    b.textContent = label;
    if (onclick) b.onclick = onclick;
    return b;
  }

  // ---- main loop ----------------------------------------------------------
  function refresh() {
    if (!FAQ) return;
    const incoming = getLatestIncomingText();
    if (!incoming) return;
    const signature = getChatTitle() + "||" + incoming;
    if (signature === lastSignature) return;   // nothing new
    lastSignature = signature;
    if (signature === dismissedSignature) return;

    const result = PFCMatcher.match(incoming, FAQ.intents, {
      minScore: SETTINGS.minScore || 1,
    });
    if (result) renderCard(result, incoming);
    else removeCard();
  }

  function startObserving() {
    let timer = null;
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 400);
    };
    const mo = new MutationObserver(debounced);
    mo.observe(document.body, { childList: true, subtree: true });
    debounced();
  }

  // ---- AI compose (Phase 2, via key-holding proxy) ------------------------
  async function composeWithAI(message) {
    const base = (SETTINGS.proxyUrl || "").replace(/\/+$/, "");
    const headers = { "Content-Type": "application/json" };
    if (SETTINGS.sharedSecret) headers["x-pfc-key"] = SETTINGS.sharedSecret;
    const res = await fetch(base + "/compose", {
      method: "POST",
      headers,
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error("proxy " + res.status);
    return res.json();
  }

  // ---- helpers ------------------------------------------------------------
  function truncate(s, n) {
    s = s || "";
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }
  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  boot();
})();
