import {
  PART_MATERIALS, TOOL_MATERIALS, TOOL_MATERIAL_CLASS_MULT, COATINGS,
  TOOL_TYPES, OPERATIONS, WOC_CLASS_TARGETS, PERIPHERAL_ROUGH_WOC_TARGETS,
  TAP_SFM_BY_CLASS, TAP_TOOL_MATERIAL_MULT, TAP_STYLES, HOLE_TYPES, THREAD_TABLE,
  WORKHOLDING_JAW_TYPES, tapDrillSize, baseChipLoad, lerp, clamp,
  RADIUS_ENGAGEMENTS, RADIUS_CUTTER_SFM, RADIUS_PASS_SCHEDULE, radiusPassCount, classRefMid,
} from "./cncData";

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
//   targetRa (µin) — finish target that drives ball-nose scallop stepover / feed-mark cap,
//   clampForce (lbf) — optional: the vise/fixture's actual rated clamping force,
//   used to give a direct pass/fail instead of just reporting the requirement }
export function calculate(input) {
  const {
    diameter, flutes, loc, toolMaterialId, coatingId, toolTypeId,
    material, materialId, operationId, aggressiveness = 0.6, machine, override,
    leadAngle, cornerRadius, includedAngle, tipDiameter, thickness, neckDiameter, pointAngle,
    radialLoad, axialDoc, featureDepth, threadId, tapStyle, holeType, gripDepth,
    jawTypeId, clampForce,
    priority, featureDiameter, pilotDiameter, targetRa, radiusEngagement, insertIc,
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
  const m = machine || { hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 };
  const agg = clamp(aggressiveness, 0, 1);
  // --- Optimize-for priority (finish quality vs. speed) ---
  // "balanced" (also the default when `priority` is omitted) reproduces the
  // manufacturer tool-bot benchmark behaviour (IMCO ToolBot etc.) the engine
  // is regression-tested against. "finish" (the app default) biases every
  // geometric/feed term toward surface quality: effective aggressiveness for
  // chip load, stepover, axial depth and HP budget is shifted down 20 points,
  // WHILE SURFACE SPEED STAYS ON THE UNSHIFTED SLIDER (higher speed with a
  // lighter chip is what improves finish and avoids built-up edge — CNC
  // Cookbook, Mitsubishi Materials). The 20-point shift is a documented shop-
  // judgement bias, not a manufacturer constant; the finishing-specific
  // limits further below (scallop stepover, feed-mark cap, stock-to-leave,
  // spring pass) ARE sourced. "speed" shifts +15 points for MRR-focused work.
  const prio = priority === "finish" || priority === "speed" ? priority : "balanced";
  const finishFirst = prio === "finish";
  const aggQ = clamp(agg + (prio === "finish" ? -0.20 : prio === "speed" ? 0.15 : 0), 0, 1);
  // "Required Horse Power" on a machine spec sheet is the rated/nameplate
  // figure, and manufacturer tool bots (e.g. IMCO ToolBot) size cuts against
  // that full rated number directly — they don't separately discount for
  // spindle mechanical losses in the number they display. To land on the same
  // stepover/feed/RPM for a given rated HP, hpAtCutter here intentionally
  // equals the rated HP; the ~13% real-world spindle efficiency loss (belts,
  // gearbox, bearings) is instead folded into mat.hpFactor (see cncData.js),
  // which is where it belongs physically — it's a property of how much
  // material a given HP number actually removes, not a separate machine trait.
  const hpAtCutter = m.hp;

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
    const pitch = thread.pitch != null ? thread.pitch : input.pitch;
    const style = TAP_STYLES.find((s) => s.id === tapStyle) || TAP_STYLES[0];
    const hole = HOLE_TYPES.find((h) => h.id === holeType) || HOLE_TYPES[0];

    const warnings = [];
    if (!pitch || pitch <= 0) {
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
      sfm = override.sfm;
    } else {
      const range = (mat.materialClass && TAP_SFM_BY_CLASS[mat.materialClass]) || TAP_SFM_BY_CLASS.steel_mild;
      const tapMatMult = TAP_TOOL_MATERIAL_MULT[tm.id] != null ? TAP_TOOL_MATERIAL_MULT[tm.id] : TAP_TOOL_MATERIAL_MULT.hss;
      sfm = lerp(range[0], range[1], agg) * tapMatMult * coat.sfmMult * style.sfmMult;
    }

    // --- RPM --- straightforward SFM -> RPM at the tap's major diameter.
    let rpm = (sfm * 3.82) / tapMajor;
    const rpmIdeal = rpm;
    rpm = clamp(rpm, m.minRpm, m.maxRpm);
    const rpmClamped = Math.abs(rpm - rpmIdeal) > 0.5;

    // --- Feed (IPM) --- LOCKED to pitch. No chip load, no aggressiveness
    // term, no flute-count multiplier — this is the one true physical
    // constant of rigid tapping (F = RPM x pitch).
    let ipm = pitch > 0 ? rpm * pitch : 0;
    const ipmIdeal = ipm;
    ipm = Math.min(ipm, m.maxIpm);
    const ipmClamped = ipm < ipmIdeal - 0.01;
    if (ipmClamped) {
      warnings.push(`Machine max feed (${m.maxIpm} IPM) is below the pitch-locked tapping feed — rigid tapping REQUIRES the spindle to advance exactly RPM x pitch. If the machine truly cannot hit ${ipmIdeal.toFixed(2)} IPM at ${Math.round(rpm)} RPM, reduce RPM instead (never the feed alone) or the tap will strip the thread.`);
    }

    // --- Thread depth / G84 cycle ---
    const threadDepth = (featureDepth && featureDepth > 0) ? featureDepth : (loc || tapMajor * 2);
    const depthRatio = tapMajor > 0 ? threadDepth / tapMajor : 0;
    const retract = Math.max(0.1, tapMajor * 0.3);
    const tapping = {
      threadDepth: Number(threadDepth.toFixed(3)),
      depthRatio: Number(depthRatio.toFixed(1)),
      pitch: pitch ? Number(pitch.toFixed(5)) : null,
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
    const minorDiameter = pitch ? tapMajor - 1.0825 * pitch : tapMajor * 0.85;
    const mrr = (Math.PI / 4) * (tapMajor * tapMajor - minorDiameter * minorDiameter) * ipm;
    let hpRequired = mrr * mat.hpFactor;
    if (hpAtCutter > 0 && hpRequired > hpAtCutter) {
      hpRequired = hpAtCutter;
    }
    if (coat.verified === false) warnings.push(`${coat.name} speed multiplier is an engineering estimate — no manufacturer speed chart is published for this coating.`);
    if (mat.hpFactorEstimate) warnings.push("Horsepower factor for this material is an engineering estimate, not sourced from a published handbook value.");
    if (rpmClamped) warnings.push(rpm > rpmIdeal ? "Spindle minimum forced RPM above ideal — reduce SFM or use a larger tap." : "Spindle max RPM reached — ideal " + Math.round(rpmIdeal) + " RPM. Increase SFM or use a smaller tap.");

    return {
      sfm: Math.round(sfm),
      rpm: Math.round(rpm),
      chipLoad: tapping.pitch || 0,
      programmedFpt: null,
      ipm: Number(ipm.toFixed(2)),
      woc: Number(tapMajor.toFixed(3)),
      doc: Number(threadDepth.toFixed(3)),
      mrr: Number(mrr.toFixed(mrr < 0.01 ? 4 : 2)),
      hpRequired: Number(hpRequired.toFixed(2)),
      hpAvailable: m.hp,
      hpUtilization: hpAtCutter > 0 ? Math.min(100, Math.round((hpRequired / hpAtCutter) * 100)) : 0,
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
      warnings,
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
    const R = cornerRadius > 0 ? cornerRadius : diameter * 0.1;
    const pilot = formKind === "corner_round" ? diameter - 2 * R : diameter - 2 * R;
    if (!(cornerRadius > 0)) radiusNotes.push(`No radius entered — assuming ${R.toFixed(3)}" (10% of diameter). Enter the actual cutter radius.`);
    if (pilot <= 0.0005) {
      return { error: formKind === "corner_round" ? `Corner radius (${R}") must be smaller than half the cutter diameter (${(diameter / 2).toFixed(3)}").` : `Radius (${R}") must be smaller than half the cutter diameter (${(diameter / 2).toFixed(3)}") so the cutter has a core diameter.`, warnings: [] };
    }
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
    if (!(axialDoc && axialDoc > 0)) doc = R * sched[0];
    radiusInfo = { kind: formKind, radius: R, pilotDiameter: pilot, effectiveDiameter: formEffD, engagement: eng.name, engagementMult: eng.mult, passes: nPass, passSchedule: sched.map((f) => Number((f * R).toFixed(4))) };
    radiusNotes.push(`Radius cutter: speed and chip load are referenced to the EFFECTIVE diameter ${formEffD.toFixed(3)}" (nominal ${diameter}"), per Harvey Tool's ${formKind === "corner_round" ? "corner-rounding" : "concave-radius"} chart. Engagement "${eng.name}" scales chip load ×${eng.mult}.`);
    radiusNotes.push(`Cut the radius in ${nPass} descending pass${nPass > 1 ? "es" : ""} (${sched.map((f) => (f * R).toFixed(3) + '"').join(", ")} of the ${R.toFixed(3)}" radius per pass, Harvey schedule); the first pass is shown as axial DOC. Climb mill, and finish with a light spring pass for a clean radius.`);
    if (formKind === "corner_round") radiusNotes.push("Corner-rounding cutters are side-cutting only: round the edge from the side or in an existing slot; do not plunge into solid. Plunging into a hole needs the chip load cut to 40–50% (choose that engagement).");
    if (R / pilot >= 2.5) radiusNotes.push("Radius/pilot ratio ≥ 2.5: effective diameter uses 0.7×R (Harvey).");
  } else if (radiusKind === "round_insert") {
    const iC = insertIc > 0 ? insertIc : diameter * 0.5;
    if (!(insertIc > 0)) radiusNotes.push(`No insert diameter entered — assuming IC ${iC.toFixed(3)}" (half the cutter diameter).`);
    if (iC >= diameter) return { error: `Insert diameter (${iC}") must be smaller than the cutter diameter (${diameter}").`, warnings: [] };
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
    sfm = override.sfm * op.sfmMult;
  } else {
    // Materials that publish a dedicated ABSOLUTE drilling SFM window (phenolic
    // laminates: Ready Plastics 300-500 SFM) use it for drill ops, bypassing the
    // generic drilling op.sfmMult (which would double-derate a sourced figure).
    // Phenolic speed windows are published for UNCOATED, polished C-2 carbide
    // (Ready Plastics) — that is the reference tool, so the metal-derived 0.72x
    // "uncoated" derate must not be applied on top of them.
    const coatSfmMult = (mat.materialClass === "phenolic" && coat.id === "none") ? 1.0 : coat.sfmMult;
    const useDrillRange = !!(mat.drillSfmRange && (op.docMode === "drill" || tt.isDrill));
    const [sfmMin, sfmMax] = useDrillRange ? mat.drillSfmRange : mat.sfmRange;
    sfm = lerp(sfmMin, sfmMax, agg) * toolMatMult * coatSfmMult * (useDrillRange ? 1 : op.sfmMult) * tt.sfmMult;
    if (formKind) {
      // Harvey's radius-cutter charts publish ABSOLUTE speeds (same for coated and
      // uncoated), so replace the end-mill range lerp: class SFM scaled to the
      // grade inside its class, +-15% with aggressiveness.
      const hs = RADIUS_CUTTER_SFM[mat.materialClass];
      if (hs) {
        const mid = (mat.sfmRange[0] + mat.sfmRange[1]) / 2;
        const gradeScale = clamp(mid / classRefMid(mat.materialClass), 0.6, 1.3);
        sfm = hs * gradeScale * lerp(0.85, 1.15, agg) * toolMatMult * op.sfmMult;
      } else {
        sfm *= 0.7; // ESTIMATE: wide full-profile contact in plastics/wood/composites
      }
    }
  }
  // Standard 20% slotting speed derate (Kennametal, CGS Tool) — full-width
  // engagement generates more heat per flute pass than partial-width milling.
  if (op.slotDerate) sfm *= 0.8;
  // Hard ceiling: no combination of aggressiveness/operation/coating
  // multipliers should ever push a material past its own published
  // "aggressive" SFM by more than a small margin — stacking op.sfmMult (e.g.
  // 2D Contour's 1.1x for wall-finish quality) on top of an already-maxed
  // aggressiveness lerp was letting SFM run 10-20% past the table's own
  // ceiling (e.g. 660 SFM vs A36's stated 600 max), which is well outside
  // what the coating/material can actually sustain. Cap at 1.05x the
  // material's own sfmMax regardless of how the multipliers stack.
  const sfmHardCap = mat.sfmRange[1] * 1.05;
  const sfmCapped = sfm > sfmHardCap;
  if (sfmCapped) sfm = sfmHardCap;

  // --- RPM --- (effective diameter, not nominal, for ball nose at partial doc)
  let rpm = (sfm * 3.82) / effectiveDiameter;
  const rpmIdeal = rpm;
  rpm = clamp(rpm, m.minRpm, m.maxRpm);
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
  const hpUtilizationTarget = lerp(0.20, 1.0, aggQ);
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
          hpSolveNote = `Stepover held at a chip-evacuation-friendly ${Math.round(floorRatio * 100)}% of diameter and spindle speed backed down to ${Math.round(rpm)} RPM to land exactly on the targeted ${Math.round(hpUtilizationTarget * 100)}% of spindle power — this is how manufacturer tool bots size a cut, balancing stepover and speed together instead of maxing speed first.`;
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
          hpSolveNote = `Radial engagement (${Math.round(rClamped * 100)}% of diameter) solved to use ${Math.round(hpUtilizationTarget * 100)}% of available spindle horsepower at this aggressiveness setting — this is how manufacturer tool bots size the stepover, not a fixed percentage.`;
        }
      }
    }
  }

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
  if (hpAtCutter > 0 && hpRequired > hpAtCutter * 1.005) {
    const governorScale = hpAtCutter / hpRequired;
    ipm *= governorScale;
    mrr *= governorScale;
    hpRequired = hpAtCutter;
    hpGovernorNote = `Feed rate reduced ${Math.round((1 - governorScale) * 100)}% below the ideal chip-load target to stay within the machine's available power — radial engagement is already at its practical minimum for this tool/material, so speed had to give instead.`;
  } else if (hpAtCutter > 0 && hpRequired > hpAtCutter) {
    hpRequired = hpAtCutter; // clean up float noise just over the limit without a note
  }

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
    // The vise's RATED force (from its spec plate/manual) is the force the
    // screw/mechanism can generate. But soft aluminum jaws (6061-T6) yield
    // under their own clamping load well before a steel-jaw vise maxes out
    // -- they reliably deliver only ~30-50% of an equivalent steel jaw's
    // force before deforming (machally.com vise jaw selection guide,
    // ctemag.com fixture considerations). So the force that actually reaches
    // the part through an aluminum jaw is capped at jaw.forceDerate x the
    // vise's rated force, not the full rated number -- this is a SEPARATE
    // failure mode from friction (mu): the jaw itself can crush before the
    // part ever slips.
    const usableClampForce = ratedClampForce != null ? ratedClampForce * jaw.forceDerate : null;
    const clampMargin = usableClampForce ? usableClampForce / requiredClampForce : null;
    workholding = {
      cuttingForce: Number(cuttingForce.toFixed(1)),
      requiredClampForce: Number(requiredClampForce.toFixed(1)),
      ratedClampForce,
      usableClampForce: usableClampForce != null ? Number(usableClampForce.toFixed(1)) : null,
      forceDerate: jaw.forceDerate,
      clampMargin: clampMargin != null ? Number(clampMargin.toFixed(2)) : null,
      jawTypeId: jaw.id,
      mu: jaw.mu,
      safetyFactor,
      insufficient: usableClampForce != null && clampMargin < 1.0,
      // True when the VISE's rated force would have been enough, but the
      // aluminum jaw's own strength derate is what actually pushes the
      // usable force below the requirement -- i.e. the bottleneck is the
      // soft jaw material, not the vise mechanism itself.
      jawLimited: usableClampForce != null && jaw.forceDerate < 1.0 && clampMargin < 1.0 && (ratedClampForce / requiredClampForce) >= 1.0,
    };
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
        // Helical entry: axial pitch per revolution capped by a 3 deg ramp (the low
        // end of the 3-5 deg end-mill helix limit, carbide-tooling.com) on the path circle.
        if (baseOp.circularKind === "bore_rough" || baseOp.circularKind === "pocket_rough") {
          const pathD = Math.max(Dh - diameter, 0.001);
          const pitchMax = Math.PI * pathD * Math.tan(3 * Math.PI / 180);
          const pitch = Math.min(doc, pitchMax);
          const rampDeg = Math.atan(pitch / (Math.PI * pathD)) * 180 / Math.PI;
          circular.helixPitch = Number(pitch.toFixed(4));
          circular.rampAngleDeg = Number(rampDeg.toFixed(1));
          const depthForHelix = featureDepth && featureDepth > 0 ? featureDepth : doc;
          circular.helixTurns = Math.max(1, Math.ceil(depthForHelix / pitch));
          if (pitch < doc * 0.999) circular.notes.push(`Helical pitch limited to ${pitch.toFixed(4)}" per revolution (3° ramp on a Ø${pathD.toFixed(3)}" path circle) — the cut is shallower per turn than the ${doc.toFixed(3)}" step-down because the hole is small relative to the tool.`);
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
  const isMillingCut = !(op.docMode === "drill" || op.docMode === "tap" || tt.isDrill || tt.isTap);
  if (isMillingCut && op.id !== "engrave" && op.id !== "thread" && tt.id !== "slitting_saw") {
    const stock = Math.max(0.002, diameter * (diameter < 0.125 ? 0.02 : 0.015));
    if (op.finishing) {
      finishPlan = {
        role: "finish",
        springPass: true,
        climb: true,
        freshTool: true,
        priority: prio,
        scallop,
        feedMarkCapped,
        notes: [
          "Climb mill the finish pass, take it with a fresh/dedicated tool, and repeat the final pass once at zero radial infeed (spring pass) to cancel tool deflection.",
        ],
      };
    } else {
      finishPlan = {
        role: "rough",
        stockToLeaveRadial: Number(stock.toFixed(4)),
        stockToLeaveAxial: Number(stock.toFixed(4)),
        priority: prio,
        notes: [
          `Leave ~${stock.toFixed(3)}" (1.5-2% of the tool diameter, Seco Tools) on walls and floors for the finish operation. Leaving more wastes time; leaving less makes the finish tool rub on work-hardened or deflected material.`,
        ],
      };
    }
  }

  // --- Tool deflection (worst-case estimate) ---
  // Cantilever beam: delta = F L^3 / (3 E I), I = pi d^4 / 64 with the flute
  // core taken as 0.8 D (same cantilever model as online-tools.work/metal/en/
  // tool-deflection and formulafactory.tools tool-deflection calculator).
  // F is the TANGENTIAL cutting force (hp x 33000 / SFM), which is an upper
  // bound on the radial force that actually pushes the tool off the wall, and
  // L is the flute length (the real stickout is at least this long) — so this
  // is a conservative screening number, not a measurement.
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
  const warnings = [...thinningNotes, ...circWarn];
  if (mat.notes && mat.notes.length) for (const n of mat.notes) warnings.push(`${mat.name}: ${n}`);
  if (mat.abrasive && (tm.id === "hss" || tm.id === "cobalt")) warnings.push(`${mat.name} is abrasive — ${tm.name} will wear very quickly; use solid carbide (diamond-coated or PCD for production).`);
  if (mat.materialClass === "phenolic" && (tm.id === "hss" || tm.id === "cobalt")) warnings.push(`${mat.name}: ${tm.name} is viable only for low volume (< ~20 parts per operation) on paper/cotton phenolic — carbide (uncoated C-2, sharp, polished flutes) is the standard and holds life far longer. A dulling tool raises heat, which drives formaldehyde off-gassing and edge chipping (Ready Plastics phenolic guide). Speeds shown use an estimated HSS derate.`);
  if (mat.materialClass === "plastic" && clampForce && clampForce > 1500) warnings.push(`Plastics deform under clamping load that is routine for metal — your vise is rated ${Math.round(clampForce)} lbf. Torque it down just enough to hold (cutting forces in plastic are a few pounds), use wide flat soft jaws or vacuum, and re-measure after release (Ready Plastics: over-clamping bows/pinches nylon, PP, PTFE and Ertalyte).`);
  if (finishFirst && op.finishing && deflection && deflection.estimateIn > deflection.limitIn) warnings.push(`Finish quality: estimated worst-case tool deflection is ${deflection.estimateIn.toFixed(4)}" (> ${deflection.limitIn}") at ${loc}" LOC — shorten the stickout, use a larger/stub tool, or add a spring pass; a deflected finish pass leaves taper and a step at the end of the cut.`);
  if (feedMarkCapped) warnings.push(`Finish quality: feed per tooth was reduced so the theoretical feed-mark cusp (fz²/4D) stays within the ${Math.round(raTargetIn * 1e6)} µin Ra target.`);
  if (sfmCapped) warnings.push(`SFM capped at ${Math.round(sfmHardCap)} (105% of ${mat.name}'s published range) — the stacked aggressiveness/operation/coating multipliers wanted a higher speed than this material and coating can realistically sustain.`);
  if (tt.id === "ball_end" && effectiveDiameter < diameter * 0.999) warnings.push(`Ball nose effective cutting diameter is ${effectiveDiameter.toFixed(3)}" at ${doc.toFixed(3)}" axial DOC (nominal diameter ${diameter}") — RPM and chip load are computed from this smaller effective diameter, not the nominal one, per standard ball-nose speed/feed correction.`);
  for (const n of radiusNotes) warnings.push(n);
  if (hpSolveNote) warnings.push(hpSolveNote);
  if (hpGovernorNote) warnings.push(hpGovernorNote);
  if (hpRequired > hpAtCutter) warnings.push(`Requires ~${hpRequired.toFixed(1)} HP but the machine has ${hpAtCutter} HP — reduce DOC/WOC or feed.`);
  if (rpmClamped) warnings.push(rpm > rpmIdeal ? `Spindle minimum forced RPM above ideal — reduce SFM or use smaller tool.` : `Spindle max RPM reached — ideal ${Math.round(rpmIdeal)} RPM. Increase SFM or use larger diameter.`);
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
    chipLoad: Number(chipLoad.toFixed(5)),
    programmedFpt: programmedFpt != null ? Number(programmedFpt.toFixed(5)) : null,
    ipm: Number(ipm.toFixed(1)),
    woc: Number(woc.toFixed(3)),
    doc: Number(doc.toFixed(3)),
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
    warnings,
  };
}
