import { calculate } from "./cncEngine.js";
import { PART_MATERIALS, THREAD_TABLE } from "./cncData.js";

function run(label, matId, threadId, toolMaterialId = "hss", tapStyle = "spiral_point", aggressiveness = 0.6, featureDepth) {
  const mat = PART_MATERIALS.find((m) => m.id === matId);
  const thread = THREAD_TABLE.find((t) => t.id === threadId);
  const r = calculate({
    diameter: thread.major, flutes: 4, loc: 1.0,
    toolMaterialId, coatingId: "uncoated", toolTypeId: "tap",
    material: mat, operationId: "tapping", aggressiveness,
    machine: { hp: 10, maxRpm: 8000, minRpm: 100, maxIpm: 500 },
    threadId, tapStyle, featureDepth,
  });
  console.log(`\n--- ${label} (${thread.name} in ${mat.name}) ---`);
  console.log(JSON.stringify({
    sfm: r.sfm, rpm: r.rpm, ipm: r.ipm, pitch: r.tapping.pitch, tpi: r.tapping.tpi,
    threadDepth: r.tapping.threadDepth, cycle: r.tapping.cycle, notes: r.tapping.notes,
    warnings: r.warnings,
  }, null, 2));
  // sanity: verify F = RPM * pitch exactly (the rigid physical constraint)
  const expectedIpm = r.rpm * thread.pitch;
  const ok = Math.abs(expectedIpm - r.ipm) < 0.0001; // independent feed clamp is forbidden
  console.log(`Check: RPM(${r.rpm}) x pitch(${r.tapping.pitch.toFixed(5)}) = ${expectedIpm.toFixed(2)} IPM vs reported ${r.ipm} IPM -> ${ok ? "PASS" : "FAIL"}`);
  return r;
}

// 1/4-20 UNC in mild steel (1018) w/ HSS tap — manufacturer references put
// mild-steel cut-tap SFM around 20-70 depending on source; expect RPM well
// under 1000 for a 0.25" tap, feed a few IPM.
run("1/4-20 UNC Steel", "steel_1018", "unc_1_4_20", "hss", "spiral_point", 0.5, 0.5);

// M8x1.25 in 6061 aluminum w/ HSS tap — expect higher SFM (40-70 range),
// feed = RPM * 1.25mm converted to inches (0.04921 in/rev).
run("M8x1.25 Aluminum", "alum_6061", "m8_coarse", "hss", "spiral_point", 0.5, 20 / 25.4);

// 3/8-16 UNC in 304 stainless w/ cobalt tap, forming style warning check
run("3/8-16 UNC Stainless (cobalt, forming)", "ss_304", "unc_3_8_16", "cobalt", "forming", 0.5, 0.75);

// Custom thread (no threadId match -> falls back to id 'custom', pitch from input.pitch)
console.log("\n--- Custom pitch fallback ---");
const custom = calculate({
  diameter: 0.5, flutes: 4, loc: 1.0,
  toolMaterialId: "hss", coatingId: "uncoated", toolTypeId: "tap",
  material: PART_MATERIALS.find((m) => m.id === "steel_1018"), operationId: "tapping",
  aggressiveness: 0.5, machine: { hp: 10, maxRpm: 8000, minRpm: 100, maxIpm: 500 },
  threadId: "custom", pitch: 0.05, tapStyle: "spiral_flute", featureDepth: 1.0,
});
console.log(JSON.stringify({ sfm: custom.sfm, rpm: custom.rpm, ipm: custom.ipm, pitch: custom.tapping.pitch }, null, 2));

// Machine feed-limit warning check: tiny maxIpm forces a warning about not
// lowering feed alone.
console.log("\n--- Machine feed-limit warning check ---");
const limited = calculate({
  diameter: THREAD_TABLE.find((t) => t.id === "unc_1_4_20").major, flutes: 4, loc: 1.0,
  toolMaterialId: "hss", coatingId: "uncoated", toolTypeId: "tap",
  material: PART_MATERIALS.find((m) => m.id === "steel_1018"), operationId: "tapping",
  aggressiveness: 0.9, machine: { hp: 10, maxRpm: 8000, minRpm: 100, maxIpm: 2 },
  threadId: "unc_1_4_20", tapStyle: "spiral_point", featureDepth: 0.5,
});
console.log(JSON.stringify({ ipm: limited.ipm, warnings: limited.warnings }, null, 2));

console.log("\nAll tapping tests executed.");
