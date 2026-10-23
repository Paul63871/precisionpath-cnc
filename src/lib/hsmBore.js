import { PART_MATERIALS, RAMP_ANGLE_BY_CLASS, RAMP_ANGLE_DEFAULT } from "./cncData";

export const isHsmBore = (id) => ["2d_bore_rough", "2d_bore_finish", "bore"].includes(id);
export const HSM_BORE_SOURCE = "https://help.autodesk.com/cloudhelp/2019/ENU/Inventor-HSM/files/GUID-A3D01231-69F4-40E4-994C-9103B0CF9C0B.htm";
const pos = (n) => Number.isFinite(n) && n > 0;

// Contract for the user's screenshot-matched, internal, straight-wall,
// vertical HSMWorks Bore workflow. No G-code or collision certification.
export function hsmBorePlan(input, result) {
  if (input.camWorkflow !== "hsmworks_bore" || !isHsmBore(input.operationId)) return null;
  const reasons = [...(result.blockingReasons || [])];
  const h = input.hsmBore || {};
  const verified = !!input.hsmVerifyKey && h.verifiedFor === input.hsmVerifyKey;
  const D = input.diameter, hole = input.featureDiameter, depth = input.featureDepth;
  const finishing = input.operationId === "2d_bore_finish";
  const stock = result.stockPlan?.radial || 0;
  const cutDiameter = hole - 2 * stock;
  const solid = h.stockState === "solid";
  const pilot = solid ? 0 : input.pilotDiameter;
  const mat = input.material || PART_MATERIALS.find(m => m.id === input.materialId);
  const band = RAMP_ANGLE_BY_CLASS[mat?.materialClass] || RAMP_ANGLE_DEFAULT;
  if (!["solid", "pilot"].includes(h.stockState)) reasons.push("Select known starting stock: solid or a measured existing hole. Blank is not assumed solid.");
  if (finishing && solid) reasons.push("Bore Finish cannot start in solid. Rough/pre-drill first and enter the actual starting hole.");
  if (!["end_mill", "bull_nose", "roughing"].includes(input.toolTypeId)) reasons.push("This HSMWorks Bore sheet supports approved flat/bull-nose end mills only, not form tools, drills, taps or indexable face mills.");
  if (!pos(hole) || !pos(cutDiameter) || cutDiameter < 1.2 * D) reasons.push("Enter a bore large enough for this generic workflow: cutting diameter after stock allowance must be at least 1.2× tool diameter. This is an application clearance policy, not an exact-tool approval.");
  if (!pos(depth) || !pos(input.loc) || depth > input.loc) reasons.push("Enter positive bore depth and cutting length. This sheet requires bore depth no greater than LOC; longer-reach/relieved-shank setups need separate verification.");
  if (!solid && (!pos(pilot) || pilot <= D || pilot >= cutDiameter)) reasons.push("For an existing hole, enter its measured diameter: larger than the cutter with entry clearance, and smaller than the planned cutting diameter.");
  if (!pos(h.maxRampAngle) || h.maxRampAngle >= 45) reasons.push("Enter the exact cutter's published allowable helical ramp angle (>0 and <45°). A material-class estimate is not cutter approval.");
  for (const [key, text] of [
    ["toolApproved", "Confirm the exact cutter is approved for this helical cut, material and coolant."],
    ["geometryVerified", "Confirm an internal, straight, constant-diameter vertical bore, correct selected face, hole top/bottom, actual stock, clearances, holder reach and entry/exit simulation."],
    ["postVerified", "Verify the post/control uses G94 centerline feed with no second arc-feed compensation, correct units, and acceptable axis/acceleration limits."],
    ["passesVerified", "Confirm HSMWorks simulation matches the listed pass count/stepover and no cutting orbit is smaller than the listed minimum. Labels hidden behind icons must be checked by tooltip."],
  ]) if (!verified || h[key] !== true) reasons.push(text);

  let count = 1, stepover = 0, firstCutDiameter = cutDiameter;
  if (pos(cutDiameter) && pos(D) && cutDiameter > D) {
    if (solid) {
      // First hole 1.5D maximum for this model: enough overlap to clear the
      // core. Subsequent radius increments <= 10%D (application estimate).
      const initial = Math.min(cutDiameter, 1.5 * D);
      const span = (cutDiameter - initial) / 2;
      count = 1 + Math.ceil(Math.max(0, span) / (D * 0.1) - 1e-10);
      stepover = count > 1 ? span / (count - 1) : 0;
      firstCutDiameter = cutDiameter - 2 * (count - 1) * stepover;
    } else if (pos(pilot) && pilot < cutDiameter && pos(result.woc)) {
      const radialStock = (cutDiameter - pilot) / 2;
      // Leave numerical/entry-rounding headroom below modeled radial load.
      count = Math.max(1, Math.ceil(radialStock / (result.woc * 0.98) - 1e-10));
      stepover = radialStock / count;
      firstCutDiameter = cutDiameter - 2 * (count - 1) * stepover;
    }
  }
  stepover = Math.floor(Math.max(0, stepover) * 1e9) / 1e9;
  firstCutDiameter = cutDiameter - 2 * (count - 1) * stepover;
  if (!solid && pos(pilot) && (firstCutDiameter - pilot) / 2 > result.woc + 1e-9) reasons.push("Typed radial-pass rounding would exceed the modeled first-cut engagement; use a different stock-clearing plan.");
  if (count > 1000) reasons.push("More than 1000 radial passes are required. Use a separate stock-clearing strategy.");
  const minPathDiameter = firstCutDiameter - D;
  const angleLimit = Math.min(h.maxRampAngle || 0, band.lo);
  const maxPitch = Math.min(result.doc, depth || 0, Math.PI * minPathDiameter * Math.tan(angleLimit * Math.PI / 180));
  let pitch = h.pitchOverride === undefined || h.pitchOverride === null ? maxPitch : h.pitchOverride;
  if (!pos(pitch) || !pos(maxPitch) || pitch > maxPitch + 1e-10) reasons.push("Pitch must be positive and no larger than the listed model/tool limit on the smallest cutting orbit. Larger pitch is not silently accepted.");
  if (Number.isFinite(pitch)) pitch = Math.floor(pitch * 1e9) / 1e9;
  if (!pos(pitch)) reasons.push("Pitch cannot be represented positively at this worksheet's precision. No zero/rounded-up pitch is issued.");
  // Avoid unbounded turn counts; never silently round tiny pitch up.
  if (pos(pitch) && depth / pitch > 10000) reasons.push("More than 10000 turns per radial pass: review the tool/strategy rather than issuing a tiny-pitch program.");
  const pathLength = Math.hypot(Math.PI * minPathDiameter, pitch);
  const centerlineFactor = minPathDiameter / firstCutDiameter;
  const edgeFeed = solid ? Math.min(result.ipm, result.rpm * input.flutes * result.targetChipLoad * 0.5) : result.ipm;
  // G94 is a 3D path feed. Do not increase it by the helix-vector factor:
  // keeping the corrected XY magnitude as path feed is slightly conservative.
  let feed = edgeFeed * centerlineFactor;
  const budget = (input.machine?.hp || 0) * result.policy.powerFraction;
  let worstArea = Math.PI * (firstCutDiameter ** 2 - (solid ? 0 : pilot ** 2)) / 4;
  if (count > 1) worstArea = Math.max(worstArea, Math.PI * (cutDiameter ** 2 - (cutDiameter - 2 * stepover) ** 2) / 4);
  const hpPerFeed = worstArea * pitch / pathLength * (mat?.hpFactor || 0);
  if (!pos(mat?.hpFactor)) reasons.push("A valid material unit-power factor is required for this bore model.");
  if (hpPerFeed > 0) feed = Math.min(feed, budget / hpPerFeed);
  feed = Math.min(feed, input.machine?.maxIpm || 0);
  if (!pos(feed) || feed < 0.01) reasons.push("Calculated centerline feed is missing or below 0.01 in/min; no zero/rounded-up feed is issued. Review the tool, geometry and chip formation.");
  const zFeed = feed * pitch / pathLength;
  const mrr = worstArea * zFeed;
  const plungeFeed = Math.min(feed, result.rpm * input.flutes * result.targetChipLoad * 0.25);
  const workholding = result.workholding ? { ...result.workholding } : null;
  if (workholding) {
    const sfm = result.rpm * Math.PI * D / 12;
    const boreForce = mrr * (mat?.hpFactor || 0) * 33000 / sfm;
    workholding.cuttingForce = Math.max(workholding.cuttingForce, boreForce);
    workholding.safetyFactor = Math.max(workholding.safetyFactor, solid ? 4 : 3);
    workholding.requiredClampForce = workholding.cuttingForce * workholding.safetyFactor / workholding.mu;
    workholding.clampMargin = workholding.usableClampForce ? workholding.usableClampForce / workholding.requiredClampForce : null;
    workholding.insufficient = workholding.clampMargin != null && workholding.clampMargin < 1;
    if (workholding.insufficient) reasons.push("Entered clamping force is below the conservative bore workholding estimate. Correct the fixture/load before releasing this worksheet.");
  }
  const ready = reasons.length === 0;
  return {
    ready, reasons: [...new Set(reasons)], revision: input.hsmVerifyKey, finishing, solid, stock, cutDiameter,
    minPathDiameter, firstCutDiameter, radialPasses: count, stepover, maxPitch,
    pitch, angleLimit, angleDeg: Math.atan(pitch / (Math.PI * minPathDiameter)) * 180 / Math.PI,
    turnsPerPass: Math.ceil(depth / pitch), centerlineFactor, axialFeed: zFeed,
    mrr, hpRequired: mrr * (mat?.hpFactor || 0), hpBudget: budget, workholding,
    // Withhold all copyable fields while any critical input remains unknown.
    fields: ready ? {
      spindleSpeed: result.rpm, rampSpindleSpeed: result.rpm,
      surfaceSpeed: result.rpm * Math.PI * D / 12,
      cuttingFeedrate: feed, leadInFeedrate: feed, leadOutFeedrate: feed,
      rampFeedrate: feed, plungeFeedrate: plungeFeed,
      feedPerTooth: feed / (result.rpm * input.flutes),
      plungeFeedPerRev: plungeFeed / result.rpm, pitch,
      multiplePasses: count > 1, numberOfStepovers: count, stepover,
      finishingPasses: false, compensationType: "In Computer",
      direction: "Climb", repeatPasses: false, stockToLeave: stock > 0, radialStockToLeave: stock,
    } : null,
    source: HSM_BORE_SOURCE,
    setup: { toolDiameter: D, flutes: input.flutes, loc: input.loc, material: mat?.name || "Unknown", holeDiameter: hole, depth, pilotDiameter: pilot, solid },
    cautions: [
      ...(mat?.notes || []).map(n => `${mat.name}: ${n}`),
      ...(mat?.abrasive ? ["Abrasive material: use suitable tooling and dust/coolant controls; dull edges and wear can invalidate these starting values."] : []),
      ...(input.override ? ["A lookup override is present. Its material condition, grade and engagement must match this exact cutter before using the sheet."] : []),
    ],
    notes: [
      "Pitch is Z distance per ONE orbit around the bore, not distance per spindle revolution. Use the Pitch field above Multiple passes; do not enter it in Tool → Feed per revolution.",
      "Tool → Feed per revolution is PLUNGE feed / spindle RPM. Cutting feed / (RPM × flutes) is the displayed feed per tooth; it is not the physical edge chip target before arc correction.",
      "The same conservative centerline feed is listed for cutting, ramp and leads to avoid relying on an unverified movement classification. Apply the circular correction once, not again in CAM/post/control.",
      "In Computer is cutter-diameter/path compensation, not proof of automatic feed compensation. Use this sheet only after verifying that your post/control expects the already-corrected G94 centerline feed.",
      "Pitch and feed are limited by the SMALLEST cutting orbit. The outermost bore diameter alone is insufficient for multi-pass boring. Check post rounding too: posted pitch must not exceed the listed limit. Simulate first; this does not verify the generated path automatically.",
      "Finishing passes is Off: use the separately calculated finish operation. Enabling that checkbox does NOT cancel Stock to Leave; a rough operation with stock enabled still stops short of final size.",
      "Plunge feed is for verified air/existing-hole travel only. This sheet does not authorize a straight plunge into material.",
      "Coolant is not inferred as Flood just because the screenshot shows it. Use the exact-tool/material-approved coolant or dust-control policy; match the selected HSMWorks library tool's diameter, flutes and LOC.",
      "Heights, rapid/high-feed mapping, lead radii/distances, Lead to center and entry positions depend on actual fixture/stock/geometry. Keep your verified setup and inspect it in simulation; no generic clearance values or rapid-mode change is issued.",
      "The 1.2D clearance floor, 1.5D initial solid hole, <=10%D later solid steps, material ramp bound and feed reserves are application estimates, not exact-tool guarantees. Very low feeds may rub; prove out under qualified supervision.",
    ],
  };
}
