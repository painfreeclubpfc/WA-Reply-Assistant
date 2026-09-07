/* Build the standalone (gist-ready) userscript from the template.
 *
 * Template pfc-reply-assistant.user.js carries placeholders for a server-hosted
 * build; the standalone version instead ships blank PROXY_BASE (set via the
 * Tampermonkey menu), an open @connect, gist auto-update placeholders, and the
 * FAQ inlined. Writes dist/pfc-reply-assistant.standalone.user.js.
 *
 * Run:  node build-userscript.mjs   (from the repo root)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const tpl = readFileSync(join(root, "pfc-reply-assistant.user.js"), "utf8");
const faq = readFileSync(join(root, "faq.json"), "utf8").trim();

let out = tpl
  .replaceAll("__PROXY_BASE__/pfc-reply-assistant.user.js", "REPLACE_WITH_YOUR_GIST_RAW_URL")
  .replaceAll('"__PROXY_BASE__"', '""')
  .replaceAll("__PROXY_HOST__", "*")
  .replace("__FAQ_JSON__", () => faq);

if (out.includes("__PROXY_BASE__") || out.includes("__PROXY_HOST__") || out.includes("__FAQ_JSON__")) {
  throw new Error("placeholder left unreplaced — check the template");
}

const dest = join(root, "dist", "pfc-reply-assistant.standalone.user.js");
writeFileSync(dest, out);
console.log(`Built ${dest} (${out.length} bytes)`);
