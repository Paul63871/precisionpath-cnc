// CNC feeds & speeds reference data.
// SFM ranges are [conservative, aggressive] for solid carbide tooling.
// hpFactor = horsepower required per cubic inch per minute of material removal.

export const PART_MATERIALS = [
  { id: "alum_6061", name: "Aluminum 6061", category: "Aluminum",
    sfmRange: [300, 1000], chipLoadFactor: 1.0, hpFactor: 0.25,
    slotDepthFactor: 1.0, profileDepthFactor: 3.0 },
  { id: "alum_7075", name: "Aluminum 7075", category: "Aluminum",
    sfmRange: [250, 800], chipLoadFactor: 0.9, hpFactor: 0.30,
    slotDepthFactor: 0.9, profileDepthFactor: 2.5 },
  { id: "alum_cast", name: "Cast Aluminum", category: "Aluminum",
    sfmRange: [200, 600], chipLoadFactor: 0.85, hpFactor: 0.28,
    slotDepthFactor: 0.8, profileDepthFactor: 2.0 },
  { id: "brass", name: "Brass", category: "Copper Alloys",
    sfmRange: [200, 600], chipLoadFactor: 0.8, hpFactor: 0.50,
    slotDepthFactor: 0.8, profileDepthFactor: 2.5 },
  { id: "copper", name: "Copper", category: "Copper Alloys",
    sfmRange: [200, 500], chipLoadFactor: 0.7, hpFactor: 0.55,
    slotDepthFactor: 0.7, profileDepthFactor: 2.0 },
  { id: "bronze", name: "Bronze", category: "Copper Alloys",
    sfmRange: [150, 400], chipLoadFactor: 0.7, hpFactor: 0.60,
    slotDepthFactor: 0.7, profileDepthFactor: 2.0 },
  { id: "steel_1018", name: "Mild Steel 1018", category: "Steel",
    sfmRange: [150, 400], chipLoadFactor: 0.5, hpFactor: 1.0,
    slotDepthFactor: 0.5, profileDepthFactor: 1.5 },
  { id: "steel_1045", name: "Medium Carbon Steel 1045", category: "Steel",
    sfmRange: [120, 350], chipLoadFactor: 0.45, hpFactor: 1.1,
    slotDepthFactor: 0.45, profileDepthFactor: 1.3 },
  { id: "steel_4140", name: "Alloy Steel 4140", category: "Steel",
    sfmRange: [100, 300], chipLoadFactor: 0.4, hpFactor: 1.3,
    slotDepthFactor: 0.4, profileDepthFactor: 1.2 },
  { id: "steel_a36", name: "A36 Structural Steel", category: "Steel",
    sfmRange: [140, 380], chipLoadFactor: 0.48, hpFactor: 1.05,
    slotDepthFactor: 0.48, profileDepthFactor: 1.4 },
  { id: "steel_a572", name: "A572 Gr 50 Steel", category: "Steel",
    sfmRange: [130, 360], chipLoadFactor: 0.46, hpFactor: 1.1,
    slotDepthFactor: 0.46, profileDepthFactor: 1.35 },
  { id: "steel_12l14", name: "12L14 Free-Machining Steel", category: "Steel",
    sfmRange: [200, 500], chipLoadFactor: 0.6, hpFactor: 0.9,
    slotDepthFactor: 0.55, profileDepthFactor: 1.6 },
  { id: "ss_303", name: "Stainless 303", category: "Stainless",
    sfmRange: [120, 350], chipLoadFactor: 0.45, hpFactor: 1.3,
    slotDepthFactor: 0.45, profileDepthFactor: 1.3 },
  { id: "ss_304", name: "Stainless 304", category: "Stainless",
    sfmRange: [100, 300], chipLoadFactor: 0.4, hpFactor: 1.4,
    slotDepthFactor: 0.4, profileDepthFactor: 1.2 },
  { id: "ss_316", name: "Stainless 316", category: "Stainless",
    sfmRange: [90, 250], chipLoadFactor: 0.38, hpFactor: 1.5,
    slotDepthFactor: 0.4, profileDepthFactor: 1.1 },
  { id: "ss_17-4", name: "Stainless 17-4 PH", category: "Stainless",
    sfmRange: [60, 200], chipLoadFactor: 0.35, hpFactor: 1.6,
    slotDepthFactor: 0.35, profileDepthFactor: 1.0 },
  { id: "cast_iron", name: "Cast Iron (Gray)", category: "Iron",
    sfmRange: [150, 450], chipLoadFactor: 0.6, hpFactor: 0.8,
    slotDepthFactor: 0.7, profileDepthFactor: 2.0 },
  { id: "ductile_iron", name: "Ductile Iron", category: "Iron",
    sfmRange: [120, 350], chipLoadFactor: 0.5, hpFactor: 0.9,
    slotDepthFactor: 0.6, profileDepthFactor: 1.7 },
  { id: "titanium_gr2", name: "Titanium Grade 2", category: "Titanium",
    sfmRange: [80, 250], chipLoadFactor: 0.35, hpFactor: 1.4,
    slotDepthFactor: 0.4, profileDepthFactor: 1.2 },
  { id: "titanium_gr5", name: "Titanium Grade 5 (Ti-6Al-4V)", category: "Titanium",
    sfmRange: [50, 180], chipLoadFactor: 0.3, hpFactor: 1.6,
    slotDepthFactor: 0.35, profileDepthFactor: 1.0 },
  { id: "inconel", name: "Inconel 718", category: "Superalloy",
    sfmRange: [30, 100], chipLoadFactor: 0.25, hpFactor: 2.0,
    slotDepthFactor: 0.25, profileDepthFactor: 0.8 },
  { id: "tool_steel", name: "Tool Steel (A2/D2)", category: "Steel",
    sfmRange: [60, 200], chipLoadFactor: 0.3, hpFactor: 1.5,
    slotDepthFactor: 0.3, profileDepthFactor: 0.9 },
  { id: "wood_hard", name: "Hardwood (Maple/Oak)", category: "Wood",
    sfmRange: [400, 900], chipLoadFactor: 1.2, hpFactor: 0.08,
    slotDepthFactor: 1.0, profileDepthFactor: 3.0 },
  { id: "wood_soft", name: "Softwood (Pine)", category: "Wood",
    sfmRange: [500, 1000], chipLoadFactor: 1.3, hpFactor: 0.06,
    slotDepthFactor: 1.0, profileDepthFactor: 3.0 },
  { id: "mdf", name: "MDF / Plywood", category: "Wood",
    sfmRange: [400, 900], chipLoadFactor: 1.1, hpFactor: 0.07,
    slotDepthFactor: 1.0, profileDepthFactor: 2.5 },
  { id: "acrylic", name: "Acrylic (PMMA)", category: "Plastic",
    sfmRange: [250, 600], chipLoadFactor: 0.9, hpFactor: 0.10,
    slotDepthFactor: 0.9, profileDepthFactor: 2.0 },
  { id: "delrin", name: "Delrin (POM)", category: "Plastic",
    sfmRange: [300, 700], chipLoadFactor: 1.0, hpFactor: 0.09,
    slotDepthFactor: 1.0, profileDepthFactor: 2.5 },
  { id: "abs", name: "ABS / Polycarbonate", category: "Plastic",
    sfmRange: [250, 600], chipLoadFactor: 0.9, hpFactor: 0.10,
    slotDepthFactor: 0.9, profileDepthFactor: 2.0 },
  { id: "cfrp", name: "Carbon Fiber (CFRP)", category: "Composite",
    sfmRange: [150, 400], chipLoadFactor: 0.6, hpFactor: 0.20,
    slotDepthFactor: 0.6, profileDepthFactor: 1.5 },
  { id: "g10", name: "G10 / FR4", category: "Composite",
    sfmRange: [200, 500], chipLoadFactor: 0.7, hpFactor: 0.18,
    slotDepthFactor: 0.7, profileDepthFactor: 1.7 },
];

