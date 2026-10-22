// Deterministic numerical audit. NOT physical proof of every tool/material pair.
// Run: node tests/audit.mjs
import { build } from "esbuild";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const built = await build({
  stdin: { contents: `
    export { calculate } from "./src/lib/cncEngine.js";
    export { calculateTurning } from "./src/lib/turningEngine.js";
    export * from "./src/lib/cncData.js";
    export * from "./src/lib/turningData.js";
    export * from "./src/lib/processModel.js";
  `, resolveDir: process.cwd() },
  bundle: true, write: false, format: "esm", platform: "node",
});
const M = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);
const { calculate, calculateTurning, PART_MATERIALS, TOOL_TYPES, TOOL_MATERIALS, COATINGS, OPERATIONS, TURNING_OPERATIONS, TURNING_GRADES, contourCorner, processPolicy } = M;
let checks = 0, cases = 0, blocked = 0, errors = [];
const check = (c, message) => { checks++; if (!c && errors.length < 35) errors.push(message); };
const base = { diameter: 0.5, flutes: 4, loc: 1, toolMaterialId: "carbide", coatingId: "altin", toolTypeId: "end_mill", materialId: "alum_6061", operationId: "2d_contour_rough", machine: { hp: 10, maxRpm: 12000, minRpm: 20, maxIpm: 400 }, threadId: "unc_1_4_20" };
function verify(r, p, label) {
  cases++;
  check(!!r && !r.error, `${label}: missing result`);
  if (!r || r.error) return;
  if (r.runnable === false) blocked++;
  for (const key of ["sfm", "rpm", "ipm", "doc", "woc", "chipLoad", "hpRequired", "feedPerRev"]) check(Number.isFinite(r[key]) && r[key] >= 0, `${label}: ${key}=${r[key]}`);
  check(r.rpm <= p.machine.maxRpm + 1, `${label}: max RPM`);
  check(r.ipm <= p.machine.maxIpm + 1e-5, `${label}: max feed`);
  if (!r.tapping) check(r.hpRequired <= p.machine.hp * r.policy.powerFraction + 0.011, `${label}: HP reserve`);
  if (r.tapping && r.runnable) check(r.hpRequired <= p.machine.hp * r.policy.powerFraction + 0.011, `${label}: runnable tap HP reserve`);
  if (r.tapping && r.tapping.pitch) check(Math.abs(r.ipm - r.rpm * r.tapping.pitch) < r.rpm * 0.000006 + 0.0001, `${label}: tap pitch`);
  check(r.reasoning?.length >= 5, `${label}: reasoning missing`);
  check(r.stockPlan && Number.isFinite(r.stockPlan.radial), `${label}: stock plan missing`);
  if (p.loc > 0 && !r.drilling && !r.tapping) check(r.doc <= p.loc + 1e-6, `${label}: cutting length`);
}

// Every material × tool TYPE × operation × priority × slider at 0, 60, 100%.
for (const mat of PART_MATERIALS) for (const tool of TOOL_TYPES) for (const op of OPERATIONS) for (const slider of [0, 0.6, 1]) for (const priority of ["finish", "life", "balanced", "speed"]) {
  const p = { ...base, materialId: mat.id, toolTypeId: tool.id, operationId: op.id, aggressiveness: slider, priority };
  try { verify(calculate(p), p, `${mat.id}/${tool.id}/${op.id}/${slider}`); }
  catch (e) { if (errors.length < 35) errors.push(`${mat.id}/${tool.id}/${op.id}: ${e.message}`); }
}
const fullCrossProductCases = cases;

// All priorities/materials/tool grades/coatings at a representative valid
// operation for each type; complements rather than claims the enormous full product.
for (const mat of PART_MATERIALS) for (const tool of TOOL_TYPES) for (const tm of TOOL_MATERIALS) for (const coat of COATINGS) for (const priority of ["finish", "life", "balanced", "speed"]) {
  const operationId = tool.isDrill ? "drilling" : tool.isTap ? "tapping" : tool.id === "face_mill" ? "facing_rough" : tool.id === "slitting_saw" ? "slotting" : "2d_contour_rough";
  const p = { ...base, toolTypeId: tool.id, operationId, materialId: mat.id, toolMaterialId: tm.id, coatingId: coat.id, priority, aggressiveness: 1 };
  verify(calculate(p), p, `${mat.id}/${tm.id}/${coat.id}/${priority}`);
}
const matrixCases = cases;

// Dimensional/geometry and hostile limits across all tools.
for (const diameter of [0.03125, 0.125, 0.5, 1.5, 3]) for (const tool of TOOL_TYPES) for (const slider of [0, 0.6, 1]) {
  const p = { ...base, diameter, loc: diameter * 2, toolTypeId: tool.id, operationId: tool.isDrill ? "drilling" : tool.isTap ? "tapping" : "2d_pocket", aggressiveness: slider, machine: { hp: 0.5, maxRpm: 18000, minRpm: 100, maxIpm: 20 } };
  verify(calculate(p), p, `size/${tool.id}/${diameter}/${slider}`);
}
for (const v of [undefined, NaN, null, -1, 0, 1e6, Infinity]) {
  const p = { ...base, helixDiameter: v, featureDiameter: v, cornerRadius: v, insertIc: v, operationId: "2d_pocket", aggressiveness: v };
  verify(calculate(p), p, `bad-input/${v}`);
}

