import { calculate } from "./cncEngine.js";
import { PART_MATERIALS, THREAD_TABLE } from "./cncData.js";

function run(label, matId, threadId, tapStyle, holeType, featureDepth) {
  const mat = PART_MATERIALS.find((m) => m.id === matId);
  const thread = THREAD_TABLE.find((t) => t.id === threadId);
  const r = calculate({
    diameter: thread.major, flutes: 4, loc: 1.0,
    toolMaterialId: "hss", coatingId: "uncoated", toolTypeId: "tap",
    material: mat, operationId: "tapping", aggressiveness: 0.5,
    machine: { hp: 10, maxRpm: 8000, minRpm: 100, maxIpm: 500 },
    threadId, tapStyle, holeType, featureDepth,
  });
  console.log(`\n--- ${label} ---`);
  console.log("holeType:", r.tapping.holeType, "| chipDirection:", r.tapping.chipDirection);
  console.log("warnings:", JSON.stringify(r.warnings, null, 2));
  console.log("notes:", JSON.stringify(r.tapping.notes, null, 2));
  return r;
}

// MISMATCH: spiral point (pushes chips forward) in a blind hole -> must warn hard
run("Spiral Point in BLIND hole (should hard-warn)", "steel_1018", "unc_1_4_20", "spiral_point", "blind", 0.3);

// CORRECT: spiral flute in blind hole -> no mismatch warning
run("Spiral Flute in BLIND hole (correct, no mismatch warning)", "steel_1018", "unc_1_4_20", "spiral_flute", "blind", 0.3);

// CORRECT: spiral point in through hole -> no mismatch warning
run("Spiral Point in THROUGH hole (correct)", "steel_1018", "unc_1_4_20", "spiral_point", "through", 0.5);

// CAUTION: straight flute in a deep blind hole -> depth-ratio caution note
run("Straight Flute in deep BLIND hole (depth caution)", "steel_1018", "unc_1_4_20", "straight_flute", "blind", 0.5);

// OK: forming tap works in either hole type, ductile material
run("Forming tap in BLIND hole in aluminum (no mismatch, ductile ok)", "alum_6061", "m8_coarse", "forming", "blind", 0.6);

console.log("\nAll hole-type mismatch tests executed.");
