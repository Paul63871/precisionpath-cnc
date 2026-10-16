// Turning (lathe) reference data. Everything here is either a manufacturer/
// handbook figure (cited inline) or is explicitly flagged `est: true`, in which
// case the UI tells the machinist it is an engineering estimate to verify
// against the insert maker's own catalog.
//
// Units: inches, SFM, in/rev (IPR) unless noted.

import { PART_MATERIALS } from "./cncData";

// ---------------------------------------------------------------------------
// 1. Cutting-speed / feed windows for COATED CARBIDE INSERTS by material.
// ---------------------------------------------------------------------------
// Source windows are manufacturer-catalogue starting values (Korloy and other
// carbide-insert catalogues) transcribed by MetronQ's cutting-parameters
// calculator, converted here to SFM (m/min x 3.2808) and in/rev (mm/rev / 25.4):
//   https://metronq.com/en/cutting-parameters-calculator
// Cross-checks: Sandvik Coromant Metalcutting Technical Guide (General
// Turning), MechCodex turning reference
// (https://mechcodex.com/reference/turning-speeds-feeds), and BSSA stainless
// turning guidance (https://bssa.org.uk/bssa_articles/speeds-and-feeds-for-turning-stainless-steels/).
// `ref` is the PART_MATERIALS entry the window was published for; any other
// material that maps to this row is scaled by the ratio of its own milling SFM
// midpoint to the reference's (clamped 0.6-1.3), so e.g. 17-4PH turns slower
// than 304 and 12L14 turns slightly faster than 1018 exactly as their end-mill
// speed ranges already say.
export const TURNING_ROWS = {
  steel_mild: { ref: "steel_1018", name: "Unalloyed / low-carbon steel",
    rough: [656, 1083], finish: [919, 1378], fRough: [0.012, 0.020], fFinish: [0.004, 0.010] },
  steel_alloy: { ref: "steel_4140", name: "Low-alloy steel (normalised)",
    rough: [558, 951], finish: [787, 1181], fRough: [0.012, 0.020], fFinish: [0.004, 0.010] },
  tool_steel: { ref: "tool_steel", name: "Quenched & tempered / high-alloy steel",
    rough: [394, 656], finish: [525, 853], fRough: [0.010, 0.016], fFinish: [0.004, 0.008] },
  stainless: { ref: "ss_304", name: "Austenitic stainless",
    rough: [427, 722], finish: [574, 886], fRough: [0.008, 0.016], fFinish: [0.004, 0.008] },
  cast_iron: { ref: "cast_iron", name: "Grey cast iron",
    rough: [656, 1115], finish: [853, 1345], fRough: [0.012, 0.020], fFinish: [0.006, 0.012] },
  ductile_iron: { ref: "ductile_iron", name: "Nodular / ductile cast iron",
    rough: [591, 984], finish: [755, 1214], fRough: [0.010, 0.020], fFinish: [0.005, 0.010] },
  aluminum: { ref: "alum_6061", name: "Wrought aluminum",
    rough: [984, 2625], finish: [1312, 3281], fRough: [0.008, 0.020], fFinish: [0.004, 0.012] },
  alum_cast: { ref: "alum_cast", name: "Cast Al-Si alloys",
    rough: [656, 1640], finish: [820, 1969], fRough: [0.008, 0.016], fFinish: [0.004, 0.012] },
  brass: { ref: "brass", name: "Free-cutting brass",
    rough: [820, 1640], finish: [1050, 1969], fRough: [0.008, 0.016], fFinish: [0.003, 0.010] },
  copper_bronze: { ref: null, name: "Copper & lead-free bronzes",
    rough: [492, 984], finish: [656, 1148], fRough: [0.006, 0.014], fFinish: [0.003, 0.008] },
  titanium: { ref: "titanium_gr5", name: "Titanium alloys (Ti-6Al-4V)",
    rough: [115, 197], finish: [148, 230], fRough: [0.006, 0.012], fFinish: [0.003, 0.008] },
  superalloy: { ref: "inconel", name: "Nickel superalloys (Inconel 718/625)",
    rough: [82, 148], finish: [115, 197], fRough: [0.006, 0.010], fFinish: [0.003, 0.006] },
};

