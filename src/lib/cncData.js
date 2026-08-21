// CNC feeds & speeds reference data.
// SFM ranges are [conservative, aggressive] for solid carbide, coated (standard
// AlTiN-class). They reflect proven manufacturer chart values, so the default
// (60% aggressiveness) output lands slightly conservative vs brand tool-bots and
// reaches proven aggressive values near the top of the slider.
// Coating multipliers are mild adjustments on top of that coated baseline
// (uncoated runs slower; premium nanocomposite coatings run slightly faster).
// chipLoadFactor scales the base chip load (actual chip thickness the edge can take).
// hpFactor = effective spindle unit power (hp per in³/min), net cutting power ÷ ~80%
//   drive efficiency × dulling allowance — so HP = MRR × hpFactor matches the
//   spindle horsepower a machine must deliver (matches manufacturer tool-bot output).

export const PART_MATERIALS = [
  { id: "alum_6061", name: "Aluminum 6061", category: "Aluminum",
    sfmRange: [500, 1200], chipLoadFactor: 1.0, hpFactor: 0.35,
    slotDepthFactor: 1.0, profileDepthFactor: 3.0 },
  { id: "alum_7075", name: "Aluminum 7075", category: "Aluminum",
    sfmRange: [450, 1000], chipLoadFactor: 0.9, hpFactor: 0.40,
    slotDepthFactor: 0.9, profileDepthFactor: 2.5 },
  { id: "alum_cast", name: "Cast Aluminum", category: "Aluminum",
    sfmRange: [350, 800], chipLoadFactor: 0.85, hpFactor: 0.38,
    slotDepthFactor: 0.8, profileDepthFactor: 2.0 },
  { id: "brass", name: "Brass", category: "Copper Alloys",
    sfmRange: [250, 600], chipLoadFactor: 0.8, hpFactor: 0.65,
    slotDepthFactor: 0.8, profileDepthFactor: 2.5 },
  { id: "copper", name: "Copper", category: "Copper Alloys",
    sfmRange: [200, 500], chipLoadFactor: 0.7, hpFactor: 0.70,
    slotDepthFactor: 0.7, profileDepthFactor: 2.0 },
  { id: "bronze", name: "Bronze", category: "Copper Alloys",
    sfmRange: [180, 400], chipLoadFactor: 0.7, hpFactor: 0.75,
    slotDepthFactor: 0.7, profileDepthFactor: 2.0 },
  { id: "steel_1018", name: "Mild Steel 1018", category: "Steel",
    sfmRange: [280, 450], chipLoadFactor: 0.57, hpFactor: 1.4,
    slotDepthFactor: 0.5, profileDepthFactor: 1.5 },
  { id: "steel_1045", name: "Medium Carbon Steel 1045", category: "Steel",
    sfmRange: [250, 400], chipLoadFactor: 0.52, hpFactor: 1.5,
    slotDepthFactor: 0.45, profileDepthFactor: 1.3 },
  { id: "steel_4140", name: "Alloy Steel 4140", category: "Steel",
    sfmRange: [200, 360], chipLoadFactor: 0.46, hpFactor: 1.75,
    slotDepthFactor: 0.4, profileDepthFactor: 1.2 },
  { id: "steel_a36", name: "A36 Structural Steel", category: "Steel",
    sfmRange: [280, 450], chipLoadFactor: 0.55, hpFactor: 1.5,
    slotDepthFactor: 0.48, profileDepthFactor: 1.4 },
  { id: "steel_a572", name: "A572 Gr 50 Steel", category: "Steel",
    sfmRange: [270, 430], chipLoadFactor: 0.53, hpFactor: 1.55,
    slotDepthFactor: 0.46, profileDepthFactor: 1.35 },
  { id: "steel_12l14", name: "12L14 Free-Machining Steel", category: "Steel",
    sfmRange: [380, 600], chipLoadFactor: 0.69, hpFactor: 1.25,
    slotDepthFactor: 0.55, profileDepthFactor: 1.6 },
  { id: "ss_303", name: "Stainless 303", category: "Stainless",
    sfmRange: [250, 400], chipLoadFactor: 0.52, hpFactor: 1.7,
    slotDepthFactor: 0.45, profileDepthFactor: 1.3 },
  { id: "ss_304", name: "Stainless 304", category: "Stainless",
    sfmRange: [200, 320], chipLoadFactor: 0.46, hpFactor: 1.9,
    slotDepthFactor: 0.4, profileDepthFactor: 1.2 },
  { id: "ss_316", name: "Stainless 316", category: "Stainless",
    sfmRange: [180, 290], chipLoadFactor: 0.44, hpFactor: 2.0,
    slotDepthFactor: 0.4, profileDepthFactor: 1.1 },
  { id: "ss_17-4", name: "Stainless 17-4 PH", category: "Stainless",
    sfmRange: [150, 260], chipLoadFactor: 0.40, hpFactor: 2.3,
    slotDepthFactor: 0.35, profileDepthFactor: 1.0 },
  { id: "cast_iron", name: "Cast Iron (Gray)", category: "Iron",
    sfmRange: [350, 550], chipLoadFactor: 0.69, hpFactor: 1.1,
    slotDepthFactor: 0.7, profileDepthFactor: 2.0 },
  { id: "ductile_iron", name: "Ductile Iron", category: "Iron",
    sfmRange: [300, 450], chipLoadFactor: 0.58, hpFactor: 1.25,
    slotDepthFactor: 0.6, profileDepthFactor: 1.7 },
  { id: "titanium_gr2", name: "Titanium Grade 2", category: "Titanium",
    sfmRange: [150, 260], chipLoadFactor: 0.40, hpFactor: 1.8,
    slotDepthFactor: 0.4, profileDepthFactor: 1.2 },
  { id: "titanium_gr5", name: "Titanium Grade 5 (Ti-6Al-4V)", category: "Titanium",
    sfmRange: [80, 170], chipLoadFactor: 0.35, hpFactor: 2.2,
    slotDepthFactor: 0.35, profileDepthFactor: 1.0 },
  { id: "inconel", name: "Inconel 718", category: "Superalloy",
    sfmRange: [40, 95], chipLoadFactor: 0.29, hpFactor: 3.2,
    slotDepthFactor: 0.25, profileDepthFactor: 0.8 },
  { id: "tool_steel", name: "Tool Steel (A2/D2)", category: "Steel",
    sfmRange: [150, 280], chipLoadFactor: 0.35, hpFactor: 2.3,
    slotDepthFactor: 0.3, profileDepthFactor: 0.9 },
  { id: "wood_hard", name: "Hardwood (Maple/Oak)", category: "Wood",
    sfmRange: [500, 1000], chipLoadFactor: 1.2, hpFactor: 0.12,
    slotDepthFactor: 1.0, profileDepthFactor: 3.0 },
  { id: "wood_soft", name: "Softwood (Pine)", category: "Wood",
    sfmRange: [600, 1100], chipLoadFactor: 1.3, hpFactor: 0.10,
    slotDepthFactor: 1.0, profileDepthFactor: 3.0 },
  { id: "mdf", name: "MDF / Plywood", category: "Wood",
    sfmRange: [500, 1000], chipLoadFactor: 1.1, hpFactor: 0.10,
    slotDepthFactor: 1.0, profileDepthFactor: 2.5 },
  { id: "acrylic", name: "Acrylic (PMMA)", category: "Plastic",
    sfmRange: [300, 600], chipLoadFactor: 0.9, hpFactor: 0.14,
    slotDepthFactor: 0.9, profileDepthFactor: 2.0 },
  { id: "delrin", name: "Delrin (POM)", category: "Plastic",
    sfmRange: [400, 800], chipLoadFactor: 1.0, hpFactor: 0.13,
    slotDepthFactor: 1.0, profileDepthFactor: 2.5 },
  { id: "abs", name: "ABS / Polycarbonate", category: "Plastic",
    sfmRange: [300, 600], chipLoadFactor: 0.9, hpFactor: 0.14,
    slotDepthFactor: 0.9, profileDepthFactor: 2.0 },
  { id: "cfrp", name: "Carbon Fiber (CFRP)", category: "Composite",
    sfmRange: [200, 450], chipLoadFactor: 0.6, hpFactor: 0.28,
    slotDepthFactor: 0.6, profileDepthFactor: 1.5 },
  { id: "g10", name: "G10 / FR4", category: "Composite",
    sfmRange: [250, 500], chipLoadFactor: 0.7, hpFactor: 0.25,
    slotDepthFactor: 0.7, profileDepthFactor: 1.7 },
];

