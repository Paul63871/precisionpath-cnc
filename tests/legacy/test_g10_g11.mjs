import { calculate } from "./cncEngine.js";
import { PART_MATERIALS, THREAD_TABLE } from "./cncData.js";

function runTap(label, matId, threadId, tapStyle = "spiral_point") {
  const mat = PART_MATERIALS.find((m) => m.id === matId);
  const thread = THREAD_TABLE.find((t) => t.id === threadId);
  const r = calculate({
    diameter: thread.major, flutes: 4, loc: 1.0,
    toolMaterialId: "hss", coatingId: "uncoated", toolTypeId: "tap",
    material: mat, operationId: "tapping", aggressiveness: 0.6,
    machine: { hp: 10, maxRpm: 8000, minRpm: 100, maxIpm: 500 },
    threadId, tapStyle,
  });
  console.log(`\n--- TAP ${label} (${thread.name} in ${mat.name}, style=${tapStyle}) ---`);
  console.log(JSON.stringify({ sfm: r.sfm, rpm: r.rpm, ipm: r.ipm, notes: r.tapping.notes, warnings: r.warnings }, null, 2));
}

function runMill(label, matId, ttId = "end_mill_flat") {
  const mat = PART_MATERIALS.find((m) => m.id === matId);
  const r = calculate({
    diameter: 0.5, flutes: 3, loc: 1.0,
    toolMaterialId: "carbide", coatingId: "uncoated", toolTypeId: ttId,
    material: mat, operationId: "slot", aggressiveness: 0.6,
    machine: { hp: 10, maxRpm: 24000, minRpm: 100, maxIpm: 500 },
  });
  console.log(`\n--- MILL ${label} (${mat.name}) ---`);
  console.log(JSON.stringify({ sfm: r.sfm, rpm: r.rpm, ipm: r.ipm, woc: r.woc, doc: r.doc, warnings: r.warnings }, null, 2));
}

function runDrill(label, matId) {
  const mat = PART_MATERIALS.find((m) => m.id === matId);
  const r = calculate({
    diameter: 0.25, flutes: 2, loc: 1.5,
    toolMaterialId: "carbide", coatingId: "uncoated", toolTypeId: "drill",
    material: mat, operationId: "drill", aggressiveness: 0.6,
    machine: { hp: 10, maxRpm: 24000, minRpm: 100, maxIpm: 500 },
    featureDepth: 1.0,
  });
  console.log(`\n--- DRILL ${label} (${mat.name}) ---`);
  console.log(JSON.stringify({ sfm: r.sfm, rpm: r.rpm, ipm: r.ipm, drilling: r.drilling, warnings: r.warnings }, null, 2));
}

// Confirm g11 entry exists and differs from g10
const g10 = PART_MATERIALS.find((m) => m.id === "g10");
const g11 = PART_MATERIALS.find((m) => m.id === "g11");
console.log("g10:", JSON.stringify(g10));
console.log("g11:", JSON.stringify(g11));
console.log("g11 sfmRange < g10 sfmRange:", g11.sfmRange[1] < g10.sfmRange[1]);
console.log("g11 profileDepthFactor < g10 profileDepthFactor:", g11.profileDepthFactor < g10.profileDepthFactor);

runMill("G10/FR4 slot", "g10");
runMill("G11/FR5 slot", "g11");
runMill("CFRP slot", "cfrp");

runDrill("G10/FR4", "g10");
runDrill("G11/FR5", "g11");

runTap("G10/FR4 cutting tap", "g10", "m8_coarse", "spiral_point");
runTap("G11/FR5 cutting tap", "g11", "m8_coarse", "spiral_point");
runTap("G10/FR4 FORMING tap (should warn)", "g10", "m8_coarse", "forming");
runTap("CFRP cutting tap", "cfrp", "m8_coarse", "spiral_point");
