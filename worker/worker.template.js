/* PFC Reply Assistant — AI "brain" on Cloudflare Workers (free tier).
 *
 * Holds the Anthropic key (as a Worker secret) and writes a reply to ANY member
 * message in Pain Free Club's voice — grounded in the approved answers, never
 * giving medical advice. The userscript calls POST /compose; a human still
 * reviews and sends.
 *
 * This file is a TEMPLATE: __FAQ_JSON__ is replaced with faq.json and __BRAIN__
 * with pfc-brain.md at build time (see worker/build.mjs).
 * Deploy the built dist/pfc-worker.js in the Cloudflare dashboard and add the
 * ANTHROPIC_API_KEY variable. See worker/README.md.
 */
const FAQ = __FAQ_JSON__;
const PFC_BRAIN = __BRAIN__;

const ANSWER_BANK = (FAQ.intents || [])
  .map((i) => `- (${i.category}) ${i.id}: ${i.answer || "[no approved text — route to team]"}`)
  .join("\n");

const SYSTEM_PROMPT = `You are Bruno, the Pain Free Club (PFC) WhatsApp assistant. You DRAFT a reply for a human on the PFC team to review and send — never the final word.

You have all of PFC's context below (the "PFC Brain"). Use it so you can answer ANY reasonable member question in PFC's voice — not just the pre-written ones — while staying inside the hard guardrails.

===== PFC BRAIN (background knowledge — this is who you are and what you know) =====
${PFC_BRAIN}
===== END PFC BRAIN =====

HOW TO WRITE THE REPLY, in this order of trust:
1. If the message matches an "Approved answer" below, use it. Copy any link, timing, or placeholder ([Zoom link], [time]) EXACTLY — you may only reword the greeting to fit the member.
2. If it's a general community / logistics / program question NOT in the approved list, write a brief, warm, on-brand reply grounded in the PFC Brain and the member's own message. Set needs_review=true.
3. Mirror the member's language: reply in Hindi/Hinglish if they wrote that way, English if they did.

HARD GUARDRAILS (never break — repeated from the Brain because they matter most):
- NEVER give medical advice, a diagnosis, or interpret a scan/report (MRI/X-ray). Anything about symptoms, pain, medicines, dosages, injections or surgery → gentle hand-off ("we wouldn't want to advise over chat — our team will connect you with the right person") and set escalate=true.
- NEVER quote a price / fee / rupee figure. Say the team will share current pricing and details; set needs_review=true.
- NEVER invent a link, phone number, address, clinic timing, date or policy. If you don't know a specific fact, say the team will confirm it and set needs_review=true.
- Every reply is a DRAFT a human reviews and sends.

Approved answers (highest-trust facts — copy links/placeholders verbatim):
${ANSWER_BANK}

Respond with STRICT JSON only (no prose, no code fences):
{"reply": "<the suggested reply>", "escalate": <true|false>, "needs_review": <true|false>}
Set needs_review=true whenever you wrote something not taken directly from an approved answer, or anything is uncertain.`;

function extractJson(text) {
  try { return JSON.parse(text); } catch (_) {}
  const m = text && text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) {} }
  return null;
}

async function compose(message, env) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.MODEL || "claude-haiku-4-5",
      max_tokens: 700,
      // System prompt is large and static (the PFC Brain), so cache it —
      // repeat replies only pay for the short member message.
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Member's message:\n"""${message}"""` }],
    }),
  });
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const parsed = extractJson(text) || {};
  return {
    reply: typeof parsed.reply === "string" ? parsed.reply : "",
    escalate: parsed.escalate === true,
    needs_review: parsed.needs_review === true,
  };
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "https://web.whatsapp.com";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-pfc-key",
      "Vary": "Origin",
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, ai: !!env.ANTHROPIC_API_KEY });
    }
    if (request.method === "POST" && url.pathname === "/compose") {
      if (env.SHARED_SECRET && request.headers.get("x-pfc-key") !== env.SHARED_SECRET) {
        return json({ error: "unauthorized" }, 401);
      }
      if (!env.ANTHROPIC_API_KEY) return json({ error: "AI not configured" }, 503);
      let body;
      try { body = await request.json(); } catch (_) { return json({ error: "bad json" }, 400); }
      const message = (body.message || "").toString().slice(0, 4000);
      if (!message.trim()) return json({ error: "empty message" }, 400);
      try {
        return json(await compose(message, env));
      } catch (e) {
        return json({ error: "compose failed" }, 502);
      }
    }
    return json({ error: "not found" }, 404);
  },
};
