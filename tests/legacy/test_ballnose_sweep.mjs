import { calculate } from "./cncEngine.js";

const cases = [
  { label: "0.25\" ball, Aluminum 6061, 3D Adaptive Finish", diameter: 0.25, flutes: 2, loc: 1.0,
    toolMaterialId: "carbide", coatingId: "none", toolTypeId: "ball_end", materialId: "alum_6061",
    operationId: "3d_adaptive_finish", aggressiveness: 1.0, featureDepth: 0.15,
    machine: { hp: 10, maxRpm: 18000, minRpm: 1000, maxIpm: 400 } },
  { label: "0.5\" ball, Stainless 304, 2D Contour Finish", diameter: 0.5, flutes: 4, loc: 1.5,
    toolMaterialId: "carbide", coatingId: "altin", toolTypeId: "ball_end", materialId: "ss_304",
    operationId: "2d_contour_finish", aggressiveness: 1.0, featureDepth: 0.3,
    machine: { hp: 20, maxRpm: 12000, minRpm: 200, maxIpm: 400 } },
  { label: "1.0\" ball, Titanium Grade 5 (Ti-6Al-4V), 3D Pencil finish", diameter: 1.0, flutes: 4, loc: 2.0,
    toolMaterialId: "carbide", coatingId: "alcrnx", toolTypeId: "ball_end", materialId: "titanium_gr5",
    operationId: "3d_pencil", aggressiveness: 1.0, featureDepth: 0.4,
    machine: { hp: 25, maxRpm: 10000, minRpm: 200, maxIpm: 300 } },
  { label: "0.125\" (1/8\") ball, A36 steel, 2D Contour Finish, small tool", diameter: 0.125, flutes: 2, loc: 0.5,
    toolMaterialId: "carbide", coatingId: "altin", toolTypeId: "ball_end", materialId: "steel_a36",
    operationId: "2d_contour_finish", aggressiveness: 1.0, featureDepth: 0.05,
    machine: { hp: 5, maxRpm: 24000, minRpm: 1000, maxIpm: 200 } },
  { label: "0.5\" ball, A36 steel, 2D Adaptive Rough (HEM) - ball nose in roughing", diameter: 0.5, flutes: 3, loc: 1.5,
    toolMaterialId: "carbide", coatingId: "altin", toolTypeId: "ball_end", materialId: "steel_a36",
    operationId: "2d_adaptive_rough", aggressiveness: 1.0, featureDepth: 1.0,
    machine: { hp: 30, maxRpm: 6000, minRpm: 60, maxIpm: 500 } },
  { label: "0.5\" ball, A36 steel, 2D Contour Rough (peripheral) - ball nose in roughing", diameter: 0.5, flutes: 3, loc: 1.5,
    toolMaterialId: "carbide", coatingId: "altin", toolTypeId: "ball_end", materialId: "steel_a36",
    operationId: "2d_contour_rough", aggressiveness: 1.0, featureDepth: 1.0,
    machine: { hp: 30, maxRpm: 6000, minRpm: 60, maxIpm: 500 } },
  { label: "IMCO benchmark: 0.393701\" ball nose, 4-flute, A36, 2D Contour Rough (Periph.-Rough match)", diameter: 0.393701, flutes: 4, loc: 0.75,
    toolMaterialId: "carbide", coatingId: "alcrnx", toolTypeId: "ball_end", materialId: "steel_a36",
    operationId: "2d_contour_rough", aggressiveness: 0.68, featureDepth: 0.33,
    machine: { hp: 30, maxRpm: 6000, minRpm: 60, maxIpm: 500 } },
];

for (const c of cases) {
  const { label, ...params } = c;
  const r = calculate(params);
  console.log(`\n--- ${label} ---`);
  console.log(JSON.stringify({
    sfm: r.sfm, rpm: r.rpm, effectiveDiameter: r.effectiveDiameter, doc: r.doc, passes: r.passes,
    ipm: r.ipm, chipLoad: r.chipLoad, hpRequired: r.hpRequired, hpAvailable: r.hpAvailable,
    hpUtilization: r.hpUtilization, sfmCapped: r.sfmCapped, warnings: r.warnings,
  }, null, 2));
}
