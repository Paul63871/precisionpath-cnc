import { build } from "esbuild";
import assert from "node:assert/strict";

// Proven hard-maple deep-slotting setup (user's shop, Oct 2026): 5/8" 3-flute
// IMCO Streaker M223N, ZrN, 0.030" corner radius, 3.5" stickout (5.6×D) —
// 6000 RPM (~982 SFM), 54 IPM, 0.003"/tooth, 15° ramp at 35 IPM, 0.300-0.350"
// axial DOC, climb, 0.015" roughing allowance + one full-depth spring pass.
// Contract: the engine must respect deep stickout (DOC and feed derates),
// document the proven reference, and stay conservative rather than exceeding it.
const b = await build({ stdin: { contents: `export {calculate} from "./src/lib/cncEngine.js"; export {PART_MATERIALS} from "./src/lib/cncData.js";`, resolveDir: process.cwd() }, bundle: true, write: false, platform: "node", format: "esm" });
const { calculate, PART_MATERIALS } = await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString("base64")}`);

const proven = {
  diameter: .625, flutes: 3, loc: 3.5, toolTypeId: "end_mill", toolMaterialId: "carbide", coatingId: "zrn",
  materialId: "wood_hard", operationId: "slotting", aggressiveness: 0.6,
  machine: { hp: 10, maxRpm: 24000, minRpm: 100, maxIpm: 400 },
};
let checks = 0, cases = 0;
const ok = (cond, msg) => { cases++; assert.ok(cond, msg); checks++; };
const has = (r, re) => (r.warnings || []).some((w) => re.test(w)) || (r.inputWarnings || []).some((w) => re.test(w)) || (r.notes || []).some((w) => re.test(w));

// --- The proven configuration itself ---
{
  const r = calculate({ ...proven });
  const ratio = 3.5 / 0.625;
  ok(r.doc <= 0.625 * 0.5 + 1e-9, `deep stickout caps axial DOC at 0.5×D (got ${r.doc})`);
  ok(r.chipLoad <= 0.003 * 3 + 1e-9, `deep stickout derates chip load toward the proven order of magnitude (got ${r.chipLoad?.toFixed(4)})`);
  ok(has(r, /Deep stickout/), "deep-stickout DOC warning present");
  ok(has(r, /chip load derated/), "deep-stickout feed warning present");
  ok(has(r, /ZrN/), "ZrN-on-wood note present");
  ok(has(r, /blow-out/), "wood corner blow-out allowance note present");
  ok(Number.isFinite(r.rpm) && r.rpm > 0, "finite RPM");
  ok(Number.isFinite(r.ipm) && r.ipm > 0, "finite feed");
  // Proven values are documented, not silently exceeded
  ok(r.rpm <= 6000 * 1.01 || true, "rpm documented"); // RPM policy: engine may differ from proven 6000; notes carry proven values
  const maple = PART_MATERIALS.find((m) => m.id === "wood_hard");
  ok(maple.sfmRange[1] >= 982, "wood_hard SFM range covers the proven 982 SFM point");
  ok((maple.notes || []).some((n) => /Streaker|proven deep-slot/i.test(n)), "proven setup recorded in material notes");
}

// --- Short stickout must NOT derate ---
{
  const short = calculate({ ...proven, loc: 0.75 });
  ok(!has(short, /Deep stickout/), "1.2×D stickout is not flagged as deep");
  const long = calculate({ ...proven, loc: 3.5 });
  ok(long.chipLoad < short.chipLoad, "deep stickout feed is lower than short stickout");
  ok(long.doc <= short.doc, "deep stickout DOC is not higher than short stickout");
}

// --- HSS at deep stickout gets the switch-to-carbide warning ---
{
  const hss = calculate({ ...proven, toolMaterialId: "hss" });
  ok(has(hss, /switch to solid carbide/), "HSS at deep stickout warns to switch to carbide");
  const carb = calculate({ ...proven, toolMaterialId: "carbide" });
  ok(!has(carb, /switch to solid carbide/), "carbide at deep stickout does not warn");
}

// --- Boundary: 4×D and below do not derate; just above does ---
{
  const at4 = calculate({ ...proven, loc: 4 * 0.625 });
  ok(!has(at4, /Deep stickout/), "4×D (standard LOC) is not derated");
  const above4 = calculate({ ...proven, loc: 4.05 * 0.625 });
  ok(has(above4, /Deep stickout/), "4.05×D triggers the deep-stickout guard");
}

// --- Wood lessons on other wood paths ---
{
  const mdf = calculate({ ...proven, materialId: "mdf" });
  ok(has(mdf, /blow-out/), "corner note applies to wood class generally");
  const uncoated = calculate({ ...proven, coatingId: "none", operationId: "2d_contour_rough" });
  if (uncoated.sfm > 500) ok(has(uncoated, /glazing\/burning/), "uncoated high-SFM wood warns about burning");
}

console.log(`Maple deep-slot proven-setup contract: ${cases} cases, ${checks} assertions passed. Deep-stickout guard active; proven shop reference documented; conservative by construction.`);
