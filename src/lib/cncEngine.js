import {
  PART_MATERIALS, TOOL_MATERIALS, TOOL_MATERIAL_CLASS_MULT, COATINGS,
  TOOL_TYPES, OPERATIONS, WOC_CLASS_TARGETS, PERIPHERAL_ROUGH_WOC_TARGETS,
  TAP_SFM_BY_CLASS, TAP_TOOL_MATERIAL_MULT, TAP_STYLES, HOLE_TYPES, THREAD_TABLE,
  WORKHOLDING_JAW_TYPES, tapDrillSize, baseChipLoad, lerp, clamp,
  RADIUS_ENGAGEMENTS, RADIUS_CUTTER_SFM, RADIUS_PASS_SCHEDULE, radiusPassCount, classRefMid,
  RAMP_ANGLE_BY_CLASS, RAMP_ANGLE_DEFAULT, ENTRY_FEED_FACTOR,
  HELIX_DIA_DEFAULT_MULT, HELIX_DIA_MIN_MULT, HELIX_DIA_PRACTICAL_MULT, HELIX_DIA_SLUG_MULT,
} from "./cncData";
import { processPolicy, stockPlan, contourCorner, calculationReasoning } from "./processModel";
import { millingFinishCompanion } from "./finishCompanion";

// input shape:
// { diameter (in), flutes (feed count), loc (in), toolMaterialId, coatingId, toolTypeId,
//   materialId, operationId, aggressiveness (0..1), override?,
//   machine: { hp, maxRpm, minRpm, maxIpm },
//   leadAngle, cornerRadius, includedAngle, tipDiameter, thickness, neckDiameter, pointAngle,
//   gripDepth (in) — optional: how much of the part height is actually clamped
//   in the workholding (vise jaw height, chuck depth, fixture pad height, etc.),
//   jawTypeId — optional: WORKHOLDING_JAW_TYPES id, selects friction coefficient,
//   priority — "finish" | "balanced" | "speed" (default balanced = IMCO-benchmark behaviour),
//   featureDiameter (in) — bore/pocket/boss diameter for circular ops; pilotDiameter (in) — pilot hole for helical bore,
//   entryMethod — "helix" | "ramp" | "plunge" | "predrilled" (how the tool first enters solid in pocket/slot/bore ops),
//   helixDiameter (in) — programmed helix HOLE diameter for helical entry (default 1.2 x tool),
//   targetRa (µin) — finish target that drives ball-nose scallop stepover / feed-mark cap,
//   clampForce (lbf) — optional: the vise/fixture's actual rated clamping force,
//   used to give a direct pass/fail instead of just reporting the requirement }
export function calculate(input) {
  const result = calculateSingle(input);
  if (result) result.companionFinish = millingFinishCompanion(input, result, calculateSingle);
  return result;
}

