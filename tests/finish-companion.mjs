import { build } from "esbuild";
import assert from "node:assert/strict";
const built = await build({
  stdin: { contents: `export {calculate} from "./src/lib/cncEngine.js"; export {calculateTurning} from "./src/lib/turningEngine.js"; export {OPERATIONS} from "./src/lib/cncData.js";`, resolveDir: process.cwd() },
  bundle: true, write: false, format: "esm", platform: "node",
});
const { calculate, calculateTurning, OPERATIONS } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);
const base = { diameter: .5, flutes: 4, loc: 1, toolMaterialId: "carbide", coatingId: "altin", toolTypeId: "end_mill", materialId: "alum_6061", operationId: "2d_contour_rough", machine: { hp: 10, maxRpm: 12000, minRpm: 20, maxIpm: 400 }, featureDiameter: 2, entryMethod: "predrilled" };
let checks = 0;
const ok = (value, message) => { checks++; assert.ok(value, message); };
const near = (a, b, message, tolerance = 1e-6) => ok(Math.abs(a - b) <= tolerance, `${message}: ${a} vs ${b}`);

for (const radius of [undefined, null, 0]) {
  const r = calculate({ ...base, operationId: "2d_contour_finish", previousToolDiameter: 1, previousStock: .01, insideCornerRadius: radius });
  ok(r.corner === null, "blank/zero optional corner disables only the corner check");
  ok(r.runnable, "straight/outside contour with prior tool remains runnable");
}
ok(!calculate({ ...base, previousToolDiameter: 1, insideCornerRadius: .1 }).runnable, "positive impossible radius still blocks");
ok(calculate({ ...base, previousToolDiameter: 1, insideCornerRadius: .3 }).corner !== null, "valid positive radius enables check");
const cornerBase = { ...base, diameter: .25, operationId: "2d_contour_finish", previousToolDiameter: .75, previousStock: .002, insideCornerRadius: .5 };
for (const operationId of ["2d_contour_finish", "3d_waterline", "3d_pocket"]) {
  const p = { ...cornerBase, operationId };
  const auto = calculate(p);
  near(auto.corner.cornerFeedIpm, auto.ipm * .75, "automatic centerline correction derived independently");
  for (const percent of [1, 25, 40, 75, 100]) {
    const capped = calculate({ ...p, cornerFeedMode: "cap", cornerFeedPercent: percent });
    near(capped.corner.cornerFeedIpm, Math.min(capped.ipm * .75, capped.ipm * percent / 100), "custom cap never raises geometric feed");
    ok(capped.corner.cornerFeedIpm <= capped.ipm, "corner feed never increases straight feed");
  }
  for (const percent of [undefined, NaN, 0, -10, 101, Infinity]) {
    const invalid = calculate({ ...p, cornerFeedMode: "cap", cornerFeedPercent: percent });
    ok(invalid.corner.cornerFeedIpm === null && !invalid.runnable, "invalid custom cap withholds recommendation");
  }
  const rest = calculate({ ...p, cornerFeedMode: "rest" });
  ok(!rest.runnable && rest.corner.cornerFeedIpm === null, "rest-first choice blocks single-pass feed");
  const unknown = calculate({ ...p, previousStock: undefined });
  ok(!unknown.runnable && unknown.corner.cornerFeedIpm === null, "unknown actual corner stock cannot get a feed");
  const overloaded = calculate({ ...p, insideCornerRadius: .15, previousStock: .1, cornerFeedMode: "cap", cornerFeedPercent: 1 });
  ok(!overloaded.runnable && overloaded.corner.cornerFeedIpm === null, "even a 1% cap cannot approve excess stock");
}
const disabledCap = calculate({ ...cornerBase, insideCornerRadius: undefined, cornerFeedMode: "cap" });
ok(disabledCap.corner === null && disabledCap.runnable, "no corner radius means no forced cap input either");
const linkedCap = calculate({ ...cornerBase, operationId: "2d_contour_rough", cornerFeedMode: "cap", cornerFeedPercent: 25 });
const linkedCorner = linkedCap.companionFinish.steps[0].result.corner;
near(linkedCorner.cornerFeedIpm, linkedCap.companionFinish.steps[0].result.ipm * .25, "linked finish inherits corner feed policy");
for (const priority of ["finish", "life", "balanced", "speed"]) {
  const r = calculate({ ...base, priority });
  ok(r.companionFinish.steps.every(s => s.result.priority === priority), "linked finish honors selected objective");
}