export const TOOL_MATERIALS = [
  { id: "carbide", name: "Solid Carbide", sfmMult: 1.0 },
  { id: "hss", name: "High Speed Steel (HSS)", sfmMult: 0.35 },
  { id: "cobalt", name: "Cobalt (HSS-Co)", sfmMult: 0.45 },
  { id: "indexable", name: "Indexable Insert", sfmMult: 1.1 },
];

// Mild multipliers on the coated-carbide SFM baseline. Uncoated runs slower;
// premium PVD/nanocomposite coatings run slightly faster. (Brand charts already
// assume a coated tool, so these are small adjustments, not large boosts.)
export const COATINGS = [
  { id: "none", name: "Uncoated (Bright)", sfmMult: 0.85 },
  { id: "tin", name: "TiN (Titanium Nitride)", sfmMult: 0.95 },
  { id: "ticn", name: "TiCN (Titanium Carbonitride)", sfmMult: 1.0 },
  { id: "crn", name: "CrN (Chromium Nitride)", sfmMult: 0.95 },
  { id: "zrn", name: "ZrN (Zirconium Nitride)", sfmMult: 0.98 },
  { id: "tialn", name: "TiAlN (Titanium Aluminum Nitride)", sfmMult: 1.0 },
  { id: "altin", name: "AlTiN (Aluminum Titanium Nitride)", sfmMult: 1.03 },
  { id: "tib2", name: "TiB2 (Titanium Diboride — aluminum)", sfmMult: 1.0 },
  { id: "alcrn", name: "AlCrN (Aluminum Chromium Nitride)", sfmMult: 1.05 },
  { id: "alcrnx", name: "AlCrNX (AlCrN-X, enhanced)", sfmMult: 1.08 },
  { id: "alcrsin", name: "AlCrSiN (AlCrN-Si nanocomposite)", sfmMult: 1.07 },
  { id: "naco", name: "nACo (AlTiN-Si nanocomposite)", sfmMult: 1.1 },
  { id: "tialsin", name: "TiAlSiN (TiAlN-Si nanocomposite)", sfmMult: 1.08 },
  { id: "dlc", name: "DLC / Diamond-like Carbon", sfmMult: 1.05 },
  { id: "diamond", name: "Diamond (PCD)", sfmMult: 1.15 },
];

