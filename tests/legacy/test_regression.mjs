import { calculate } from "./cncEngine.js";

function run(label, params) {
  const r = calculate(params);
  console.log(`\n--- ${label} ---`);
  console.log(JSON.stringify({ sfm: r.sfm, rpm: r.rpm, woc: r.woc, doc: r.doc, ipm: r.ipm, hpRequired: r.hpRequired, hpAvailable: r.hpAvailable, warnings: r.warnings }, null, 2));
}

// 1. Aluminum HEM, small machine (2 HP) -> should be power-starved, WOC should shrink toward floor.
run("Aluminum HEM, weak 2HP machine", {
  diameter: 0.5, flutes: 3, loc: 1.5, toolMaterialId: "carbide", coatingId: "none",
  toolTypeId: "end_mill", materialId: "alum_6061", operationId: "2d_adaptive_rough",
  aggressiveness: 0.5, featureDepth: 1.0, machine: { hp: 2, maxRpm: 24000, minRpm: 1000, maxIpm: 600 },
});

// 2. Aluminum HEM, huge machine (50 HP) -> should hit ceiling clamp, not runaway WOC.
run("Aluminum HEM, big 50HP machine", {
  diameter: 0.5, flutes: 3, loc: 1.5, toolMaterialId: "carbide", coatingId: "none",
  toolTypeId: "end_mill", materialId: "alum_6061", operationId: "2d_adaptive_rough",
  aggressiveness: 0.5, featureDepth: 1.0, machine: { hp: 50, maxRpm: 24000, minRpm: 1000, maxIpm: 600 },
});

// 3. Titanium HEM (tough material, should not run away).
run("Titanium HEM, 15HP machine", {
  diameter: 0.375, flutes: 5, loc: 1.0, toolMaterialId: "carbide", coatingId: "alcrn",
  toolTypeId: "end_mill", materialId: "titanium_gr5", operationId: "2d_adaptive_rough",
  aggressiveness: 0.3, featureDepth: 0.5, machine: { hp: 15, maxRpm: 15000, minRpm: 500, maxIpm: 400 },
});

// 4. User-pinned radial load should NOT be overridden by HP solve.
run("A36 HEM with manually pinned radialLoad=0.2", {
  diameter: 1.0, flutes: 9, loc: 3, toolMaterialId: "carbide", coatingId: "alcrnx",
  toolTypeId: "bull_nose", cornerRadius: 0.03, materialId: "steel_a36", operationId: "2d_adaptive_rough",
  aggressiveness: 0.15, featureDepth: 1.5, radialLoad: 0.2,
  machine: { hp: 30, maxRpm: 6000, minRpm: 60, maxIpm: 500 },
});

// 5. No HP specified on machine -> should fall back to percentage table, not crash.
run("A36 HEM, machine.hp = 0 (fallback)", {
  diameter: 1.0, flutes: 9, loc: 3, toolMaterialId: "carbide", coatingId: "alcrnx",
  toolTypeId: "bull_nose", cornerRadius: 0.03, materialId: "steel_a36", operationId: "2d_adaptive_rough",
  aggressiveness: 0.15, featureDepth: 1.5,
  machine: { hp: 0, maxRpm: 6000, minRpm: 60, maxIpm: 500 },
});

// 6. Fixed-stepover finishing profile op should be totally unaffected by the
// peripheral-roughing changes (2d_contour was split into _rough / _finish).
run("A36 Profile finish (non-HEM) sanity check", {
  diameter: 0.5, flutes: 4, loc: 1.5, toolMaterialId: "carbide", coatingId: "tialn",
  toolTypeId: "end_mill", materialId: "steel_a36", operationId: "2d_contour_finish",
  aggressiveness: 0.5, featureDepth: 0.5, machine: { hp: 10, maxRpm: 10000, minRpm: 500, maxIpm: 300 },
});

// 7. New: peripheral roughing profile op should HP-solve WOC from
// PERIPHERAL_ROUGH_WOC_TARGETS (wider band than HEM's WOC_CLASS_TARGETS).
run("A36 Peripheral rough (2d_contour_rough) sanity check", {
  diameter: 0.5, flutes: 4, loc: 1.5, toolMaterialId: "carbide", coatingId: "tialn",
  toolTypeId: "end_mill", materialId: "steel_a36", operationId: "2d_contour_rough",
  aggressiveness: 0.5, featureDepth: 0.5, machine: { hp: 10, maxRpm: 10000, minRpm: 500, maxIpm: 300 },
});