// Which TURNING_ROWS entry a given PART_MATERIALS id uses.
export const TURNING_ROW_BY_MATERIAL = {
  alum_6061: "aluminum", alum_7075: "aluminum", alum_cast: "alum_cast",
  brass: "brass", copper: "copper_bronze", bronze: "copper_bronze",
  steel_1018: "steel_mild", steel_1045: "steel_mild", steel_a36: "steel_mild",
  steel_a572: "steel_mild", steel_12l14: "steel_mild",
  steel_4140: "steel_alloy", tool_steel: "tool_steel",
  ss_303: "stainless", ss_304: "stainless", ss_316: "stainless", "ss_17-4": "stainless",
  cast_iron: "cast_iron", ductile_iron: "ductile_iron",
  titanium_gr2: "titanium", titanium_gr5: "titanium", inconel: "superalloy",
};

// Class fallback (custom user materials that only carry a materialClass).
export const TURNING_ROW_BY_CLASS = {
  aluminum: "aluminum", nonferrous_soft: "brass", steel_mild: "steel_mild",
  steel_alloy: "steel_alloy", stainless: "stainless", cast_iron: "cast_iron",
  titanium: "titanium", superalloy: "superalloy",
};

// ---------------------------------------------------------------------------
// 2. PLASTICS turning windows (SFM, IPR) — per-material, from plastics
// processors. `est` = the processor publishes no number for that material and
// the window is borrowed from the closest published one.
// ---------------------------------------------------------------------------
// Ready Plastics per-material machining guides (nylon, PP, PVC, PTFE, PEEK,
// Ultem, PET), Curbell Plastics turning guidelines (rough ~0.015 IPR, finish
// <= 0.005 IPR; fine C-2 carbide, polished top face, generous relief):
//   https://www.readyplastics.com/resources/materials/nylon/machining
//   https://www.curbellplastics.com/services-capabilities/fabrication-machined-parts/plastic-machining-guidelines/plastic-turning-machining-guidelines/
export const PLASTIC_TURNING = {
  acrylic:       { rough: [300, 600], finish: [400, 800], fRough: [0.008, 0.015], fFinish: [0.002, 0.005], est: true },
  delrin:        { rough: [300, 700], finish: [400, 900], fRough: [0.008, 0.015], fFinish: [0.002, 0.005], est: true },
  abs:           { rough: [300, 600], finish: [400, 800], fRough: [0.008, 0.015], fFinish: [0.002, 0.005], est: true },
  polycarbonate: { rough: [300, 600], finish: [400, 800], fRough: [0.008, 0.015], fFinish: [0.002, 0.005], est: true },
  nylon66:       { rough: [400, 700], finish: [500, 800], fRough: [0.008, 0.015], fFinish: [0.003, 0.006] },
  nylon6_cast:   { rough: [350, 600], finish: [450, 700], fRough: [0.008, 0.012], fFinish: [0.003, 0.005] },
  nylon_gf30:    { rough: [200, 350], finish: [250, 400], fRough: [0.005, 0.010], fFinish: [0.003, 0.005] },
  uhmw:          { rough: [500, 700], finish: [700, 1000], fRough: [0.010, 0.020], fFinish: [0.004, 0.008], est: true },
  hdpe:          { rough: [500, 700], finish: [700, 1000], fRough: [0.010, 0.020], fFinish: [0.004, 0.008], est: true },
  polypropylene: { rough: [500, 700], finish: [700, 1000], fRough: [0.010, 0.020], fFinish: [0.004, 0.008] },
  pvc:           { rough: [300, 500], finish: [400, 600], fRough: [0.008, 0.015], fFinish: [0.004, 0.008] },
  ptfe:          { rough: [400, 700], finish: [600, 1000], fRough: [0.005, 0.010], fFinish: [0.003, 0.006] },
  peek:          { rough: [400, 550], finish: [450, 600], fRough: [0.008, 0.015], fFinish: [0.002, 0.005], est: true },
  peek_gf30:     { rough: [280, 420], finish: [320, 450], fRough: [0.005, 0.010], fFinish: [0.002, 0.004], est: true },
  pei_ultem:     { rough: [600, 800], finish: [700, 1000], fRough: [0.004, 0.007], fFinish: [0.002, 0.004] },
  pet_ertalyte:  { rough: [200, 450], finish: [300, 600], fRough: [0.003, 0.012], fFinish: [0.003, 0.006] },
};

