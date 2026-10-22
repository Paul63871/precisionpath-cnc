// Mechanical packaging for the opaque-origin attached preview. Keep production
// Base44 builds unchanged. External ES modules require CORS; embed the already
// bundled module and CSS so the preview can execute without that request.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
let html = await readFile("dist/index.html", "utf8");
const js = html.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/);
const css = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
if (!js || !css) throw new Error("Preview bundle tags not found");
const code = (await readFile(resolve("dist", js[1]), "utf8")).replace(/<\/script/gi, "<\\/script");
const style = (await readFile(resolve("dist", css[1]), "utf8")).replace(/<\/style/gi, "<\\/style");
// The SDK probes window.localStorage outside its own try/catch at import
// time. In the opaque sandbox that getter throws. Supply only an ephemeral
// in-page compatibility object in this preview, never browser persistence.
const boot = `<script>
(() => {
  for (const key of ["localStorage", "sessionStorage"]) {
    const values = new Map();
    const store = {
      getItem: k => values.get(String(k)) ?? null,
      setItem: (k,v) => values.set(String(k), String(v)),
      removeItem: k => values.delete(String(k)),
      clear: () => values.clear(),
      key: i => [...values.keys()][i] ?? null,
      get length() { return values.size; }
    };
    Object.defineProperty(window, key, { value: store, configurable: true });
  }
})();
</script>`;
html = html.replace(js[0], () => `${boot}<script type="module">${code}</script>`);
html = html.replace(css[0], () => `<style>${style}</style>`);
await writeFile("dist/index.html", html);