export const TOOL_MATERIALS = [
  { id: "carbide", name: "Solid Carbide", sfmMult: 1.0 },
  { id: "carbide_coated", name: "Coated Carbide", sfmMult: 1.25 },
  { id: "hss", name: "High Speed Steel (HSS)", sfmMult: 0.35 },
  { id: "cobalt", name: "Cobalt (HSS-Co)", sfmMult: 0.45 },
  { id: "indexable", name: "Indexable Insert", sfmMult: 1.1 },
];

export const COATINGS = [
  { id: "none", name: "Uncoated (Bright)", sfmMult: 1.0 },
  { id: "tin", name: "TiN", sfmMult: 1.1 },
  { id: "tialn", name: "TiAlN", sfmMult: 1.2 },
  { id: "altin", name: "AlTiN", sfmMult: 1.3 },
  { id: "zrn", name: "ZrN", sfmMult: 1.15 },
  { id: "dlc", name: "DLC / Diamond-like", sfmMult: 1.25 },
  { id: "diamond", name: "Diamond (PCD)", sfmMult: 1.5 },
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

// Operation presets. wocFactor and docFactor are multipliers of tool diameter.
export const OPERATIONS = [
  { id: "slotting", name: "Slotting (Full Width)", sfmMult: 0.9, chipMult: 1.0, feedMult: 1.0, wocFactor: 1.0, docMode: "slot" },
  { id: "roughing", name: "Side Roughing", sfmMult: 1.0, chipMult: 1.0, feedMult: 1.0, wocFactor: 0.25, docMode: "profile" },
  { id: "finishing", name: "Side Finishing", sfmMult: 1.1, chipMult: 0.7, feedMult: 1.0, wocFactor: 0.08, docMode: "profile" },
  { id: "facing", name: "Facing / Plunging", sfmMult: 0.95, chipMult: 1.0, feedMult: 1.0, wocFactor: 1.0, docMode: "face" },
  { id: "drilling", name: "Drilling", sfmMult: 0.8, chipMult: 1.0, feedMult: 1.0, wocFactor: 1.0, docMode: "drill" },
];

// Base chip load per tooth (inches) for an "easy" material like aluminum,
// interpolated by tool diameter.
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