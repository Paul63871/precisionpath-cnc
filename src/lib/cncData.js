// CNC feeds & speeds reference data.
// SFM ranges are [conservative, aggressive] for solid carbide, coated (standard
// AlTiN-class). Values below were cross-checked against manufacturer/handbook
// sources (Harvey Tool, Kennametal, Fastenal/Cleveland, Amana, 6G Tools, Sandvik
// Coromant, Autodesk Fusion, Machinery's Handbook 27th ed., Michigan Drill, OSG,
// ShopBot/Onsrud, Ready Plastics) during an August 2026 data audit. See
// cnc_feeds_speeds_audit_report.md for full citations and per-value reasoning.
// Coating multipliers are mild adjustments on top of that coated baseline
// (uncoated runs slower; premium nanocomposite coatings run slightly faster).
// chipLoadFactor scales the base chip load (actual chip thickness the edge can take).
// hpFactor = effective spindle unit power (hp per in³/min), net cutting power ÷ ~80%
//   drive efficiency × dulling allowance — so HP = MRR × hpFactor matches the
//   spindle horsepower a machine must deliver (matches manufacturer tool-bot output).
// materialClass groups materials for tool-material and WOC lookups that vary by
// class rather than by a single global multiplier (see TOOL_MATERIAL_CLASS_MULT
// and WOC_CLASS_TARGETS below).
// chipCurve selects which base chip-load curve applies: "metal" (default) or
// "soft" for wood/soft plastics, which cut much thicker chips at small diameters
// than the aluminum-derived metal curve.