// Phenolic laminate (Textolite / Micarta / Bakelite family) turning windows.
// Source: Ready Plastics "Machining Phenolic Laminates" grade-by-grade turning
// tables (rough SFM / finish SFM, IPR, DOC; C-2 carbide, DRY for organic-fibre
// grades, flood for glass phenolic) and the thermoset hub summary table:
//   https://www.readyplastics.com/resources/machining/phenolic
//   https://www.readyplastics.com/resources/machining
// Published numbers for every entry — no estimates (glass phenolic roughing
// 250-380 SFM is the processor's own G-3/GP-01 figure).
export const PHENOLIC_TURNING = {
  phenolic_xx:     { rough: [400, 600], finish: [600, 900], fRough: [0.008, 0.012], fFinish: [0.003, 0.007], docRough: [0.080, 0.200], docFinish: [0.010, 0.030] },
  phenolic_ce:     { rough: [350, 550], finish: [550, 750], fRough: [0.006, 0.010], fFinish: [0.003, 0.006], docRough: [0.080, 0.160], docFinish: [0.010, 0.025] },
  phenolic_le:     { rough: [350, 550], finish: [500, 700], fRough: [0.005, 0.009], fFinish: [0.003, 0.006], docRough: [0.070, 0.150], docFinish: [0.010, 0.025] },
  phenolic_canvas: { rough: [300, 480], finish: [450, 650], fRough: [0.004, 0.009], fFinish: [0.002, 0.005], docRough: [0.060, 0.130], docFinish: [0.008, 0.020] },
  phenolic_glass:  { rough: [250, 380], finish: [380, 550], fRough: [0.004, 0.008], fFinish: [0.002, 0.005], docRough: [0.040, 0.090], docFinish: [0.005, 0.015] },
};

// Handbook modulus of elasticity (psi) for workpiece-deflection estimates
// (typical MatWeb / Machinery's Handbook values). Plastics are 1-3 orders of
// magnitude softer than steel, which is why a nylon or PTFE bar deflects under
// forces that a steel bar of the same size shrugs off.
export const MODULUS_PSI = {
  steel_mild: 29e6, steel_alloy: 29e6, tool_steel: 30e6, stainless: 28e6,
  cast_iron: 15e6, aluminum: 10e6, nonferrous_soft: 15e6, titanium: 16e6,
  superalloy: 30e6, plastic: 0.4e6, composite: 3e6, wood: 1.5e6,
  // Phenolic laminates: CE canvas flexural modulus 1.5-1.6 Msi (Norplex-Micarta NP310E via
  // https://www.proplasticsinc.com/en/materials/phenolic/ and Plastics International CE sheet
  // https://www.plasticsintl.com/media/i3dhjbyn/phenolic-canvas-ce-data-sheet.pdf); paper/linen assumed the same
  // (Plastic-Craft lists a lower 1.1 Msi — flexural values vary 1.1-1.6 Msi by supplier).
  phenolic: 1.5e6,
};
export const MODULUS_BY_MATERIAL = {
  uhmw: 0.1e6, hdpe: 0.15e6, polypropylene: 0.2e6, ptfe: 0.06e6, pvc: 0.4e6,
  nylon66: 0.4e6, nylon6_cast: 0.45e6, nylon_gf30: 1.2e6, acrylic: 0.45e6,
  delrin: 0.4e6, abs: 0.35e6, polycarbonate: 0.35e6, peek: 0.5e6, peek_gf30: 1.0e6,
  pei_ultem: 0.64e6, pet_ertalyte: 0.5e6,
  phenolic_xx: 1.3e6, /* ESTIMATE */ phenolic_glass: 2.5e6, /* ESTIMATE — G-3 glass-cloth laminate */ copper: 17e6, bronze: 15e6, brass: 15e6,
};

