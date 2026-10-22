import { calculate } from "./cncEngine.js";
import { PART_MATERIALS, TOOL_MATERIALS, COATINGS, TOOL_TYPES, OPERATIONS } from "./cncData.js";

// Reproduce the exact IMCO ToolBot scenario from the user's screenshots:
// 1" 9-flute bull nose solid carbide, AlCrN-X coating, A36 structural steel,
// 2D Adaptive Clearing (Rough), 1.5" feature depth, 30 HP / 500 min RPM / 6000 max RPM machine.
const result = calculate({
  diameter: 1.0,
  flutes: 9,
  loc: 3,
  toolMaterialId: "carbide",
  coatingId: "alcrnx",
  toolTypeId: "bull_nose",
  cornerRadius: 0.03,
  materialId: "steel_a36",
  operationId: "2d_adaptive_rough",
  aggressiveness: 1.0,
  featureDepth: 1.5,
  machine: { hp: 30, maxRpm: 6000, minRpm: 60, maxIpm: 500 },
});

console.log("=== PrecisionPath (HP-solved WOC) ===");
console.log(JSON.stringify(result, null, 2));

console.log("\n=== IMCO ToolBot reference ===");
console.log(JSON.stringify({
  sfm: 460.8, rpm: 1760, feedPerTooth: 0.0142, ipm: 225.7,
  axialDoc: 1.5, radialDoc: 0.05538, hp: 30, mrr: 18.75,
}, null, 2));
