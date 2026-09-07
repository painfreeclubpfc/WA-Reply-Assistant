/* PFC Reply Assistant — AI compose proxy.
 *
 * Holds the Anthropic API key server-side so it never sits in the browser
 * extension. Takes a member's WhatsApp message, asks Claude to pick/adapt one of
 * Pain Free Club's APPROVED answers (grounded only in faq.json), and returns the
 * suggested reply. The extension still only drafts it — a human reviews & sends.
 *
 * Endpoints:
 *   POST /compose  { message: "<member text>" } -> { reply, intent_id, escalate, needs_review }
 *   GET  /health   -> { ok: true }
 *
 * Env:
 *   ANTHROPIC_API_KEY  (required)
 *   MODEL              (default claude-haiku-4-5)
 *   PORT               (default 8787)
 *   ALLOWED_ORIGIN     (default https://web.whatsapp.com)
 *   SHARED_SECRET      (optional; if set, the extension must send it as x-pfc-key)
 */
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL = process.env.MODEL || "claude-haiku-4-5";
const PORT = parseInt(process.env.PORT || "8787", 10);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://web.whatsapp.com";
const SHARED_SECRET = process.env.SHARED_SECRET || "";

// The proxy also hosts the userscript + answers, which need no key. Only the
// AI "Compose" button needs a key — so start either way, and disable AI if unset.
const AI_ENABLED = !!process.env.ANTHROPIC_API_KEY;
const anthropic = AI_ENABLED ? new Anthropic() : null; // reads ANTHROPIC_API_KEY
if (!AI_ENABLED) {
  console.warn("ANTHROPIC_API_KEY not set — hosting userscript/answers only; AI compose disabled.");
}

// ---- load the approved answer bank + userscript once --------------------
// These are copied into this folder by sync.mjs (runs on `npm install`), so the
// proxy is self-contained and deploys cleanly with its Root Directory = proxy.
// Fall back to the extension-root copies when running from a full checkout.
function loadFirst(...names) {
  for (const n of names) {
    try { return readFileSync(n, "utf8"); } catch (_) {}
  }
  return "";
}
const FAQ_RAW = loadFirst(
  path.join(__dirname, "faq.json"),
  path.join(__dirname, "..", "faq.json")
);
const FAQ = JSON.parse(FAQ_RAW);
const USERSCRIPT_TEMPLATE = loadFirst(
  path.join(__dirname, "pfc-reply-assistant.user.js"),
  path.join(__dirname, "..", "pfc-reply-assistant.user.js")
);
const ANSWER_BANK = FAQ.intents
  .map(
    (i) =>
      `### id: ${i.id}  (category: ${i.category})\n${i.answer || "(no approved answer yet — escalate)"}`
  )
  .join("\n\n");

const SYSTEM_PROMPT = `You are the Pain Free Club (PFC) WhatsApp support assistant. You draft a reply for a HUMAN to review and send — you are never the final word.

You may ONLY reply using the APPROVED ANSWERS below. Pick the single best-matching answer for the member's message and return it. You may lightly adjust greeting/wording to fit the member's tone, but:
- Keep every link, phone number, price and fact EXACTLY as written in the approved answer. Never invent or alter a URL, address, price, or number.
- Never give medical advice, a diagnosis, a drug/dosage, or interpret a scan/report. If the message is about symptoms, pain severity, reports (MRI/X-ray), surgery, injections, medicines, or "what should I do for my knee", use the safety_medical answer and set escalate=true.
- If no approved answer reasonably fits, set escalate=true and leave reply empty.
- Keep placeholders like [time], [name], [paste today's Zoom link] intact for the human to fill.

APPROVED ANSWERS:
${ANSWER_BANK}

Respond with STRICT JSON only, no prose, no code fences:
{"intent_id": "<id or null>", "reply": "<the suggested reply text, or empty string>", "escalate": <true|false>, "needs_review": <true|false>}
Set needs_review=true whenever the chosen answer's id is safety_medical, appointment, or location, or whenever you are unsure.`;

// ---- helpers ------------------------------------------------------------
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-pfc-key");
  res.setHeader("Vary", "Origin");
}
function sendJson(res, code, obj) {
  cors(res);
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}
function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {}
  const m = text && text.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch (_) {}
  }
  return null;
}

async function compose(message) {
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Member's message:\n"""${message}"""` }],
  });
  const text = (resp.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const parsed = extractJson(text) || {};
  return {
    reply: typeof parsed.reply === "string" ? parsed.reply : "",
    intent_id: parsed.intent_id || null,
    escalate: parsed.escalate === true,
    needs_review: parsed.needs_review === true,
  };
}

// ---- server -------------------------------------------------------------
const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    return res.end();
  }
  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { ok: true, model: MODEL });
  }
  // Live answer bank (handy for debugging / future live-fetch).
  if (req.method === "GET" && req.url === "/faq.json") {
    cors(res);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(FAQ_RAW);
  }
  // Serve the Tampermonkey userscript with its own URL + the current answers
  // injected, so Tampermonkey auto-updates every install when we redeploy.
  if (req.method === "GET" && req.url.split("?")[0] === "/pfc-reply-assistant.user.js") {
    if (!USERSCRIPT_TEMPLATE) return sendJson(res, 404, { error: "userscript not bundled" });
    const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
    const host = req.headers.host || `localhost:${PORT}`;
    const base = `${proto}://${host}`;
    const body = USERSCRIPT_TEMPLATE
      .split("__FAQ_JSON__").join(FAQ_RAW)
      .split("__PROXY_BASE__").join(base)
      .split("__PROXY_HOST__").join(host);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    return res.end(body);
  }
  if (req.method === "POST" && req.url === "/compose") {
    if (!AI_ENABLED) return sendJson(res, 503, { error: "AI not configured" });
    if (SHARED_SECRET && req.headers["x-pfc-key"] !== SHARED_SECRET) {
      return sendJson(res, 401, { error: "unauthorized" });
    }
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 20000) req.destroy(); // guard
    });
    req.on("end", async () => {
      let message = "";
      try { message = (JSON.parse(body).message || "").toString().slice(0, 4000); }
      catch (_) { return sendJson(res, 400, { error: "bad json" }); }
      if (!message.trim()) return sendJson(res, 400, { error: "empty message" });
      try {
        const out = await compose(message);
        return sendJson(res, 200, out);
      } catch (e) {
        console.error("compose error:", e && e.message);
        return sendJson(res, 502, { error: "compose failed" });
      }
    });
    return;
  }
  sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`PFC Reply Assistant proxy on :${PORT} (model ${MODEL}, origin ${ALLOWED_ORIGIN})`);
});