// Materials the turning calculator does not cover (no published insert-turning
// windows): wood and fiber composites.
export function isTurnable(mat) {
  if (!mat) return false;
  if (PHENOLIC_TURNING[mat.id]) return true; // phenolics incl. glass phenolic have published windows
  if (mat.materialClass === "wood" || mat.materialClass === "composite") return false;
  return true;
}

// Resolve the speed/feed window for a material.
export function turningWindow(mat) {
  if (PLASTIC_TURNING[mat.id]) {
    return { ...PLASTIC_TURNING[mat.id], rowName: mat.name, scale: 1, plastic: true };
  }
  if (PHENOLIC_TURNING[mat.id]) {
    return { ...PHENOLIC_TURNING[mat.id], rowName: mat.name, scale: 1, plastic: true, phenolic: true };
  }
  if (mat.materialClass === "plastic") {
    // custom plastic -> generic Curbell/Ready window
    return { rough: [300, 600], finish: [400, 800], fRough: [0.008, 0.015], fFinish: [0.002, 0.005], est: true, rowName: mat.name, scale: 1, plastic: true };
  }
  const rowId = TURNING_ROW_BY_MATERIAL[mat.id] || TURNING_ROW_BY_CLASS[mat.materialClass];
  const row = rowId ? TURNING_ROWS[rowId] : null;
  if (!row) return null;
  let scale = 1;
  if (row.ref && row.ref !== mat.id && mat.sfmRange) {
    const refMat = PART_MATERIALS.find((m) => m.id === row.ref);
    if (refMat) {
      const mid = (r) => (r[0] + r[1]) / 2;
      scale = Math.min(1.3, Math.max(0.6, mid(mat.sfmRange) / mid(refMat.sfmRange)));
    }
  }
  return { ...row, scale, rowId, rowName: row.name, plastic: false };
}

// ---------------------------------------------------------------------------
// 3. Insert / tool grades
// ---------------------------------------------------------------------------
// Multipliers are vs. COATED CARBIDE (1.0) by workpiece material class.
// null = not recommended for that class (the engine warns and falls back to
// coated carbide numbers).
//   uncoated: existing verified Kennametal-derived uncoated/coated ratio
//     (0.72, COATINGS in cncData.js); polished uncoated carbide is the
//     standard (not slower) grade in aluminum/non-ferrous/plastics.
//   cermet: finish-turning steel — MMS test, PVD cermet 1050 SFM vs CVD coated
//     carbide 918 SFM at the same ap/f (x1.14):
//     https://www.mmsonline.com/articles/whats-the-best-insert-for-finishing-steel
//     Cermets are finishing/semi-finishing grades (CTE "The Time is Right for
//     Cermets": https://ctemag.com/articles/time-right-cermets/).
//   ceramic: cast iron ~6x coated carbide (Machining Doctor,
//     https://www.machiningdoctor.com/glossary/ceramic-inserts/) and Inconel
//     4-5x (American Machinist, https://www.americanmachinist.com/cutting-tools/article/21895509/exotic-cutting-materials-for-hard-machining);
//     the lower bound of each range is used.
//   pcd: aluminum <12% Si 2000-6000 SFM (Durrie PCD guide, https://durrie.com/wp-content/uploads/2022/08/Catalog_ACT.pdf)
//     vs the 984-2625 SFM coated-carbide window above (~x2.2); no speed gain in
//     plastics (melt-limited) — the benefit there is tool life on abrasive grades.
export const TURNING_GRADES = [
  { id: "coated", name: "Coated carbide (CVD/PVD)" },
  { id: "uncoated", name: "Uncoated / polished carbide" },
  { id: "cermet", name: "Cermet (finishing)" },
  { id: "ceramic", name: "Ceramic (cast iron / superalloy)" },
  { id: "pcd", name: "PCD diamond (aluminum / plastics)" },
  { id: "hss", name: "HSS (ground tool bit)" },
];