// countField: which state field drives feed (flutes vs inserts).
// fields: the type-specific inputs shown in the tool form.
export const TOOL_TYPES = [
  { id: "end_mill", name: "Square End Mill", sfmMult: 1.0, chipMult: 1.0, docMult: 1.0, isDrill: false, countField: "flutes", fields: ["flutes", "loc"] },
  { id: "ball_end", name: "Ball End Mill", sfmMult: 1.0, chipMult: 0.9, docMult: 0.85, isDrill: false, countField: "flutes", fields: ["flutes", "loc"] },
  { id: "bull_nose", name: "Bull-Nose End Mill", sfmMult: 1.0, chipMult: 1.0, docMult: 1.0, isDrill: false, countField: "flutes", fields: ["flutes", "loc", "cornerRadius"] },
  { id: "roughing", name: "Roughing / Corn Cob", sfmMult: 1.1, chipMult: 1.2, docMult: 1.3, isDrill: false, countField: "flutes", fields: ["flutes", "loc"] },
  { id: "chamfer", name: "Chamfer / V-Bit", sfmMult: 1.0, chipMult: 0.8, docMult: 0.6, isDrill: false, countField: "flutes", fields: ["flutes", "loc", "includedAngle", "tipDiameter"] },
  { id: "face_mill", name: "Face Mill (Indexable)", sfmMult: 1.0, chipMult: 1.1, docMult: 0.5, isDrill: false, countField: "inserts", fields: ["inserts", "loc", "leadAngle"] },
  { id: "drill", name: "Drill", sfmMult: 1.0, chipMult: 1.0, docMult: 1.0, isDrill: true, countField: "flutes", fields: ["flutes", "pointAngle", "loc"] },
  { id: "slitting_saw", name: "Slitting Saw", sfmMult: 0.9, chipMult: 0.8, docMult: 1.0, isDrill: false, countField: "flutes", fields: ["flutes", "thickness"] },
  { id: "t_slot", name: "T-Slot Cutter", sfmMult: 0.95, chipMult: 0.9, docMult: 1.0, isDrill: false, countField: "flutes", fields: ["flutes", "neckDiameter"] },
];

