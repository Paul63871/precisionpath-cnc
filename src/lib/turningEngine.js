// Turning (lathe) calculation engine.
//
// Every formula is the standard machining relation or a manufacturer rule;
// sources are cited at the point of use. Anything that is an engineering
// estimate is returned in `estimates[]` so the UI can label it.
//
// Inputs (inches / SFM / lbf unless noted):
//   materialId | material, operationId, gradeId, aggressiveness 0..1,
//   priority "finish" | "balanced" | "speed" (default "balanced"),
//   workDiameter  — diameter at the start of the cut (OD ops: the stock OD;
//                   ID ops: the bore diameter being cut; face: stock OD;
//                   parting/grooving: the diameter the tool is plunging into)
//   finishDiameter — target diameter at the end of the pass (OD/ID ops)
//   cutLength — length of cut (Z for OD/ID; radial for facing)
//   insert { shapeId, ic, noseRadius, kappa? }
//   targetRa (µin) — surface finish target for finishing ops (default 32)
//   machine { hp, maxRpm, minRpm, maxIpm, chuckMaxRpm }
//   workholding { stickout, gripDiameter, jawTypeId, chuckGripForce, tailstock,
//                 steadyRest, chuckAge: "new" | "old" }
//   bar { id, diameter, overhang }              (ID ops)
//   groove { width, depth }                     (groove/parting)
//   thread { pitch, internal, passes? }         (thread ops)

import { PART_MATERIALS, WORKHOLDING_JAW_TYPES, lerp, clamp } from "./cncData";
import { calculate as calculateMilling } from "./cncEngine";
import {
  TURNING_OPERATIONS, INSERT_SHAPES, GRADE_MULT, HSS_TURNING, BORING_BARS,
  MODULUS_PSI, MODULUS_BY_MATERIAL, LD_LIMITS, CHUCK_SAFETY,
  turningWindow, isTurnable, maxFeedForNose, partingWidthFor,
} from "./turningData";

const num = (v, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);
const r = (v, p = 4) => (v == null || !isFinite(v) ? null : Number(v.toFixed(p)));

// Constant-chip-area thread infeed schedule — Sandvik Coromant threading guide
// (C-2920:031): cumulative depth after pass x of N is
//   a(x) = H / sqrt(N-1) * sqrt(phi),   phi = 0.3 (pass 1), 1.0 (pass 2), x-1 (x >= 3)
// where H = total thread depth, and the schedule ends exactly at H on pass N.
// https://cdn.sandvik.coromant.com/files/sitecollectiondocuments/downloads/global/technical%20guides/en-gb/c-2920-031.pdf
export function threadInfeeds(depth, N) {
  const passes = Math.max(2, Math.round(N));
  const phi = (x) => (x === 1 ? 0.3 : x === 2 ? 1 : x - 1);
  // normalise so pass N lands on the full depth
  const raw = [];
  for (let x = 1; x <= passes; x++) raw.push(Math.sqrt(phi(x)));
  const scale = depth / raw[passes - 1];
  const cum = raw.map((v) => v * scale);
  return cum.map((c, i) => ({ pass: i + 1, cumulative: c, increment: c - (i ? cum[i - 1] : 0) }));
}

