/* PFC Reply Assistant — settings page logic. */
const el = (id) => document.getElementById(id);

const DEFAULTS = { minScore: 1, aiEnabled: false, proxyUrl: "", sharedSecret: "" };

chrome.storage.sync.get(DEFAULTS, (s) => {
  el("minScore").value = s.minScore;
  el("aiEnabled").checked = !!s.aiEnabled;
  el("proxyUrl").value = s.proxyUrl || "";
  el("sharedSecret").value = s.sharedSecret || "";
});

el("save").addEventListener("click", () => {
  const cfg = {
    minScore: Math.max(1, Math.min(6, parseInt(el("minScore").value, 10) || 1)),
    aiEnabled: el("aiEnabled").checked,
    proxyUrl: el("proxyUrl").value.trim().replace(/\/+$/, ""),
    sharedSecret: el("sharedSecret").value.trim(),
  };
  chrome.storage.sync.set(cfg, () => {
    el("saved").textContent = "Saved ✓ (reload WhatsApp Web tab)";
    setTimeout(() => (el("saved").textContent = ""), 2500);
  });
});