export const PART_MATERIALS = [
  { id: "alum_6061", name: "Aluminum 6061", category: "Aluminum", materialClass: "aluminum",
    sfmRange: [700, 1400], chipLoadFactor: 1.0, hpFactor: 0.35,
    slotDepthFactor: 1.0, profileDepthFactor: 2.0 },
  { id: "alum_7075", name: "Aluminum 7075", category: "Aluminum", materialClass: "aluminum",
    sfmRange: [650, 1300], chipLoadFactor: 0.9, hpFactor: 0.40,
    slotDepthFactor: 0.9, profileDepthFactor: 2.0 },
  { id: "alum_cast", name: "Cast Aluminum", category: "Aluminum", materialClass: "aluminum",
    sfmRange: [450, 950], chipLoadFactor: 0.85, hpFactor: 0.30,
    slotDepthFactor: 0.8, profileDepthFactor: 2.0 },
  { id: "brass", name: "Brass", category: "Copper Alloys", materialClass: "nonferrous_soft",
    sfmRange: [300, 700], chipLoadFactor: 0.85, hpFactor: 0.55,
    slotDepthFactor: 0.8, profileDepthFactor: 2.0 },
  { id: "copper", name: "Copper", category: "Copper Alloys", materialClass: "nonferrous_soft",
    sfmRange: [300, 700], chipLoadFactor: 0.65, hpFactor: 0.70,
    slotDepthFactor: 0.7, profileDepthFactor: 2.0 },
  { id: "bronze", name: "Bronze", category: "Copper Alloys", materialClass: "nonferrous_soft",
    sfmRange: [220, 450], chipLoadFactor: 0.7, hpFactor: 0.70,
    slotDepthFactor: 0.7, profileDepthFactor: 2.0 },
  { id: "steel_1018", name: "Mild Steel 1018", category: "Steel", materialClass: "steel_mild",
    sfmRange: [350, 600], chipLoadFactor: 0.57, hpFactor: 1.40,
    slotDepthFactor: 0.5, profileDepthFactor: 1.5 },
  { id: "steel_1045", name: "Medium Carbon Steel 1045", category: "Steel", materialClass: "steel_mild",
    sfmRange: [300, 500], chipLoadFactor: 0.52, hpFactor: 1.50,
    slotDepthFactor: 0.45, profileDepthFactor: 1.3 },
  { id: "steel_4140", name: "Alloy Steel 4140", category: "Steel", materialClass: "steel_alloy",
    sfmRange: [250, 450], chipLoadFactor: 0.58, hpFactor: 1.75,
    slotDepthFactor: 0.4, profileDepthFactor: 1.2 },
  { id: "steel_a36", name: "A36 Structural Steel", category: "Steel", materialClass: "steel_mild",
    sfmRange: [350, 600], chipLoadFactor: 0.55, hpFactor: 1.40,
    slotDepthFactor: 0.48, profileDepthFactor: 1.4 },
  { id: "steel_a572", name: "A572 Gr 50 Steel", category: "Steel", materialClass: "steel_mild",
    sfmRange: [300, 550], chipLoadFactor: 0.53, hpFactor: 1.55,
    slotDepthFactor: 0.46, profileDepthFactor: 1.35 },
  { id: "steel_12l14", name: "12L14 Free-Machining Steel", category: "Steel", materialClass: "steel_mild",
    sfmRange: [380, 600], chipLoadFactor: 0.69, hpFactor: 1.05,
    slotDepthFactor: 0.55, profileDepthFactor: 1.6 },
  { id: "ss_303", name: "Stainless 303", category: "Stainless", materialClass: "stainless",
    sfmRange: [250, 400], chipLoadFactor: 0.52, hpFactor: 1.30,
    slotDepthFactor: 0.45, profileDepthFactor: 1.3 },
  { id: "ss_304", name: "Stainless 304", category: "Stainless", materialClass: "stainless",
    sfmRange: [200, 320], chipLoadFactor: 0.46, hpFactor: 1.60,
    slotDepthFactor: 0.4, profileDepthFactor: 1.2 },
  { id: "ss_316", name: "Stainless 316", category: "Stainless", materialClass: "stainless",
    sfmRange: [180, 290], chipLoadFactor: 0.44, hpFactor: 1.70,
    slotDepthFactor: 0.4, profileDepthFactor: 1.1 },
  { id: "ss_17-4", name: "Stainless 17-4 PH", category: "Stainless", materialClass: "stainless",
    sfmRange: [150, 260], chipLoadFactor: 0.40, hpFactor: 2.30,
    slotDepthFactor: 0.35, profileDepthFactor: 1.0 },
  { id: "cast_iron", name: "Cast Iron (Gray)", category: "Iron", materialClass: "cast_iron",
    sfmRange: [350, 650], chipLoadFactor: 0.69, hpFactor: 1.10,
    slotDepthFactor: 0.7, profileDepthFactor: 2.0 },
  { id: "ductile_iron", name: "Ductile Iron", category: "Iron", materialClass: "cast_iron",
    sfmRange: [300, 450], chipLoadFactor: 0.58, hpFactor: 1.25,
    slotDepthFactor: 0.6, profileDepthFactor: 1.7 },
  { id: "titanium_gr2", name: "Titanium Grade 2", category: "Titanium", materialClass: "titanium",
    sfmRange: [150, 260], chipLoadFactor: 0.40, hpFactor: 1.30,
    slotDepthFactor: 0.4, profileDepthFactor: 1.2 },
  { id: "titanium_gr5", name: "Titanium Grade 5 (Ti-6Al-4V)", category: "Titanium", materialClass: "titanium",
    sfmRange: [120, 250], chipLoadFactor: 0.35, hpFactor: 2.20,
    slotDepthFactor: 0.35, profileDepthFactor: 1.0 },
  { id: "inconel", name: "Inconel 718", category: "Superalloy", materialClass: "superalloy",
    sfmRange: [40, 95], chipLoadFactor: 0.29, hpFactor: 2.40,
    slotDepthFactor: 0.25, profileDepthFactor: 0.8 },
  { id: "tool_steel", name: "Tool Steel (A2/D2)", category: "Steel", materialClass: "steel_alloy",
    sfmRange: [150, 280], chipLoadFactor: 0.45, hpFactor: 2.30,
    slotDepthFactor: 0.3, profileDepthFactor: 0.9 },
  { id: "wood_hard", name: "Hardwood (Maple/Oak)", category: "Wood", materialClass: "wood",
    sfmRange: [400, 600], chipLoadFactor: 1.0, hpFactor: 0.12, chipCurve: "soft",
    slotDepthFactor: 1.0, profileDepthFactor: 2.0 },
  { id: "wood_soft", name: "Softwood (Pine)", category: "Wood", materialClass: "wood",
    sfmRange: [400, 1000], chipLoadFactor: 1.1, hpFactor: 0.10, chipCurve: "soft",
    slotDepthFactor: 1.0, profileDepthFactor: 2.0 },
  { id: "mdf", name: "MDF / Plywood", category: "Wood", materialClass: "wood",
    sfmRange: [500, 1000], chipLoadFactor: 1.0, hpFactor: 0.10, chipCurve: "soft",
    slotDepthFactor: 1.0, profileDepthFactor: 2.0 },
  { id: "acrylic", name: "Acrylic (PMMA)", category: "Plastic", materialClass: "plastic",
    sfmRange: [300, 600], chipLoadFactor: 1.05, hpFactor: 0.14, chipCurve: "soft",
    slotDepthFactor: 0.9, profileDepthFactor: 2.0 },
  { id: "delrin", name: "Delrin (POM)", category: "Plastic", materialClass: "plastic",
    sfmRange: [500, 1000], chipLoadFactor: 1.0, hpFactor: 0.13, chipCurve: "soft",
    slotDepthFactor: 1.0, profileDepthFactor: 2.0 },
  { id: "abs", name: "ABS / Polycarbonate", category: "Plastic", materialClass: "plastic",
    sfmRange: [300, 600], chipLoadFactor: 1.05, hpFactor: 0.14, chipCurve: "soft",
    slotDepthFactor: 0.9, profileDepthFactor: 2.0 },
  { id: "cfrp", name: "Carbon Fiber (CFRP)", category: "Composite", materialClass: "composite",
    sfmRange: [300, 600], chipLoadFactor: 0.6, hpFactor: 0.28,
    slotDepthFactor: 1.0, profileDepthFactor: 1.5 },
  { id: "g10", name: "G10 / FR4", category: "Composite", materialClass: "composite",
    sfmRange: [350, 650], chipLoadFactor: 0.7, hpFactor: 0.25,
    slotDepthFactor: 1.0, profileDepthFactor: 1.7 },
];

