import { build } from "esbuild";
import assert from "node:assert/strict";
const b = await build({ stdin: { contents: `export {calculate} from "./src/lib/cncEngine.js"; export {PART_MATERIALS} from "./src/lib/cncData.js";`, resolveDir: process.cwd() }, bundle: true, write: false, platform: "node", format: "esm" });
const { calculate, PART_MATERIALS } = await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString("base64")}`);
const base = {
  diameter: .5, flutes: 4, loc: 1, toolTypeId: "end_mill", toolMaterialId: "carbide", coatingId: "altin",
  materialId: "alum_6061", operationId: "2d_bore_rough", featureDiameter: .9, pilotDiameter: .7, featureDepth: .5,
  machine: { hp: 10, maxRpm: 12000, minRpm: 20, maxIpm: 400 }, entryMethod: "predrilled",
  camWorkflow: "hsmworks_bore", hsmVerifyKey: "test-input-revision",
  hsmBore: { verifiedFor: "test-input-revision", stockState: "pilot", maxRampAngle: 1, toolApproved: true, geometryVerified: true, postVerified: true, passesVerified: true },
};
let checks = 0, cases = 0;
const ok = (x, msg) => { checks++; assert.ok(x, msg); };
const near = (x, y, msg, tol = 1e-7) => ok(Math.abs(x-y) < tol, `${msg}: ${x} vs ${y}`);
const checkReady = (p) => {
  cases++;
  const r = calculate(p), h = r.hsmBore;
  if (!h.ready) return r;
  const f = h.fields;
  ok(r.runnable, "ready sheet marks parent runnable");
  for (const [k, v] of Object.entries(f)) if (typeof v === "number") ok(Number.isFinite(v) && v >= 0, `finite field ${k}`);
  ok(f.cuttingFeedrate <= p.machine.maxIpm, "feed cap");
  ok(f.spindleSpeed <= p.machine.maxRpm, "RPM cap");
  near(f.feedPerTooth * f.spindleSpeed * p.flutes, f.cuttingFeedrate, "HSM cutting feed/FPT linkage");
  near(f.plungeFeedPerRev * f.spindleSpeed, f.plungeFeedrate, "HSM PLUNGE feed/IPR linkage");
  near(f.rampFeedrate, f.cuttingFeedrate, "same conservative cutting and ramp feeds");
  near(f.leadInFeedrate, f.rampFeedrate, "no high unverified lead feed");
  near(f.rampSpindleSpeed, f.spindleSpeed, "one RPM basis");
  ok(h.angleDeg <= p.hsmBore.maxRampAngle + 1e-9, "exact tool ramp limit");
  ok(h.hpRequired <= h.hpBudget + 1e-7, "actual bore-volume power bounded");
  ok(h.pitch <= r.doc + 1e-9, "pitch no larger than modeled axial bound");
  near(h.pitch, h.maxPitch, "auto pitch uses minimum orbit bound");
  near(h.minPathDiameter, h.firstCutDiameter - p.diameter, "centerline versus hole diameter");
  const reconstructed = h.firstCutDiameter + 2 * (h.radialPasses - 1) * h.stepover;
  near(reconstructed, h.cutDiameter, "pass geometry reconstructs final cutting diameter");
  if (h.solid) {
    ok(h.firstCutDiameter <= 2*p.diameter, "no uncut central core");
    ok(h.firstCutDiameter >= 1.2*p.diameter, "generic solid clearance floor");
    ok(h.stepover <= .1*p.diameter + 1e-8, "subsequent solid ring steps bounded");
  } else ok(h.stepover <= r.woc + 1e-8, "existing-hole actual step bounded");
  for (const s of r.companionFinish?.steps || []) if (s.result.hsmBore?.ready) {
    const c = s.result.hsmBore;
    ok(c.fields.radialStockToLeave === 0 && !c.fields.stockToLeave, "every linked finish zeroes stock");
    ok(c.hpRequired <= c.hpBudget + 1e-7, "linked finish bore power bounded");
    ok(c.fields.cuttingFeedrate <= p.machine.maxIpm, "linked finish feed bounded");
    ok(c.angleDeg <= p.hsmBore.maxRampAngle + 1e-9, "linked finish cutter ramp bound");
    for (const [k, v] of Object.entries(c.fields)) if (typeof v === "number") ok(Number.isFinite(v) && v >= 0, `linked field finite ${k}`);
  }
  return r;
};
const ready = checkReady(base);
ok(ready.hsmBore.ready, ready.hsmBore.reasons.join("; "));
const child = ready.companionFinish.steps[0].result.hsmBore;
ok(child.ready, "linked finish worksheet ready under reviewed pair");
near(child.stock, 0, "finish stock zero");
near(ready.hsmBore.cutDiameter, child.firstCutDiameter - 2*child.stepover, "finish starts from rough exit diameter", 1e-6);
ok(child.fields.stockToLeave === false, "finish stock checkbox OFF");
ok(checkReady({ ...base, operationId: "2d_bore_finish" }).hsmBore.ready, "standalone Bore Finish mapped");
ok(checkReady({ ...base, operationId: "bore" }).hsmBore.ready, "legacy bore ID mapped");
for (const key of ["toolApproved", "geometryVerified", "postVerified", "passesVerified"]) {
  const r = calculate({ ...base, hsmBore: { ...base.hsmBore, [key]: false } });
  ok(!r.hsmBore.ready && r.hsmBore.fields === null && !r.runnable, `missing ${key} withholds fields`);
}
for (const modify of [
  { hsmVerifyKey: "changed-input" }, { featureDiameter: undefined }, { featureDepth: undefined },
  { featureDepth: 2 }, { pilotDiameter: undefined }, { pilotDiameter: .49 }, { pilotDiameter: 1 },
  { featureDiameter: .55 }, { toolTypeId: "face_mill" }, { machine: { ...base.machine, hp: 0 } },
  { clampForce: 1 },
  { hsmBore: { ...base.hsmBore, maxRampAngle: undefined } },
  { hsmBore: { ...base.hsmBore, stockState: "unknown" } },
  { hsmBore: { ...base.hsmBore, pitchOverride: -.01 } },
  { hsmBore: { ...base.hsmBore, pitchOverride: 0 } },
  { hsmBore: { ...base.hsmBore, pitchOverride: Infinity } },
  { hsmBore: { ...base.hsmBore, pitchOverride: 1e-10 } },
  { hsmBore: { ...base.hsmBore, pitchOverride: ready.hsmBore.maxPitch * 2 } },
  { operationId: "2d_bore_finish", hsmBore: { ...base.hsmBore, stockState: "solid" } },
]) {
  const r = calculate({ ...base, ...modify });
  ok(!r.hsmBore.ready && r.hsmBore.fields === null, "invalid/unverified setup withholds all entry fields");
  ok(r.companionFinish?.steps.every(s => !s.result.hsmBore?.ready) !== false, "blocked parent cannot release finish");
}
const override = calculate({ ...base, hsmBore: { ...base.hsmBore, pitchOverride: .001 } });
near(override.hsmBore.fields.pitch, .001, "valid pitch override");
// Screenshot arithmetic, not a validation of that user's machining settings.
near(5.2 / 891.268, .00583439, "screenshot IPR belongs to plunge", 1e-8);
ok(Math.abs(.007 - 5.2/891.268) > .001, "screenshot pitch not equal plunge IPR");
for (const mat of PART_MATERIALS) for (const priority of ["life", "finish", "balanced", "speed"]) {
  for (const aggressiveness of [0, 1]) for (const state of ["solid", "pilot"]) {
    for (const featureDiameter of [.75, 1, 2]) {
      const p = { ...base, materialId: mat.id, priority, aggressiveness, featureDiameter, pilotDiameter: state === "pilot" ? .6 : 0, entryMethod: state === "solid" ? "helix" : "predrilled", hsmBore: { ...base.hsmBore, stockState: state } };
      const r = checkReady(p);
      if (r.hsmBore.fields) {
        const center = r.hsmBore.minPathDiameter / r.hsmBore.firstCutDiameter;
        ok(r.hsmBore.fields.cuttingFeedrate <= r.ipm * center + 1e-6, "correction applied once, never inverse");
      }
    }
  }
}
console.log(`HSMWorks Bore contract: ${cases} cases, ${checks} assertions passed. Numerical/screenshot mapping only; no live HSMWorks or post certification.`);