export const GRADE_MULT = {
  aluminum:        { coated: 1.0, uncoated: 1.0, cermet: null, ceramic: null, pcd: 2.2 },
  nonferrous_soft: { coated: 1.0, uncoated: 1.0, cermet: null, ceramic: null, pcd: 1.5, pcdEst: true },
  steel_mild:      { coated: 1.0, uncoated: 0.72, cermet: 1.14, ceramic: null, pcd: null },
  steel_alloy:     { coated: 1.0, uncoated: 0.72, cermet: 1.14, ceramic: null, pcd: null },
  stainless:       { coated: 1.0, uncoated: 0.72, cermet: 1.0, cermetEst: true, ceramic: null, pcd: null },
  cast_iron:       { coated: 1.0, uncoated: 0.72, cermet: 1.14, ceramic: 4.0, pcd: null },
  titanium:        { coated: 1.0, uncoated: 0.85, uncoatedEst: true, cermet: null, ceramic: null, pcd: null },
  superalloy:      { coated: 1.0, uncoated: 0.72, cermet: null, ceramic: 4.0, pcd: null },
  plastic:         { coated: 1.0, uncoated: 1.0, cermet: null, ceramic: null, pcd: 1.0 },
  // Phenolic: C-2 UNCOATED carbide is the processor's standard grade (not slower);
  // PCD gives tool life, not speed, on organic-fibre grades (heat/formaldehyde-limited)
  // — multiplier 1.0 is an ENGINEERING ESTIMATE (Ready Plastics phenolic guide).
  phenolic:        { coated: 1.0, uncoated: 1.0, cermet: null, ceramic: null, pcd: 1.0, pcdEst: true },
  // Only reachable by glass-cloth phenolic (G10/G11/CFRP are not turnable here).
  composite:       { coated: 1.0, uncoated: 1.0, cermet: null, ceramic: null, pcd: 1.0, pcdEst: true },
};

// HSS absolute turning speeds (SFM) by class — carbide-multiplier shortcuts
// from end-milling do not apply to lathe tool bits. Sources: MechCodex turning
// reference (HSS vs carbide columns), Lathe Mastery wikibook (HSS rough/finish):
//   https://mechcodex.com/reference/turning-speeds-feeds
//   https://jonilsson.github.io/lathe-mastery-wikibook/08-critical-operations/03-speeds-and-feeds/
export const HSS_TURNING = {
  aluminum:        { rough: [250, 500], finish: [350, 800] },
  nonferrous_soft: { rough: [175, 350], finish: [350, 500] },
  steel_mild:      { rough: [90, 120], finish: [100, 150] },
  steel_alloy:     { rough: [80, 110], finish: [90, 135], est: true },
  stainless:       { rough: [40, 60], finish: [60, 100] },
  cast_iron:       { rough: [60, 100], finish: [80, 100] },
  phenolic:        { mult: 0.5, est: true }, // ESTIMATE: Ready — HSS viable on XX/CE at low volume; ratio matches cncData TOOL_MATERIAL_CLASS_MULT.phenolic.hss
  plastic:         { mult: 0.67 }, // existing plastics HSS/carbide ratio (cncData TOOL_MATERIAL_CLASS_MULT)
};
// not recommended with HSS: titanium, superalloy (use carbide).

// ---------------------------------------------------------------------------
// 4. Insert geometry
// ---------------------------------------------------------------------------
// ISO insert shape letters. `edgeFactor` = effective cutting edge length l as a
// multiple of the inscribed-circle diameter IC (exact geometry: l = IC / sin(
// included angle) for rhombic shapes, e.g. CNMG 432: IC 12.7 mm, l 12.9 mm;
// DNMG 432: l 15.5 mm; VNMG: l 1.74 x IC; TNMG: l 1.73 x IC), per the Sandvik
// Coromant Metalcutting Technical Guide (General Turning), insert-size section.
export const INSERT_SHAPES = [
  { id: "C", name: "C - 80° diamond (CNMG/CCMT)", angle: 80, edgeFactor: 1.015, kappa: 95 },
  { id: "D", name: "D - 55° diamond (DNMG/DCMT)", angle: 55, edgeFactor: 1.221, kappa: 93, fragile: true },
  { id: "V", name: "V - 35° diamond (VNMG/VCMT)", angle: 35, edgeFactor: 1.743, kappa: 93, fragile: true },
  { id: "T", name: "T - 60° triangle (TNMG/TCMT)", angle: 60, edgeFactor: 1.732, kappa: 91 },
  { id: "W", name: "W - 80° trigon (WNMG)", angle: 80, edgeFactor: 0.685, kappa: 95 },
  { id: "S", name: "S - 90° square (SNMG)", angle: 90, edgeFactor: 1.0, kappa: 45 },
  { id: "R", name: "R - Round (RCMT)", angle: 0, edgeFactor: 1.0, kappa: 90, round: true },
];