// Global fallback multipliers (used when a material has no materialClass match
// in TOOL_MATERIAL_CLASS_MULT below — should not normally happen since every
// PART_MATERIALS entry now has a materialClass).
export const TOOL_MATERIALS = [
  { id: "carbide", name: "Solid Carbide", sfmMult: 1.0 },
  { id: "hss", name: "High Speed Steel (HSS)", sfmMult: 0.35 },
  { id: "cobalt", name: "Cobalt (HSS-Co)", sfmMult: 0.45 },
  { id: "indexable", name: "Indexable Insert", sfmMult: 1.1 },
  { id: "pcd", name: "PCD (Polycrystalline Diamond)", sfmMult: 3.0 },
];

// Tool-material speed ratio vs solid carbide, by material class. The real ratio
// varies far more by workpiece material than a single global number: HSS runs
// ~17-25% of carbide speed in steels but only ~8-13% in austenitic stainless and
// ~67% in plastics; indexable inserts run faster than solid carbide in steel/iron/
// aluminum but slower in stainless/titanium (Hymson, MechCodex, Formula Factory,
// Hannibal Carbide, Fastenal/Cleveland — see audit report §7/§11).
export const TOOL_MATERIAL_CLASS_MULT = {
  aluminum:        { hss: 0.40, cobalt: 0.50, indexable: 1.15, pcd: 3.0 },
  nonferrous_soft: { hss: 0.45, cobalt: 0.55, indexable: 1.10, pcd: 2.0 },
  steel_mild:      { hss: 0.22, cobalt: 0.30, indexable: 1.20, pcd: 1.0 },
  steel_alloy:     { hss: 0.20, cobalt: 0.28, indexable: 1.15, pcd: 1.0 },
  stainless:       { hss: 0.11, cobalt: 0.20, indexable: 0.80, pcd: 1.0 },
  cast_iron:       { hss: 0.30, cobalt: 0.40, indexable: 1.25, pcd: 1.0 },
  titanium:        { hss: 0.15, cobalt: 0.25, indexable: 0.70, pcd: 1.0 },
  superalloy:      { hss: 0.10, cobalt: 0.18, indexable: 0.65, pcd: 1.0 },
  wood:            { hss: 0.60, cobalt: 0.65, indexable: 1.00, pcd: 4.0 },
  plastic:         { hss: 0.67, cobalt: 0.70, indexable: 1.00, pcd: 3.0 },
  composite:       { hss: 0.30, cobalt: 0.35, indexable: 0.90, pcd: 5.0 },
};

