/* Copy the canonical faq.json + userscript from the extension root into this
 * proxy folder so the proxy is self-contained for deployment. Runs on
 * `npm install` (postinstall) and via `npm run sync`. Safe to run anywhere:
 * if the source files aren't present (already-bundled deploy), it just skips.
 */
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = ["faq.json", "pfc-reply-assistant.user.js"];

for (const f of files) {
  const src = path.join(dir, "..", f);
  const dst = path.join(dir, f);
  try {
    if (existsSync(src)) {
      copyFileSync(src, dst);
      console.log("synced", f);
    } else {
      console.log("skip (no source, using bundled copy):", f);
    }
  } catch (e) {
    console.log("skip", f, "-", e.message);
  }
}
