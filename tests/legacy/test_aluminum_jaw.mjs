// Audit correction: retired the prior assertion that aluminum jaws always
// transmit only 40% of rated vise force. That had no geometry-based validation.
import assert from "node:assert/strict";
import { calculate } from "./cncEngine.js";
import { WORKHOLDING_JAW_TYPES } from "./cncData.js";
const base = { toolTypeId: "end_mill", toolMaterialId: "carbide", coatingId: "altin", materialId: "alum_6061", operationId: "2d_contour_rough", diameter: 0.5, loc: 1, flutes: 3, aggressiveness: 0.6, clampForce: 1000 };
for (const jaw of WORKHOLDING_JAW_TYPES) {
  const r = calculate({ ...base, jawTypeId: jaw.id });
  assert.equal(r.workholding.forceDerate, 1, "No material-only jaw strength rating");
  assert.equal(r.workholding.jawStrengthEvaluated, false);
  assert.equal(r.workholding.jawLimited, false);
  assert.equal(r.workholding.usableClampForce, 1000);
  assert(Number.isFinite(r.workholding.requiredClampForce));
  assert(r.warnings.some((s) => s.includes("strength are not calculated")));
}
console.log("PASS jaw model: friction screen only; strength remains unverified");
