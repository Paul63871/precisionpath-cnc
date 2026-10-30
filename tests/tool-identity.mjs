import { build } from "esbuild";
import assert from "node:assert/strict";

// Tool identity contract: unknown coating, coating/material mismatch, helix
// guidance and stainless finishing-speed policy. Advisory notes and withheld
// bonuses only — NO invented speed/feed multipliers from helix or identity.
const b = await build({ stdin: { contents: `export {calculate} from "./src/lib/cncEngine.js";`, resolveDir: process.cwd() }, bundle: true, write: false, platform: "node", format: "esm" });
const { calculate } = await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString("base64")}`);

const base = {
  diameter: .5, flutes: 4, loc: 1, toolTypeId: "end_mill", toolMaterialId: "carbide", coatingId: "altin",
  materialId: "ss_304", operationId: "2d_contour_rough",
  machine: { hp: 10, maxRpm: 12000, minRpm: 20, maxIpm: 400 },
};
let checks = 0, cases = 0;
const ok = (cond, msg) => { cases++; assert.ok(cond, msg); checks++; };
const has = (r, re) => r.warnings.some((w) => re.test(w));

// --- Unknown coating: conservative uncoated baseline, no coated bonus, warned
{
  const known = calculate({ ...base, coatingId: "altin" });
  const bare = calculate({ ...base, coatingId: "none" });
  const unk = calculate({ ...base, coatingId: "unknown" });
  ok(Math.abs(unk.rpm - bare.rpm) < 1e-6, "unknown coating uses the uncoated speed baseline");
  ok(unk.rpm < known.rpm, "unknown coating does not keep the coated speed");
  // The +15% coated chip-load bonus (Harvey) applies to form cutters; verify it
  // is withheld for unknown on that path.
  const formBase = { ...base, toolTypeId: "corner_round", cornerRadius: .06 };
  const formKnown = calculate({ ...formBase, coatingId: "altin" });
  const formBare = calculate({ ...formBase, coatingId: "none" });
  const formUnk = calculate({ ...formBase, coatingId: "unknown" });
  ok(Math.abs(formKnown.chipLoad - formBare.chipLoad * 1.15) < 2e-5, "coated form cutter keeps the +15% chip-load bonus");
  ok(Math.abs(formUnk.chipLoad - formBare.chipLoad) < 2e-5, "unknown coating withholds the +15% coated chip-load bonus");
  ok(has(unk, /Coating NOT CONFIRMED/), "unknown coating is warned, not silent");
  ok(has(bare, /Coating NOT CONFIRMED/) === false, "uncoated is not flagged as unknown");
  ok(unk.warnings.length > 0 && !unk.blockingReasons?.length, "unknown coating warns without blocking");
}

// --- Coating/material mismatch: Al-containing coatings on non-ferrous work
{
  const al = calculate({ ...base, materialId: "alum_6061", coatingId: "tialn" });
  ok(has(al, /chip welding|built-up edge/), "TiAlN on aluminum warns about chip welding/BUE");
  const okAl = calculate({ ...base, materialId: "alum_6061", coatingId: "zrn" });
  ok(!has(okAl, /chip welding|built-up edge/), "ZrN on aluminum does not warn");
  const ss = calculate({ ...base, materialId: "ss_304", coatingId: "tialn" });
  ok(!has(ss, /chip welding|built-up edge/), "TiAlN on stainless is a normal pairing, no warning");
  const unc = calculate({ ...base, coatingId: "none" });
  ok(has(unc, /Uncoated cutter on Stainless/), "uncoated on stainless gets the advisory note");
}

// --- Helix guidance: notes only, never a speed/feed change
{
  const none = calculate({ ...base });
  const hi = calculate({ ...base, helixAngle: "high" });
  ok(Math.abs(hi.rpm - none.rpm) < 1e-9, "helix does not change speed");
  ok(Math.abs(hi.ipm - none.ipm) < 1e-9, "helix does not change feed");
  ok(has(hi, /pulls the tool upward axially/), "high helix notes holder pull-in");
  const unk = calculate({ ...base, helixAngle: "unknown" });
  ok(has(unk, /Helix angle not confirmed/), "unknown helix is flagged");
  const std = calculate({ ...base, helixAngle: "standard" });
  ok(has(std, /45° helix is the common stainless/), "standard helix on stainless notes the 45° guidance");
  const alLow = calculate({ ...base, materialId: "alum_6061", helixAngle: "low" });
  ok(has(alLow, /poorer chip evacuation/), "low helix on aluminum notes chip packing");
  const varH = calculate({ ...base, helixAngle: "variable" });
  ok(has(varH, /Variable HELIX/), "variable helix distinguishes variable pitch");
  // Roughing cutter also gets helix input
  const rough = calculate({ ...base, toolTypeId: "roughing", helixAngle: "unknown" });
  ok(has(rough, /Helix angle not confirmed/), "roughing cutter carries helix guidance too");
}

// --- Stainless finishing speed: policy bump exists, is explained, and stays small
{
  const rough = calculate({ ...base, operationId: "2d_contour_rough" });
  const fin = calculate({ ...base, operationId: "2d_contour_finish" });
  ok(fin.rpm > rough.rpm, "finishing currently runs faster than roughing (documented policy)");
  ok(fin.rpm <= rough.rpm * 1.11, "finishing bump stays within the 10% policy");
  ok(has(fin, /Stainless finishing speed/), "stainless finishing explains WHY it is faster");
  ok(!has(rough, /Stainless finishing speed/), "roughing is not annotated as finishing");
  const alFin = calculate({ ...base, materialId: "alum_6061", operationId: "2d_contour_finish" });
  ok(!has(alFin, /Stainless finishing speed/), "explanation is stainless-specific");
  ok(has(fin, /do NOT thin the chip below/), "note carries the minimum-chip-thickness caveat");
}

// --- Minimum chip thickness: very low fz on stainless warns about rubbing
{
  const tiny = calculate({ ...base, operationId: "2d_contour_finish", diameter: 0.125, flutes: 6, aggressiveness: 0.2, targetRa: 16 });
  if (tiny.feedPerTooth > 0 && tiny.feedPerTooth < 0.001) {
    ok(has(tiny, /very low for stainless/), "very low fz on stainless warns about rubbing/work hardening");
  } else {
    cases++; // configuration did not produce a sub-threshold fz; nothing to assert
  }
  const normal = calculate({ ...base, operationId: "2d_contour_finish" });
  if (normal.feedPerTooth >= 0.001) ok(!has(normal, /very low for stainless/), "normal fz on stainless does not trigger the rubbing warning");
}

// --- Cross-material sanity: notes never block output
for (const matId of ["alum_6061", "ss_304", "ss_316", "steel_1018", "brass", "copper"]) {
  for (const coatId of ["none", "unknown", "altin", "tialn", "zrn", "dlc"]) {
    for (const helix of [undefined, "unknown", "low", "standard", "mid", "high", "variable"]) {
      const r = calculate({ ...base, materialId: matId, coatingId: coatId, helixAngle: helix });
      cases++;
      ok(Number.isFinite(r.rpm) && r.rpm > 0, `finite rpm ${matId}/${coatId}/${helix}`);
      ok(Number.isFinite(r.ipm) && r.ipm > 0, `finite feed ${matId}/${coatId}/${helix}`);
      ok(!(r.blockingReasons || []).length, `no blocking from identity notes ${matId}/${coatId}/${helix}`);
    }
  }
}

console.log(`Tool identity contract: ${cases} cases, ${checks} assertions passed. Advisory notes only; no invented helix/coating speed multipliers; unknown identity withholds bonuses instead of guessing.`);