function calculateSingle(input) {
  // Optional fields may be cleared or partially typed. Ignore invalid optional
  // numerics rather than letting Infinity/negative lengths poison the result.
  input = { ...input };
  const invalidFields = [];
  for (const key of ["loc", "leadAngle", "cornerRadius", "includedAngle", "tipDiameter", "thickness", "neckDiameter", "pointAngle", "radialLoad", "axialDoc", "featureDepth", "gripDepth", "clampForce", "featureDiameter", "pilotDiameter", "targetRa", "insertIc", "helixDiameter", "previousToolDiameter", "previousStock", "insideCornerRadius", "cornerAngleDeg", "finishToolDiameter"]) {
    if (input[key] != null && (!Number.isFinite(input[key]) || input[key] < 0)) {
      invalidFields.push(key);
      input[key] = undefined;
    }
  }
  const {
    diameter, flutes, loc, toolMaterialId, coatingId, toolTypeId,
    material, materialId, operationId, aggressiveness = 0.6, machine, override,
    leadAngle, cornerRadius, includedAngle, tipDiameter, thickness, neckDiameter, pointAngle,
    radialLoad, axialDoc, featureDepth, threadId, tapStyle, holeType, gripDepth,
    jawTypeId, clampForce,
    priority, featureDiameter, pilotDiameter, targetRa, radiusEngagement, insertIc, entryMethod, helixDiameter,
  } = input;

  const mat = material || PART_MATERIALS.find((m) => m.id === materialId) || PART_MATERIALS[0];
  const tm = TOOL_MATERIALS.find((t) => t.id === toolMaterialId) || TOOL_MATERIALS[0];
  const coat = COATINGS.find((c) => c.id === coatingId) || COATINGS[0];
  const tt = TOOL_TYPES.find((t) => t.id === toolTypeId) || TOOL_TYPES[0];
  const baseOp = OPERATIONS.find((o) => o.id === operationId) || OPERATIONS[0];
  // Helical bore opened from SOLID (no pilot hole entered): the first helix is a
  // full-width cut exactly like a slot, so it takes the slotting speed derate
  // and slot-depth logic instead of the ring-stepover (HEM-style) logic.
  const op = (baseOp.circularKind === "bore_rough" && !(pilotDiameter > 0))
    ? { ...baseOp, docMode: "slot", adaptive: false, slotDerate: true, solidStart: true }
    : baseOp;
  if (!Number.isFinite(diameter) || diameter <= 0 || !Number.isFinite(flutes) || flutes <= 0) return null;
  const m = { ...{ hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 }, ...machine };
  for (const [k, fallback] of Object.entries({ hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 })) {
    if (!Number.isFinite(m[k]) || m[k] <= 0) m[k] = fallback;
  }
  const policy = processPolicy(aggressiveness, priority);
  const agg = policy.setting;
  // --- Optimize-for priority (finish quality vs. speed) ---
  // ESTIMATE: objective-specific policy bias, not a manufacturer calibration.
  // Surface quality moderates engagement, life moderates speed, and all
  // objectives use the same limits. Speed mode no longer boosts past slider 1.
  const prio = policy.objective;
  const finishFirst = prio === "finish";
  const aggQ = clamp(agg + (prio === "finish" ? -0.20 : prio === "life" ? -0.10 : 0), 0, 1);
  const speedAgg = policy.speedPosition;
  // Enter continuous usable spindle HP if known. A material power factor is
  // not a spindle efficiency or torque curve; nameplate HP is only a proxy.
  const hpAtCutter = m.hp;
  const inputWarnings = [];
  const blockingReasons = [];
  if (invalidFields.length) blockingReasons.push(`Invalid optional inputs ignored: ${invalidFields.join(", ")}. Correct them before cutting.`);
  for (const [key, list] of [["operationId", OPERATIONS], ["toolTypeId", TOOL_TYPES], ["toolMaterialId", TOOL_MATERIALS], ["coatingId", COATINGS]]) {
    if (input[key] && !list.some((item) => item.id === input[key])) blockingReasons.push(`Unknown ${key}: ${input[key]}. Choose a listed value.`);
  }
  if (!material && materialId && !PART_MATERIALS.some((item) => item.id === materialId)) blockingReasons.push("Unknown material ID; fallback numbers are illustrative only.");
  if (m.minRpm > m.maxRpm) {
    blockingReasons.push("Machine minimum RPM exceeds maximum RPM. Correct the machine profile.");
    m.minRpm = m.maxRpm;
  }
  if ((baseOp.docMode === "drill" && !tt.isDrill) || (baseOp.docMode === "tap" && !tt.isTap) ||
      (tt.isDrill && baseOp.docMode !== "drill") || (tt.isTap && baseOp.docMode !== "tap")) {
    blockingReasons.push("Tool and operation do not match. A drill needs drilling; a tap needs tapping.");
  }
  if (tm.id === "pcd" && ["steel_mild", "steel_alloy", "stainless", "cast_iron", "titanium", "superalloy"].includes(mat.materialClass)) {
    blockingReasons.push("PCD is not validated for this material class; choose a compatible tool grade and exact catalog data.");
  }
  if (op.id === "thread") blockingReasons.push("Thread milling needs a dedicated thread-mill profile and pitch model, not the selected generic cutter. Use exact-tool CAM/catalog data.");
  if (baseOp.circular && featureDiameter > 0 && baseOp.circularKind !== "boss_rough" && baseOp.circularKind !== "boss_finish" && featureDiameter <= diameter) blockingReasons.push("Internal circular feature is not larger than the tool. There is no valid orbit clearance.");
  if (tt.isTap && !["hss", "cobalt"].includes(tm.id)) blockingReasons.push("This generic tap model only covers HSS/cobalt taps; use exact catalog data for another substrate.");
  if (coat.id === "diamond" && ["steel_mild", "steel_alloy", "stainless", "cast_iron"].includes(mat.materialClass)) blockingReasons.push("Diamond coating is not validated for this ferrous material; choose a suitable grade/coating.");
  if (["corner_round", "concave_radius"].includes(tt.id) && input.cornerRadius >= diameter / 2) blockingReasons.push("Entered cutter radius leaves no valid core. Display geometry was clamped for UI stability; correct the actual tool dimensions.");
  if (tt.id === "round_insert" && input.insertIc >= diameter) blockingReasons.push("Entered insert IC is too large for the cutter body. Correct the dimensions; clamped geometry is illustrative only.");
  if (tt.id === "face_mill" && op.docMode !== "face") blockingReasons.push("This generic face-mill model only covers facing. Cutter-body shoulder/ramp clearance for other operations is not specified.");
  if (tt.id === "slitting_saw" && op.docMode !== "slot") blockingReasons.push("This slitting-saw model is for straight slot/cut-off use, not generic pockets, holes or surface paths.");
  if (["slitting_saw", "t_slot"].includes(tt.id) && op.docMode === "slot" && input.entryMethod !== "predrilled") blockingReasons.push("Confirm pre-opened/side entry for this saw or T-slot cutter. Do not ramp or plunge it into solid.");
  if (["corner_round", "concave_radius"].includes(tt.id) && op.docMode !== "profile") blockingReasons.push("This form-cutter model covers controlled side/profile contact, not buried pocketing, facing or solid entry.");
  if (tt.id === "t_slot" && !["profile", "slot"].includes(op.docMode)) blockingReasons.push("T-slot cutter needs a pre-opened slot and neck clearance; this operation is not modeled for it.");
  if (["chamfer"].includes(tt.id) && !["chamfer", "engrave", "profile"].includes(op.docMode)) blockingReasons.push("Chamfer/V-bit needs a matching edge/engraving path, not general buried roughing.");

  // --- TAPPING (rigid tapping) ---
  // Physically distinct from every other operation in this engine: a tap's
  // feed is NOT a chip-load-driven free variable. Once the tap enters the
  // hole its flutes ride the thread groove already being cut, so the axial
  // feed per revolution is rigidly locked to the thread pitch — F = RPM x
  // pitch, exactly one pitch of travel per revolution, with zero degrees of
  // freedom (aggressiveness cannot change it; changing it would strip the
  // thread). The only free variable is spindle speed, and even that runs far
  // slower than drilling/milling because a tap cuts on its full flank
  // simultaneously rather than a single leading edge (see TAP_SFM_BY_CLASS
  // sourcing in cncData.js). This branch returns its own complete result
  // shape and skips the doc/woc/chip-load/HP-solve pipeline below entirely —
  // none of those concepts (radial engagement, chip thinning, HEM stepover)
  // apply to a tap.
  if (op.docMode === "tap" || tt.isTap) {
    const thread = THREAD_TABLE.find((t) => t.id === threadId) || THREAD_TABLE[0];
    // diameter/pitch come from the selected thread designation when available;
    // fall back to the raw diameter/pitch the caller passed in for "custom".
    const tapMajor = thread.major != null ? thread.major : diameter;
    const rawPitch = thread.pitch != null ? thread.pitch : input.pitch;
    const pitch = Number.isFinite(rawPitch) && rawPitch > 0 ? rawPitch : 0;
    const style = TAP_STYLES.find((s) => s.id === tapStyle) || TAP_STYLES[0];
    const hole = HOLE_TYPES.find((h) => h.id === holeType) || HOLE_TYPES[0];

    const warnings = [];
    if (!pitch || pitch <= 0) {
      blockingReasons.push("A positive, finite thread pitch is required.");
      warnings.push("No thread pitch known — select a thread size or enter a custom pitch/TPI.");
    }
    // --- Hole type / chip direction mismatch check ---
    // This is the #1 real-world tapping failure: a spiral point (gun) tap
    // drives chips FORWARD with nowhere to go in a blind hole, packs at the
    // bottom, and jams or snaps the tap. A straight-flute tap just stores
    // chips in the flute gullets, so it runs out of chip capacity well
    // before typical blind-hole depths (~1.5xD). Spiral flute (pulls chips
    // back out) and forming/roll (no chip at all) are safe in either hole
    // type. Sources: Cutronix spiral point/flute/forming guide ("Never [use
    // spiral point] in a blind hole... the single most common tapping
    // failure" — cutronix.com.au/blog/metal-cutting-basics-1/spiral-point-vs-spiral-flute-taps-which-to-use-when-and-why-8),
    // Cutwel spiral point vs spiral flute guide (cutwel.co.uk/blog/spiral-point-taps-vs-spiral-flute-taps),
    // OPT Cutting Tools on straight-flute depth limits in blind holes
    // (optcuttingtools.com/news/what-is-the-advantage-of-a-spiral-flute-tap-vs-a-straight-flute-tap-when-tapping-a-blind-hole/).
    if (hole.id === "blind" && style.id === "spiral_point") {
      warnings.push("Tap style mismatch: a Spiral Point (gun) tap pushes chips FORWARD, ahead of the tap — in a blind hole they have nowhere to go and pack at the bottom, jamming or breaking the tap. Switch to a Spiral Flute tap (pulls chips back out) or a Forming/Roll tap (no chip at all) for this blind hole.");
    } else if (hole.id === "blind" && style.id === "straight_flute") {
      warnings.push("Tap style caution: a Straight Flute tap stores chips in the flute gullets instead of evacuating them — in blind holes this limits safe thread depth to roughly 1.5× diameter before the flutes pack solid. A Spiral Flute tap is the safer choice for deeper blind holes.");
    } else if (hole.id === "through" && style.id === "spiral_flute") {
      warnings.push("Note: a Spiral Flute tap works fine in a through-hole, but a Spiral Point (gun) tap is the faster, stronger, more common choice when chips can exit freely out the far side.");
    }

    // --- Surface speed (SFM) --- HSS cut-tap baseline by material class,
    // cobalt multiplier on top (TAP_TOOL_MATERIAL_MULT), tap-style multiplier
    // (spiral point/flute/straight/forming — TAP_STYLES), and coating exactly
    // like every other tool (uncoated taps run slower than TiN/TiCN-coated).
    let sfm;
    if (override?.sfm) {
      sfm = override.sfm * lerp(0.75, 1, speedAgg); // ESTIMATE: app intensity reserve, not exact catalog reproduction
    } else {
      const range = (mat.materialClass && TAP_SFM_BY_CLASS[mat.materialClass]) || TAP_SFM_BY_CLASS.steel_mild;
      const tapMatMult = TAP_TOOL_MATERIAL_MULT[tm.id] != null ? TAP_TOOL_MATERIAL_MULT[tm.id] : TAP_TOOL_MATERIAL_MULT.hss;
      sfm = lerp(range[0], range[1], speedAgg) * tapMatMult * Math.min(1, coat.sfmMult) * style.sfmMult;
    }

    // --- RPM --- straightforward SFM -> RPM at the tap's major diameter.
    let rpm = (sfm * 3.82) / tapMajor;
    const rpmIdeal = rpm;
    rpm = clamp(rpm, m.minRpm, m.maxRpm);
    let rpmClamped = Math.abs(rpm - rpmIdeal) > 0.5;

    // --- Feed (IPM) --- LOCKED to pitch. No chip load, no aggressiveness
    // term, no flute-count multiplier — this is the one true physical
    // constant of rigid tapping (F = RPM x pitch).
    const feedLimitedRpm = pitch > 0 ? Math.floor(m.maxIpm / pitch) : 0;
    if (pitch > 0 && rpm > feedLimitedRpm) {
      rpm = Math.max(0, feedLimitedRpm);
      rpmClamped = true;
      warnings.push("Feed limit: spindle RPM AND feed reduced together to preserve thread pitch.");
      if (rpm < m.minRpm) blockingReasons.push("No feasible tapping RPM within machine minimum RPM and maximum feed. Do not run this combination.");
    }
    rpm = Math.round(rpm);
    if (rpm * tapMajor / 3.82 > sfm * 1.01) blockingReasons.push("Machine minimum spindle speed exceeds the selected tapping speed.");
    const ipm = pitch > 0 ? rpm * pitch : 0;

    // --- Thread depth / G84 cycle ---
    const threadDepth = (featureDepth && featureDepth > 0) ? featureDepth : (loc || tapMajor * 2);
    const depthRatio = tapMajor > 0 ? threadDepth / tapMajor : 0;
    const retract = Math.max(0.1, tapMajor * 0.3);
    const tapping = {
      threadDepth: Number(threadDepth.toFixed(3)),
      depthRatio: Number(depthRatio.toFixed(1)),
      pitch: pitch || null, // full precision: a rounded pitch must not change F = N*p
      tpi: thread.tpi || null,
      pitchMm: thread.pitchMm || null,
      threadName: thread.name,
      cycle: "G84",
      notes: [],
    };
    tapping.holeType = hole.id;
    tapping.chipDirection = style.chipDirection;
    tapping.tapDrill = thread.major ? tapDrillSize(thread, { isForming: style.id === "forming" }) : null;
    if (loc && threadDepth > loc) tapping.notes.push(`Thread depth exceeds flute LOC (${loc}") — verify the tap's chamfer/flute length can reach full depth.`);
    if (hole.id === "blind" && style.id === "straight_flute" && depthRatio > 1.5) tapping.notes.push(`Blind-hole depth is ${depthRatio.toFixed(1)}×D — beyond the ~1.5×D chip-storage limit of a straight-flute tap at this diameter.`);
    if (mat.category === "Stainless" || mat.category === "Titanium" || mat.category === "Superalloy") tapping.notes.push("Work-hardening / heat-sensitive alloy — use cobalt or coated tap, keep speed down, flood coolant or tapping fluid.");
    if (style.id === "forming" && (mat.category === "Cast Iron" || mat.category === "Iron")) tapping.notes.push("Forming/roll taps are not recommended in cast iron — the material doesn't deform ductilely enough to form a clean thread.");
    const isLaminate = mat.category === "Composite" || mat.materialClass === "composite" || mat.materialClass === "phenolic";
    if (style.id === "forming" && isLaminate) tapping.notes.push("Forming/roll taps are not recommended in fiberglass/carbon laminates — the fibers shear or crack instead of deforming plastically. Use a sharp cutting tap.");
    if (mat.materialClass === "phenolic") {
      tapping.notes.push("Phenolic: tap DRY with a sharp cutting tap at ~65-70% thread engagement — cotton/canvas fibre grips the tap body and galls in a full-depth thread. A light mineral oil brushed on the TAP only is acceptable; wipe the part clean immediately (hygroscopic). Back the hole exit with a sacrificial board to avoid breakout (Ready Plastics phenolic guide: https://www.readyplastics.com/resources/machining/phenolic).");
    } else if (isLaminate) tapping.notes.push(`Direct tapping in laminate is workable for low-cycle, static joints (increase thread engagement to 1.5-2.5×D vs the usual metal 75% depth, keep the tap sharp, cut rather than force it). For repeated assembly/disassembly or high-load joints, use a bonded or mechanically retained metal insert (Heli-Coil, threaded insert) instead — current thread depth is ${depthRatio.toFixed(1)}×D.`);
    if (style.note) tapping.notes.push(style.note);

    // Horsepower / torque for tapping is small relative to milling/drilling —
    // reported for consistency with the rest of the app, using the same
    // MRR x hpFactor relationship, but the thread's minor-diameter annulus
    // rather than the full circle (a tap doesn't remove a full bore's worth
    // of material — only the thread groove volume).
    if (pitch * 1.0825 >= tapMajor) blockingReasons.push("Thread pitch is inconsistent with tap diameter. Correct the thread specification.");
    const minorDiameter = pitch ? Math.max(0, tapMajor - 1.0825 * pitch) : tapMajor * 0.85;
    const mrr = (Math.PI / 4) * (tapMajor * tapMajor - minorDiameter * minorDiameter) * ipm;
    let hpRequired = mrr * mat.hpFactor;
    if (hpRequired > hpAtCutter * policy.powerFraction) blockingReasons.push("Estimated tapping power exceeds the application budget. Confirm torque with tap and machine supplier.");
    if (hole.id === "blind" && style.id === "spiral_point") blockingReasons.push("Spiral point chip direction is unsuitable for this blind-hole setup.");
    if (style.id === "forming" && (isLaminate || mat.materialClass === "cast_iron")) blockingReasons.push("Form tapping is not supported for this brittle/laminated material.");
    if (coat.verified === false) warnings.push(`${coat.name} speed multiplier is an engineering estimate — no manufacturer speed chart is published for this coating.`);
    if (mat.hpFactorEstimate) warnings.push("Horsepower factor for this material is an engineering estimate, not sourced from a published handbook value.");
    if (rpmClamped) warnings.push(rpm > rpmIdeal ? "Spindle minimum forced RPM above target. Check whether this tool/material speed is feasible." : "Spindle/feed cap reduced RPM from target " + Math.round(rpmIdeal) + ". Actual speed is lower; feed remains synchronized. Do not raise SFM to compensate.");

    return {
      sfm: Number((rpm * tapMajor / 3.82).toFixed(2)),
      targetSfm: Number(sfm.toFixed(2)),
      rpm: Math.round(rpm),
      chipLoad: tapping.pitch || 0,
      feedPerRev: tapping.pitch || 0, // tap feed per rev is locked to thread pitch
      programmedFpt: null,
      ipm: Number(ipm.toFixed(5)),
      woc: Number(tapMajor.toFixed(3)),
      doc: Number(threadDepth.toFixed(3)),
      mrr: Number(mrr.toFixed(mrr < 0.01 ? 4 : 2)),
      hpRequired: Number(hpRequired.toFixed(2)),
      hpAvailable: m.hp,
      hpUtilization: hpAtCutter > 0 ? Math.round((hpRequired / hpAtCutter) * 100) : 0,
      passes: null,
      stepdown: null,
      drilling: null,
      tapping,
      radialThinningFactor: 1,
      radialEngagementPct: 0,
      adaptive: false,
      effectiveDiameter: Number(tapMajor.toFixed(3)),
      ballFeedCompensation: 1,
      sfmCapped: false,
      warnings: [...warnings, ...inputWarnings, ...blockingReasons],
      policy, runnable: blockingReasons.length === 0 && pitch > 0, blockingReasons,
      stockPlan: stockPlan(baseOp, diameter),
      reasoning: calculationReasoning({ op: baseOp, mat, tool: tt, policy, rpm, actualSfm: rpm * tapMajor / 3.82, targetSfm: sfm, ipm, chipLoad: pitch || 0, fpt: pitch || 0, woc: tapMajor, doc: threadDepth, stock: stockPlan(baseOp, diameter), override, limits: "Tap grade, chamfer lead and blind-hole clearance require catalog confirmation." }),
    };
  }


  // Tool-material speed ratio vs solid carbide, resolved by workpiece material
  // class where we have real per-class data (HSS/cobalt/indexable/PCD vary a lot
  // by material — see TOOL_MATERIAL_CLASS_MULT). Falls back to the tool's global
  // sfmMult (e.g. for custom materials without a materialClass, or solid carbide
  // itself which is always 1.0).
  const classMult = mat.materialClass && TOOL_MATERIAL_CLASS_MULT[mat.materialClass];
  const toolMatMult = (classMult && classMult[tm.id] != null) ? classMult[tm.id] : tm.sfmMult;

  // --- Depth & width of cut ---
  // Computed BEFORE speed/feed below: a ball nose tool's effective cutting
  // diameter at the axial depth of cut determines its real surface speed and
  // chip thickness (see the ball-nose correction after doc/woc/passes are
  // final), so doc has to be known first.
  let woc, doc;
  let drilling = null;
  let deepHoleFeedFactor = 1;
  let hemWocBounds = null; // {floorPct, ceilingPct} for the HP-driven WOC solve below
  if (op.docMode === "drill" || tt.isDrill) {
    // Peck-drilling cycle generation. G83 (full retract) for holes > 3×D;
    // G81 single plunge for shallow holes. Peck depth scales with material
    // (gummy alloys get smaller pecks) and shrinks for deep holes.
    const holeDepth = (featureDepth && featureDepth > 0) ? featureDepth : (loc || diameter * 3);
    const depthRatio = holeDepth / diameter;
    const peckBase = (mat.category === "Stainless" || mat.category === "Titanium" || mat.category === "Superalloy") ? 0.5
      : (mat.category === "Composite" || mat.materialClass === "composite" || mat.materialClass === "phenolic") ? 0.6
      : (mat.category === "Steel" || mat.category === "Iron") ? 0.75
      : 1.0;
    deepHoleFeedFactor = clamp(1 - Math.max(0, depthRatio - 3) * 0.06, 0.4, 1.0);
    let peckDepth = Math.max(diameter * peckBase * deepHoleFeedFactor, Math.max(0.05, diameter * 0.15));
    const peckCount = Math.max(1, Math.ceil(holeDepth / peckDepth));
    peckDepth = holeDepth / peckCount;
    const retract = Math.max(0.1, diameter * 0.2);
    const dwell = (mat.category === "Stainless" || mat.category === "Titanium" || mat.category === "Superalloy") ? 0.3 : 0.1;
    const cycle = depthRatio > 3 ? "G83" : "G81";
    const dNotes = [];
    if (depthRatio <= 3) dNotes.push(`Shallow hole (${depthRatio.toFixed(1)}×D) — single plunge (G81), no pecking needed.`);
    if (depthRatio > 3) dNotes.push(`Deep hole (${depthRatio.toFixed(1)}×D) — peck drilling (G83) with full retract to clear chips.`);
    if (depthRatio > 5) dNotes.push(`Very deep hole — feed reduced ${Math.round((1 - deepHoleFeedFactor) * 100)}% to protect the drill.`);
    if (loc && holeDepth > loc) dNotes.push(`Hole depth exceeds flute LOC (${loc}") — ensure through-spindle coolant or peck to evacuate chips.`);
    if (mat.materialClass === "phenolic" || mat.materialClass === "composite") {
      dNotes.push("Laminate drilling: clamp a sacrificial backing board under the exit (G10/thermoset scrap 0.125 in or MDF — never metal, it dulls the drill) and cut the feed 50% over the last 20% of hole depth to prevent bottom-ply delamination. Parabolic-flute carbide recommended; pecking is not needed below ~6×D (Ready Plastics thermoset-sheet guide).");
      if (mat.materialClass === "phenolic") dNotes.push("Drill DRY with air blast — the organic fibre absorbs coolant.");
    }
    if (tm.id === "carbide" && depthRatio > 3) dNotes.push("Pecking carbide drills risks edge chipping — prefer parabolic carbide or HSS for deep pecking.");
    if (mat.category === "Stainless" || mat.category === "Titanium" || mat.category === "Superalloy") dNotes.push("Work-hardening alloy — pecks clear chips and prevent hardening at the hole bottom; keep feed up.");
    drilling = {
      holeDepth: Number(holeDepth.toFixed(3)),
      depthRatio: Number(depthRatio.toFixed(1)),
      cycle,
      peckDepth: Number(peckDepth.toFixed(3)),
      peckCount,
      retract: Number(retract.toFixed(3)),
      dwell,
      notes: dNotes,
    };
    woc = diameter;
    doc = holeDepth;
  } else if (tt.id === "slitting_saw" && thickness) {
    woc = thickness; // kerf width = blade thickness
    doc = diameter * mat.slotDepthFactor * tt.docMult * lerp(0.6, 1.0, aggQ);
    if (loc) doc = Math.min(doc, loc);
  } else if (op.docMode === "slot") {
    woc = diameter;
    // Slot depth scales by diameter as well as material (OSG breakpoints:
    // 0.25×D under 0.8", 0.50×D from 0.8-2", 1.00×D above 2" — smaller tools
    // need a lower multiple regardless of material toughness).
    const diaBreak = diameter < 0.8 ? 0.25 : diameter < 2.0 ? 0.5 : 1.0;
    doc = diameter * Math.min(mat.slotDepthFactor, diaBreak) * tt.docMult * lerp(0.6, 1.0, aggQ);
    if (diameter > 0.5) doc = Math.min(doc, diameter * 1.2);
  } else if (op.docMode === "face") {
    woc = diameter;
    if (op.finishing) {
      // Finish facing: a light, largely diameter-independent skim pass.
      // Manufacturer/shop sources converge on ~0.005-0.010in (0.12-0.25mm)
      // regardless of tool diameter — Sandvik Coromant's wiper-insert
      // guidance (0.5-1.0mm), CNC Cookbook, LatheHub, and shop-practice
      // consensus on r/Machinists all land in this band:
      // https://www.sandvik.coromant.com/en-us/knowledge/milling/face-milling
      // https://www.cnccookbook.com/milling-finish-complete-guide-feeds-speeds-master-class-lesson-7/
      // Small diameters can't physically take a full 0.010" skim relative to
      // their own size, so it's still capped at 15% of diameter as a floor
      // guard for tiny tools (e.g. a 0.0625" end mill facing a small boss).
      doc = Math.min(lerp(0.005, 0.010, aggQ), diameter * 0.15);
    } else {
      // Rough facing: existing diameter-scaled formula, which lands in the
      // sourced 0.040-0.120in (~1-3mm) rough-facing band from FastPreci and
      // PTS Make for typical 0.5-1.5in tools:
      // https://www.fastpreci.com/blog/comprehensive-guide-to-face-milling/
      // https://www.ptsmake.com/brass-machining-mastery-10-expert-tactics-for-precision-cost-savings/
      doc = diameter * 0.1 * lerp(0.7, 1.2, aggQ);
    }
  } else if (op.docMode === "hem") {
    // High-Efficiency Machining / adaptive toolpaths. This is a provisional
    // WOC from the material-class target table (aluminum runs much wider
    // stepovers than titanium/hardened steel at the same "aggressiveness" —
    // see WOC_CLASS_TARGETS). It gets REPLACED below by an HP-solved value
    // once rpm/chip-load are known, unless the user pinned a radial load.
    // Falls back to the operation's flat wocFactor for materials without a
    // materialClass (e.g. legacy custom materials).
    const wocClass = mat.materialClass && WOC_CLASS_TARGETS[mat.materialClass];
    if (wocClass) {
      let [rMin, rMax] = op.finishing ? wocClass.finishPct : wocClass.roughPct;
      let ceilingPct = wocClass.ceiling;
      // Ball nose roughing/semi-finishing tolerates a wider radial stepover
      // than a flat end mill's trochoidal/HEM clearing at the same "class"
      // ceiling — the curved profile enters the cut gradually instead of
      // full-width, so chip load and deflection stay manageable at a wider
      // step. Moldmaking Technology (round-insert/ball-nose roughing guidance)
      // puts typical radial stepovers at 25-40% of diameter for constant-Z
      // roughing/semi-finishing, well above the ~10-20% ceiling tuned for
      // flat-end-mill HEM clearing in WOC_CLASS_TARGETS. Only widen the
      // non-finishing (roughing) band, and only up to that independently-
      // sourced 25-40% range, scaled by how much headroom the material class
      // has left below it (never narrows an already-wider class ceiling).
      if (tt.id === "ball_end" && !op.finishing) {
        rMin = Math.max(rMin, 0.25);
        rMax = Math.max(rMax, 0.40);
        ceilingPct = Math.max(ceilingPct, 0.40);
      }
      const pct = Math.min(ceilingPct, lerp(rMin, rMax, aggQ));
      woc = diameter * pct;
      // Safety band for the HP-driven solve: never go narrower than half the
      // table's aggressiveness-0 target (chip-thinning gets extreme below
      // that) or wider than the table's ceiling (chip evacuation / deflection).
      hemWocBounds = { floorPct: rMin * 0.5, ceilingPct };
    } else {
      woc = diameter * op.wocFactor * lerp(0.8, 1.1, aggQ);
      hemWocBounds = { floorPct: op.wocFactor * 0.4, ceilingPct: op.wocFactor * 1.1 };
    }
    doc = diameter * 2.0 * lerp(0.7, 1.2, aggQ);
  } else if (op.peripheralRough) {
    // Straight peripheral/contour ROUGHING (side-milling a wall/profile at
    // full axial depth, not trochoidal). This gets the same material-class-
    // aware, HP-solved WOC treatment as HEM roughing above, but pulled from
    // PERIPHERAL_ROUGH_WOC_TARGETS instead of WOC_CLASS_TARGETS — a straight
    // peripheral pass runs a materially wider stepover (30-50% of diameter,
    // Harvey Performance) than trochoidal/HEM clearing (10-20%) because it
    // doesn't get HEM's chip-thinning benefit at scale. Falls back to the
    // op's flat wocFactor for materials without a materialClass.
    const periphClass = mat.materialClass && PERIPHERAL_ROUGH_WOC_TARGETS[mat.materialClass];
    if (periphClass) {
      const [rMin, rMax] = periphClass.roughPct;
      const pct = Math.min(periphClass.ceiling, lerp(rMin, rMax, aggQ));
      woc = diameter * pct;
      hemWocBounds = { floorPct: rMin * 0.5, ceilingPct: periphClass.ceiling };
    } else {
      woc = diameter * op.wocFactor * lerp(0.8, 1.1, aggQ);
      hemWocBounds = { floorPct: op.wocFactor * 0.4, ceilingPct: op.wocFactor * 1.1 };
    }
    // Profile (side-milling) axial depth. Cap at 2×D per published ceilings
    // (CGS Tool, Helical/Harvey HEM, Sandvik trochoidal, Autodesk Fusion all
    // publish 1.5-2×D ceilings) unless radial engagement is very light (<10% of
    // diameter), where a long-flute tool can safely go deeper.
    const profCap = (woc / diameter) < 0.10 ? mat.profileDepthFactor : Math.min(mat.profileDepthFactor, 2.0);
    doc = diameter * profCap * tt.docMult * lerp(0.6, 1.0, aggQ);
  } else {
    woc = diameter * op.wocFactor * lerp(0.8, 1.1, aggQ);
    // FINISH-FIRST: a finishing pass removes only the stock left by the rough
    // (Seco: 1-2% of diameter) so its radial engagement belongs in Harvey's
    // 3-5% of diameter peripheral-FINISHING band (same finishPct band used by
    // the adaptive-finish branch), not the 6-9% of the legacy flat wocFactor.
    // Ball-nose finishing stepover is instead set from the scallop-height
    // limit below. https://www.secotools.com/article/finish_stock_allowance_with_solid_end_mills
    if (finishFirst && op.finishing && tt.id !== "ball_end") {
      const fc = mat.materialClass && WOC_CLASS_TARGETS[mat.materialClass];
      if (fc) woc = Math.min(woc, diameter * lerp(fc.finishPct[0], fc.finishPct[1], aggQ));
    }
    // Profile (side-milling) axial depth. Cap at 2×D per published ceilings
    // (CGS Tool, Helical/Harvey HEM, Sandvik trochoidal, Autodesk Fusion all
    // publish 1.5-2×D ceilings) unless radial engagement is very light (<10% of
    // diameter), where a long-flute tool can safely go deeper.
    const profCap = (woc / diameter) < 0.10 ? mat.profileDepthFactor : Math.min(mat.profileDepthFactor, 2.0);
    doc = diameter * profCap * tt.docMult * lerp(0.6, 1.0, aggQ);
  }
  // CAM-driven paths (HSMWorks 2D & 3D adaptive / rough / finish) hold a set radial
  // engagement; honor the user's set radial load and axial step-down. Axial DOC is
  // NOT capped to flute LOC — the toolpath steps down in multiple Z-passes.
  const userPinnedWoc = !!(op.adaptive && radialLoad && radialLoad > 0);
  if (userPinnedWoc) woc = radialLoad;
  if (op.docMode !== "drill" && !tt.isDrill && axialDoc && axialDoc > 0) doc = axialDoc;
  if (!tt.isDrill && Number.isFinite(loc) && loc > 0 && doc > loc) {
    inputWarnings.push(`Requested DOC exceeds ${loc.toFixed(4)} in cutting length; limited to LOC.`);
    doc = loc;
  }

  // --- Finishing quality targets (scallop / feed-mark limits) ---
  // Theoretical-to-real roughness: actual Rz runs ~3x the theoretical cusp
  // height because of built-up edge, runout and deflection (Mitsubishi
  // Materials end-mill finishing guide, "Actual surface roughness Rz will be
  // about 3 times worse than theoretical h": mitsubishicarbide.net/contents/
  // mmus/enus/manual/end_mills_SRF_INCH.pdf; EngiCalcsHub puts measured Ra at
  // 2-5x theory). Theoretical Ra of a cusp profile = h/4. So to MEET a target
  // Ra the theoretical cusp must be h = (4/3) x Ra_target.
  const raTargetIn = (targetRa && targetRa > 0 ? targetRa : 32) * 1e-6; // default 32 uin Ra (0.8 um, ISO N6)
  const cuspAllowIn = (4 / 3) * raTargetIn;
  let scallop = null;
  const qualityActive = finishFirst || (targetRa && targetRa > 0);
  if (qualityActive && op.finishing && tt.id === "ball_end" && !userPinnedWoc) {
    // Ball-nose scallop: h = R - sqrt(R^2 - (s/2)^2)  ->  s = 2 sqrt(2Rh - h^2)
    // (machinecalcs.com ball-nose stepover calculator; twcindustrial.com CNC
    // ball endmill calculator; Moldmaking Technology). Stepover is capped so
    // the predicted surface meets the target Ra.
    const Rb = diameter / 2;
    const sMax = 2 * Math.sqrt(Math.max(0, 2 * Rb * cuspAllowIn - cuspAllowIn * cuspAllowIn));
    if (sMax > 0 && sMax < woc) {
      woc = sMax;
      if (hemWocBounds) hemWocBounds = { floorPct: Math.min(hemWocBounds.floorPct, woc / diameter), ceilingPct: Math.min(hemWocBounds.ceilingPct, woc / diameter) };
    }
  }
  if (tt.id === "ball_end" && op.finishing) {
    const Rb = diameter / 2;
    const h = Rb - Math.sqrt(Math.max(0, Rb * Rb - (woc / 2) * (woc / 2)));
    scallop = { cuspHeightIn: h, raTheoreticalUin: (h / 4) * 1e6, raRealisticUin: (h / 4) * 3 * 1e6, stepoverIn: woc, targetRaUin: raTargetIn * 1e6 };
  }

  // Ball nose per-pass axial DOC cap — FINISHING OPERATIONS ONLY.
  // IMCO's own published ball-nose adjustment guide (the same reference this
  // calculator is benchmarked against) draws a hard line at 50% of diameter:
  // below that, engagement is shallow/finishing-style and the effective-
  // diameter correction below applies; at or above it, IMCO treats the cut as
  // full-radius/slotting-style and uses the nominal diameter directly with no
  // extra derate. Dapra's "finishing ADOC ≤ 10% of diameter" guidance is
  // finishing-specific — it does not describe roughing or peripheral milling.
  // For roughing/semi-finishing, Mitsubishi Materials states ap can run "up to
  // 1×D", and Moldmaking Technology's 10%-of-diameter-per-pass rule only
  // applies to hardened 30-40+ HRc material — it does not apply to structural/
  // mild steel or aluminum. So: only finishing ops (2D/3D adaptive finish,
  // pencil) get capped tight (10% of diameter, keeping them in the shallow-
  // engagement regime the effective-diameter correction is meant for);
  // roughing/contour ops are left to the existing feature-depth/passes and
  // flute-LOC logic below, the same as any other tool type.
  if (tt.id === "ball_end" && op.finishing && op.docMode !== "drill" && !tt.isDrill) {
    doc = Math.min(doc, diameter * 0.10);
  }

  // Feature depth → number of axial passes and the actual per-pass stepdown.
  let passes = null, stepdown = null;
  if (op.docMode !== "drill" && !tt.isDrill && featureDepth && featureDepth > 0 && doc > 0) {
    passes = Math.max(1, Math.ceil(featureDepth / doc));
    stepdown = featureDepth / passes;
    doc = stepdown; // actual per-pass depth never exceeds the feature depth
  }

  // --- Workholding overhang (workpiece-side rigidity, NOT tool stickout) ---
  // gripDepth is how much of the part height the vise jaws / chuck / fixture
  // actually clamp. When a feature (an outside contour, a tall boss, a wall)
  // is cut above that grip line, the UNCLAMPED workpiece itself becomes the
  // cantilever the cutting forces act on — physically the same cantilever-
  // beam problem as tool stickout (deflection scales with the CUBE of the
  // unsupported length: δ = FL³/3EI), just on the part side of the interface
  // instead of the tool side:
  // https://online-tools.work/metal/en/tool-deflection
  // https://formulafactory.tools/cnc-calculators/tool-deflection-calculator/
  // A full-LOC 2D contour/adaptive pass run around the OUTSIDE of a part that
  // is only gripped for a fraction of that height is exactly this case — the
  // engine has no way to see the fixture, so this only activates when the
  // user tells it how tall the grip is (gripDepth). Precision-vise
  // manufacturer LANG Technik's published workholding rule of thumb states
  // "maximum height = 2x jaw width" for a workpiece held in a standard vise
  // ("depending on the material and cutting forces, the maximum size can be
  // significantly larger or somewhat smaller") — i.e. total part height
  // above the table should not exceed ~2x the grip/jaw dimension, which
  // means the UNSUPPORTED portion above the jaw should stay at or below
  // roughly 1x the grip depth for typical cutting loads:
  // https://lang-technik.de/en/service/faq/workholding
  // Independently, thin-wall/cantilever machining guidance (Xometry's CNC
  // design guide, ynypm.com, and the University of Huddersfield thin-wall
  // review) all converge on "reduce radial width of cut before reducing
  // axial depth" and "take multiple lighter passes" as the practical fix
  // once a feature gets tall/flexible relative to its support, rather than
  // a single full-engagement pass:
  // https://www.xometry.com/resources/machining/cnc-machining-thin-walls/
  // https://www.ynypm.com/news/industry-knowledge/cnc-machining/CNC-milling-chatter-problems-that-show-up-in-thin-walls.html
  // No manufacturer source gives a numeric feed/speed derate for a given
  // overhang ratio (LANG's page stops at the sizing rule of thumb, no feed
  // table), so this stays a quantified WARNING rather than an invented
  // silent multiplier on doc/woc/feed — the user sizes the actual response
  // (usually rigid fixturing, roughing to a stub + finishing after
  // re-fixturing, or a lighter radial stepover) using the numbers below,
  // exactly the same reasoning already applied to sfmCapped/hpGovernorNote.
  let overhang = null;
  const cutHeight = featureDepth && featureDepth > 0 ? featureDepth : (loc || 0);
  if (gripDepth && gripDepth > 0 && cutHeight > 0 && (op.docMode === "profile" || op.docMode === "hem" || op.peripheralRough)) {
    const unsupported = Math.max(0, cutHeight - gripDepth);
    const ratio = unsupported / gripDepth; // unsupported : grip — LANG's 2x-height rule implies ~1.0 is the practical ceiling
    overhang = {
      unsupportedHeight: Number(unsupported.toFixed(3)),
      gripDepth: Number(gripDepth.toFixed(3)),
      ratio: Number(ratio.toFixed(2)),
      severity: unsupported <= 0 ? "none" : ratio > 1.0 ? "high" : ratio > 0.5 ? "moderate" : "low",
    };
  }

  // --- Ball nose effective cutting diameter ---
  // A ball nose only cuts at full diameter when the axial depth of cut (doc)
  // is at least the ball radius. At shallower doc — the normal case for 3D
  // contour/profile finishing — the actual contact point is partway up the
  // ball, spinning at a smaller effective diameter. Using the nominal
  // diameter for SFM there overstates real surface speed dramatically (a
  // 0.39" ball nose at 0.20" doc contacts at ~0.20" effective diameter, not
  // 0.39") and understates the chip load needed to hold the same chip
  // thickness. Formula per IMCO/Harvey/NS Tool/CNC Cookbook (all agree):
  //   De = 2 * sqrt(ap * (D - ap))   for ap <= D/2 (ap = axial doc, D = ball dia)
  //   De = D                          for ap > D/2 (full hemisphere engaged)
  // RPM uses De in place of D; feed-per-tooth scales by D/De to hold chip
  // thickness (both applied below, after De is known).
  // --- Radius cutters (corner rounding / concave radius / round insert / bull nose) ---
  // Their cutting diameter varies along the profile, so SFM and chip load are
  // referenced to an EFFECTIVE diameter, not the nominal one:
  //   corner rounding (Harvey SF_712500): pilot = D - 2R;
  //     De = pilot + R when R/pilot < 2.5, else pilot + 0.7R
  //   concave radius (Harvey SF_32800): De = D - 2R
  //   round insert (Mentor CNC / Sandvik): De = D - iC + sqrt(iC^2 - (iC - 2ap)^2)
  //     for ap < iC/2, plus axial chip thinning sqrt(1 - (1 - 2ap/iC)^2)
  //   bull nose (cnc57 / Mentor): De = (D - 2r) + 2 sqrt(ap (2r - ap)) for ap < r,
  //     same axial chip-thinning term with iC = 2r
  // https://harveyperformance.widen.net/content/57m86cyknv/pdf/SF_712500.pdf
  // https://harveyperformance.widen.net/content/pba67otskw/pdf/SF_32800.pdf
  // https://www.mentorcnc.com/en/cnc-milling-cutting-tools-guide/
  // https://cnc57.com/en/technical_information/Effective-Diameter-and-Ball-Nose-Speed
  const radiusKind = tt.radiusKind || null;
  const formKind = (radiusKind === "corner_round" || radiusKind === "concave") ? radiusKind : null;
  const radiusNotes = [];
  let radiusInfo = null;
  let axialThinning = 1;
  let radiusEngMult = 1;
  let formEffD = null;
  if (formKind) {
    let R = cornerRadius > 0 ? cornerRadius : diameter * 0.1;
    if (!(cornerRadius > 0)) radiusNotes.push(`No radius entered — assuming ${R.toFixed(3)}" (10% of diameter). Enter the actual cutter radius.`);
    // A radius at/over half the diameter leaves no core, so it is not a physical
    // cutter. Never return an error object here (the UI reads woc/doc/etc. on every
    // keystroke while the user is typing) — clamp to 45% of D and say so.
    const Rmax = diameter * 0.45;
    if (R > Rmax) {
      radiusNotes.push(`Radius ${R}" is too large for a ${diameter}" cutter (must be < ${(diameter / 2).toFixed(3)}", leaving a core) — calculated with ${Rmax.toFixed(3)}" instead. Check the radius and diameter you entered.`);
      R = Rmax;
    }
    const pilot = diameter - 2 * R;
    formEffD = formKind === "corner_round"
      ? (R / pilot < 2.5 ? pilot + R : pilot + 0.7 * R)
      : pilot;
    const engList = RADIUS_ENGAGEMENTS[formKind];
    const eng = engList.find((e) => e.id === radiusEngagement) || engList[0];
    radiusEngMult = eng.mult;
    const nPass = radiusPassCount(formKind, mat.materialClass);
    const sched = RADIUS_PASS_SCHEDULE[nPass];
    if (!userPinnedWoc) woc = R;
    hemWocBounds = null; // form tools cut a fixed profile — no HP-driven stepover solve
    if (!(axialDoc && axialDoc > 0)) doc = Math.min(R * sched[0], loc > 0 ? loc : Infinity);
    radiusInfo = { kind: formKind, radius: R, pilotDiameter: pilot, effectiveDiameter: formEffD, engagement: eng.name, engagementMult: eng.mult, passes: nPass, passSchedule: sched.map((f) => Number((f * R).toFixed(4))) };
    radiusNotes.push(`Radius cutter: speed and chip load are referenced to the EFFECTIVE diameter ${formEffD.toFixed(3)}" (nominal ${diameter}"), per Harvey Tool's ${formKind === "corner_round" ? "corner-rounding" : "concave-radius"} chart. Engagement "${eng.name}" scales chip load ×${eng.mult}.`);
    radiusNotes.push(`Cut the radius in ${nPass} descending pass${nPass > 1 ? "es" : ""} (${sched.map((f) => (f * R).toFixed(3) + '"').join(", ")} of the ${R.toFixed(3)}" radius per pass, Harvey schedule); the first pass is shown as axial DOC. Climb mill, and finish with a light spring pass for a clean radius.`);
    if (formKind === "corner_round") radiusNotes.push("Corner-rounding cutters are side-cutting only: round the edge from the side or in an existing slot; do not plunge into solid. Plunging into a hole needs the chip load cut to 40–50% (choose that engagement).");
    if (R / pilot >= 2.5) radiusNotes.push("Radius/pilot ratio ≥ 2.5: effective diameter uses 0.7×R (Harvey).");
  } else if (radiusKind === "round_insert") {
    let iC = insertIc > 0 ? insertIc : diameter * 0.5;
    if (!(insertIc > 0)) radiusNotes.push(`No insert diameter entered — assuming IC ${iC.toFixed(3)}" (half the cutter diameter).`);
    if (iC > diameter * 0.9) {
      radiusNotes.push(`Insert diameter ${iC}" must be smaller than the ${diameter}" cutter diameter — calculated with ${(diameter * 0.9).toFixed(3)}" instead. Check the values you entered.`);
      iC = diameter * 0.9;
    }
    const apR = Math.min(doc, iC / 2);
    const De = diameter - iC + Math.sqrt(Math.max(0, iC * iC - Math.pow(iC - 2 * apR, 2)));
    formEffD = Math.max(De, diameter * 0.2);
    if (doc < iC / 2) axialThinning = Math.min(3, 1 / Math.max(0.2, Math.sqrt(Math.max(0, 1 - Math.pow(1 - 2 * doc / iC, 2)))));
    radiusInfo = { kind: "round_insert", insertIc: iC, effectiveDiameter: formEffD, axialThinning };
    if (axialThinning > 1.01) radiusNotes.push(`Round insert at ${doc.toFixed(3)}" depth (< IC/2 = ${(iC / 2).toFixed(3)}"): effective diameter ${formEffD.toFixed(3)}" and axial chip thinning raise the feed ×${axialThinning.toFixed(2)} to hold chip thickness (Mentor CNC / Sandvik). Below ~25% of IC the thinning is heavy — consider a deeper cut or smaller IC.`);
    if (doc > iC / 2) radiusNotes.push("Depth exceeds IC/2: the insert is cutting on its full width, chip thickness equals feed per tooth; keep depth ≤ ~0.25×IC for roughing to protect the insert (Sandvik round-insert guidance, ESTIMATE).");
  } else if (tt.id === "bull_nose" && cornerRadius > 0 && cornerRadius < diameter / 2 && doc > 0 && doc < cornerRadius) {
    const r = cornerRadius;
    const De = (diameter - 2 * r) + 2 * Math.sqrt(Math.max(0, doc * (2 * r - doc)));
    formEffD = Math.max(De, diameter * 0.2);
    axialThinning = Math.min(2, 1 / Math.max(0.3, Math.sqrt(Math.max(0, 1 - Math.pow(1 - doc / r, 2)))));
    radiusInfo = { kind: "bull_nose", cornerRadius: r, effectiveDiameter: formEffD, axialThinning };
    radiusNotes.push(`Bull-nose at ${doc.toFixed(3)}" axial depth (< corner radius ${r}"): effective cutting diameter is ${formEffD.toFixed(3)}" — RPM is computed from it, and the feed is raised ×${axialThinning.toFixed(2)} to hold chip thickness (axial chip thinning, capped at 2×).`);
  }

  let effectiveDiameter = formEffD || diameter;
  if (tt.id === "ball_end" && doc > 0 && doc < diameter) {
    const ap = Math.min(doc, diameter / 2);
    effectiveDiameter = 2 * Math.sqrt(ap * (diameter - ap));
    effectiveDiameter = Math.max(effectiveDiameter, diameter * 0.05); // guard against ~0 at vanishing doc
  }

  // --- Surface speed (SFM) ---
  // Tool-material speed ratio vs solid carbide, resolved by workpiece material
  // class where we have real per-class data (HSS/cobalt/indexable/PCD vary a lot
  // by material — see TOOL_MATERIAL_CLASS_MULT). Falls back to the tool's global
  // sfmMult (e.g. for custom materials without a materialClass, or solid carbide
  // itself which is always 1.0).
  let sfm;
  if (override?.sfm) {
    sfm = override.sfm * Math.min(1, op.sfmMult) * lerp(0.75, 1, speedAgg);
  } else {
    // Materials that publish a dedicated ABSOLUTE drilling SFM window (phenolic
    // laminates: Ready Plastics 300-500 SFM) use it for drill ops, bypassing the
    // generic drilling op.sfmMult (which would double-derate a sourced figure).
    // Phenolic speed windows are published for UNCOATED, polished C-2 carbide
    // (Ready Plastics) — that is the reference tool, so the metal-derived 0.72x
    // "uncoated" derate must not be applied on top of them.
    // A generic coating name must not boost a coated-carbide baseline.
    const coatSfmMult = (mat.materialClass === "phenolic" && coat.id === "none") ? 1.0 : Math.min(1, coat.sfmMult);
    const useDrillRange = !!(mat.drillSfmRange && (op.docMode === "drill" || tt.isDrill));
    const [sfmMin, sfmMax] = useDrillRange ? mat.drillSfmRange : mat.sfmRange;
    sfm = lerp(sfmMin, sfmMax, speedAgg) * toolMatMult * coatSfmMult * (useDrillRange ? 1 : op.sfmMult) * tt.sfmMult;
    if (formKind) {
      // Harvey's radius-cutter charts publish ABSOLUTE speeds (same for coated and
      // uncoated), so replace the end-mill range lerp: class SFM scaled to the
      // grade inside its class, +-15% with aggressiveness.
      const hs = RADIUS_CUTTER_SFM[mat.materialClass];
      if (hs) {
        const mid = (mat.sfmRange[0] + mat.sfmRange[1]) / 2;
        const gradeScale = clamp(mid / classRefMid(mat.materialClass), 0.6, 1.3);
        sfm = hs * gradeScale * lerp(0.85, 1.15, speedAgg) * toolMatMult * op.sfmMult;
      } else {
        sfm *= 0.7; // ESTIMATE: wide full-profile contact in plastics/wood/composites
      }
    }
  }
  if (!tt.isDrill && Number.isFinite(loc) && loc > 0 && doc > loc) {
    inputWarnings.push(`Axial DOC limited to cutting length ${loc.toFixed(4)} in. Clear deeper features in multiple levels.`);
    doc = loc;
    if (featureDepth > 0) {
      passes = Math.ceil(featureDepth / doc);
      stepdown = doc;
    }
  }
  // Standard 20% slotting speed derate (Kennametal, CGS Tool) — full-width
  // engagement generates more heat per flute pass than partial-width milling.
  // The slot operation already carries 0.8. Only apply the missing reduction
  // to solid-entry bore operations (whose nominal op multiplier is 1.0).
  if (op.slotDerate && op.sfmMult > 0.8) sfm *= 0.8 / op.sfmMult;
  // Hard ceiling: no combination of aggressiveness/operation/coating
  // multipliers should ever push a material past its own published
  // "aggressive" SFM by more than a small margin — stacking op.sfmMult (e.g.
  // 2D Contour's 1.1x for wall-finish quality) on top of an already-maxed
  // aggressiveness lerp was letting SFM run 10-20% past the table's own
  // ceiling (e.g. 660 SFM vs A36's stated 600 max), which is well outside
  // what the coating/material can actually sustain. Cap at 1.05x the
  // material's own sfmMax regardless of how the multipliers stack.
  // Apply a tool-grade-specific ceiling, not a solid-carbide ceiling to HSS/PCD.
  const sfmHardCap = override?.sfm > 0 ? override.sfm : formKind ? sfm :
    (tt.isDrill && mat.drillSfmRange ? mat.drillSfmRange[1] : mat.sfmRange[1]) * toolMatMult *
    ((mat.materialClass === "phenolic" && coat.id === "none") ? 1 : Math.min(1, coat.sfmMult));
  const sfmCapped = sfm > sfmHardCap;
  if (sfmCapped) sfm = sfmHardCap;

  // --- RPM --- (effective diameter, not nominal, for ball nose at partial doc)
  let rpm = (sfm * 3.82) / effectiveDiameter;
  const rpmIdeal = rpm;
  rpm = clamp(rpm, m.minRpm, m.maxRpm);
  if (rpm * effectiveDiameter / 3.82 > sfmHardCap * 1.01) blockingReasons.push("Machine minimum RPM exceeds this tool/material speed ceiling. Confirm a suitable catalog rating before cutting.");
  const rpmClamped = Math.abs(rpm - rpmIdeal) > 0.5;

  // --- Chip load per tooth (or feed per revolution for drilling) ---
  // Drilling uses a dedicated feed-per-REVOLUTION curve (CHIP_LOAD_TABLE_DRILL)
  // rather than the end-mill per-tooth table: a twist drill's programmed feed
  // in cncEngine's IPM formula below is rpm * chipLoad with no flute
  // multiplier, so "chipLoad" here must already represent a full revolution's
  // advance, not one tooth's bite — the two quantities differ by roughly
  // 2.5-3x at the same diameter (see cncData.js CHIP_LOAD_TABLE_DRILL comment
  // for manufacturer sourcing). mat.chipLoadFactor still applies on top, same
  // as milling, to scale for material hardness.
  const isDrillOp = op.docMode === "drill" || tt.isDrill;
  const chipCurve = isDrillOp ? "drill" : (mat.chipCurve === "soft" || mat.chipCurve === "plastic") ? mat.chipCurve : "metal";
  let chipLoad;
  if (override?.chipLoad) {
    chipLoad = override.chipLoad * op.chipMult * lerp(0.8, 1.0, aggQ);
  } else {
    // drillChipLoadFactor: materials with a published ABSOLUTE drilling IPR
    // window (phenolics: Ready Plastics 0.004-0.008 IPR) override the milling-
    // derived chipLoadFactor when drilling.
    const matChipFactor = (isDrillOp && mat.drillChipLoadFactor) ? mat.drillChipLoadFactor : mat.chipLoadFactor;
    chipLoad = baseChipLoad(formKind ? formEffD : diameter, chipCurve) * matChipFactor * op.chipMult * tt.chipMult;
    chipLoad *= lerp(0.75, 1.05, aggQ);
    if (formKind) {
      chipLoad *= radiusEngMult;
      // Harvey's concave-radius chart runs ferrous/hard-alloy chip loads at only
      // ~0.35-0.4x its aluminum values (vs ~0.6x for a flat end mill), so trim the
      // metal-curve chip load a further 0.6x there (steel at 0.375" effective:
      // Harvey 0.00093 in/tooth).
      if (formKind === "concave" && ["steel_mild", "steel_alloy", "stainless", "cast_iron", "titanium", "superalloy"].includes(mat.materialClass)) chipLoad *= 0.6;
      if (coat.id !== "none") chipLoad *= 1.15; // Harvey: chip loads are for uncoated cutters, +10-20% if coated
    }
    chipLoad *= axialThinning;
  }
  // Ball nose feed-per-tooth compensation: at reduced effective diameter the
  // edge sweeps a shorter arc per revolution, so the programmed chip load
  // must scale up by D/De to hold the same actual chip thickness (same
  // sources as the effective-diameter formula above).
  let ballFeedCompensation = 1;
  if (tt.id === "ball_end" && effectiveDiameter < diameter) {
    ballFeedCompensation = diameter / effectiveDiameter;
    chipLoad *= ballFeedCompensation;
  }

  // --- HP-driven radial engagement (HEM/adaptive only) ---
  // Manufacturer tool bots (IMCO ToolBot and similar) size the stepover by
  // solving backward from the machine's available horsepower, not from a
  // fixed percentage-of-diameter table — a 30 HP spindle gets a much wider
  // cut than a 5 HP one on the same tool/material at the same aggressiveness.
  // MRR(r) = r·D · doc · rpm · flutes · chipLoad_actual / sqrt(r - r^2), which
  // solves in closed form for r given a target HP:
  //   K = D · doc · rpm · flutes · chipLoad_actual / 2
  //   target = (HP / hpFactor) / K
  //   r = target^2 / (1 + target^2)
  // The provisional percentage-table WOC stays in force (a) when the user
  // pinned a radial load, (b) for non-HEM ops, or (c) when the machine has no
  // HP figure — otherwise it's replaced by the HP-solved value, clamped to
  // the table's floor/ceiling band as a chip-evacuation/deflection safety net.
  //
  // The power BUDGET the solve targets is itself scaled by aggressiveness —
  // not a flat 100% of the spindle every time — so the slider behaves the way
  // a machinist expects: dial to 0% and the cut asks for only a conservative
  // fraction of available HP; dial to 100% and it uses every bit of the
  // spindle's rated power (never more, per the governor below). Floored at
  // 20% utilization at agg=0 rather than 0%, since a near-zero HP target has
  // no meaningful closed-form solution (it would collapse WOC toward zero).
  let hpSolveNote = null;
  const hpUtilizationTarget = Math.min(policy.powerFraction, lerp(0.20, 0.80, aggQ));
  // Applies to HEM/adaptive roughing AND straight peripheral-roughing profile
  // ops (op.peripheralRough) — both populate hemWocBounds above and both want
  // the WOC traded against available HP the same way. Fixed-stepover profile
  // ops (finishing, thread, engrave) leave hemWocBounds null and skip this.
  if ((op.docMode === "hem" || op.peripheralRough) && !userPinnedWoc && hemWocBounds && hpAtCutter > 0 && doc > 0 && rpm > 0 && chipLoad > 0) {
    const hpTarget = hpAtCutter * hpUtilizationTarget;
    const K = (diameter * doc * rpm * flutes * chipLoad) / 2;
    if (K > 0) {
      const target = (hpTarget / mat.hpFactor) / K;
      const rSolved = (target * target) / (1 + target * target);

      if (rSolved < hemWocBounds.floorPct) {
        // Racing RPM to its aggressiveness-driven ceiling first and only then
        // solving WOC starves the stepover before the HP budget is used —
        // real tool bots (IMCO ToolBot and similar) do the opposite: they hold
        // a reasonable, chip-evacuation-friendly stepover and back SFM/RPM off
        // until that stepover alone balances the HP budget. Reproduce that by
        // re-solving RPM at the floor WOC: MRR = floorWoc·doc·rpm·flutes·chipLoad/thinning,
        // hpTarget = MRR·hpFactor  =>  solve rpm directly (chipLoad/thinning both
        // depend on rpm only through chip load's own agg lerp, already fixed above,
        // and thinning depends only on the ratio, which is now fixed at the floor).
        const floorRatio = hemWocBounds.floorPct;
        const floorWoc = diameter * floorRatio;
        const floorThinning = floorRatio < 0.5 ? 1 / Math.sqrt(1 - Math.pow(1 - 2 * floorRatio, 2)) : 1;
        const denom = floorWoc * doc * flutes * chipLoad * floorThinning * mat.hpFactor;
        const rpmForFloor = denom > 0 ? hpTarget / denom : rpm;
        // Only take this path if it lands within a sane speed band for the
        // tool/material (never below the machine's min RPM, never above what
        // ~1.35x the material's max published SFM would imply) — otherwise
        // fall through to the ordinary clamp so we don't invent an unrealistic
        // spindle speed just to hit a power number.
        const sfmMaxRpm = (mat.sfmRange[1] * 1.35 * 3.82) / diameter;
        if (rpmForFloor >= m.minRpm && rpmForFloor <= Math.max(m.maxRpm, sfmMaxRpm)) {
          rpm = clamp(rpmForFloor, m.minRpm, m.maxRpm);
          woc = floorWoc;
          hpSolveNote = `ESTIMATE: stepover held at the selected ${Math.round(floorRatio * 100)}%-diameter floor; RPM reduced toward the ${Math.round(hpUtilizationTarget * 100)}%-HP budget. This application optimization is not an exact manufacturer-toolbot reproduction.`;
        } else {
          woc = floorWoc;
          hpSolveNote = `Stepover reduced toward its ${Math.round(floorRatio * 100)}% practical minimum for this tool/material — even at that narrow engagement it may still be under the targeted ${Math.round(hpUtilizationTarget * 100)}% spindle utilization; consider a shallower axial DOC.`;
        }
      } else {
        const rClamped = clamp(rSolved, hemWocBounds.floorPct, hemWocBounds.ceilingPct);
        woc = diameter * rClamped;
        if (rSolved > hemWocBounds.ceilingPct) {
          hpSolveNote = `Radial engagement capped at ${Math.round(hemWocBounds.ceilingPct * 100)}% of diameter (chip-evacuation ceiling) instead of the HP-solved ${Math.round(rSolved * 100)}% — this tool/material combo hits its stepover limit before using the targeted ${Math.round(hpUtilizationTarget * 100)}% of spindle power.`;
        } else {
          hpSolveNote = `ESTIMATE: radial engagement (${Math.round(rClamped * 100)}% of diameter) solved toward the ${Math.round(hpUtilizationTarget * 100)}%-HP application budget, then limited by the generic engagement window.`;
        }
      }
    }
  }

  rpm = Math.round(rpm);
  // --- Feed multipliers from tool geometry ---
  let feedMult = op.feedMult;
  const thinningNotes = [];
  // Lead-angle (axial) chip thinning for indexable face mills.
  if (tt.id === "face_mill" && leadAngle && leadAngle < 90) {
    const la = clamp(leadAngle, 1, 89);
    feedMult *= 1 / Math.sin(la * Math.PI / 180);
    thinningNotes.push(`Lead-angle chip thinning (${la}°) applied — feed raised to hold chip thickness.`);
  }
  // Radial chip thinning for partial-width (Ae < D/2) cuts. Standard 90°-cutter
  // RCTF: 1 / sqrt(1 - (1 - 2*Ae/D)^2). (The simplified 1/sqrt(Ae/D) over-states
  // the factor by ~2x and is incorrect — it does not match manufacturer output.)
  let radialThinningFactor = 1;
  if (op.adaptive && !formKind && woc > 0 && woc < diameter * 0.5) {
    const ratio = Math.min(0.5, woc / diameter);
    radialThinningFactor = 1 / Math.sqrt(1 - Math.pow(1 - 2 * ratio, 2));
    feedMult *= radialThinningFactor;
    thinningNotes.push(`Radial chip thinning applied (${radialThinningFactor.toFixed(2)}× feed) — feed increased to hold chip thickness at ${Math.round(ratio * 100)}% radial engagement.`);
  }

  // --- Feed (IPM) ---
  let ipm;
  if (op.docMode === "drill" || tt.isDrill) {
    ipm = rpm * chipLoad * deepHoleFeedFactor; // feed per revolution (reduced for deep holes)
  } else {
    ipm = rpm * chipLoad * flutes * feedMult;
  }
  // FINISH-FIRST feed-mark cap: the scallop left between successive tooth
  // passes along the feed direction is Rt = fz^2 / (4 D) (kinematic cusp of a
  // cutter of diameter D — Wojciechowski et al., ball-end-milling surface
  // texture analysis; same geometry as the ball-nose scallop). The programmed
  // feed per tooth of a FINISHING cut is limited so this cusp stays within the
  // roughness budget (h = 4/3 x target Ra, see above).
  let feedMarkCapped = false;
  if (qualityActive && op.finishing && !(op.docMode === "drill" || tt.isDrill) && flutes > 0 && rpm > 0) {
    const fzNow = ipm / (rpm * flutes);
    const Dm = Math.max(effectiveDiameter, diameter * 0.05);
    const fzMax = Math.sqrt(4 * Dm * cuspAllowIn);
    if (fzNow > fzMax) { ipm *= fzMax / fzNow; feedMarkCapped = true; }
  }
  const ipmIdeal = ipm;
  ipm = Math.min(ipm, m.maxIpm);
  const ipmClamped = ipm < ipmIdeal - 0.01;

  // --- Material removal rate & horsepower ---
  let mrr = (op.docMode === "drill" || tt.isDrill)
    ? (Math.PI / 4) * diameter * diameter * ipm
    : woc * doc * ipm;
  let hpRequired = mrr * mat.hpFactor;

  // --- HP governor (final safety net) ---
  // The HP-driven WOC solve above picks the widest engagement the spindle can
  // sustain, but it's clamped to a floor so we never suggest an engagement too
  // narrow for practical chip evacuation. At high aggressiveness settings the
  // RPM/feed can still climb past what that floor-clamped WOC can support —
  // there's no more room to trade width for speed. Real machines don't get to
  // ignore that: if we're still over the spindle's effective (post-
  // efficiency) HP after the WOC solve, back the feed (and therefore
  // RPM-independent MRR) down until hpRequired matches hpAtCutter, exactly
  // like a CAM post processor or the machine's own torque-limiting would in
  // practice. Skipped when hp is unknown/zero.
  let hpGovernorNote = null;
  const hpBudget = hpAtCutter * hpUtilizationTarget;
  if (hpAtCutter > 0 && hpRequired > hpBudget) {
    const governorScale = hpBudget / hpRequired;
    ipm *= governorScale;
    mrr *= governorScale;
    hpRequired = hpBudget;
    hpGovernorNote = `Feed reduced ${Math.round((1 - governorScale) * 100)}% to the ${Math.round(hpUtilizationTarget * 100)}%-HP application budget. This estimated reserve is not a tool-breakage guarantee; reduce WOC/DOC if chip thickness becomes too low.`;
  }
  const targetSfm = sfm;
  sfm = rpm * effectiveDiameter / 3.82;

  // --- Workholding: required clamping force (slip / pull-out check) ---
  // Distinct from the deflection-style "overhang" check above: this is
  // whether the vise/fixture has enough grip AT ALL to keep the part from
  // sliding or being pulled out under the cutting load — the actual failure
  // mode reported from the shop floor (full 2" LOC cut, part gripped only
  // 0.25" per side, part pulled out of the vise mid-program). Runs for every
  // real milling cut (not drilling/tapping, which load the part axially into
  // the table/vise base rather than sideways against the jaws).
  //
  // Tangential cutting force from the horsepower this engine already
  // computed, using the standard shop formula (Tooling World "Calculating
  // the Clamping Force for Machining", itself citing the Machinability Data
  // Handbook's unit-power method — the same hpRequired/mat.hpFactor this
  // engine already uses elsewhere):
  //   Fc (lbf) = hpRequired * 33000 (ft-lb/min/hp) / SFM (ft/min)
  // http://www.toolingworld.com/sites/default/files/CLAMPING_FORCE_FOR_MACHINING.pdf
  //
  // Required clamping force to prevent slip, with a safety factor:
  //   F_clamp >= (Fc * n) / mu
  // mu = jaw friction coefficient (WORKHOLDING_JAW_TYPES, cncData.js) —
  // defaults to smooth-jaw dry (mu=0.20, the conservative/lower-grip case)
  // when the user hasn't specified a jaw type. n = safety factor, 2-5x per
  // both sourced references below; this engine uses 3x for continuous
  // engagement (contour/adaptive/pocket/face) and 4x for full-radial/
  // interrupted engagement (slotting, boring a slot-style hole) — both
  // squarely inside the sourced ranges, not picked arbitrarily:
  // https://machally.com/us/blog/workholding-clamping-force-calculation/
  // (continuous milling n=2.0-3.0, slot milling full radial n=2.5-3.5,
  //  interrupted/entry-exit shock n=3.0-5.0)
  let workholding = null;
  if (hpAtCutter > 0 && sfm > 0 && op.docMode !== "drill" && op.docMode !== "tap" && !tt.isDrill && !tt.isTap) {
    const jaw = WORKHOLDING_JAW_TYPES.find((j) => j.id === jawTypeId) || WORKHOLDING_JAW_TYPES[0];
    const cuttingForce = (hpRequired * 33000) / sfm; // lbf
    const safetyFactor = op.slotDerate ? 4 : 3;
    const requiredClampForce = (cuttingForce * safetyFactor) / jaw.mu;
    const ratedClampForce = clampForce && clampForce > 0 ? clampForce : null;
    // A universal 40% aluminum-jaw force limit cannot predict yielding without
    // jaw dimensions, support, alloy/temper and contact area. Do not invent a
    // material-only strength capacity. Friction check only, strength unverified.
    const usableClampForce = ratedClampForce;
    const clampMargin = usableClampForce ? usableClampForce / requiredClampForce : null;
    workholding = {
      cuttingForce: Number(cuttingForce.toFixed(1)),
      requiredClampForce: Number(requiredClampForce.toFixed(1)),
      ratedClampForce,
      usableClampForce: usableClampForce != null ? Number(usableClampForce.toFixed(1)) : null,
      forceDerate: 1,
      jawStrengthEvaluated: false,
      clampMargin: clampMargin != null ? Number(clampMargin.toFixed(2)) : null,
      jawTypeId: jaw.id,
      mu: jaw.mu,
      safetyFactor,
      insufficient: usableClampForce != null && clampMargin < 1.0,
      // True when the VISE's rated force would have been enough, but the
      // aluminum jaw's own strength derate is what actually pushes the
      // usable force below the requirement -- i.e. the bottleneck is the
      // soft jaw material, not the vise mechanism itself.
      jawLimited: false,
    };
  }

  // --- Entry into stock (helical ramp / linear ramp / plunge) ---
  // Starting a pocket, slot or bore with the SAME end mill means the tool is
  // buried: chip thickness = fz (a slot-like cut, no radial chip thinning), so
  //   * ramp angle follows the material class (Harvey/Helical 1-3 deg ferrous,
  //     3-10 deg non-ferrous; stainless/Ti/superalloy 1-2 deg),
  //   * helix pitch per orbit = PI x pathD x tan(angle), never more than the
  //     axial DOC (Sandvik: pitch can never exceed max ap),
  //   * entry feed = 50% of normal fz (Harvey: reduce at least 50% until fully
  //     engaged; Sandvik linear ramp 75%, 2-axis ramping -30..-50%),
  //   * spindle RPM unchanged (CNCCookbook: no reason to change RPM on a ramp),
  //   * programmed helix feed acts on the tool CENTERLINE:
  //     F_cl = F_edge x (D_hole - D_tool) / D_hole (Kennametal ID interpolation).
  // Two different "per rev" numbers exist and are reported separately:
  //   pitchPerOrbit  = Z drop per ONE lap around the helix path circle,
  //   axialIprSpindle = Z drop per SPINDLE revolution (= Z feed / RPM).
  // https://www.harveyperformance.com/in-the-loupe/ramping-success/
  // https://www.harveyperformance.com/in-the-loupe/types-tool-entry/
  // https://www.sandvik.coromant.com/en-us/knowledge/milling/milling-holes-cavities-pockets/ramping
  // https://www1.mscdirect.com/images/solutions/kennametal/millingTechInfoInterpolation.pdf
  const ENTRY_OP_IDS = ["2d_pocket", "2d_adaptive_rough", "2d_circular_pocket", "2d_bore_rough", "bore", "slotting", "3d_pocket", "3d_adaptive_rough"];
  const entryWarn = [];
  let entry = null;
  const isFormCutter = !!tt.radiusKind || ["chamfer", "slitting_saw", "t_slot", "drill", "tap"].includes(tt.id);
  if (ENTRY_OP_IDS.includes(baseOp.id) && !tt.isDrill && !tt.isTap) {
    if (isFormCutter) {
      if (tt.radiusKind || tt.id === "chamfer") entryWarn.push(`${tt.name}: do not ramp, helix or plunge a form/radius cutter into solid — pre-drill or start from open air and enter from the side (Harvey: radius and chamfer cutters are not center-cutting plunge tools).`);
    } else {
      const matClass = mat.materialClass;
      const band = (matClass && RAMP_ANGLE_BY_CLASS[matClass]) || RAMP_ANGLE_DEFAULT;
      const fin = Number.isFinite(aggQ) ? aggQ : 0.6;
      const rampDeg = Number((band.lo + (band.hi - band.lo) * clamp(fin, 0, 1) * 0.6).toFixed(1));
      const tanA = Math.tan(rampDeg * Math.PI / 180);
      const pre = (baseOp.circularKind === "bore_rough" && pilotDiameter > 0);
      let method = ["helix", "ramp", "plunge", "predrilled"].includes(entryMethod) ? entryMethod : null;
      if (pre) method = "predrilled";
      if (!method) method = (baseOp.id === "slotting") ? "ramp" : "helix";
      const D = diameter;
      const insertTool = tt.countField === "inserts";
      const centerCutting = !insertTool && tt.id !== "face_mill";
      const entryDepth = (baseOp.circularKind === "bore_rough")
        ? ((featureDepth && featureDepth > 0) ? featureDepth : doc)
        : Math.min(doc, (featureDepth && featureDepth > 0) ? featureDepth : doc);
      const fzEntry = chipLoad * (ENTRY_FEED_FACTOR[method] || 0.5);
      entry = {
        method, rampAngleDeg: rampDeg, rampBand: [band.lo, band.hi], rampBandSource: band.src,
        rampAngleEstimate: true, entryDepth: Number(entryDepth.toFixed(4)), notes: [
          "ESTIMATE: the selected ramp angle is a class-level starting point, not the exact cutter's catalog ramp limit.",
        ],
      };
      if (method === "predrilled") {
        entry.notes.push(pre ? "Pilot hole entered: the tool enters the existing hole, so no helix/ramp feed reduction applies at the start. Feed the first axial move only into open pilot." : "Pre-drilled / side entry: no ramp is programmed. Enter from a drilled hole at least 1.2x the cutter diameter, or from open air with an arc lead-in (Harvey: arcing enters from the side and ramps load gradually).");
      } else if (D > 0 && rpm > 0 && flutes > 0) {
        const entryIpmEdge = Math.min(rpm * flutes * fzEntry, m.maxIpm,
          hpBudget / Math.max(1e-12, diameter * doc * mat.hpFactor));
        entry.entryFpt = Number((entryIpmEdge / (rpm * flutes)).toFixed(7));
        entry.entryTargetFpt = fzEntry;
        entry.entryFeedFactor = entryIpmEdge / (rpm * flutes * chipLoad);
        entry.entryNominalFactor = ENTRY_FEED_FACTOR[method];
        entry.rpm = Math.round(rpm);
        entry.entryEdgeIpm = Number(entryIpmEdge.toFixed(1));
        entry.feedPerRev = Number((entryIpmEdge / rpm).toFixed(5));
        if (insertTool) entryWarn.push("Indexable cutter: maximum ramp angle depends on the insert radius and body (Sandvik) — check the catalog ramp limit; for round inserts keep the ramp at 1-2 deg. Entry feed is the solid-carbide default; Sandvik uses 75% of normal for linear ramps with inserts.");
        if (method === "helix") {
          const userHelix = (helixDiameter > 0 && Number.isFinite(helixDiameter));
          let hole;
          const Dh = (featureDiameter > 0 && Number.isFinite(featureDiameter)) ? featureDiameter : null;
          if (userHelix) hole = helixDiameter;
          else if (op.circular && Dh && Dh <= D * HELIX_DIA_SLUG_MULT) hole = Dh;
          else hole = D * HELIX_DIA_DEFAULT_MULT;
          if (hole < D * HELIX_DIA_MIN_MULT) {
            entryWarn.push(`Helix hole Ø${hole.toFixed(3)}\" is below ${HELIX_DIA_MIN_MULT}x the cutter — the tool cannot orbit; using ${(D * HELIX_DIA_MIN_MULT).toFixed(3)}\". Use a hole of ${(D * HELIX_DIA_PRACTICAL_MULT).toFixed(3)}\" or more (carbide-tooling.com helical interpolation guide).`);
            hole = D * HELIX_DIA_MIN_MULT;
          } else if (hole < D * HELIX_DIA_PRACTICAL_MULT - 1e-9) {
            entryWarn.push(`Helix hole is only ${(hole / D).toFixed(2)}x the cutter — below 1.2x chips pack and re-cut; Harvey/Helical recommend a helix 110-120%+ of the cutter diameter, Global Cutting Tools 115-130%.`);
          }
          if (hole > D * HELIX_DIA_SLUG_MULT + 1e-9) {
            entryWarn.push(`Helix hole Ø${hole.toFixed(3)}\" is more than 2x the cutter — it leaves a Ø${(hole - 2 * D).toFixed(3)}\" core slug that can jam or break the tool (Sandvik: max hole in one spiral = 2 x D). Use a smaller helix and clear the rest with the pocket pass.`);
          }
          const pathD = hole - D; // positive after the minimum hole/cutter ratio check
          const pitchMax = Math.PI * pathD * tanA;
          const pitch = Math.min(doc, pitchMax);
          const actualDeg = Math.atan(pitch / (Math.PI * pathD)) * 180 / Math.PI;
          const factor = (hole - D) / hole;
          let cl = entryIpmEdge * factor;
          // MRR of a fully-cleared helical hole = (PI Dh^2/4) * Z feed.
          // A large-hole core slug is not certified by this volumetric check.
          const hpPerIpm = mat.hpFactor * hole * hole * pitch / (4 * pathD);
          if (hpPerIpm > 0 && cl * hpPerIpm > hpBudget) {
            cl = hpBudget / hpPerIpm;
            entry.notes.push("Helix feed reduced further to the application power budget. Confirm bottom-edge ramp capability in the exact tool catalog.");
          }
          entry.entryEdgeIpm = Number((cl / factor).toFixed(5));
          entry.entryFpt = cl / factor / (rpm * flutes);
          entry.entryFeedFactor = entry.entryFpt / chipLoad;
          entry.feedPerRev = cl / factor / rpm;
          const orbitsPerMin = cl / (Math.PI * pathD);
          entry.helixHoleDia = Number(hole.toFixed(4));
          entry.helixHoleMult = Number((hole / D).toFixed(2));
          entry.pathDia = Number(pathD.toFixed(4));
          entry.pitchPerOrbit = Number(pitch.toFixed(4));
          entry.rampAngleDeg = Number(actualDeg.toFixed(1));
          entry.turns = Math.max(1, Math.ceil(entryDepth / Math.max(pitch, 1e-6)));
          entry.centerlineFactor = Number(factor.toFixed(3));
          entry.rampFeed = Number(cl.toFixed(1));
          entry.programmedFeedPerRev = cl / rpm;
          entry.axialFeedIpm = Number((pitch * orbitsPerMin).toFixed(2));
          entry.axialIprSpindle = Number((pitch * orbitsPerMin / rpm).toFixed(5));
          if (pitch < doc * 0.999 && actualDeg < rampDeg + 0.05) entry.notes.push(`Pitch ${pitch.toFixed(4)}\" per orbit (${rampDeg}° on a Ø${pathD.toFixed(3)}\" path circle) is shallower than the ${doc.toFixed(3)}\" step-down — it takes ${entry.turns} turns to reach ${entryDepth.toFixed(3)}\".`);
          if (actualDeg < rampDeg - 0.05) entry.notes.push(`Pitch capped at the axial depth of cut (${doc.toFixed(3)}\"), which is a ${actualDeg.toFixed(1)}° ramp on this path circle (Sandvik: pitch never larger than max ap).`);
          entry.notes.push("Program the helix counter-clockwise (G3) for climb milling (Sandvik). Helix feed shown is the tool-centerline feed; with cutter radius compensation use the edge feed instead. Path-length difference of a helix vs. its XY arc is under 2% for ramps up to 10°.");
          entry.notes.push("Prefer a corner-radius end mill for helical entry — the radius survives the bottom-corner load better than a sharp square corner (Harvey/Helical).");
        } else if (method === "ramp") {
          entry.rampFeed = Number(entryIpmEdge.toFixed(1));
          entry.axialFeedIpm = Number((entryIpmEdge * tanA).toFixed(2));
          entry.axialIprSpindle = Number((entryIpmEdge * tanA / rpm).toFixed(5));
          entry.rampLength = Number((entryDepth / tanA).toFixed(3));
          entry.notes.push(`Linear ramp is a full-width slot cut (Sandvik: circular ramping is always preferred). It needs ${entry.rampLength}\" of travel to drop ${entryDepth.toFixed(3)}\" at ${rampDeg}° — ramp back and forth (progressive ramping) if the pocket is shorter.`);
          entry.notes.push("After the ramp, keep the reduced feed for about one cutter diameter of travel until the tool is fully engaged (Sandvik).");
        } else if (method === "plunge") {
          const plungeIpr = chipLoad * flutes * ENTRY_FEED_FACTOR.plunge;
          const plungeIpm = Math.min(plungeIpr * rpm, m.maxIpm,
            hpBudget / Math.max(1e-12, Math.PI * D * D / 4 * mat.hpFactor));
          entry.plungeIpr = Number((plungeIpm / rpm).toFixed(5));
          entry.plungeIpm = Number(plungeIpm.toFixed(1));
          entry.rampFeed = entry.plungeIpm;
          entry.axialFeedIpm = entry.plungeIpm;
          entry.axialIprSpindle = entry.plungeIpr;
          entry.entryEdgeIpm = entry.plungeIpm;
          entry.entryFpt = plungeIpm / (rpm * flutes);
          entry.entryFeedFactor = entry.entryFpt / chipLoad;
          entry.feedPerRev = plungeIpm / rpm;
          entry.notes.push("Plunge feed = 50% of the normal chip load per revolution (Harvey: plunge chip load -50%). Use only center-cutting end mills; ramping or helixing is gentler and gives smaller, easier-to-clear chips.");
          if (!centerCutting) entryWarn.push("This cutter is not center-cutting — do NOT plunge it. Use a helical ramp into a pre-drilled hole.");
        }
        if (matClass === "plastic" || matClass === "wood") entry.notes.push("Single-flute / O-flute tools evacuate the ramp chip best in plastics and wood; keep the ramp feed up so the chip carries the heat away rather than melting.");
        if (matClass === "composite" || matClass === "phenolic") entry.notes.push("Laminate: a steep ramp or plunge pushes the plies apart and delaminates the entry. Keep the ramp shallow and use a sharp, diamond-coated or carbide tool.");
        if (band.estimate) entry.notes.push(`ESTIMATE: no manufacturer publishes a ramp band for this material class; ${band.lo}-${band.hi}° was chosen inside the published non-ferrous/ferrous band (${band.src}).`);
      }
    }
  }

  // --- Circular features (bore / circular pocket / boss) ---
  // The programmed G2/G3 feed acts on the TOOL CENTERLINE, but the chip load
  // is set at the CUTTING EDGE. Internal: the edge travels on a LARGER circle
  // than the centerline so the centerline feed must be REDUCED; external: the
  // edge is on a SMALLER circle so it must be INCREASED:
  //   internal  F_cl = F_edge x (D_feature - D_tool) / D_feature
  //   external  F_cl = F_edge x (D_feature + D_tool) / D_feature
  // https://www.shader7.com/cnc-circular-interpolation-g02-g03
  // https://carbide-tooling.com/tools/helical-interpolation-calculator/
  // (Skipping this on a 12 mm cutter in a 50 mm bore runs the edge 32% too
  // fast; on a boss it runs the edge too slow and rubs.)
  let circular = null;
  const circWarn = [];
  if (op.circular) {
    const Dh = featureDiameter && featureDiameter > 0 ? featureDiameter : null;
    const internal = op.circular === "internal";
    circular = { kind: baseOp.circularKind, internal, featureDiameter: Dh, notes: [] };
    if (!Dh) {
      circular.centerlineFactor = 1;
      circular.centerlineIpm = Number(ipm.toFixed(1));
      circWarn.push(`Enter the ${internal ? (baseOp.circularKind === "pocket_rough" ? "pocket" : "bore") : "boss"} diameter — without it the circular-interpolation feed correction (centerline vs. cutting-edge feed) cannot be applied, and the displayed feed is the cutting-EDGE feed.`);
    } else {
      const factor = internal ? (Dh - diameter) / Dh : (Dh + diameter) / Dh;
      circular.centerlineFactor = Number(Math.max(0.02, factor).toFixed(3));
      circular.edgeIpm = Number(ipm.toFixed(1));
      circular.centerlineIpm = Number((ipm * Math.max(0.02, factor)).toFixed(1));
      circular.pathDiameter = Number((internal ? Dh - diameter : Dh + diameter).toFixed(4));
      if (internal) {
        if (Dh <= diameter * 1.05) circWarn.push(`Bore Ø${Dh}" is not larger than 1.05x the tool (Ø${diameter}") — the cutter cannot orbit; use a smaller tool (carbide-tooling.com helical interpolation guide).`);
        else if (Dh < diameter * 1.2) circWarn.push(`Bore is only ${(Dh / diameter).toFixed(2)}x the tool diameter — below 1.2x the tool rubs the wall and chip evacuation is poor, chips re-cut and gall the bore. Use a tool at most ~83% of the bore diameter.`);
        if (diameter / Dh > 0.8) circular.notes.push("Tool is > 80% of the bore: the ring is very thin, so the whole wall engages at once and chip room is minimal — prefer a smaller tool for rough, a larger one only for the finish pass.");
        if (op.solidStart && Dh > diameter * 2 + 1e-9) {
          circWarn.push(`Opening Ø${Dh}" from solid with a Ø${diameter}" tool leaves a Ø${(Dh - 2 * diameter).toFixed(3)}" core slug — it will loosen and jam or drop into the cutter. Enter a pilot hole diameter, add ring passes, or drill it out first.`);
        }
        // Helical entry (pitch, ramp angle, turns) comes from the shared entry
        // model above (class-based ramp angle, pitch <= axial DOC).
        if ((baseOp.circularKind === "bore_rough" || baseOp.circularKind === "pocket_rough") && entry && entry.method === "helix" && entry.pitchPerOrbit != null) {
          circular.helixPitch = entry.pitchPerOrbit;
          circular.rampAngleDeg = entry.rampAngleDeg;
          circular.helixTurns = entry.turns;
        }
        // Radial ring passes
        if (baseOp.circularKind === "pocket_rough") {
          const radiusTravel = (Dh - diameter) / 2;
          circular.ringPasses = Math.max(1, Math.ceil(radiusTravel / Math.max(woc, 1e-4)));
        } else if (baseOp.circularKind === "bore_rough" && pilotDiameter > 0) {
          const stockPerSide = Math.max(0, (Dh - pilotDiameter) / 2);
          circular.ringPasses = Math.max(1, Math.ceil(stockPerSide / Math.max(woc, 1e-4)));
          circular.stockPerSide = Number(stockPerSide.toFixed(4));
        }
      } else if (baseOp.circularKind === "boss_rough" || baseOp.circularKind === "boss_finish") {
        circular.notes.push("Boss: the cutter edge is on a smaller circle than the centerline path, so the centerline feed is raised. Approach and exit on a tangent arc so the tool does not dwell on the wall.");
      }
      if (baseOp.finishing) {
        circular.notes.push("Run a spring pass (repeat the finish circle at zero radial infeed) to remove deflection error and taper, and finish with a fresh tool (Shader7 circular-interpolation guide; Seco finish-stock guide).");
        if (internal) circular.notes.push("Tolerance tighter than IT7 (~0.0007-0.0010\" on a 1\" bore) is a boring-head or reamer job — a circular-interpolated end mill leaves a slightly tapered, deflection-limited bore (carbide-tooling.com).");
      } else if (internal) {
        circular.notes.push("Leave finish stock on the bore wall (see Finish Plan) and cut the final size with the Bore Finish operation.");
      }
      if (internal && circular.centerlineFactor < 0.6) circWarn.push(`Centerline feed is only ${Math.round(circular.centerlineFactor * 100)}% of the cutting-edge feed because the tool is large relative to the bore — program ${circular.centerlineIpm} IPM on the G2/G3 path (not ${circular.edgeIpm}) or the edge will run ${Math.round((1 / circular.centerlineFactor - 1) * 100)}% too fast.`);
    }
  }

  // --- Finish plan (stock to leave, spring pass, predicted finish) ---
  // Seco Tools: finish stock allowance is 1-2% of the finishing cutter
  // diameter (most manufacturers base finishing data on that engagement), and
  // for tools below ~3 mm leave ~2% so the edge still bites. Leaving more
  // than that "will result in lost productivity"; leaving less rubs.
  let finishPlan = null;
  const plannedStock = stockPlan(baseOp, diameter, input.finishToolDiameter);
  const isMillingCut = !(op.docMode === "drill" || op.docMode === "tap" || tt.isDrill || tt.isTap);
  if (isMillingCut && op.id !== "engrave" && op.id !== "thread" && tt.id !== "slitting_saw") {
    if (op.finishing) {
      finishPlan = {
        role: "finish",
        springPass: op.docMode !== "face",
        climb: true,
        freshTool: true,
        priority: prio,
        scallop,
        feedMarkCapped,
        stockToLeaveRadial: 0, stockToLeaveAxial: 0, stockToLeaveNormal: 0,
        notes: [
          plannedStock.reason,
          "Climb milling and a dedicated finish tool can help. Use a spring pass only when deflection/repeatability warrants it; it is not mandatory and may rub.",
        ],
      };
    } else {
      finishPlan = {
        role: "rough",
        stockToLeaveRadial: Number(plannedStock.radial.toFixed(5)),
        stockToLeaveAxial: Number(plannedStock.axial.toFixed(5)),
        stockToLeaveNormal: Number(plannedStock.normal.toFixed(5)),
        allowanceEstimate: plannedStock.estimate,
        priority: prio,
        notes: [
          plannedStock.reason,
          "ESTIMATE: allowance uses 1.5% of the finish-tool diameter (or current tool if unknown). Seco's 1-2% finish-stock guidance is not a universal floor/material specification. Account for tolerance, roughness, deflection and minimum chip thickness.",
        ],
      };
    }
  }

  // --- Tool deflection (worst-case estimate) ---
  // Cantilever beam: delta = F L^3 / (3 E I), I = pi d^4 / 64 with the flute
  // core taken as 0.8 D (same cantilever model as online-tools.work/metal/en/
  // tool-deflection and formulafactory.tools tool-deflection calculator).
  // F is an approximate tangential force, NOT a proven upper bound on radial
  // force. L defaults to LOC, which can understate actual stickout. Assumed
  // core diameter 0.8D and force direction make this an ESTIMATE, not a worst case.
  let deflection = null;
  if (isMillingCut && hpAtCutter > 0 && sfm > 0 && loc > 0) {
    const Fc = (hpRequired * 33000) / sfm;
    const E = tm.id === "carbide" ? 87e6 : 30e6; // psi: cemented carbide ~600 GPa, HSS/cobalt steel ~207 GPa
    const dCore = 0.8 * diameter;
    const I = (Math.PI * Math.pow(dCore, 4)) / 64;
    const delta = (Fc * Math.pow(loc, 3)) / (3 * E * I);
    deflection = { estimateIn: Number(delta.toFixed(5)), forceLbf: Number(Fc.toFixed(1)), limitIn: 0.001 };
  }

  // --- Warnings ---
  const corner = contourCorner(input, { woc, ipm });
  if (corner?.exceedsStepover) blockingReasons.push(corner.reason);
  if (corner && !corner.fits) blockingReasons.push("Current cutter cannot interpolate the requested inside radius. Use a smaller cutter with clearance.");
  if (corner?.feedBlockReason) blockingReasons.push(corner.feedBlockReason);
  if (corner && !corner.previousStockKnown) inputWarnings.push("Prior roughing wall stock was not entered. Corner estimate assumes zero wall stock; enter the actual CAM value.");
  if (formKind && op.docMode === "slot") blockingReasons.push("Form/radius cutters must not slot or plunge into solid; use a matching side/form operation.");
  if (entry && entry.method !== "predrilled" && ["face_mill", "round_insert"].includes(tt.id)) blockingReasons.push("Indexable solid entry needs an exact cutter ramp/plunge rating, which is not provided by this generic model. Use a verified pilot/side entry.");
  if (entry?.helixHoleMult > 2) blockingReasons.push("A helix larger than twice the tool leaves a core slug. Clear it with a suitable strategy before running.");
  if (entry?.helixHoleDia && featureDiameter > 0 && entry.helixHoleDia > featureDiameter + 1e-6) blockingReasons.push("Helix entry does not fit inside the entered feature diameter.");
  if (override?.requiresCatalogReview) inputWarnings.push("Brand lookup is AI-assisted, not independently verified. Confirm material hardness, operation, engagement and whether the catalog feed already includes chip thinning before applying this result.");
  const warnings = [...thinningNotes, ...circWarn, ...entryWarn, ...inputWarnings, ...blockingReasons];
  if (workholding) warnings.push("Workholding is an estimated friction/slip screen only. Jaw bending/yield, contact pressure and dynamic holding strength are not calculated; enter geometry and supplier capacity separately.");
  if (mat.notes && mat.notes.length) for (const n of mat.notes) warnings.push(`${mat.name}: ${n}`);
  if (mat.abrasive && (tm.id === "hss" || tm.id === "cobalt")) warnings.push(`${mat.name} is abrasive — ${tm.name} will wear very quickly; use solid carbide (diamond-coated or PCD for production).`);
  if (mat.materialClass === "phenolic" && (tm.id === "hss" || tm.id === "cobalt")) warnings.push(`${mat.name}: ${tm.name} is viable only for low volume (< ~20 parts per operation) on paper/cotton phenolic — carbide (uncoated C-2, sharp, polished flutes) is the standard and holds life far longer. A dulling tool raises heat, which drives formaldehyde off-gassing and edge chipping (Ready Plastics phenolic guide). Speeds shown use an estimated HSS derate.`);
  if (mat.materialClass === "plastic" && clampForce && clampForce > 1500) warnings.push(`Plastics deform under clamping load that is routine for metal — your vise is rated ${Math.round(clampForce)} lbf. Torque it down just enough to hold (cutting forces in plastic are a few pounds), use wide flat soft jaws or vacuum, and re-measure after release (Ready Plastics: over-clamping bows/pinches nylon, PP, PTFE and Ertalyte).`);
  if (finishFirst && op.finishing && deflection && deflection.estimateIn > deflection.limitIn) warnings.push(`Finish quality: screening deflection estimate ${deflection.estimateIn.toFixed(4)}" (> ${deflection.limitIn}") using LOC as length. Actual stickout/core and force direction are unknown; shorten the tool or use a stiffer setup.`);
  if (feedMarkCapped) warnings.push(`Finish quality: feed per tooth was reduced so the theoretical feed-mark cusp (fz²/4D) stays within the ${Math.round(raTargetIn * 1e6)} µin Ra target.`);
  if (sfmCapped) warnings.push(`SFM capped at ${Math.round(sfmHardCap)} (105% of ${mat.name}'s published range) — the stacked aggressiveness/operation/coating multipliers wanted a higher speed than this material and coating can realistically sustain.`);
  if (tt.id === "ball_end" && effectiveDiameter < diameter * 0.999) warnings.push(`Ball nose effective cutting diameter is ${effectiveDiameter.toFixed(3)}" at ${doc.toFixed(3)}" axial DOC (nominal diameter ${diameter}") — RPM and chip load are computed from this smaller effective diameter, not the nominal one, per standard ball-nose speed/feed correction.`);
  for (const n of radiusNotes) warnings.push(n);
  if (hpSolveNote) warnings.push(hpSolveNote);
  if (hpGovernorNote) warnings.push(hpGovernorNote);
  if (hpRequired > hpAtCutter) warnings.push(`Requires ~${hpRequired.toFixed(1)} HP but the machine has ${hpAtCutter} HP — reduce DOC/WOC or feed.`);
  if (rpmClamped) warnings.push(rpm > rpmIdeal ? `Machine minimum RPM forced speed above target; verify tool/material limits before cutting.` : `Spindle max RPM reached (target ${Math.round(rpmIdeal)}). Actual cutting speed is lower and feed uses achieved RPM. Do not raise SFM to compensate.`);
  if (ipmClamped) warnings.push(`Machine max feed (${m.maxIpm} IPM) limits the programmed feed.`);
  if (loc && (op.docMode === "profile" || op.docMode === "hem") && doc > loc) warnings.push(`Per-pass axial DOC (${doc.toFixed(3)}") exceeds flute LOC (${loc}") — confirm chip evacuation.`);
  if (overhang && overhang.severity === "high") warnings.push(`Workholding: ${overhang.unsupportedHeight}" of this cut is above your ${overhang.gripDepth}" grip depth (${overhang.ratio}x the grip) — the workpiece itself is now the flexible cantilever, not just the tool. LANG Technik's vise-sizing rule of thumb caps workpiece height at ~2x the jaw/grip dimension for this reason. Rough to a support stub and finish after re-fixturing, use a taller vise step/soft jaws, add a tailstock or steady support, or cut in from the top down instead of a single full-height pass around the outside.`);
  else if (overhang && overhang.severity === "moderate") warnings.push(`Workholding: ${overhang.unsupportedHeight}" of this cut is above your ${overhang.gripDepth}" grip depth (${overhang.ratio}x the grip) — getting close to the point where the workpiece, not the tool, starts flexing. Consider a lighter radial stepover or an extra finishing pass on this feature if you see chatter or a tapered wall.`);
  if (workholding && workholding.insufficient && workholding.jawLimited) warnings.push(`Workholding: this cut needs ~${Math.round(workholding.requiredClampForce)} lbf of clamping force, and the vise itself is rated for ${Math.round(workholding.ratedClampForce)} lbf — enough on paper — but aluminum soft jaws only reliably deliver ~${Math.round(workholding.forceDerate * 100)}% of that (${Math.round(workholding.usableClampForce)} lbf usable) before the jaw material itself yields. The jaw, not the vise, is the weak link here. Switch to steel soft jaws bored to the same part profile for this operation, or reduce DOC/WOC/feed.`);
  else if (workholding && workholding.insufficient) warnings.push(`Workholding: this cut needs ~${Math.round(workholding.requiredClampForce)} lbf of clamping force (${Math.round(workholding.cuttingForce)} lbf cutting force x ${workholding.safetyFactor}x safety factor ÷ ${workholding.mu} friction) but the vise is only rated for ${Math.round(workholding.ratedClampForce)} lbf — the part can slip or pull out under this load, exactly like a full-LOC cut on a shallow grip. Reduce DOC/WOC/feed, switch to serrated or soft jaws for more grip, or add a second point of support (tailstock, strap, stop block) before running this program.`);
  else if (workholding && !workholding.ratedClampForce && overhang && (overhang.severity === "moderate" || overhang.severity === "high")) warnings.push(`Workholding: this cut needs an estimated ~${Math.round(workholding.requiredClampForce)} lbf of clamping force (${Math.round(workholding.cuttingForce)} lbf cutting force x ${workholding.safetyFactor}x safety factor ÷ ${workholding.mu} friction, ${WORKHOLDING_JAW_TYPES.find((j)=>j.id===workholding.jawTypeId)?.name.toLowerCase()}) — enter your vise's rated clamping force to check it against this number directly, especially combined with the shallow grip depth flagged above.`);
  if (op.docMode === "slot" && diameter >= 0.5 && flutes >= 4) warnings.push("Slotting with 4+ flutes at this diameter risks chip packing — consider 2-3 flutes or air blast.");
  if (tt.id === "bull_nose" && cornerRadius && op.docMode === "slot" && doc > cornerRadius * 2) warnings.push("Bull-nose full-width slotting deeper than the corner radius — chip evacuation at the radius is tight; peck or reduce DOC.");
  if (mat.category === "Stainless" || mat.category === "Titanium" || mat.category === "Superalloy") warnings.push("Work hardening / heat-sensitive alloy — keep chip load up, avoid rubbing, use coolant or air.");
  if (mat.id === "cfrp" || mat.id === "g10") warnings.push("Abrasive composite — expect rapid tool wear; diamond-coated carbide recommended.");
  if (mat.id === "g11") warnings.push("Abrasive composite — expect rapid tool wear; diamond-coated carbide recommended. G11's higher-crosslink resin is slightly more abrasive than G10/FR4 — DOC already reduced ~12% for this material; avoid pushing feeds back up to G10 levels.");
  if (coat.verified === false) warnings.push(`${coat.name} speed multiplier is an engineering estimate — no manufacturer speed chart is published for this coating.`);
  if (mat.hpFactorEstimate) warnings.push("Horsepower factor for this material is an engineering estimate, not sourced from a published handbook value.");

  // Programmed feed per tooth = table feed / (rpm × flutes). This is the value
  // entered in CAM; it exceeds the actual chip thickness whenever chip thinning applies.
  const programmedFpt = (op.docMode === "drill" || tt.isDrill || !flutes || flutes <= 0 || rpm <= 0)
    ? null
    : ipm / (rpm * flutes);

  return {
    sfm: Math.round(sfm),
    rpm: Math.round(rpm),
    targetChipLoad: Number(chipLoad.toFixed(7)),
    chipLoad: Number((tt.isDrill && rpm > 0 ? ipm / rpm : chipLoad).toFixed(7)),
    programmedFpt: programmedFpt != null ? Number(programmedFpt.toFixed(5)) : null,
    ipm: Number(ipm.toFixed(5)),
    woc: Number(woc.toFixed(6)),
    doc: Number(doc.toFixed(6)),
    // Light-engagement ops (engrave, thread milling, pencil finishing, tiny
    // slitting-saw kerfs) legitimately remove well under 0.01 in3/min — a
    // fixed 2-decimal round was displaying those correct, nonzero MRR values
    // as a flat "0.00", which reads as a broken calculation even though the
    // underlying number is physically right. Use 4 decimals below 0.01 so
    // small-but-real removal rates stay visible instead of rounding to zero.
    mrr: Number(mrr.toFixed(mrr < 0.01 ? 4 : 2)),
    hpRequired: Number(hpRequired.toFixed(2)),
    hpAvailable: m.hp,
    hpUtilization: Math.min(100, Math.round((hpRequired / hpAtCutter) * 100)),
    passes,
    stepdown,
    drilling,
    radialThinningFactor: Number(radialThinningFactor.toFixed(2)),
    radialEngagementPct: diameter > 0 ? Math.round((woc / diameter) * 100) : 0,
    adaptive: !!op.adaptive,
    effectiveDiameter: Number(effectiveDiameter.toFixed(3)),
    radiusCutter: radiusInfo,
    ballFeedCompensation: Number(ballFeedCompensation.toFixed(3)),
    sfmCapped,
    overhang,
    workholding,
    priority: prio,
    circular,
    finishPlan,
    deflection,
    entry,
    policy, targetSfm: Number(targetSfm.toFixed(2)),
    stockPlan: plannedStock, corner,
    runnable: blockingReasons.length === 0, blockingReasons,
    reasoning: calculationReasoning({ op: baseOp, mat, tool: tt, policy, rpm, actualSfm: sfm, targetSfm, ipm, chipLoad, fpt: programmedFpt || chipLoad, woc, doc, stock: plannedStock, override }),
    feedPerRev: (rpm > 0 && isFinite(ipm)) ? Number((ipm / rpm).toFixed(5)) : null,
    warnings,
  };
}
