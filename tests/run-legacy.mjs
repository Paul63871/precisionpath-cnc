import { build } from "esbuild";
import { readdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
const root = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "precisionpath-tests-"));
const receipt = [];
try {
  for (const file of (await readdir("tests/legacy")).filter((s) => s.endsWith(".mjs")).sort()) {
    const bundle = await build({
      entryPoints: [resolve("tests/legacy", file)], write: false, bundle: true, platform: "node", format: "esm",
      plugins: [{ name: "resolve-engine-fixtures", setup(b) {
        b.onResolve({ filter: /^\.\/(?:cncData|cncEngine|turningData|turningEngine)\.js$/ }, (args) => ({ path: resolve(root, "src/lib", args.path) }));
      } }],
    });
    const target = join(dir, file);
    await writeFile(target, bundle.outputFiles[0].contents);
    const r = spawnSync(process.execPath, [target], { encoding: "utf8", maxBuffer: 12 * 1024 * 1024 });
    const failLines = (r.stdout + r.stderr).split("\n").filter((s) => /FAIL|Error:/.test(s));
    const pass = r.status === 0 && failLines.length === 0;
    receipt.push({ file, status: r.status, pass, errors: failLines.slice(0, 8) });
    console.log(`${pass ? "PASS" : "FAIL"} ${file} (exit ${r.status})`);
    if (!pass) console.log(failLines.slice(0, 8).join("\n"));
  }
} finally { await rm(dir, { recursive: true, force: true }); }
await writeFile("tests/legacy-results.json", JSON.stringify(receipt, null, 2));
if (receipt.some((s) => !s.pass)) process.exitCode = 1;
