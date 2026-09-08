/* Build the deployable Cloudflare Worker.
 *
 * Reads worker/worker.template.js and inlines:
 *   __FAQ_JSON__ -> ../faq.json          (the approved answer bank)
 *   __BRAIN__    -> ../pfc-brain.md       (Bruno's member-safe PFC knowledge)
 * Writes ../dist/pfc-worker.js — the single file you paste into the
 * Cloudflare dashboard (Edit code -> paste -> Deploy).
 *
 * Run:  node worker/build.mjs   (from the whatsapp-web-assistant folder)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const template = readFileSync(join(here, "worker.template.js"), "utf8");
const faq = readFileSync(join(root, "faq.json"), "utf8").trim();
const brain = readFileSync(join(root, "pfc-brain.md"), "utf8");
const library = readFileSync(join(root, "library.json"), "utf8").trim();

// Target the assignments specifically (the tokens also appear in the header
// comment). faq/library are already valid JSON literals; the brain is embedded
// as a JS string via JSON.stringify.
const out = template
  .replace("= __FAQ_JSON__;", () => `= ${faq};`)
  .replace("= __BRAIN__;", () => `= ${JSON.stringify(brain)};`)
  .replace("= __LIBRARY_JSON__;", () => `= ${library};`);

for (const ph of ["__FAQ_JSON__;", "__BRAIN__;", "__LIBRARY_JSON__;"]) {
  if (out.includes(ph)) throw new Error(`placeholder ${ph} not replaced — check worker.template.js`);
}

const dest = join(root, "dist", "pfc-worker.js");
writeFileSync(dest, out);
console.log(`Built ${dest} (${out.length} bytes; brain ${brain.length} chars, faq ${faq.length} chars)`);
