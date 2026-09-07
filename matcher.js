/* PFC Reply Assistant — local matcher.
 * No network, nothing leaves the browser. Maps a member's message to one of the
 * approved intents in faq.json. Exposed as window.PFCMatcher.
 *
 * Rules:
 *  - A trigger phrase matches if it appears in the message on word boundaries.
 *  - An intent's score = sum of matched-trigger weights (longer phrases weigh more).
 *  - "Priority" intents (safety / appointment) win whenever they match at all, so
 *    a medical message is never answered with a generic FAQ. Everything else is
 *    chosen by best score.
 */
(function () {
  "use strict";

  function normalize(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[‘’ʼ]/g, "'") // curly apostrophes -> '
      .replace(/[^a-z0-9'\s]/g, " ")          // drop punctuation/emoji
      .replace(/\s+/g, " ")
      .trim();
  }

  function triggerHit(paddedText, trigger) {
    const t = normalize(trigger);
    if (!t) return false;
    return paddedText.indexOf(" " + t + " ") !== -1;
  }

  function scoreIntent(paddedText, intent) {
    let score = 0;
    const hits = [];
    for (const trig of intent.triggers || []) {
      if (triggerHit(paddedText, trig)) {
        const weight = normalize(trig).split(" ").filter(Boolean).length;
        score += weight;
        hits.push(trig);
      }
    }
    return { score, hits };
  }

  // Returns { intent, score, hits } or null.
  function match(text, intents, opts) {
    opts = opts || {};
    const minScore = opts.minScore || 1;
    const priorityFloor = opts.priorityFloor || 90; // intents at/above win when matched
    const paddedText = " " + normalize(text) + " ";

    const matched = [];
    for (const intent of intents || []) {
      const { score, hits } = scoreIntent(paddedText, intent);
      if (score >= minScore) matched.push({ intent, score, hits });
    }
    if (!matched.length) return null;

    // 1) If any high-priority (safety/appointment) intent matched, prefer it.
    const priority = matched
      .filter((m) => (m.intent.priority || 0) >= priorityFloor)
      .sort((a, b) => (b.intent.priority || 0) - (a.intent.priority || 0) || b.score - a.score);
    if (priority.length) return priority[0];

    // 2) Otherwise best score, tie-broken by priority.
    matched.sort(
      (a, b) => b.score - a.score || (b.intent.priority || 0) - (a.intent.priority || 0)
    );
    return matched[0];
  }

  window.PFCMatcher = { normalize, match };
})();