export function calculateTurning(input) {
  const {
    materialId, material, operationId = "od_rough", gradeId = "coated",
    aggressiveness = 0.6, priority, workDiameter, finishDiameter, cutLength,
    insert = {}, targetRa, machine = {}, workholding = {}, bar = {}, groove = {}, thread = {},
    customMaterial,
  } = input;

  const mat = material || customMaterial || PART_MATERIALS.find((m) => m.id === materialId) || PART_MATERIALS[0];
  const op = TURNING_OPERATIONS.find((o) => o.id === operationId) || TURNING_OPERATIONS[0];
  const warnings = [];
  const estimates = [];
  const notes = [];

  if (!isTurnable(mat)) {
    return { error: `${mat.name} is not covered by the turning calculator (no published insert-turning data for wood or fiber composites).`, warnings: [], estimates: [] };
  }
  const D0 = num(workDiameter, 1);
  if (D0 <= 0) return { error: "Enter a work diameter.", warnings: [], estimates: [] };

  const m = {
    hp: num(machine.hp, 10), maxRpm: num(machine.maxRpm, 4000), minRpm: num(machine.minRpm, 20),
    maxIpm: num(machine.maxIpm, 400), chuckMaxRpm: num(machine.chuckMaxRpm, 0),
  };
  const agg = clamp(aggressiveness, 0, 1);
  const prio = priority === "finish" || priority === "speed" ? priority : "balanced";
  // Same documented priority bias as the milling engine: speed stays on the raw
  // slider (a faster surface speed with a lighter feed improves finish), while
  // feed, depth of cut and HP budget move with the priority shift.
  const aggQ = clamp(agg + (prio === "finish" ? -0.2 : prio === "speed" ? 0.15 : 0), 0, 1);
  const matClass = mat.materialClass;
  const gradeClass = (matClass === "plastic" || matClass === "phenolic" || matClass === "composite") ? matClass : (matClass === "aluminum" || matClass === "nonferrous_soft" || GRADE_MULT[matClass]) ? matClass : "steel_mild";

  // --- Lathe drilling: delegate to the verified drilling model --------------
  if (op.kind === "drill") {
    const dd = num(input.drillDiameter, 0.5);
    const res = calculateMilling({
      tool: undefined, diameter: dd, flutes: 2, loc: num(input.drillDepth, dd * 4),
      toolMaterialId: gradeId === "hss" ? "hss" : "carbide", coatingId: gradeId === "hss" ? "none" : "tialn",
      toolTypeId: "drill", operationId: "drilling", materialId: mat.id, aggressiveness: agg, priority: prio,
      machine: { hp: m.hp, maxRpm: m.maxRpm, minRpm: m.minRpm, maxIpm: m.maxIpm },
      pointAngle: 118,
    });
    return { kind: "drill", drill: res, op, mat, warnings: [...(res.warnings || [])], estimates, notes: ["Lathe drilling feeds in inches per revolution; the table below converts the drill feed to IPR."], ipr: res.rpm ? r(res.ipm / res.rpm, 4) : null };
  }

  const win = turningWindow(mat);
  if (!win) return { error: `No turning data for ${mat.name}.`, warnings: [], estimates: [] };
  if (win.est) estimates.push(`${mat.name}: the plastics processors do not publish a turning speed/feed window for this exact grade — values are borrowed from the closest published plastic and should be proven out.`);

  // --- Insert geometry ------------------------------------------------------
  const shape = INSERT_SHAPES.find((s) => s.id === insert.shapeId) || INSERT_SHAPES[0];
  const ic = num(insert.ic, 0.5);
  let rn = num(insert.noseRadius, 1 / 32);
  if (shape.round) rn = ic / 2;
  const kappa = num(insert.kappa, shape.kappa);

  // --- Grade / speed --------------------------------------------------------
  let gradeMult = 1;
  let gradeNote = null;
  let gradeUsed = gradeId;
  let sfmRough, sfmFinish;
  if (gradeId === "hss") {
    const h = HSS_TURNING[gradeClass];
    if (!h) { warnings.push(`HSS tool bits are not recommended for ${mat.name} — carbide numbers are used instead.`); gradeUsed = "coated"; }
    else if (h.mult) { gradeMult = h.mult; if (h.est) estimates.push(`HSS speed ratio for ${mat.name} (${h.mult}× carbide) is an engineering estimate — Ready Plastics only states HSS is viable at low volume.`); }
    else {
      const sc = win.scale || 1;
      sfmRough = h.rough.map((v) => v * sc);
      sfmFinish = h.finish.map((v) => v * sc);
      if (h.est) estimates.push("HSS speed for this alloy class is an engineering estimate.");
    }
  } else {
    const gm = GRADE_MULT[gradeClass] || GRADE_MULT.steel_mild;
    const v = gm[gradeId];
    if (v == null) {
      warnings.push(`${gradeId === "pcd" ? "PCD" : gradeId === "ceramic" ? "Ceramic" : gradeId === "cermet" ? "Cermet" : gradeId} inserts are not normally used on ${mat.name} — coated-carbide numbers are used instead.`);
      gradeUsed = "coated";
    } else {
      gradeMult = v;
      if (gradeId === "cermet" && !op.finishing) { warnings.push("Cermet is a finishing/semi-finishing grade — speed gain only applied on finish passes."); gradeMult = 1; }
      if (gm[gradeId + "Est"] || (gradeId === "pcd" && gm.pcdEst)) estimates.push(`${gradeId} speed multiplier for ${mat.name} is an engineering estimate.`);
    }
    if (gradeUsed === "ceramic") notes.push("Ceramic inserts need a rigid setup and (for most grades) no coolant — thermal shock cracks them. Do not use for interrupted cuts unless the grade is rated for it.");
    if (gradeUsed === "pcd") notes.push("PCD wears down on ferrous metals and titanium; use it on aluminum (<12% Si for the highest speeds), brass, and abrasive plastics.");
  }
  if (mat.abrasive && gradeUsed !== "pcd") warnings.push(`${mat.name} is abrasive — a PCD or diamond-coated insert will last many times longer than carbide.`);

  // Base window (SFM)
  const absoluteRow = gradeId === "hss" && sfmRough; // HSS rows are already absolute SFM
  const rowWin = op.speedRow === "finish" ? (absoluteRow ? sfmFinish : win.finish) : (absoluteRow ? sfmRough : win.rough);
  const sfmWin = rowWin.map((v) => v * (absoluteRow ? 1 : (win.scale || 1)) * gradeMult);
  const sfmBase = lerp(sfmWin[0], sfmWin[1], agg) * (op.sfmMult || 1);
  if (op.est) estimates.push(`${op.name}: the speed ratio versus plain turning (${Math.round((op.sfmMult || 1) * 100)}%) comes from the Ready Plastics per-operation table (rough turning 500–700 SFM vs grooving/parting 200–400 and threading 150–350) — applied to all materials as an estimate.`);

  // --- Feed -----------------------------------------------------------------
  const fWin = op.finishing ? win.fFinish : win.fRough;
  let feed = lerp(fWin[0], fWin[1], aggQ);
  const feedNotes = [];
  const nose = maxFeedForNose(rn);
  if (!op.finishing && (op.kind === "od" || op.kind === "face" || op.kind === "id")) {
    // Sandvik max feed vs nose radius
    const cap = lerp(nose.lo, nose.hi, aggQ);
    if (feed > cap) { feed = cap; feedNotes.push(`Feed limited by nose radius ${rn.toFixed(4)}" (Sandvik max ${nose.lo.toFixed(3)}–${nose.hi.toFixed(3)} IPR).`); }
  }
  // Surface-finish limit: theoretical Ra = f^2 / (32 r). Real surfaces run
  // 1.2-2x theory (BUE, vibration, nose wear), so design to Ra_target/1.5.
  // https://en.wikipedia.org/wiki/Surface_roughness ; noxmetals / simplewoody
  const raTarget = (targetRa && targetRa > 0 ? targetRa : (op.finishing ? (prio === "speed" ? 63 : 32) : null));
  let raFeedCap = null;
  if (raTarget && (op.kind === "od" || op.kind === "face" || op.kind === "id")) {
    raFeedCap = Math.sqrt(32 * rn * (raTarget * 1e-6) / 1.5);
    if (op.finishing && feed > raFeedCap) { feed = raFeedCap; feedNotes.push(`Feed set by finish target: Ra ${raTarget} µin with a ${rn.toFixed(4)}" nose radius (Ra = f²/32r, with 1.5x real-world allowance).`); }
  }

  if (op.kind === "id") {
    const bt0 = BORING_BARS.find((b) => b.id === bar.id) || BORING_BARS[0];
    const bd0 = num(bar.diameter, Math.max(D0 * 0.6, 0.25));
    const ld0 = num(bar.overhang, bd0 * 4) / bd0;
    if (ld0 > 3 && ld0 <= bt0.maxLD) { feed *= 0.8; feedNotes.push("Feed reduced 20% for long boring-bar overhang (machally.com guidance for long overhang / interrupted cuts)."); }
  }
  // --- Special ops: grooving / parting / threading ---------------------------
  let width = null, partInfo = null, threadInfo = null;
  if (op.kind === "parting" || op.kind === "groove") {
    width = num(groove.width, op.kind === "parting" ? partingWidthFor(D0) : 0.118);
    // CTE parting know-how: max feed ≈ 0.031 x insert width + 0.001 in/rev (width >= 0.118")
    // https://www.ctemag.com/sites/www.ctemag.com/files/archive_pdf/0102-partingknowhow.pdf
    const fMax = 0.031 * width + 0.001;
    const matFeedRatio = clamp(lerp(win.fFinish[0], win.fFinish[1], 0.5) / 0.007, 0.5, 1.2);
    const fRef = fMax * matFeedRatio * lerp(0.6, 1.0, aggQ);
    feed = Math.min(feed, fRef);
    feedNotes.push(`Feed from insert width ${width.toFixed(3)}" (CTE parting rule 0.031 x width + 0.001), scaled to ${mat.name}.`);
    if (op.kind === "groove") notes.push(`Single-plunge depth per pass ≤ 75% of insert width in turning-type grooving (Sandvik); plunge-only for deep grooves, peck to break chips.`);
    if (op.kind === "parting") {
      const dMin = D0;
      partInfo = {
        recommendedWidth: r(partingWidthFor(D0), 4),
        nearCenterFeed: r(feed * 0.25, 4),
        reduceFromDiameter: 0.16, // 0.08" radius before centre (Sandvik)
        stopBeforeCenter: 0.02,
        centerHeightTol: 0.004,
      };
      notes.push("Reduce feed by 75% (to " + (feed * 0.25).toFixed(4) + " IPR) over the last 0.08\" before centre and stop feeding 0.02\" before centre so the slug breaks off instead of leaving a pip or snapping the blade (Sandvik Coromant parting-off guide).");
      notes.push("Tool centre height must be within ±0.004\" of spindle centre; keep blade overhang as short as the part Ø allows (roughly ≤ 1.5x the diameter being parted).");
      if (width && Math.abs(width - partingWidthFor(D0)) > 0.0001) notes.push(`Sandvik's recommended blade width for Ø${D0}" is ${partingWidthFor(D0).toFixed(3)}" (${(partingWidthFor(D0) * 25.4).toFixed(1)} mm).`);
      if (dMin > 2.6) notes.push("Above Ø2.6\" use a blade ≥ 3 mm and confirm the maximum parting diameter for that blade with the insert catalog.");
    }
  }
  if (op.kind === "thread") {
    const P = num(thread.pitch, 0.05);
    const internal = !!op.internal;
    // ANSI/ISO 60° thread depth: external 0.61343·P, internal 0.54127·P (Machinery's Handbook).
    const depth = (internal ? 0.54127 : 0.61343) * P;
    const pitchMm = P * 25.4;
    const N = clamp(Math.round(num(thread.passes, 2 + 2.67 * pitchMm)), 3, 16);
    const schedule = threadInfeeds(depth, N);
    const last = schedule[schedule.length - 1].increment;
    threadInfo = { pitch: r(P, 5), tpi: r(1 / P, 2), depth: r(depth, 4), passes: N, schedule: schedule.map((s) => ({ ...s, cumulative: r(s.cumulative, 4), increment: r(s.increment, 4) })), lastPass: r(last, 4), internal };
    feed = P; // feed per revolution = lead
    if (!thread.passes) estimates.push("Pass count is a starting heuristic (≈2 + 2.7 x pitch in mm, clamped 3–16); Sandvik gives the infeed shape (constant chip area) but the count depends on insert and material — check the insert catalog.");
    if (last < 0.002) warnings.push("Last thread pass is under 0.002\" — Sandvik advises against infeeds that small (insert rubs and work-hardens); use fewer passes.");
    if (P > 0.2) warnings.push("Very coarse pitch — use a multi-tooth or full-profile insert only if the machine can drive this lead at the chosen RPM.");
    notes.push("Thread with constant spindle speed (G97), never CSS (G96) — the Z axis must stay locked to spindle angle.");
    notes.push("Use modified flank infeed (about 29° from perpendicular) so chips come off one flank; radial infeed on both flanks packs chips (Sandvik threading guide). Sandvik recommends against spring passes — use the control's threading cycle with the schedule shown.");
    notes.push("Start the threading pass at least ~2-3 pitches before the part so the axis reaches full lead speed (confirm against your control's lead-in rule).");
  }

  // --- Depth of cut ----------------------------------------------------------
  const D1 = num(finishDiameter, op.kind === "id" ? D0 + 0.1 : D0 - 0.2);
  const radialStock = Math.max(0, op.kind === "id" ? (D1 - D0) / 2 : op.kind === "face" ? num(input.faceStock, 0.05) : (D0 - D1) / 2);
  let doc = 0;
  let docNote = null;
  if (op.kind === "groove" || op.kind === "parting") {
    doc = op.kind === "parting" ? D0 / 2 : num(groove.depth, 0.1);
  } else if (op.kind === "thread") {
    doc = threadInfo.depth;
  } else {
    // Max ap from insert size: usable edge length l = IC x edgeFactor; design
    // ap_max = (2/3) l sin(kappa) (Seco geometry factor: depth <= 3/4 of the
    // useful edge length, Sandvik: <= 2/3). Round inserts: ap <= 0.25 IC
    // (Iscar RCMX catalog 0.4 IC / Pramet 0.28 IC / MMS max 1/2 IC -> conservative).
    const l = ic * shape.edgeFactor;
    let apMax = shape.round ? 0.25 * ic : (2 / 3) * l * Math.sin((kappa * Math.PI) / 180);
    // HP-limited ap: HP = hpFactor x MRR, MRR = 12 x SFM x f x ap
    const hpFactor = num(mat.hpFactor, 1.0);
    const hpBudget = m.hp * 0.85 * lerp(0.2, 1, aggQ); // 85% drive-line efficiency typical of spindle motors
    // placeholder sfm for HP estimate (refined after RPM clamp)
    const apHp = hpBudget / (hpFactor * 12 * sfmBase * Math.max(feed, 1e-4));
    if (op.finishing) {
      // Finish ap: leave exactly the finishing allowance. Sandvik/MetronQ finish ap 0.3-1 mm
      // (0.012-0.040"); Ready Plastics 0.010-0.020"; and ap >= 2/3 nose radius to engage
      // the radius (Sandvik) while < 1/3 RE gives the best finish only for sub-0.5 mm cuts.
      const allow = Math.min(radialStock || 0.015, 0.040);
      doc = radialStock > 0 ? allow : 0.015;
      docNote = "Finish pass removes the stock left by the rough pass.";
      if (radialStock > 0.040 + 1e-9) warnings.push(`${radialStock.toFixed(3)}" per side is more than a finish pass should remove (≤ 0.040", Sandvik/MetronQ finishing ap 0.3–1 mm) — rough most of it first and leave ~0.010–0.020" per side.`);
      if (doc < (2 / 3) * rn) warnings.push(`Finish depth ${doc.toFixed(3)}" is less than 2/3 of the nose radius (${rn.toFixed(3)}") — the radius is not fully engaged, the cut rubs and the finish/feeds in the table no longer hold. Use a smaller nose radius or a deeper cut (Sandvik Coromant, Seco geometry guide).`);
    } else {
      const finishAllowance = radialStock > 0.03 ? Math.min(0.015, radialStock) : 0;
      const roughStock = Math.max(radialStock - finishAllowance, 0);
      doc = Math.min(apMax * lerp(0.5, 1.0, aggQ), apHp, roughStock > 0 ? roughStock : Infinity);
      doc = Math.max(doc, Math.min(0.01, apMax));
      if (doc < (2 / 3) * rn - 1e-9 && !shape.round) warnings.push(`Depth of cut ${doc.toFixed(3)}" is below 2/3 of the nose radius (${rn.toFixed(3)}") — use a smaller nose radius or deeper cut (Sandvik).`);
      docNote = `Max ap from insert: ${apMax.toFixed(3)}" (${shape.round ? "0.25 x IC for round inserts" : "2/3 x edge length x sin κr"}); HP limit ${apHp.toFixed(3)}".`;
      if (apHp < doc * 0.99) docNote += " HP-limited.";
    }
  }

  // --- Speed -> RPM (constant surface speed ref diameter) ------------------------
  // RPM = 12 x SFM / (pi x D) = 3.82 x SFM / D
  // For facing the speed is referenced to the OD and falls toward the centre; G50 caps it.
  const Dref = op.kind === "thread" ? D0 : D0;
  let sfm = sfmBase;
  const rpmIdeal = (12 * sfm) / (Math.PI * Dref);
  const rpmLimit = Math.min(m.maxRpm, m.chuckMaxRpm > 0 ? m.chuckMaxRpm : Infinity);
  let rpm = clamp(rpmIdeal, m.minRpm, rpmLimit);
  const rpmClamped = Math.abs(rpm - rpmIdeal) > 1;
  if (rpmClamped) {
    sfm = (rpm * Math.PI * Dref) / 12;
    warnings.push(rpm >= rpmLimit - 1 ? `Spindle/chuck speed limit (${Math.round(rpmLimit)} RPM) caps surface speed at ${Math.round(sfm)} SFM — ideal was ${Math.round(sfmBase)} SFM.` : `Spindle minimum RPM forces ${Math.round(sfm)} SFM — higher than the ${Math.round(sfmBase)} SFM target.`);
  }
  if (m.chuckMaxRpm > 0 && rpm > m.chuckMaxRpm * 0.999) warnings.push("At the chuck's maximum RPM. Gripping force falls with speed as the jaws throw outward under centrifugal force — check your chuck's grip-force-vs-RPM chart (Röhm / Kitagawa publish them).");
  else notes.push("Chuck grip force drops as RPM rises (centrifugal jaw force) — confirm the dynamic grip force on your chuck's speed chart (Röhm, DC0000221; VDI 3106).");

  // thread: pitch-locked Z feed limit
  if (op.kind === "thread") {
    const zIpm = rpm * feed;
    if (zIpm > m.maxIpm) {
      const rpmT = m.maxIpm / feed;
      rpm = Math.max(m.minRpm, Math.min(rpm, rpmT));
      sfm = (rpm * Math.PI * Dref) / 12;
      warnings.push(`Threading feed (RPM x pitch) exceeds the machine's ${m.maxIpm} IPM — RPM reduced to ${Math.round(rpm)}.`);
    }
  }

  // Parting off: speed falls as the diameter shrinks under G96, so G50 matters even more
  const ipm = Math.min(rpm * feed, m.maxIpm);
  const feedPerRev = rpm > 0 ? ipm / rpm : feed;

  // --- MRR, HP, force ---------------------------------------------------------
  const hpFactor = num(mat.hpFactor, 1.0);
  // Plunge ops (groove/parting) cut a chip of area f x insert width; turning
  // ops f x ap. MRR = 12 x SFM x f x ap (in^3/min).
  const chipDepth = op.kind === "groove" || op.kind === "parting" ? num(width, 0.1) : doc;
  let mrr = 12 * sfm * feedPerRev * chipDepth;
  if (op.kind === "thread") {
    // each thread pass is a form-tool cut: use the deepest pass increment x flank length as an upper bound
    mrr = 12 * sfm * feedPerRev * (threadInfo ? threadInfo.schedule[Math.min(1, threadInfo.schedule.length - 1)].increment : 0);
  }
  const hpReq = mrr * hpFactor;
  // Tangential cutting force: Fc = HP x 33000 / V (V in ft/min); equivalent to specific force x chip area.
  const Fc = sfm > 0 ? (hpReq * 33000) / sfm : 0;
  const hpAtSpindle = m.hp * 0.85;
  if (hpReq > hpAtSpindle) warnings.push(`Requires ~${hpReq.toFixed(1)} HP at the cutter but the machine delivers ~${hpAtSpindle.toFixed(1)} HP — reduce depth of cut or feed.`);

  // --- Surface finish prediction ------------------------------------------------
  const raTheory = op.kind === "od" || op.kind === "face" || op.kind === "id" ? (feedPerRev * feedPerRev) / (32 * rn) * 1e6 : null;
  const surface = raTheory != null ? { raTheoreticalUin: r(raTheory, 1), raExpectedLow: r(raTheory * 1.2, 1), raExpectedHigh: r(raTheory * 2.0, 1), rtTheoreticalUin: r(raTheory * 4, 1) } : null;

  // --- Passes -------------------------------------------------------------------
  let passes = null;
  if (op.kind === "od" || op.kind === "id") {
    const total = radialStock;
    passes = { radialStock: r(total, 4), roughPasses: !op.finishing && doc > 0 ? Math.max(1, Math.ceil(Math.max(total - (total > 0.03 ? 0.015 : 0), 0) / doc)) : 0, finishPasses: op.finishing && doc > 0 ? Math.max(1, Math.ceil(total / doc)) : 0, finishAllowance: total > 0.03 && !op.finishing ? 0.015 : 0 };
  }
  if (op.kind === "face") passes = { radialStock: r(radialStock, 4), roughPasses: op.finishing ? 0 : Math.max(1, Math.ceil(radialStock / Math.max(doc, 1e-4))), finishAllowance: 0 };

  // Cycle time estimate (cutting only)
  let cutTime = null;
  const L = num(cutLength, 1);
  if (ipm > 0 && (op.kind === "od" || op.kind === "id" || op.kind === "face")) {
    const n = passes ? (passes.roughPasses || 1) : 1;
    cutTime = (L / ipm) * n; // minutes (excludes rapids; for facing under CSS the true time is the same since feed/rev x variable rpm = constant radial speed only if rpm unclamped)
  }

  // --- CSS (G96) with G50 clamp ------------------------------------------------
  // G96 holds surface speed constant so RPM rises as the diameter shrinks; the
  // control then over-speeds the chuck at small diameters or the centre of a
  // face unless the max RPM is clamped with G50 (Fanuc) / G92 (Mazak/Haas).
  // cnc.wiki G96 reference; Haas lathe programming guide.
  const smallD = op.kind === "face" || op.kind === "parting" ? 0.0 : Math.min(D0, D1 > 0 ? D1 : D0);
  const g50 = Math.floor(rpmLimit === Infinity ? m.maxRpm : rpmLimit);
  const rpmAtEnd = smallD > 0 ? Math.min((12 * sfm) / (Math.PI * smallD), g50) : g50;
  const css = {
    g96: Math.round(sfm), g50, rpmAtStart: Math.round(rpm), rpmAtEnd: Math.round(rpmAtEnd),
    useCss: op.kind !== "thread" && op.kind !== "drill",
    note: op.kind === "thread" ? "Use G97 (constant RPM) for threading." : "Use G96 (CSS) with the G50 RPM clamp shown — without it the spindle runs to the control's maximum at the part centre.",
  };

  // --- Workholding (chuck) ------------------------------------------------------
  const stick = num(workholding.stickout, 0);
  const Dwork = op.kind === "id" ? Math.max(D0, 0.1) : D0;
  let hold = null;
  if (op.kind !== "id" || stick > 0) {
    const Dgrip = num(workholding.gripDiameter, D0);
    const ld = stick > 0 ? stick / Math.max(Dgrip, 0.01) : null;
    const hasTail = !!workholding.tailstock;
    const hasSteady = !!workholding.steadyRest;
    let severity = "ok";
    let ldMsg = null;
    if (ld != null) {
      // Chuck only to 3:1, tailstock to 6:1 (10:1 max), steady/follow rest beyond.
      if (!hasSteady) {
        if (ld > LD_LIMITS.tailstockMax) { severity = "high"; ldMsg = `Overhang is ${ld.toFixed(1)}:1 (length : diameter) — beyond 10:1 even a tailstock alone is not enough; add a steady or follow rest, or turn it in two setups.`; }
        else if (ld > LD_LIMITS.tailstock && !hasTail) { severity = "high"; ldMsg = `Overhang is ${ld.toFixed(1)}:1 — over 6:1 needs a tailstock center and usually a steady/follow rest. Chuck-only here will chatter and taper.`; }
        else if (ld > LD_LIMITS.tailstock && hasTail) { severity = "moderate"; ldMsg = `Overhang is ${ld.toFixed(1)}:1 with a tailstock — above 6:1 expect deflection toward the middle; reduce depth of cut and add a steady rest if the finish tapers.`; }
        else if (ld > LD_LIMITS.chuckOnly && !hasTail) { severity = "moderate"; ldMsg = `Overhang is ${ld.toFixed(1)}:1 — over 3:1 should be supported by a tailstock center (Axhera, WMT CNC, AVF Décolletage L/D guidance).`; }
      }
    }
    // Workpiece bending (cantilever / fixed-pinned) — upper-bound estimate using Fc as radial load.
    const E = MODULUS_BY_MATERIAL[mat.id] || MODULUS_PSI[matClass] || 30e6;
    let deflect = null;
    if (stick > 0 && op.kind !== "id" && Fc > 0) {
      const Dc = Math.max(D1 > 0 && op.kind === "od" ? (D0 + D1) / 2 : D0, 0.05);
      const I = (Math.PI * Math.pow(Dc, 4)) / 64;
      // Chuck-only cantilever: F L^3 / (3 E I). Chuck + tailstock (fixed-pinned) load at midspan: 7 F L^3 / (768 E I) (Roark).
      const delta = hasTail || hasSteady ? (7 * Fc * Math.pow(stick, 3)) / (768 * E * I) : (Fc * Math.pow(stick, 3)) / (3 * E * I);
      deflect = { estimateIn: r(delta, 5), modulusPsi: E, support: hasSteady ? "chuck + steady rest (modelled as fixed-pinned)" : hasTail ? "chuck + tailstock" : "chuck only (cantilever)", limitIn: 0.001 };
      if (delta > 0.001) warnings.push(`Estimated worst-case workpiece deflection ${delta.toFixed(4)}" (${deflect.support}) — the part will cut oversize/tapered. Reduce depth of cut and feed, add support, or shorten the stickout. (Conservative: uses the full cutting force as the radial load.)`);
    }
    // Chuck grip force requirement (Röhm DC0000221): F_spz = F_s x S_z / mu x (d_z / d_sp)
    const jaw = WORKHOLDING_JAW_TYPES.find((j) => j.id === workholding.jawTypeId) || WORKHOLDING_JAW_TYPES[0];
    const Sz = (workholding.chuckAge === "old" ? CHUCK_SAFETY.old : CHUCK_SAFETY.new)[ld != null && ld > 3 ? 1 : 0];
    const SzEff = hasTail ? Math.max(1.5, Sz * 0.75) : Sz; // tailstock offloads torque/axial; lower factor permitted (Röhm)
    const dz = Dwork; // machining diameter
    const dsp = Math.max(Dgrip, 0.01);
    const reqGrip = jaw.mu > 0 ? ((Fc * SzEff) / jaw.mu) * (dz / dsp) : null;
    const ratedGrip = num(workholding.chuckGripForce, 0) || null;
    const usable = ratedGrip ? ratedGrip * jaw.forceDerate : null;
    const margin = usable && reqGrip ? usable / reqGrip : null;
    hold = { ld: r(ld, 2), severity, ldMsg, deflection: deflect, requiredGripForce: r(reqGrip, 0), ratedGripForce: ratedGrip, usableGripForce: r(usable, 0), margin: r(margin, 2), jawId: jaw.id, jawName: jaw.name, mu: jaw.mu, safety: r(SzEff, 2), insufficient: margin != null && margin < 1 };
    if (ldMsg) warnings.push(ldMsg);
    if (hold.insufficient) warnings.push(`Chuck grip: the cut needs ~${Math.round(reqGrip)} lbf of jaw force (Fs ${Math.round(Fc)} lbf, safety ${SzEff.toFixed(1)}, μ ${jaw.mu}) but only ~${Math.round(usable)} lbf is available${jaw.forceDerate < 1 ? " after the soft-jaw derate" : ""} — the part can spin or pull out in the chuck. Increase grip force, grip a larger diameter, or reduce the cut.`);
    if (matClass === "plastic" && ratedGrip && ratedGrip > 800) warnings.push("Plastics distort under normal chuck pressure — a round bar squeezed in 3 jaws turns out tri-lobed after release. Lower the chuck pressure, use bored soft jaws or a collet/pie jaws, and take a light finish pass with the bar relaxed.");
  }

  // --- Boring bar ---------------------------------------------------------------
  let boring = null;
  if (op.kind === "id") {
    const bt = BORING_BARS.find((b) => b.id === bar.id) || BORING_BARS[0];
    const bd = num(bar.diameter, Math.max(D0 * 0.6, 0.25));
    const oh = num(bar.overhang, bd * 4);
    const ldBar = oh / bd;
    const limit = bt.maxLD;
    const I = (Math.PI * Math.pow(bd, 4)) / 64;
    const delta = Fc > 0 ? (Fc * Math.pow(oh, 3)) / (3 * bt.E * I) : 0;
    boring = { type: bt.name, bar: r(bd, 4), overhang: r(oh, 3), ld: r(ldBar, 2), maxLD: limit, deflectionIn: r(delta, 5), minBore: r(bd * 1.4, 3) };
    if (ldBar > limit) warnings.push(`Boring bar overhang is ${ldBar.toFixed(1)}x its diameter; Sandvik's limit for a ${bt.name.toLowerCase()} is ${limit}x — expect chatter. Use a stiffer bar (carbide or damped), a larger bar, or a shorter overhang.`);
    if (delta > 0.001) warnings.push(`Estimated boring-bar deflection ${delta.toFixed(4)}" (worst case) — the bore will taper. Use a spring pass and a smaller nose radius (radial force falls with radius).`);
    if (D0 < bd * 1.4) warnings.push(`Bore Ø${D0}" is too small for a Ø${bd}" bar — chips have no room to leave. A bar should be ≤ ~70% of the bore diameter.`);
    notes.push("Boring: choose the smallest nose radius that meets the finish, and a 90° (rough) / 92° (finish) entering angle to keep radial force low (Sandvik boring guide). Use flood or through-tool coolant to flush chips out of the bore.");
  }
  const feedFinal = feedPerRev;
  const finalIpm = ipm;

  // --- Material-specific warnings ---------------------------------------------------
  {
    const matNotes = mat.turnNotes || mat.notes;
    if (matNotes && matNotes.length) for (const n of matNotes) warnings.push(`${mat.name}: ${n}`);
  }
  if (matClass === "phenolic") {
    notes.push("Phenolic turning: use a sharp C-2 uncoated carbide insert with a polished chip face, positive rake +5° to +10°, relief 8–12°, no T-land and no chipbreaker (Ready Plastics phenolic guide). Run DRY with an air blast to clear chips and keep local exhaust at the cut.");
    notes.push("Paper/cotton phenolic (XX, CE) can be turned with HSS at low volume (< ~20 parts); canvas needs carbide. Let parts equilibrate ~24 h at ambient conditions and measure at 68 °F / 50% RH before final inspection.");
  }
  if (matClass === "plastic") {
    notes.push("Plastics: use a sharp, polished-top uncoated/PCD insert with positive rake (10–15°) and generous clearance, nose radius ≈ 0.015–0.030\"; rubbing instead of cutting heats and smears the surface (Ready Plastics, Curbell).");
    notes.push("Let stock stabilise to room temperature and, for tight tolerances, rough, rest 24 h (stress relief), then finish — plastics move with temperature, moisture and released stress.");
  }
  if (matClass === "stainless" || matClass === "titanium" || matClass === "superalloy") {
    if (op.finishing && doc < 0.010) warnings.push("Work-hardening alloy: finish depth under 0.010\" rides on the work-hardened skin left by the previous pass and wears the nose quickly. Keep the finish depth ≥ 0.010\" and never dwell or stop feeding mid-cut (BSSA stainless turning guide).");
    if (feed < 0.003 && op.kind !== "thread") warnings.push("Feed under 0.003 IPR rubs rather than cuts in work-hardening alloys — keep feed up and the nose radius small.");
  }
  if (shape.fragile && !op.finishing && matClass !== "aluminum") notes.push(`${shape.name} has a weak 55°/35° tip — keep it to finishing and light semi-roughing; use a C, W, or T shape for roughing.`);

  // Insert (estimated) suggestions
  const inserts = {
    nose: rn, shape: shape.name, apMax: r(shape.round ? 0.25 * ic : (2 / 3) * ic * shape.edgeFactor * Math.sin((kappa * Math.PI) / 180), 3),
    maxFeedForNose: { lo: r(nose.lo, 4), hi: r(nose.hi, 4) },
  };

  return {
    kind: op.kind, op, mat, window: { rowName: win.rowName, scale: r(win.scale, 2), sfmRange: sfmWin.map((v) => Math.round(v * (op.sfmMult || 1))), fRange: fWin }, priority: prio, gradeUsed,
    sfm: Math.round(sfm), rpm: Math.round(rpm), feedIpr: r(feedFinal, 4), ipm: r(finalIpm, 2),
    doc: r(doc, 4), docNote, width: r(width, 4), partInfo, threadInfo,
    mrr: r(mrr, 2), hpRequired: r(hpReq, 2), cuttingForce: r(Fc, 1), surface, passes, cutTimeMin: r(cutTime, 2),
    css, hold, boring, inserts, raFeedCap: r(raFeedCap, 4), feedNotes,
    warnings, estimates, notes,
  };
}
