import { calculate } from "./cncEngine.js";

console.log("\n=== Clamping force (workholding slip/pull-out) tests ===\n");

// Sanity check against the Tooling World worked example formula shape:
// Fc = HP * 33000 / SFM. We don't reproduce their exact op (boring, which
// this engine routes differently), but we verify the SAME formula relationship
// holds inside our engine's own numbers: hpRequired*33000/sfm should equal
// the reported cuttingForce for any calc.
const check = calculate({
  diameter: 0.75, flutes: 4, loc: 2.0, toolMaterialId: "carbide", coatingId: "none",
  toolTypeId: "square_end_mill", materialId: "alum_6061", operationId: "2d_contour_rough",
  aggressiveness: 0.6, machine: { hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 },
});
const expectedFc = (check.hpRequired * 33000) / check.sfm;
console.log("--- Formula sanity check: Fc = HP*33000/SFM ---");
console.log(JSON.stringify({ hpRequired: check.hpRequired, sfm: check.sfm, expectedFc: Number(expectedFc.toFixed(1)), reportedFc: check.workholding.cuttingForce }, null, 2));
console.assert(Math.abs(expectedFc - check.workholding.cuttingForce) < 0.5, `Formula mismatch: expected ${expectedFc}, got ${check.workholding.cuttingForce}`);

// Scenario matching the coworker's real incident: 3/4" end mill, full 2" LOC,
// part gripped only 0.25" per side. We can't literally model "0.25\" per side"
// as a single gripDepth (that's a plan-view width concern, not the elevation
// concern gripDepth models), but we CAN model the coworker's actual outcome —
// insufficient clamping force for the cut being run — directly via the new
// clamping-force check, independent of grip depth/orientation specifics.
const incident = calculate({
  diameter: 0.75, flutes: 4, loc: 2.0, toolMaterialId: "carbide", coatingId: "none",
  toolTypeId: "square_end_mill", materialId: "steel_4140", operationId: "2d_contour_rough",
  aggressiveness: 0.8, machine: { hp: 10, maxRpm: 10000, minRpm: 60, maxIpm: 200 },
  featureDepth: 2.0, gripDepth: 0.25, jawTypeId: "smooth_steel", clampForce: 800,
});
console.log("\n--- Scenario: coworker's incident shape (3/4\" EM, full 2\" LOC, 4140 steel, 0.25\" grip, 800 lbf vise) ---");
console.log(JSON.stringify({ overhang: incident.overhang, workholding: incident.workholding, warnings: incident.warnings.filter(w => w.includes("Workholding")) }, null, 2));
console.assert(incident.overhang.severity === "high", "Incident: overhang severity should be high");
console.assert(incident.workholding, "Incident: workholding object should be present");
console.assert(incident.workholding.insufficient === (incident.workholding.ratedClampForce < incident.workholding.requiredClampForce), "Incident: insufficient flag should match the actual comparison");

// Scenario: a LIGHT aluminum finishing cut with a real 11,600 lbf Kurt-class
// vise rating (https://www.kurtworkholding.com/product/kurt-manual-vise-8-w-10-opening/)
// should NOT be flagged insufficient — confirms the check isn't just always
// tripping regardless of cut severity.
const safeVise = calculate({
  diameter: 0.5, flutes: 3, loc: 0.75, toolMaterialId: "carbide", coatingId: "none",
  toolTypeId: "square_end_mill", materialId: "alum_6061", operationId: "2d_contour_finish",
  aggressiveness: 0.5, machine: { hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 },
  featureDepth: 0.5, gripDepth: 0.5, jawTypeId: "smooth_steel", clampForce: 11600,
});
console.log("\n--- Light aluminum finishing cut, real 11,600 lbf Kurt-class vise rating ---");
console.log(JSON.stringify({ workholding: safeVise.workholding, warnings: safeVise.warnings.filter(w => w.includes("Workholding")) }, null, 2));
console.assert(!safeVise.workholding.insufficient, "Safe vise: should NOT be flagged insufficient for a light finishing cut");
console.assert(!safeVise.warnings.some(w => w.includes("only rated for")), "Safe vise: should not warn about insufficient clamp force");

// Scenario: serrated jaw should require LESS clamping force than smooth jaw
// for the identical cut (mu 0.50 vs 0.20 -> 2.5x less required force).
const serrated = calculate({
  diameter: 0.75, flutes: 4, loc: 2.0, toolMaterialId: "carbide", coatingId: "none",
  toolTypeId: "square_end_mill", materialId: "steel_4140", operationId: "2d_contour_rough",
  aggressiveness: 0.8, machine: { hp: 10, maxRpm: 10000, minRpm: 60, maxIpm: 200 },
  featureDepth: 2.0, gripDepth: 0.25, jawTypeId: "serrated", clampForce: 800,
});
console.log("\n--- Same cut, serrated jaws instead of smooth ---");
console.log(JSON.stringify({ smoothRequired: incident.workholding.requiredClampForce, serratedRequired: serrated.workholding.requiredClampForce }, null, 2));
console.assert(serrated.workholding.requiredClampForce < incident.workholding.requiredClampForce, "Serrated jaws should need less clamping force than smooth");
console.assert(Math.abs(incident.workholding.requiredClampForce / serrated.workholding.requiredClampForce - 2.5) < 0.05, "Ratio should be exactly mu_smooth/mu_serrated = 0.50/0.20 = 2.5x");

// Scenario: no clampForce entered -> just reports the requirement, no
// insufficient flag, but should still surface a note when overhang is also
// flagged (helps connect the two checks for the user).
const noVise = calculate({
  diameter: 0.75, flutes: 4, loc: 2.0, toolMaterialId: "carbide", coatingId: "none",
  toolTypeId: "square_end_mill", materialId: "steel_4140", operationId: "2d_contour_rough",
  aggressiveness: 0.8, machine: { hp: 10, maxRpm: 10000, minRpm: 60, maxIpm: 200 },
  featureDepth: 2.0, gripDepth: 0.25,
});
console.log("\n--- No clampForce entered (should report estimate + cross-reference overhang) ---");
console.log(JSON.stringify({ workholding: noVise.workholding, warnings: noVise.warnings.filter(w => w.includes("Workholding")) }, null, 2));
console.assert(noVise.workholding.ratedClampForce === null, "No vise entered: ratedClampForce should be null");
console.assert(!noVise.workholding.insufficient, "No vise entered: insufficient should be false (nothing to compare against)");
console.assert(noVise.warnings.some(w => w.includes("Workholding") && w.includes("estimated")), "No vise entered: should still surface the estimated requirement");

// Scenario: drilling should NOT get a workholding force check (axial load
// into the table, not sideways against the jaws).
const drill = calculate({
  diameter: 0.375, flutes: 2, loc: 2.0, toolMaterialId: "hss", coatingId: "none",
  toolTypeId: "drill", materialId: "steel_4140", operationId: "drilling",
  aggressiveness: 0.6, machine: { hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 },
  featureDepth: 1.0, clampForce: 50,
});
console.log("\n--- Drilling (should skip the clamping-force check) ---");
console.log(JSON.stringify({ workholding: drill.workholding }, null, 2));
console.assert(drill.workholding === null, "Drilling: workholding should be null");

console.log("\nAll clamping force tests executed (see asserts above for pass/fail).");