// Explicit fixes, including independent analytic values.
let r = calculate({ ...base, operationId: "facing_rough" });
check(r.stockPlan.radial === 0 && r.finishPlan.stockToLeaveRadial === 0, "Facing has ZERO radial leave");
r = calculate({ ...base, operationId: "facing_finish" });
check(r.stockPlan.radial === 0 && r.stockPlan.axial === 0, "Finished face leaves ZERO");
r = calculate({ ...base, finishToolDiameter: 0.25 });
check(Math.abs(r.stockPlan.radial - 0.00375) < 1e-10 && r.stockPlan.axial === 0, "Wall allowance based on FINISH tool, no floor");
r = calculate({ ...base, operationId: "2d_pocket", finishToolDiameter: 0.25 });
check(r.stockPlan.axial === r.stockPlan.radial, "Pocket walls/floor separately");
let c = contourCorner({ operationId: "2d_contour_finish", diameter: 0.25, previousToolDiameter: 0.75, previousStock: 0.01, insideCornerRadius: 0.15 }, { woc: 0.01, ipm: 50 });
check(Math.abs(c.cornerStock - (Math.SQRT2 * 0.01 + (Math.SQRT2 - 1) * (0.375 - 0.15))) < 1e-12, "Independent 90-degree corner geometry");
check(c.exceedsStepover && c.cornerFeedIpm === null, "Excess corner stock cannot get single-pass feed");
c = contourCorner({ operationId: "3d_waterline", diameter: 0.25, previousToolDiameter: 0.25, previousStock: 0.01, insideCornerRadius: 0.5 }, { woc: 0.02, ipm: 50 });
check(Math.abs(c.cornerStock - 0.01) < 1e-12 && c.is3D, "Large accessible fillet retains constant normal stock");
for (const priority of ["finish", "life", "balanced", "speed"]) {
  check(processPolicy(1, priority).powerFraction <= 0.800000001, "100% policy reserves HP");
  const high = calculate({ ...base, priority, aggressiveness: 1 });
  const low = calculate({ ...base, priority, aggressiveness: 0 });
  check(high.hpRequired <= base.machine.hp * 0.8 + 0.01, "100% actual HP reserve");
  check(high.targetSfm >= low.targetSfm, "Slider speed window ordered");
}
check(calculate({ ...base, priority: "life" }).targetSfm < calculate({ ...base, priority: "speed" }).targetSfm, "Life priority reduces speed");
r = calculate({ ...base, toolTypeId: "tap", operationId: "tapping", pitch: 0.05, machine: { hp: 10, minRpm: 100, maxRpm: 4000, maxIpm: 0.5 } });
check(!r.runnable && r.rpm < 100 && Math.abs(r.ipm - r.rpm * r.feedPerRev) < 1e-4, "Impossible tapping case blocked, pitch retained");
r = calculate({ ...base, axialDoc: 5, featureDepth: 5, loc: 0.75, operationId: "2d_adaptive_rough" });
check(r.doc <= 0.75 && r.passes >= 7, "Pinned DOC cannot exceed LOC, pass count updated");

let turningCases = 0, turningUnsupported = 0;
for (const mat of PART_MATERIALS) for (const op of TURNING_OPERATIONS) for (const grade of TURNING_GRADES) for (const priority of ["finish", "life", "balanced", "speed"]) for (const aggressiveness of [0, 0.6, 1]) {
  const p = { materialId: mat.id, operationId: op.id, gradeId: grade.id, aggressiveness, priority, workDiameter: 1, finishDiameter: 0.8, machine: base.machine, insert: { ic: 0.375, noseRadius: 0.016 }, thread: { pitch: 0.05 } };
  let t;
  try { t = calculateTurning(p); } catch(e) { if(errors.length < 35) errors.push(`turn/${mat.id}/${op.id}/${grade.id}: ${e.message}`); continue; }
  turningCases++;
  if (t.error) { turningUnsupported++; continue; }
  if (t.kind === "drill") { check(!!t.reasoning?.length, "Lathe drill reasoning"); continue; }
  for (const k of ["sfm", "rpm", "ipm", "feedIpr", "doc", "hpRequired"]) check(Number.isFinite(t[k]) && t[k] >= 0, `turn/${mat.id}/${op.id}/${grade.id}/${k}`);
  check(t.hpRequired <= p.machine.hp * t.policy.powerFraction + 0.011, "Turning HP cap");
  check(t.ipm <= p.machine.maxIpm + 0.001, "Turning max feed");
  check(t.reasoning?.length >= 5, "Turning reasoning");
  if (t.kind === "face") check(t.stockPlan.radial === 0, "Turning face zero radial stock");
  if (t.kind === "thread") check(Math.abs(t.ipm - t.rpm * t.feedIpr) < 0.012, "Thread pitch retained");
}
const receipt = { date: new Date().toISOString(), materialCount: PART_MATERIALS.length, toolTypeCount: TOOL_TYPES.length, millingOperationCount: OPERATIONS.length, turningOperationCount: TURNING_OPERATIONS.length, fullCrossProductCases, matrixCases, millingCases: cases, turningCases, turningUnsupported, checks, blocked, failures: errors.length, errors, qualification: "Numerical/logic audit only; not physical proof or exact manufacturer matching." };
await writeFile("tests/audit-results.json", JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));
assert.equal(errors.length, 0, "Audit failures require review");
