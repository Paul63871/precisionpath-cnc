import {
  PART_MATERIALS, TOOL_MATERIALS, TOOL_MATERIAL_CLASS_MULT, COATINGS,
  TOOL_TYPES, OPERATIONS, WOC_CLASS_TARGETS,
  baseChipLoad, lerp, clamp,
} from "./cncData";

// input shape:
// { diameter (in), flutes (feed count), loc (in), toolMaterialId, coatingId, toolTypeId,
//   materialId, operationId, aggressiveness (0..1), override?,
//   machine: { hp, maxRpm, minRpm, maxIpm },
//   leadAngle, cornerRadius, includedAngle, tipDiameter, thickness, neckDiameter, pointAngle }
export function calculate(input) {
  const {
    diameter, flutes, loc, toolMaterialId, coatingId, toolTypeId,
    material, materialId, operationId, aggressiveness = 0.6, machine, override,
    leadAngle, cornerRadius, includedAngle, tipDiameter, thickness, neckDiameter, pointAngle,
    radialLoad, axialDoc, featureDepth,
  } = input;

  const mat = material || PART_MATERIALS.find((m) => m.id === materialId) || PART_MATERIALS[0];
  const tm = TOOL_MATERIALS.find((t) => t.id === toolMaterialId) || TOOL_MATERIALS[0];
  const coat = COATINGS.find((c) => c.id === coatingId) || COATINGS[0];
  const tt = TOOL_TYPES.find((t) => t.id === toolTypeId) || TOOL_TYPES[0];
  const op = OPERATIONS.find((o) => o.id === operationId) || OPERATIONS[0];
  const m = machine || { hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 };
  const agg = clamp(aggressiveness, 0, 1);

  // Tool-material speed ratio vs solid carbide, resolved by workpiece material
  // class where we have real per-class data (HSS/cobalt/indexable/PCD vary a lot
  // by material — see TOOL_MATERIAL_CLASS_MULT). Falls back to the tool's global
  // sfmMult (e.g. for custom materials without a materialClass, or solid carbide
  // itself which is always 1.0).
  const classMult = mat.materialClass && TOOL_MATERIAL_CLASS_MULT[mat.materialClass];
  const toolMatMult = (classMult && classMult[tm.id] != null) ? classMult[tm.id] : tm.sfmMult;

  // --- Surface speed (SFM) ---
  let sfm;
  if (override?.sfm) {
    sfm = override.sfm * op.sfmMult;
  } else {
    const [sfmMin, sfmMax] = mat.sfmRange;
    sfm = lerp(sfmMin, sfmMax, agg) * toolMatMult * coat.sfmMult * op.sfmMult * tt.sfmMult;
  }
  // Standard 20% slotting speed derate (Kennametal, CGS Tool) — full-width
  // engagement generates more heat per flute pass than partial-width milling.
  if (op.slotDerate) sfm *= 0.8;

  // --- RPM ---
  let rpm = (sfm * 3.82) / diameter;
  const rpmIdeal = rpm;
  rpm = clamp(rpm, m.minRpm, m.maxRpm);
  const rpmClamped = Math.abs(rpm - rpmIdeal) > 0.5;

  // --- Chip load per tooth ---
  const chipCurve = mat.chipCurve === "soft" ? "soft" : "metal";
  let chipLoad;
  if (override?.chipLoad) {
    chipLoad = override.chipLoad * op.chipMult * lerp(0.8, 1.0, agg);
  } else {
    chipLoad = baseChipLoad(diameter, chipCurve) * mat.chipLoadFactor * op.chipMult * tt.chipMult;
    chipLoad *= lerp(0.75, 1.05, agg);
  }

  // --- Depth & width of cut ---
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
      : (mat.category === "Composite") ? 0.6
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
    doc = diameter * mat.slotDepthFactor * tt.docMult * lerp(0.6, 1.0, agg);
    if (loc) doc = Math.min(doc, loc);
  } else if (op.docMode === "slot") {
    woc = diameter;
    // Slot depth scales by diameter as well as material (OSG breakpoints:
    // 0.25×D under 0.8", 0.50×D from 0.8-2", 1.00×D above 2" — smaller tools
    // need a lower multiple regardless of material toughness).
    const diaBreak = diameter < 0.8 ? 0.25 : diameter < 2.0 ? 0.5 : 1.0;
    doc = diameter * Math.min(mat.slotDepthFactor, diaBreak) * tt.docMult * lerp(0.6, 1.0, agg);
    if (diameter > 0.5) doc = Math.min(doc, diameter * 1.2);
  } else if (op.docMode === "face") {
    woc = diameter;
    doc = diameter * 0.1 * lerp(0.7, 1.2, agg);
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
      const [rMin, rMax] = op.finishing ? wocClass.finishPct : wocClass.roughPct;
      const pct = Math.min(wocClass.ceiling, lerp(rMin, rMax, agg));
      woc = diameter * pct;
      // Safety band for the HP-driven solve: never go narrower than half the
      // table's aggressiveness-0 target (chip-thinning gets extreme below
      // that) or wider than the table's ceiling (chip evacuation / deflection).
      hemWocBounds = { floorPct: rMin * 0.5, ceilingPct: wocClass.ceiling };
    } else {
      woc = diameter * op.wocFactor * lerp(0.8, 1.1, agg);
      hemWocBounds = { floorPct: op.wocFactor * 0.4, ceilingPct: op.wocFactor * 1.1 };
    }
    doc = diameter * 2.0 * lerp(0.7, 1.2, agg);
  } else {
    woc = diameter * op.wocFactor * lerp(0.8, 1.1, agg);
    // Profile (side-milling) axial depth. Cap at 2×D per published ceilings
    // (CGS Tool, Helical/Harvey HEM, Sandvik trochoidal, Autodesk Fusion all
    // publish 1.5-2×D ceilings) unless radial engagement is very light (<10% of
    // diameter), where a long-flute tool can safely go deeper.
    const profCap = (woc / diameter) < 0.10 ? mat.profileDepthFactor : Math.min(mat.profileDepthFactor, 2.0);
    doc = diameter * profCap * tt.docMult * lerp(0.6, 1.0, agg);
  }
  // CAM-driven paths (HSMWorks 2D & 3D adaptive / rough / finish) hold a set radial
  // engagement; honor the user's set radial load and axial step-down. Axial DOC is
  // NOT capped to flute LOC — the toolpath steps down in multiple Z-passes.
  const userPinnedWoc = !!(op.adaptive && radialLoad && radialLoad > 0);
  if (userPinnedWoc) woc = radialLoad;
  if (op.docMode !== "drill" && !tt.isDrill && axialDoc && axialDoc > 0) doc = axialDoc;

  // Feature depth → number of axial passes and the actual per-pass stepdown.
  let passes = null, stepdown = null;
  if (op.docMode !== "drill" && !tt.isDrill && featureDepth && featureDepth > 0 && doc > 0) {
    passes = Math.max(1, Math.ceil(featureDepth / doc));
    stepdown = featureDepth / passes;
    doc = stepdown; // actual per-pass depth never exceeds the feature depth
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
  const hpUtilizationTarget = lerp(0.20, 1.0, agg);
  if (op.docMode === "hem" && !userPinnedWoc && hemWocBounds && m.hp > 0 && doc > 0 && rpm > 0 && chipLoad > 0) {
    const hpTarget = m.hp * hpUtilizationTarget;
    const K = (diameter * doc * rpm * flutes * chipLoad) / 2;
    if (K > 0) {
      const target = (hpTarget / mat.hpFactor) / K;
      const rSolved = (target * target) / (1 + target * target);
      const rClamped = clamp(rSolved, hemWocBounds.floorPct, hemWocBounds.ceilingPct);
      woc = diameter * rClamped;
      if (rSolved > hemWocBounds.ceilingPct) {
        hpSolveNote = `Radial engagement capped at ${Math.round(hemWocBounds.ceilingPct * 100)}% of diameter (chip-evacuation ceiling) instead of the HP-solved ${Math.round(rSolved * 100)}% — this tool/material combo hits its stepover limit before using the targeted ${Math.round(hpUtilizationTarget * 100)}% of spindle power.`;
      } else if (rSolved < hemWocBounds.floorPct) {
        hpSolveNote = `Stepover reduced toward its ${Math.round(hemWocBounds.floorPct * 100)}% practical minimum for this tool/material — even at that narrow engagement it may still be under the targeted ${Math.round(hpUtilizationTarget * 100)}% spindle utilization; consider a shallower axial DOC.`;
      } else {
        hpSolveNote = `Radial engagement (${Math.round(rClamped * 100)}% of diameter) solved to use ${Math.round(hpUtilizationTarget * 100)}% of available spindle horsepower at this aggressiveness setting — this is how manufacturer tool bots size the stepover, not a fixed percentage.`;
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
  if (op.adaptive && woc > 0 && woc < diameter * 0.5) {
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
  // ignore that: if we're still over the spindle's HP after the WOC solve,
  // back the feed (and therefore RPM-independent MRR) down until hpRequired
  // matches m.hp, exactly like a CAM post processor or the machine's own
  // torque-limiting would in practice. Skipped when hp is unknown/zero.
  let hpGovernorNote = null;
  if (m.hp > 0 && hpRequired > m.hp * 1.005) {
    const governorScale = m.hp / hpRequired;
    ipm *= governorScale;
    mrr *= governorScale;
    hpRequired = m.hp;
    hpGovernorNote = `Feed rate reduced ${Math.round((1 - governorScale) * 100)}% below the ideal chip-load target to stay within the machine's ${m.hp} HP — radial engagement is already at its practical minimum for this tool/material, so speed had to give instead.`;
  } else if (m.hp > 0 && hpRequired > m.hp) {
    hpRequired = m.hp; // clean up float noise just over the limit without a note
  }

  // --- Warnings ---
  const warnings = [...thinningNotes];
  if (hpSolveNote) warnings.push(hpSolveNote);
  if (hpGovernorNote) warnings.push(hpGovernorNote);
  if (hpRequired > m.hp) warnings.push(`Requires ~${hpRequired.toFixed(1)} HP but machine has ${m.hp} HP — reduce DOC/WOC or feed.`);
  if (rpmClamped) warnings.push(rpm > rpmIdeal ? `Spindle minimum forced RPM above ideal — reduce SFM or use smaller tool.` : `Spindle max RPM reached — ideal ${Math.round(rpmIdeal)} RPM. Increase SFM or use larger diameter.`);
  if (ipmClamped) warnings.push(`Machine max feed (${m.maxIpm} IPM) limits the programmed feed.`);
  if (loc && (op.docMode === "profile" || op.docMode === "hem") && doc > loc) warnings.push(`Per-pass axial DOC (${doc.toFixed(3)}") exceeds flute LOC (${loc}") — confirm chip evacuation.`);
  if (op.docMode === "slot" && diameter >= 0.5 && flutes >= 4) warnings.push("Slotting with 4+ flutes at this diameter risks chip packing — consider 2-3 flutes or air blast.");
  if (tt.id === "bull_nose" && cornerRadius && op.docMode === "slot" && doc > cornerRadius * 2) warnings.push("Bull-nose full-width slotting deeper than the corner radius — chip evacuation at the radius is tight; peck or reduce DOC.");
  if (mat.category === "Stainless" || mat.category === "Titanium" || mat.category === "Superalloy") warnings.push("Work hardening / heat-sensitive alloy — keep chip load up, avoid rubbing, use coolant or air.");
  if (mat.id === "cfrp" || mat.id === "g10") warnings.push("Abrasive composite — expect rapid tool wear; diamond-coated carbide recommended.");
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
    mrr: Number(mrr.toFixed(2)),
    hpRequired: Number(hpRequired.toFixed(2)),
    hpAvailable: m.hp,
    hpUtilization: Math.min(100, Math.round((hpRequired / m.hp) * 100)),
    passes,
    stepdown,
    drilling,
    radialThinningFactor: Number(radialThinningFactor.toFixed(2)),
    radialEngagementPct: diameter > 0 ? Math.round((woc / diameter) * 100) : 0,
    adaptive: !!op.adaptive,
    warnings,
  };
}