// Coating multipliers on top of a coated-carbide SFM baseline (AlTiN/TiAlN = 1.00
// anchor). Only entries with a `verified: true` flag have a real published
// numeric ratio behind them (Kennametal, Fullerton, Fastenal/Cleveland, 6G Tools —
// see audit §6). The rest are real, commercially available coatings with no
// published SFM ratio anywhere — vendors list them only as material-suitability
// picks. Their multiplier is a conservative, clearly-labeled estimate so the app
// never claims manufacturer-grade precision it doesn't have.
export const COATINGS = [
  { id: "none", name: "Uncoated (Bright)", sfmMult: 0.72, verified: true },
  { id: "tin", name: "TiN (Titanium Nitride)", sfmMult: 0.84, verified: true },
  { id: "ticn", name: "TiCN (Titanium Carbonitride)", sfmMult: 0.85, verified: true },
  { id: "crn", name: "CrN (Chromium Nitride)", sfmMult: 0.90, verified: false, note: "Non-ferrous / anti-galling choice — no published speed ratio; estimate." },
  { id: "zrn", name: "ZrN (Zirconium Nitride)", sfmMult: 0.92, verified: false, note: "Aluminum/copper choice — no published speed ratio; estimate." },
  { id: "tialn", name: "TiAlN (Titanium Aluminum Nitride)", sfmMult: 1.0, verified: true },
  { id: "altin", name: "AlTiN (Aluminum Titanium Nitride)", sfmMult: 1.0, verified: true },
  { id: "tib2", name: "TiB2 (Titanium Diboride — aluminum)", sfmMult: 0.98, verified: false, note: "1st-choice aluminum coating — no published speed ratio; estimate." },
  { id: "alcrn", name: "AlCrN (Aluminum Chromium Nitride)", sfmMult: 1.02, verified: false, note: "High-temp coating family — no published speed ratio; estimate." },
  { id: "alcrnx", name: "AlCrNX (AlCrN-X, enhanced)", sfmMult: 1.04, verified: false, note: "Proprietary/branded — no published speed ratio; estimate." },
  { id: "alcrsin", name: "AlCrSiN (AlCrN-Si nanocomposite)", sfmMult: 1.03, verified: false, note: "Thermal/abrasion-resistant family — no published speed ratio; estimate." },
  { id: "naco", name: "nACo (AlTiN-Si nanocomposite)", sfmMult: 1.05, verified: false, note: "Hardened-steel coating — no published speed ratio; estimate." },
  { id: "tialsin", name: "TiAlSiN (TiAlN-Si nanocomposite)", sfmMult: 1.04, verified: false, note: "Hardened-steel coating — no published speed ratio; estimate." },
  { id: "dlc", name: "DLC / Diamond-like Carbon", sfmMult: 1.02, verified: false, note: "Non-ferrous/abrasive coating — no published speed ratio; estimate." },
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

// Operation presets. wocFactor = radial engagement as a fraction of tool diameter,
// used as a fallback default for HEM/adaptive ops — the actual WOC target is now
// primarily driven by WOC_CLASS_TARGETS (material-class-aware) in cncEngine.js;
// wocFactor here only matters when a material's class isn't found there.
export const OPERATIONS = [
  // 2D / 2.5-Axis
  { id: "2d_adaptive_rough", name: "2D Adaptive Clearing (Rough)", category: "2D", sfmMult: 1.0, chipMult: 1.1, feedMult: 1.0, wocFactor: 0.15, docMode: "hem", adaptive: true },
  { id: "2d_adaptive_finish", name: "2D Adaptive Finishing", category: "2D", sfmMult: 1.1, chipMult: 0.8, feedMult: 1.0, wocFactor: 0.04, docMode: "hem", adaptive: true, finishing: true },
  { id: "2d_pocket", name: "2D Pocket", category: "2D", sfmMult: 1.0, chipMult: 1.0, feedMult: 1.0, wocFactor: 0.3, docMode: "hem", adaptive: true },
  { id: "2d_contour", name: "2D Contour", category: "2D", sfmMult: 1.1, chipMult: 0.7, feedMult: 1.0, wocFactor: 0.08, docMode: "profile", adaptive: true },
  { id: "facing", name: "Face", category: "2D", sfmMult: 0.95, chipMult: 1.0, feedMult: 1.0, wocFactor: 1.0, docMode: "face", adaptive: false },
  { id: "slotting", name: "Slot", category: "2D", sfmMult: 0.8, chipMult: 1.0, feedMult: 1.0, wocFactor: 1.0, docMode: "slot", adaptive: false, slotDerate: true },
  { id: "bore", name: "Circular / Bore", category: "2D", sfmMult: 0.8, chipMult: 1.0, feedMult: 1.0, wocFactor: 1.0, docMode: "slot", adaptive: false, slotDerate: true },
  { id: "thread", name: "Thread Milling", category: "2D", sfmMult: 0.8, chipMult: 0.6, feedMult: 1.0, wocFactor: 0.03, docMode: "profile", adaptive: false },
  { id: "drilling", name: "Drilling", category: "2D", sfmMult: 0.8, chipMult: 1.0, feedMult: 1.0, wocFactor: 1.0, docMode: "drill", adaptive: false },
  { id: "engrave", name: "2D Engrave", category: "2D", sfmMult: 1.0, chipMult: 0.4, feedMult: 1.0, wocFactor: 0.02, docMode: "profile", adaptive: false },
  // 3D / High-Speed Machining (HSM)
  { id: "3d_adaptive_rough", name: "3D Adaptive Clearing (Rough)", category: "3D", sfmMult: 1.0, chipMult: 1.0, feedMult: 1.0, wocFactor: 0.15, docMode: "hem", adaptive: true, fineStepup: true },
  { id: "3d_adaptive_finish", name: "3D Adaptive Finishing", category: "3D", sfmMult: 1.1, chipMult: 0.8, feedMult: 1.0, wocFactor: 0.04, docMode: "hem", adaptive: true, fineStepup: true, finishing: true },
  { id: "3d_pocket", name: "Pocket / Contour (3D)", category: "3D", sfmMult: 0.95, chipMult: 1.0, feedMult: 1.0, wocFactor: 0.08, docMode: "hem", adaptive: true, fineStepup: true },
  { id: "3d_parallel", name: "Parallel", category: "3D", sfmMult: 1.1, chipMult: 0.7, feedMult: 1.0, wocFactor: 0.06, docMode: "profile", adaptive: true },
  { id: "3d_waterline", name: "Contour (Waterline)", category: "3D", sfmMult: 1.05, chipMult: 0.7, feedMult: 1.0, wocFactor: 0.08, docMode: "profile", adaptive: true },
  { id: "3d_morph", name: "Morph / Blend", category: "3D", sfmMult: 1.1, chipMult: 0.7, feedMult: 1.0, wocFactor: 0.06, docMode: "profile", adaptive: true },
  { id: "3d_project", name: "Project", category: "3D", sfmMult: 1.1, chipMult: 0.7, feedMult: 1.0, wocFactor: 0.06, docMode: "profile", adaptive: true },
  { id: "3d_pencil", name: "Pencil / Rest Machining", category: "3D", sfmMult: 1.1, chipMult: 0.6, feedMult: 1.0, wocFactor: 0.05, docMode: "profile", adaptive: true, finishing: true },
  { id: "3d_radial", name: "Radial / Spiral / Flow", category: "3D", sfmMult: 1.1, chipMult: 0.7, feedMult: 1.0, wocFactor: 0.06, docMode: "profile", adaptive: true },
  // Multi-Axis & Special
  { id: "3plus2", name: "3+2 Positioning (Indexed)", category: "Multi-Axis", sfmMult: 1.0, chipMult: 0.8, feedMult: 1.0, wocFactor: 0.08, docMode: "profile", adaptive: true },
  { id: "5axis", name: "Simultaneous 5-Axis", category: "Multi-Axis", sfmMult: 1.0, chipMult: 0.8, feedMult: 1.0, wocFactor: 0.08, docMode: "profile", adaptive: true },
];

// Material-class HEM/adaptive radial engagement (WOC as % of diameter) targets.
// The old flat 4-6% figure was an exact match for titanium/hardened-steel HEM but
// 3-8x too conservative for aluminum and roughly half the recommended value for
// general steel (Autodesk Fusion 3D Adaptive reference, Harvey Performance HREM,
// Sandvik Coromant trochoidal/slicing — see audit §4). roughPct/finishPct are
// fractions of diameter; ceiling is a hard cap regardless of aggressiveness.
export const WOC_CLASS_TARGETS = {
  aluminum:        { roughPct: [0.25, 0.35], finishPct: [0.03, 0.05], ceiling: 0.35 },
  nonferrous_soft: { roughPct: [0.20, 0.30], finishPct: [0.03, 0.05], ceiling: 0.30 },
  steel_mild:      { roughPct: [0.10, 0.20], finishPct: [0.03, 0.05], ceiling: 0.20 },
  steel_alloy:     { roughPct: [0.08, 0.15], finishPct: [0.03, 0.05], ceiling: 0.20 },
  stainless:       { roughPct: [0.08, 0.15], finishPct: [0.03, 0.05], ceiling: 0.15 },
  cast_iron:       { roughPct: [0.10, 0.20], finishPct: [0.03, 0.05], ceiling: 0.20 },
  titanium:        { roughPct: [0.04, 0.08], finishPct: [0.03, 0.05], ceiling: 0.08 },
  superalloy:      { roughPct: [0.04, 0.06], finishPct: [0.03, 0.05], ceiling: 0.06 },
  wood:             { roughPct: [0.20, 0.35], finishPct: [0.05, 0.08], ceiling: 0.40 },
  plastic:          { roughPct: [0.15, 0.30], finishPct: [0.05, 0.08], ceiling: 0.35 },
  composite:        { roughPct: [0.10, 0.20], finishPct: [0.05, 0.08], ceiling: 0.20 },
};

// Base chip load per tooth (inches) for METALS — the actual chip thickness a
// solid carbide edge can take in an "easy" metal (aluminum), interpolated by
// tool diameter. Validated against Kennametal/Fastenal/Harvey per-diameter IPT —
// this is the best-supported table in the app (audit §2/§5).
const CHIP_LOAD_TABLE_METAL = [
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

// Base chip load per tooth (inches) for WOOD / SOFT PLASTICS. The metal-derived
// curve undershoots real router chip loads by 50-60% at small diameters
// (ShopBot/Onsrud, Onsrud soft-plastic data — audit §2 items 23-27); this is a
// separate curve rather than a bigger multiplier on the metal curve.
const CHIP_LOAD_TABLE_SOFT = [
  [0.0625, 0.0020],
  [0.125, 0.0035],
  [0.1875, 0.0050],
  [0.25, 0.0070],
  [0.3125, 0.0075],
  [0.375, 0.0080],
  [0.5, 0.0100],
  [0.625, 0.0115],
  [0.75, 0.0130],
  [1.0, 0.0150],
];

function interpTable(table, d) {
  const dmin = table[0][0], dmax = table[table.length - 1][0];
  const dc = Math.max(dmin, Math.min(dmax, d));
  for (let i = 0; i < table.length - 1; i++) {
    const [d0, c0] = table[i];
    const [d1, c1] = table[i + 1];
    if (dc >= d0 && dc <= d1) {
      const t = (dc - d0) / (d1 - d0);
      return c0 + t * (c1 - c0);
    }
  }
  return table[table.length - 1][1];
}

export function baseChipLoad(diameter, curve = "metal") {
  const table = curve === "soft" ? CHIP_LOAD_TABLE_SOFT : CHIP_LOAD_TABLE_METAL;
  return interpTable(table, diameter);
}

export function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
