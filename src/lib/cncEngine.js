import {
  PART_MATERIALS, TOOL_MATERIALS, COATINGS, TOOL_TYPES, OPERATIONS,
  baseChipLoad, lerp, clamp,
} from "./cncData";

// input shape:
// { diameter (in), flutes, loc (in), toolMaterialId, coatingId, toolTypeId,
//   materialId, operationId, aggressiveness (0..1),
//   machine: { hp, maxRpm, minRpm, maxIpm } }
export function calculate(input) {
  const {
    diameter, flutes, loc, toolMaterialId, coatingId, toolTypeId,
    material, materialId, operationId, aggressiveness = 0.6, machine,
  } = input;

  const mat = material || PART_MATERIALS.find((m) => m.id === materialId) || PART_MATERIALS[0];
  const tm = TOOL_MATERIALS.find((t) => t.id === toolMaterialId) || TOOL_MATERIALS[0];
  const coat = COATINGS.find((c) => c.id === coatingId) || COATINGS[0];
  const tt = TOOL_TYPES.find((t) => t.id === toolTypeId) || TOOL_TYPES[0];
  const op = OPERATIONS.find((o) => o.id === operationId) || OPERATIONS[0];
  const m = machine || { hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 };

  const agg = clamp(aggressiveness, 0, 1);

  // --- Surface speed (SFM) ---
  const [sfmMin, sfmMax] = mat.sfmRange;
  let sfm = lerp(sfmMin, sfmMax, agg) * tm.sfmMult * coat.sfmMult * op.sfmMult * tt.sfmMult;

  // --- RPM ---
  let rpm = (sfm * 3.82) / diameter;
  const rpmIdeal = rpm;
  rpm = clamp(rpm, m.minRpm, m.maxRpm);
  const rpmClamped = Math.abs(rpm - rpmIdeal) > 0.5;

  // --- Chip load per tooth ---
  let chipLoad = baseChipLoad(diameter) * mat.chipLoadFactor * op.chipMult * tt.chipMult;
  // aggressiveness scales chip load modestly (conservative end stays light)
  chipLoad *= lerp(0.75, 1.05, agg);

  // --- Feed (IPM) ---
  let ipm;
  if (op.docMode === "drill" || tt.isDrill) {
    // drilling: feed per revolution based on chip load
    const feedPerRev = chipLoad * 1.0; // chip load ~ feed/rev for drilling
    ipm = rpm * feedPerRev;
  } else {
    ipm = rpm * chipLoad * flutes * op.feedMult;
  }
  const ipmIdeal = ipm;
  ipm = Math.min(ipm, m.maxIpm);
  const ipmClamped = ipm < ipmIdeal - 0.01;

  // --- Depth & width of cut ---
  let woc, doc;
  if (op.docMode === "drill" || tt.isDrill) {
    woc = diameter;
    doc = Math.min(diameter * 3, loc || diameter * 3); // peck depth suggestion
  } else if (op.docMode === "slot") {
    woc = diameter;
    doc = diameter * mat.slotDepthFactor * tt.docMult * lerp(0.6, 1.0, agg);
    // cap slot depth for larger tools to manage chip evacuation / power
    if (diameter > 0.5) doc = Math.min(doc, diameter * 1.2);
  } else if (op.docMode === "face") {
    woc = diameter;
    doc = diameter * 0.1 * lerp(0.7, 1.2, agg);
  } else {
    // profile (roughing/finishing)
    woc = diameter * op.wocFactor * lerp(0.8, 1.1, agg);
    doc = diameter * mat.profileDepthFactor * tt.docMult * lerp(0.6, 1.0, agg);
    // respect LOC if provided
    if (loc) doc = Math.min(doc, loc);
  }

  // --- Material removal rate & horsepower ---
  const mrr = woc * doc * ipm; // in^3/min
  const hpRequired = mrr * mat.hpFactor;

  // --- Warnings ---
  const warnings = [];
  if (hpRequired > m.hp) {
    warnings.push(`Requires ~${hpRequired.toFixed(1)} HP but machine has ${m.hp} HP — reduce DOC/WOC or feed.`);
  }
  if (rpmClamped) {
    warnings.push(rpm > rpmIdeal
      ? `Spindle minimum forced RPM above ideal — reduce SFM or use smaller tool.`
      : `Spindle max RPM reached — ideal ${Math.round(rpmIdeal)} RPM. Increase SFM (faster tool/material) or use larger diameter.`);
  }
  if (ipmClamped) {
    warnings.push(`Machine max feed (${m.maxIpm} IPM) limits the programmed feed.`);
  }
  if (op.docMode === "slot" && diameter >= 0.5 && flutes >= 4) {
    warnings.push("Slotting with 4+ flutes at this diameter risks chip packing — consider 2-3 flutes or air blast.");
  }
  if (mat.category === "Stainless" || mat.category === "Titanium" || mat.category === "Superalloy") {
    warnings.push("Work hardening / heat-sensitive alloy — keep chip load up, avoid rubbing, use coolant or air.");
  }
  if (mat.id === "cfrp" || mat.id === "g10") {
    warnings.push("Abrasive composite — expect rapid tool wear; diamond-coated carbide recommended.");
  }

  return {
    sfm: Math.round(sfm),
    rpm: Math.round(rpm),
    chipLoad: Number(chipLoad.toFixed(5)),
    ipm: Number(ipm.toFixed(1)),
    woc: Number(woc.toFixed(3)),
    doc: Number(doc.toFixed(3)),
    mrr: Number(mrr.toFixed(2)),
    hpRequired: Number(hpRequired.toFixed(2)),
    hpAvailable: m.hp,
    hpUtilization: Math.min(100, Math.round((hpRequired / m.hp) * 100)),
    warnings,
  };
}