// Descriptors for the type-specific tool inputs rendered in the form.
export const FIELD_DEFS = {
  flutes: { label: "Flutes", kind: "int", min: 1, max: 12, step: 1 },
  inserts: { label: "Inserts", kind: "int", min: 1, max: 24, step: 1 },
  loc: { label: "LOC", kind: "length", step: 0.01 },
  cornerRadius: { label: "Corner Radius", kind: "length", step: 0.001 },
  includedAngle: { label: "Included Angle", kind: "angle", step: 1 },
  tipDiameter: { label: "Tip Diameter", kind: "length", step: 0.001 },
  leadAngle: { label: "Lead Angle", kind: "angle", step: 1 },
  pointAngle: { label: "Point Angle", kind: "angle", step: 1 },
  thickness: { label: "Thickness", kind: "length", step: 0.001 },
  neckDiameter: { label: "Neck Diameter", kind: "length", step: 0.001 },
};

// Operation presets. wocFactor = radial engagement as a fraction of tool diameter.
// HEM/adaptive defaults target 5-7% of Ø (industry HEM standard: 4-7% hard alloys,
// 8-12% steels, 15-25% aluminum) — tightened from earlier values to match
// manufacturer tool-bot output (e.g. IMCO ~5.5% for steel HEM roughing).
export const OPERATIONS = [
  // 2D / 2.5-Axis
  { id: "2d_adaptive_rough", name: "2D Adaptive Clearing (Rough)", category: "2D", sfmMult: 1.0, chipMult: 1.1, feedMult: 1.0, wocFactor: 0.055, docMode: "hem", adaptive: true },
  { id: "2d_adaptive_finish", name: "2D Adaptive Finishing", category: "2D", sfmMult: 1.1, chipMult: 0.8, feedMult: 1.0, wocFactor: 0.04, docMode: "hem", adaptive: true },
  { id: "2d_pocket", name: "2D Pocket", category: "2D", sfmMult: 1.0, chipMult: 1.0, feedMult: 1.0, wocFactor: 0.3, docMode: "hem", adaptive: true },
  { id: "2d_contour", name: "2D Contour", category: "2D", sfmMult: 1.1, chipMult: 0.7, feedMult: 1.0, wocFactor: 0.08, docMode: "profile", adaptive: true },
  { id: "facing", name: "Face", category: "2D", sfmMult: 0.95, chipMult: 1.0, feedMult: 1.0, wocFactor: 1.0, docMode: "face", adaptive: false },
  { id: "slotting", name: "Slot", category: "2D", sfmMult: 0.9, chipMult: 1.0, feedMult: 1.0, wocFactor: 1.0, docMode: "slot", adaptive: false },
  { id: "bore", name: "Circular / Bore", category: "2D", sfmMult: 0.9, chipMult: 1.0, feedMult: 1.0, wocFactor: 1.0, docMode: "slot", adaptive: false },
  { id: "thread", name: "Thread Milling", category: "2D", sfmMult: 0.8, chipMult: 0.6, feedMult: 1.0, wocFactor: 0.03, docMode: "profile", adaptive: false },
  { id: "drilling", name: "Drilling", category: "2D", sfmMult: 0.8, chipMult: 1.0, feedMult: 1.0, wocFactor: 1.0, docMode: "drill", adaptive: false },
  { id: "engrave", name: "2D Engrave", category: "2D", sfmMult: 1.0, chipMult: 0.4, feedMult: 1.0, wocFactor: 0.02, docMode: "profile", adaptive: false },
  // 3D / High-Speed Machining (HSM)
  { id: "3d_adaptive_rough", name: "3D Adaptive Clearing (Rough)", category: "3D", sfmMult: 1.0, chipMult: 1.0, feedMult: 1.0, wocFactor: 0.06, docMode: "hem", adaptive: true, fineStepup: true },
  { id: "3d_adaptive_finish", name: "3D Adaptive Finishing", category: "3D", sfmMult: 1.1, chipMult: 0.8, feedMult: 1.0, wocFactor: 0.04, docMode: "hem", adaptive: true, fineStepup: true },
  { id: "3d_pocket", name: "Pocket / Contour (3D)", category: "3D", sfmMult: 0.95, chipMult: 1.0, feedMult: 1.0, wocFactor: 0.08, docMode: "hem", adaptive: true, fineStepup: true },
  { id: "3d_parallel", name: "Parallel", category: "3D", sfmMult: 1.1, chipMult: 0.7, feedMult: 1.0, wocFactor: 0.06, docMode: "profile", adaptive: true },
  { id: "3d_waterline", name: "Contour (Waterline)", category: "3D", sfmMult: 1.05, chipMult: 0.7, feedMult: 1.0, wocFactor: 0.08, docMode: "profile", adaptive: true },
  { id: "3d_morph", name: "Morph / Blend", category: "3D", sfmMult: 1.1, chipMult: 0.7, feedMult: 1.0, wocFactor: 0.06, docMode: "profile", adaptive: true },
  { id: "3d_project", name: "Project", category: "3D", sfmMult: 1.1, chipMult: 0.7, feedMult: 1.0, wocFactor: 0.06, docMode: "profile", adaptive: true },
  { id: "3d_pencil", name: "Pencil / Rest Machining", category: "3D", sfmMult: 1.1, chipMult: 0.6, feedMult: 1.0, wocFactor: 0.05, docMode: "profile", adaptive: true },
  { id: "3d_radial", name: "Radial / Spiral / Flow", category: "3D", sfmMult: 1.1, chipMult: 0.7, feedMult: 1.0, wocFactor: 0.06, docMode: "profile", adaptive: true },
  // Multi-Axis & Special
  { id: "3plus2", name: "3+2 Positioning (Indexed)", category: "Multi-Axis", sfmMult: 1.0, chipMult: 0.8, feedMult: 1.0, wocFactor: 0.08, docMode: "profile", adaptive: true },
  { id: "5axis", name: "Simultaneous 5-Axis", category: "Multi-Axis", sfmMult: 1.0, chipMult: 0.8, feedMult: 1.0, wocFactor: 0.08, docMode: "profile", adaptive: true },
];