export const IC_SIZES = [0.25, 0.375, 0.5, 0.625, 0.75, 1.0]; // inscribed circle, in

// Nose radius vs maximum feed (in/rev) — Sandvik Coromant Turning technical
// guide (C-1020), "Nose radius" table:
//   RE 1/64: .009-.014   RE 1/32: .016-.028   RE 3/64: .020-.039
//   RE 1/16: .028-.051   RE 3/32: .039-.071
// https://coromantstrgprod.blob.core.windows.net/files/sitecollectiondocuments%2Fdownloads%2Fglobal%2Ftechnical%20guides%2Fen-gb%2Fc-1020-18.pdf
export const NOSE_RADIUS_FEED_TABLE = [
  { r: 1 / 64, lo: 0.009, hi: 0.014 },
  { r: 1 / 32, lo: 0.016, hi: 0.028 },
  { r: 3 / 64, lo: 0.020, hi: 0.039 },
  { r: 1 / 16, lo: 0.028, hi: 0.051 },
  { r: 3 / 32, lo: 0.039, hi: 0.071 },
];
export const NOSE_RADII = [
  { value: 0.004, label: "0.004\" (sharp/ground, aluminum & plastics)" },
  { value: 1 / 64, label: "1/64\" (0.0156\" — 0.4 mm)" },
  { value: 1 / 32, label: "1/32\" (0.0313\" — 0.8 mm)" },
  { value: 3 / 64, label: "3/64\" (0.0469\" — 1.2 mm)" },
  { value: 1 / 16, label: "1/16\" (0.0625\" — 1.6 mm)" },
  { value: 3 / 32, label: "3/32\" (0.0938\" — 2.4 mm)" },
];

export function maxFeedForNose(r) {
  const t = NOSE_RADIUS_FEED_TABLE;
  if (r <= t[0].r) { const k = r / t[0].r; return { lo: t[0].lo * Math.max(k, 0.3), hi: t[0].hi * Math.max(k, 0.3) }; }
  if (r >= t[t.length - 1].r) return { lo: t[t.length - 1].lo, hi: t[t.length - 1].hi };
  for (let i = 0; i < t.length - 1; i++) {
    if (r >= t[i].r && r <= t[i + 1].r) {
      const k = (r - t[i].r) / (t[i + 1].r - t[i].r);
      return { lo: t[i].lo + k * (t[i + 1].lo - t[i].lo), hi: t[i].hi + k * (t[i + 1].hi - t[i].hi) };
    }
  }
  return { lo: t[0].lo, hi: t[0].hi };
}

// Parting-off insert width by workpiece diameter — Sandvik Coromant "Parting
// off" application guide:
//   D <0.4" : 1.0 mm | 0.4-1.0": 1.5 mm | 1.0-1.6": 2.0 mm | 1.6-2.0": 2.5 mm | 2.0-2.6": 3.0 mm
// https://www.sandvik.coromant.com/en-gb/knowledge/parting-and-grooving/parting-off
export function partingWidthFor(D) {
  const t = [[0.4, 1.0], [1.0, 1.5], [1.6, 2.0], [2.0, 2.5], [2.6, 3.0]];
  for (const [d, mm] of t) if (D <= d) return mm / 25.4;
  return 3.0 / 25.4; // larger: >= 3 mm, check the insert catalog
}

