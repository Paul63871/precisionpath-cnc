import { calculate } from "./cncEngine.js";

console.log("\n=== Workholding overhang tests ===\n");

// Scenario 1: 2D Contour Rough, 2" LOC full engagement, part only gripped 0.25" —
// exactly the user's example: outside contour, tall part, shallow vise grip.
const s1 = calculate({
  diameter: 0.5, flutes: 3, loc: 2.0, toolMaterialId: "carbide", coatingId: "none",
  toolTypeId: "square_end_mill", materialId: "alum_6061", operationId: "2d_contour_rough",
  aggressiveness: 0.6, machine: { hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 },
  featureDepth: 2.0, gripDepth: 0.25,
});
console.log("--- Scenario 1: 2\" feature depth, 0.25\" grip (user's example) ---");
console.log(JSON.stringify({ overhang: s1.overhang, warnings: s1.warnings.filter(w => w.includes("Workholding")) }, null, 2));
console.assert(s1.overhang, "Scenario 1: overhang object should be present");
console.assert(s1.overhang.severity === "high", `Scenario 1: expected severity "high", got "${s1.overhang.severity}"`);
console.assert(Math.abs(s1.overhang.unsupportedHeight - 1.75) < 0.01, `Scenario 1: expected unsupportedHeight ~1.75, got ${s1.overhang.unsupportedHeight}`);
console.assert(s1.warnings.some(w => w.includes("Workholding")), "Scenario 1: should include a Workholding warning");

// Scenario 2: same part, but well-gripped (1.8" grip depth out of 2" feature depth) —
// unsupported = 0.2", ratio = 0.11 -> should be "low", no warning text needed.
const s2 = calculate({
  diameter: 0.5, flutes: 3, loc: 2.0, toolMaterialId: "carbide", coatingId: "none",
  toolTypeId: "square_end_mill", materialId: "alum_6061", operationId: "2d_contour_rough",
  aggressiveness: 0.6, machine: { hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 },
  featureDepth: 2.0, gripDepth: 1.8,
});
console.log("\n--- Scenario 2: 2\" feature depth, 1.8\" grip (well supported) ---");
console.log(JSON.stringify({ overhang: s2.overhang }, null, 2));
console.assert(s2.overhang.severity === "low", `Scenario 2: expected severity "low", got "${s2.overhang.severity}"`);
console.assert(!s2.warnings.some(w => w.includes("Workholding")), "Scenario 2: should NOT include a Workholding warning at low severity");

// Scenario 3: moderate case — 1" feature depth, 0.6" grip -> unsupported 0.4", ratio 0.67 -> "moderate"
const s3 = calculate({
  diameter: 0.375, flutes: 4, loc: 1.5, toolMaterialId: "carbide", coatingId: "none",
  toolTypeId: "square_end_mill", materialId: "steel_4140", operationId: "2d_adaptive_rough",
  aggressiveness: 0.6, machine: { hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 },
  featureDepth: 1.0, gripDepth: 0.6,
});
console.log("\n--- Scenario 3: 1\" feature depth, 0.6\" grip (moderate) ---");
console.log(JSON.stringify({ overhang: s3.overhang, warnings: s3.warnings.filter(w => w.includes("Workholding")) }, null, 2));
console.assert(s3.overhang.severity === "moderate", `Scenario 3: expected severity "moderate", got "${s3.overhang.severity}"`);
console.assert(s3.warnings.some(w => w.includes("Workholding")), "Scenario 3: should include a moderate Workholding warning");

// Scenario 4: gripDepth omitted entirely -> overhang should be null, no crash, no warning.
const s4 = calculate({
  diameter: 0.5, flutes: 3, loc: 2.0, toolMaterialId: "carbide", coatingId: "none",
  toolTypeId: "square_end_mill", materialId: "alum_6061", operationId: "2d_contour_rough",
  aggressiveness: 0.6, machine: { hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 },
  featureDepth: 2.0,
});
console.log("\n--- Scenario 4: no gripDepth provided (feature unaffected) ---");
console.log(JSON.stringify({ overhang: s4.overhang }, null, 2));
console.assert(s4.overhang === null, "Scenario 4: overhang should be null when gripDepth is not provided");
console.assert(!s4.warnings.some(w => w.includes("Workholding")), "Scenario 4: should NOT include a Workholding warning when gripDepth is unset");

// Scenario 5: non-contour op (slotting) should NOT trigger the check even with gripDepth set —
// the physical concern is specific to going around/along a part's perimeter/wall, not a slot.
const s5 = calculate({
  diameter: 0.375, flutes: 4, loc: 1.5, toolMaterialId: "carbide", coatingId: "none",
  toolTypeId: "square_end_mill", materialId: "alum_6061", operationId: "slotting",
  aggressiveness: 0.6, machine: { hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 },
  featureDepth: 1.5, gripDepth: 0.25,
});
console.log("\n--- Scenario 5: slotting op with gripDepth set (should not trigger) ---");
console.log(JSON.stringify({ overhang: s5.overhang }, null, 2));
console.assert(s5.overhang === null, "Scenario 5: overhang should be null for docMode=slot (not a profile/hem/peripheral op)");

// Scenario 6: uses `loc` as cutHeight fallback when featureDepth is not entered
// (e.g. user just enters tool LOC and grip depth without a separate feature-depth value).
const s6 = calculate({
  diameter: 0.5, flutes: 3, loc: 1.5, toolMaterialId: "carbide", coatingId: "none",
  toolTypeId: "square_end_mill", materialId: "alum_6061", operationId: "2d_contour_rough",
  aggressiveness: 0.6, machine: { hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 },
  gripDepth: 0.5,
});
console.log("\n--- Scenario 6: no featureDepth, falls back to loc (1.5\") as cut height ---");
console.log(JSON.stringify({ overhang: s6.overhang }, null, 2));
console.assert(s6.overhang, "Scenario 6: overhang should be computed from loc fallback");
console.assert(Math.abs(s6.overhang.unsupportedHeight - 1.0) < 0.01, `Scenario 6: expected unsupportedHeight ~1.0, got ${s6.overhang?.unsupportedHeight}`);

console.log("\nAll workholding overhang tests executed (see asserts above for pass/fail).");