// Base chip load per tooth (inches) — the actual chip thickness a solid carbide
// edge can take in an "easy" material (aluminum), interpolated by tool diameter.
const CHIP_LOAD_TABLE = [
  [0.03125, 0.0003],
  [0.0625, 0.0006],
  [0.09375, 0.0009],
  [0.125, 0.0012],
  [0.1875, 0.0019],
  [0.25, 0.0026],
  [0.3125, 0.0033],
  [0.375, 0.0040],
  [0.5, 0.0055],
  [0.625, 0.0070],
  [0.75, 0.0085],
  [1.0, 0.0110],
  [1.25, 0.0135],
  [1.5, 0.0160],
  [2.0, 0.0210],
];

export function baseChipLoad(diameter) {
  const d = Math.max(0.005, Math.min(2.0, diameter));
  for (let i = 0; i < CHIP_LOAD_TABLE.length - 1; i++) {
    const [d0, c0] = CHIP_LOAD_TABLE[i];
    const [d1, c1] = CHIP_LOAD_TABLE[i + 1];
    if (d >= d0 && d <= d1) {
      const t = (d - d0) / (d1 - d0);
      return c0 + t * (c1 - c0);
    }
  }
  return CHIP_LOAD_TABLE[CHIP_LOAD_TABLE.length - 1][1];
}

export function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}