for (const op of OPERATIONS) {
  const rough = calculate({ ...base, operationId: op.id });
  if (!rough.stockPlan.estimate || !(rough.stockPlan.radial || rough.stockPlan.axial || rough.stockPlan.normal)) {
    ok(!rough.companionFinish, `${op.id} has no unnecessary companion`);
    continue;
  }
  const plan = rough.companionFinish;
  ok(plan.steps.length > 0, `${op.id} has a finish plan`);
  for (const step of plan.steps) {
    const r = step.result;
    ok(!r.companionFinish, "no recursive finishing");
    ok(r.priority === "finish", "finisher uses surface-quality objective");
    near(r.stockPlan.radial + r.stockPlan.axial + r.stockPlan.normal, 0, "finish leaves zero");
    ok(r.rpm <= base.machine.maxRpm && r.ipm <= base.machine.maxIpm, "finish respects machine limits");
    ok(r.hpRequired <= base.machine.hp * r.policy.powerFraction + .011, "finish respects HP reserve");
    ok(r.doc <= base.loc, "finish respects cutting length");
    if (step.incoming.radial) near(r.woc, rough.stockPlan.radial, "wall WOC consumes rough reserve");
    if (step.incoming.axial) {
      near(step.incoming.axial, rough.stockPlan.axial, "axial input is reserved stock");
      near(r.doc * r.passes, step.incoming.axial, "face/floor levels remove only reserved stock", 1e-5);
      near(r.stockPlan.radial, 0, "facing has no radial stock to leave");
    }
  }
}
const pocket = calculate({ ...base, operationId: "2d_pocket" });
ok(pocket.companionFinish.steps.length === 2, "pocket wall and floor separate");
const pinned = calculate({ ...base, radialLoad: .2, axialDoc: .9, featureDepth: 2 });
near(pinned.companionFinish.steps[0].result.woc, pinned.stockPlan.radial, "rough WOC override never leaks into finish");
near(pinned.companionFinish.steps[0].result.doc * pinned.companionFinish.steps[0].result.passes, 2, "wall depth spans full feature in supported levels", 1e-5);
const changed = calculate({ ...base, finishToolDiameter: .25 });
near(changed.companionFinish.steps[0].result.woc, .25 * .015, "finish diameter controls incoming stock");
ok(!changed.companionFinish.steps[0].result.runnable, "different tool metadata must be reviewed");
const blocked = calculate({ ...base, toolMaterialId: "pcd", materialId: "steel_1018" });
ok(blocked.companionFinish.steps.every(s => !s.result.runnable), "blocked rough setup cannot green-light finisher");
const tinyLoc = calculate({ ...base, operationId: "facing_rough", loc: .001 });
const floor = tinyLoc.companionFinish.steps[0].result;
near(floor.doc * floor.passes, tinyLoc.stockPlan.axial, "short LOC splits face reserve", 1e-5);
for (const operationId of ["od_rough", "bore_rough", "face_rough"]) {
  for (const available of [.1, .02, .004]) {
    const p = { materialId: "alum_6061", operationId, workDiameter: 1, finishDiameter: operationId === "bore_rough" ? 1 + available * 2 : 1 - available * 2, faceStock: available, machine: base.machine, insert: { ic: .375, noseRadius: .016 } };
    const rough = calculateTurning(p);
    ok(!rough.error, "turning rough calculated");
    const allowance = operationId === "face_rough" ? rough.stockPlan.axial : rough.stockPlan.radial;
    near(allowance, Math.min(.015, available / 2), "lathe reserve based on available stock");
    const step = rough.companionFinish.steps[0], finish = step.result;
    near(operationId === "face_rough" ? step.incoming.axial : step.incoming.radial, allowance, "finish consumes reserve only");
    ok(rough.doc <= available - allowance + .000051, "rough pass cannot consume finish reserve");
    ok(finish.doc <= allowance + .000051, "finish DOC bounded by actual remaining stock");
    ok(finish.passes.finishPasses >= 1, "turning finish pass count provided");
    near(finish.stockPlan.radial + finish.stockPlan.axial, 0, "turning finish leaves zero");
    ok(!finish.companionFinish, "no turning recursion");
    if (operationId !== "face_rough") near(Math.abs(step.workDiameter - step.finishDiameter) / 2, allowance, "finish starts at roughing exit diameter");
    else near(rough.stockPlan.radial, 0, "turning face zero radial reserve");
  }
}
console.log(`Linked-finishing regression: ${checks} assertions passed.`);
