// Targeted test for the rough/finish facing split.
import { calculate } from "./cncEngine.js";

function run(label, input) {
  const out = calculate(input);
  console.log(`\n--- ${label} ---`);
  console.log(JSON.stringify({
    sfm: out.sfm, rpm: out.rpm, chipLoad: out.chipLoad, ipm: out.ipm,
    woc: out.woc, doc: out.doc, mrr: out.mrr, hpRequired: out.hpRequired,
    warnings: out.warnings,
  }, null, 2));
  return out;
}

const machine = { hp: 10, maxRpm: 12000, minRpm: 100, maxIpm: 300 };
const baseInput = {
  diameter: 1.0, flutes: 4, loc: 3, toolMaterialId: "carbide", coatingId: "altin",
  toolTypeId: "face_mill", materialId: "alum_6061", machine,
};

// 1. Rough vs finish facing on aluminum with a face mill — finish DOC should
//    be a small fraction of rough DOC, chip load lower, SFM slightly higher.
const rough = run("Aluminum, 1\" face mill, Rough Face, agg=0.6", { ...baseInput, operationId: "facing_rough", aggressiveness: 0.6 });
const finish = run("Aluminum, 1\" face mill, Finish Face, agg=0.6", { ...baseInput, operationId: "facing_finish", aggressiveness: 0.6 });

console.assert(finish.doc < rough.doc, "FAIL: finish DOC should be less than rough DOC");
console.assert(finish.doc >= 0.004 && finish.doc <= 0.011, `FAIL: finish DOC ${finish.doc} outside expected 0.005-0.010in light-skim band`);
console.assert(rough.doc > 0.03, `FAIL: rough DOC ${rough.doc} too shallow for a rough pass`);
console.assert(finish.sfm >= rough.sfm, "FAIL: finish SFM should be >= rough SFM (lighter cut tolerates more speed)");
console.assert(finish.chipLoad < rough.chipLoad, "FAIL: finish chip load should be lower than rough for surface quality");
console.assert(finish.woc === rough.woc, "FAIL: woc should stay full-diameter for both (ISCAR 70-80% guidance applies to both stages equally)");

// 2. Steel — rough/finish DOC should scale down vs aluminum's more aggressive
//    material class but keep the same rough > finish ordering.
const roughSteel = run("4140 Steel, 1\" face mill, Rough Face, agg=0.6", { ...baseInput, materialId: "steel_4140", operationId: "facing_rough", aggressiveness: 0.6 });
const finishSteel = run("4140 Steel, 1\" face mill, Finish Face, agg=0.6", { ...baseInput, materialId: "steel_4140", operationId: "facing_finish", aggressiveness: 0.6 });
console.assert(finishSteel.doc < roughSteel.doc, "FAIL: steel finish DOC should be less than rough DOC");

// 3. Small diameter tool — finish DOC should be capped so it never exceeds a
//    sane fraction of a tiny tool's own diameter (guard for e.g. 0.0625" end mill).
const tiny = run("0.0625\" end mill, Aluminum, Finish Face, agg=1.0", { ...baseInput, diameter: 0.0625, toolTypeId: "end_mill", flutes: 2, operationId: "facing_finish", aggressiveness: 1.0 });
console.assert(tiny.doc <= 0.0625 * 0.15 + 1e-9, `FAIL: tiny-tool finish DOC ${tiny.doc} exceeds the 15%-of-diameter guard`);

// 4. Aggressiveness sweep on finish facing — doc should scale between the
//    0.005-0.010 band as aggressiveness goes 0 -> 1 (before any tiny-tool cap).
const finLow = run("1\" face mill, Aluminum, Finish Face, agg=0", { ...baseInput, operationId: "facing_finish", aggressiveness: 0 });
const finHigh = run("1\" face mill, Aluminum, Finish Face, agg=1.0", { ...baseInput, operationId: "facing_finish", aggressiveness: 1.0 });
console.assert(Math.abs(finLow.doc - 0.005) < 1e-6, `FAIL: agg=0 finish DOC should be 0.005, got ${finLow.doc}`);
console.assert(Math.abs(finHigh.doc - 0.010) < 1e-6, `FAIL: agg=1.0 finish DOC should be 0.010, got ${finHigh.doc}`);

console.log("\nAll facing rough/finish tests executed (see asserts above for pass/fail).");