// ---------------------------------------------------------------------------
// 5. Turning operations
// ---------------------------------------------------------------------------
// kind: od | face | id | groove | parting | thread | drill
// speedRow: which published row (rough/finish) the SFM is drawn from.
// sfmMult for grooving/parting/threading: Ready Plastics' per-operation table
// for polypropylene shows rough turning 500-700, grooving/parting 200-400,
// external threading 200-350, internal 150-300 SFM (parting ~0.5x rough turning,
// threading ~0.45-0.5x). Those ratios are applied to the metal rows as well —
// Sandvik's threading guide likewise recommends running threads slower and at
// constant RPM — but no per-metal ratio table is published, so they are `est`.
export const TURNING_OPERATIONS = [
  { id: "od_rough", name: "OD Turning (Rough)", kind: "od", speedRow: "rough", sfmMult: 1.0, group: "OD / Face" },
  { id: "od_finish", name: "OD Turning (Finish)", kind: "od", speedRow: "finish", sfmMult: 1.0, finishing: true, group: "OD / Face" },
  { id: "face_rough", name: "Facing (Rough)", kind: "face", speedRow: "rough", sfmMult: 1.0, group: "OD / Face" },
  { id: "face_finish", name: "Facing (Finish)", kind: "face", speedRow: "finish", sfmMult: 1.0, finishing: true, group: "OD / Face" },
  { id: "bore_rough", name: "Boring / ID (Rough)", kind: "id", speedRow: "rough", sfmMult: 1.0, group: "Internal" },
  { id: "bore_finish", name: "Boring / ID (Finish)", kind: "id", speedRow: "finish", sfmMult: 1.0, finishing: true, group: "Internal" },
  { id: "drill", name: "Drilling (on lathe)", kind: "drill", group: "Internal" },
  { id: "groove_od", name: "Grooving (OD)", kind: "groove", speedRow: "rough", sfmMult: 0.7, est: true, group: "Grooving / Parting" },
  { id: "groove_face", name: "Grooving (Face)", kind: "groove", speedRow: "rough", sfmMult: 0.7, est: true, face: true, group: "Grooving / Parting" },
  { id: "parting", name: "Parting Off", kind: "parting", speedRow: "rough", sfmMult: 0.5, est: true, group: "Grooving / Parting" },
  { id: "thread_od", name: "Threading (OD)", kind: "thread", speedRow: "rough", sfmMult: 0.5, est: true, group: "Threading" },
  { id: "thread_id", name: "Threading (ID)", kind: "thread", speedRow: "rough", sfmMult: 0.45, est: true, internal: true, group: "Threading" },
];

// Workpiece length-to-diameter (stickout / diameter) support rules.
//   <= 3:1 chuck only;  3-6:1 tailstock; > 6:1 steady / follow rest (or redesign)
// Axhera design guide https://axhera.com/precision-turning/design-guide ;
// AVF Decolletage https://www.avfdecolletage.com/post/what-is-swiss-lathe-how-does-it-works ;
// WMT CNC (>10:1 needs tailstock AND steady rest) https://cncwmt.com/qa/importance-of-the-tailstock-on-a-lathe/
export const LD_LIMITS = { chuckOnly: 3, tailstock: 6, tailstockMax: 10 };

// Boring-bar maximum overhang (x bar diameter) — Sandvik Coromant "Turning tool set-up":
//   steel 4 (turning) / 3 (grooving, threading); carbide 6 / 5 / 5;
//   steel damped 7 (10 for long-design); carbide-reinforced damped 14 / 7 / 7
// https://www.sandvik.coromant.com/en-us/knowledge/general-turning/tool-set-up
export const BORING_BARS = [
  { id: "steel", name: "Steel boring bar", maxLD: 4, grooveLD: 3, E: 30e6 },
  { id: "carbide", name: "Carbide boring bar", maxLD: 6, grooveLD: 5, E: 87e6 },
  { id: "damped_steel", name: "Damped steel bar (Silent Tools type)", maxLD: 7, grooveLD: 5, E: 30e6 },
  { id: "damped_carbide", name: "Carbide-reinforced damped bar", maxLD: 14, grooveLD: 7, E: 60e6 },
];

// Lathe chuck safety factors — Rohm power-operated clamping devices (DC0000221):
// Sz ~2 for new chucks with chucking length lz <= 3, 2.4 for 3-6 (older, regularly
// serviced chucks 4.0 / 4.8). Lower values are allowed when the part is
// supported by a tailstock or seated against the jaws.
// https://www.roehm.biz/fileadmin/products/media/en/DC0000221.PDF
export const CHUCK_SAFETY = { new: [2.0, 2.4], old: [4.0, 4.8] };
