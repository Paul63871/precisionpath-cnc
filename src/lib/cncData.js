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
    // hpFactor 1.40: Machinery's Handbook Kp for 180-200 HB plain carbon steel
    // (0.82 unit power -> ~1.47 spindle-level) and Michigan Drill's <=150 BHN
    // steel factor (1.43) both bracket 1.40-1.47; 1.60 (a prior, uncited edit)
    // overstated cutting power needed by ~14-20% vs these sources.
    // https://theswissbay.ch/pdf/Books/Survival/Workshop/Machining%20and%20Machinery/Machinery's%20Handbook%20(27.8)/26663_yh.pdf
    // https://michigandrill.com/catalog/technical_data_milling_calcs.php
    sfmRange: [350, 600], chipLoadFactor: 0.62, hpFactor: 1.40,
    slotDepthFactor: 0.5, profileDepthFactor: 1.5 },
  { id: "steel_1045", name: "Medium Carbon Steel 1045", category: "Steel", materialClass: "steel_mild",
    sfmRange: [300, 500], chipLoadFactor: 0.56, hpFactor: 1.71,
    slotDepthFactor: 0.45, profileDepthFactor: 1.3 },
  { id: "steel_4140", name: "Alloy Steel 4140", category: "Steel", materialClass: "steel_alloy",
    sfmRange: [250, 450], chipLoadFactor: 0.58, hpFactor: 1.75,
    slotDepthFactor: 0.4, profileDepthFactor: 1.2 },
  { id: "steel_a36", name: "A36 Structural Steel", category: "Steel", materialClass: "steel_mild",
    // hpFactor 1.38: Machinery's Handbook Kp for 140-160 HB steel (0.74 unit
    // power -> ~1.32 spindle-level) and Michigan Drill's <=150 BHN factor
    // (1.43) bracket 1.32-1.43; A36 is softer than 1018-CD so it should sit
    // at or below 1018's 1.40, not above it at the prior uncited 1.60.
    // https://theswissbay.ch/pdf/Books/Survival/Workshop/Machining%20and%20Machinery/Machinery's%20Handbook%20(27.8)/26663_yh.pdf
    // https://michigandrill.com/catalog/technical_data_milling_calcs.php
    sfmRange: [350, 600], chipLoadFactor: 0.62, hpFactor: 1.38,
    slotDepthFactor: 0.48, profileDepthFactor: 1.4 },
  { id: "steel_a572", name: "A572 Gr 50 Steel", category: "Steel", materialClass: "steel_mild",
    sfmRange: [300, 550], chipLoadFactor: 0.58, hpFactor: 1.77,
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
  { id: "tap", name: "Tap", sfmMult: 1.0, chipMult: 1.0, docMult: 1.0, isDrill: false, isTap: true, countField: "flutes", fields: ["threadId", "holeType", "tapStyle", "flutes", "loc"] },
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
  threadId: { label: "Thread Size", kind: "thread" },
  holeType: { label: "Hole Type", kind: "holeType" },
  tapStyle: { label: "Tap Style", kind: "tapStyle" },
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
  // 2D Contour / peripheral (side) milling splits into rough and finish, same
  // as adaptive clearing above — it is a genuine wall/profile-following pass
  // that gets used for BOTH heavy stock removal and final wall finishing, not
  // just light finishing. Per Harvey Performance's "Diving Into the Depth of
  // Cut" (manufacturer-authored): peripheral milling finishing runs ~3-5% of
  // diameter radially; heavy roughing runs 30-50%. Fictiv, JLCCNC, and
  // several independent shop guides converge on the same rough 40-60% /
  // finish 5-20% bands. `peripheralRough: true` routes this op through the
  // same WOC_CLASS_TARGETS material-class-aware HP-solve that adaptive/HEM
  // roughing already uses (cncEngine.js), instead of a bare fixed wocFactor.
  { id: "2d_contour_rough", name: "2D Contour / Peripheral (Rough)", category: "2D", sfmMult: 1.0, chipMult: 1.0, feedMult: 1.0, wocFactor: 0.35, docMode: "profile", adaptive: true, peripheralRough: true },
  { id: "2d_contour_finish", name: "2D Contour / Peripheral (Finish)", category: "2D", sfmMult: 1.1, chipMult: 0.7, feedMult: 1.0, wocFactor: 0.08, docMode: "profile", adaptive: true, finishing: true },
  { id: "facing", name: "Face", category: "2D", sfmMult: 0.95, chipMult: 1.0, feedMult: 1.0, wocFactor: 1.0, docMode: "face", adaptive: false },
  { id: "slotting", name: "Slot", category: "2D", sfmMult: 0.8, chipMult: 1.0, feedMult: 1.0, wocFactor: 1.0, docMode: "slot", adaptive: false, slotDerate: true },
  { id: "bore", name: "Circular / Bore", category: "2D", sfmMult: 0.8, chipMult: 1.0, feedMult: 1.0, wocFactor: 1.0, docMode: "slot", adaptive: false, slotDerate: true },
  { id: "thread", name: "Thread Milling", category: "2D", sfmMult: 0.8, chipMult: 0.6, feedMult: 1.0, wocFactor: 0.03, docMode: "profile", adaptive: false },
  { id: "drilling", name: "Drilling", category: "2D", sfmMult: 0.8, chipMult: 1.0, feedMult: 1.0, wocFactor: 1.0, docMode: "drill", adaptive: false },
  // Rigid tapping. Feed is NOT chip-load driven — a tap's flutes follow an
  // already-formed thread groove, so the feed per revolution is physically
  // locked to the thread pitch (F = RPM x pitch); sfmMult/chipMult/feedMult
  // are kept at 1.0 here for API-shape consistency but the engine's tapping
  // branch ignores chipMult/feedMult entirely (see cncEngine.js docMode ===
  // "tap"). wocFactor is unused (no radial engagement concept for a tap).
  { id: "tapping", name: "Tapping", category: "2D", sfmMult: 1.0, chipMult: 1.0, feedMult: 1.0, wocFactor: 1.0, docMode: "tap", adaptive: false },
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

// Radial engagement targets for STRAIGHT PERIPHERAL/CONTOUR roughing (climb-
// milling a wall or profile at full axial depth, non-trochoidal) — deliberately
// wider than WOC_CLASS_TARGETS above, which is tuned for HEM/adaptive trochoidal
// clearing that relies on chip-thinning at tight radial engagement + high feed.
// A straight peripheral pass doesn't get that chip-thinning benefit at scale, so
// shops run it at a materially wider stepover instead. Source: Harvey
// Performance's "Diving Into the Depth of Cut" (manufacturer-authored) states
// peripheral-milling heavy roughing runs 30-50% of diameter across materials,
// vs. 3-5% for peripheral finishing; multiple independent shop/CAM guides
// (Fictiv, JLCCNC, ScienceInsights, RongFu, CalculatorHub) converge on a general
// 40-60% roughing / 5-20% finishing band for flat/bull end mills. Per-material
// spread here follows the same relative hardness/toughness ordering as
// WOC_CLASS_TARGETS (aluminum widest, superalloy/titanium narrowest) scaled up
// into Harvey's 30-50% peripheral-roughing envelope.
export const PERIPHERAL_ROUGH_WOC_TARGETS = {
  aluminum:        { roughPct: [0.40, 0.50], ceiling: 0.50 },
  nonferrous_soft: { roughPct: [0.35, 0.45], ceiling: 0.45 },
  steel_mild:      { roughPct: [0.30, 0.45], ceiling: 0.45 },
  steel_alloy:     { roughPct: [0.25, 0.40], ceiling: 0.40 },
  stainless:       { roughPct: [0.20, 0.35], ceiling: 0.35 },
  cast_iron:       { roughPct: [0.25, 0.40], ceiling: 0.40 },
  titanium:        { roughPct: [0.10, 0.20], ceiling: 0.20 },
  superalloy:      { roughPct: [0.08, 0.15], ceiling: 0.15 },
  wood:             { roughPct: [0.40, 0.55], ceiling: 0.55 },
  plastic:          { roughPct: [0.35, 0.50], ceiling: 0.50 },
  composite:        { roughPct: [0.25, 0.40], ceiling: 0.40 },
};

// --- TAPPING ---
// Rigid tapping is physically unlike drilling or milling: a tap's flutes ride
// an already-cut/formed thread groove, so feed per revolution is NOT a free
// chip-load variable at all — it is rigidly locked to the thread pitch
// (F = RPM x pitch, one pitch of travel per revolution, every time). The only
// free variable is spindle speed (SFM), and even that runs much slower than
// milling/drilling because a tap cuts on its full flank simultaneously rather
// than a single leading edge. Sources (cut-tap SFM by material, HSS baseline):
// Viking Drill & Tool tapping feed/speed table (vikingdrill.com/viking-Tap-FeedandSpeed.php),
// ARM Precision Mfg tapping speed selection guide (armpremfg.com/how-to-select-suitable-tapping-speed-for-your-tapping-machine/),
// Slugger Tool tap speed chart, HSS/M35/M42 by material (sluggertool.com/resources/tap-speed-chart/),
// Magotan Tools tapping speeds/feeds formulas & charts (magotan-tools.com/news/industry-news/tapping-speeds-and-feeds-formulas-charts-and-practical-machining-rules.html),
// ToolCroze CNC tapping speeds & feeds calculator (toolcroze.com/cnc-tapping-speeds-calculator/),
// Drillbitsworld tapping speeds & feeds chart (drillbitsworld.com/tapping-speeds-chart/).
// Ranges below are the HSS cut-tap baseline (SFM); cobalt/coated multipliers
// apply on top via TAP_TOOL_MATERIAL_MULT, same pattern as milling's
// TOOL_MATERIAL_CLASS_MULT. Keyed by the same materialClass already on every
// PART_MATERIALS entry so no new per-material data entry is needed.
export const TAP_SFM_BY_CLASS = {
  aluminum:        [40, 70],   // Viking 60-80, ARM 70-90, Magotan 60-90 (aluminum alloys)
  nonferrous_soft: [40, 90],   // brass/bronze/copper — Viking 30-100, Magotan-style free-machining range
  steel_mild:      [25, 45],   // Viking mild steel 30-50, ARM low-carbon 20-40, Magotan 40-60 low-carbon
  steel_alloy:     [15, 30],   // Viking tool steel 15-25 / medium carbon 35, ARM medium carbon 20-30, Magotan alloy/tool steel 30-40
  stainless:       [10, 20],   // Viking 300-series 10-20, ARM austenitic 10-20, Magotan 300-series 20-30
  cast_iron:       [30, 55],   // Viking gray CI 30-60, ARM gray/ductile 15-30, Magotan gray CI 50-70
  titanium:        [8, 15],    // Viking titanium alloys 10, Slugger Ti Grade 2/5 (HSS not recommended -> use low end w/ cobalt)
  superalloy:      [5, 10],    // Viking nickel alloys 10, Nimonic 10-12 — Inconel/Hastelloy treated conservatively
  wood:             [50, 90],  // no direct tap data — plastics/soft-material analog retained conservatively
  plastic:          [50, 90],  // Viking plastic 50-70, Magotan-style thermoplastics range (cut/thread-forming taps)
  composite:        [40, 70],  // no direct manufacturer tap data for composites — conservative mid-range estimate
};

// Tap tool-material speed multiplier vs the HSS baseline above. Cobalt (M35)
// and coated HSS taps run measurably faster than plain HSS in the same
// material (Slugger Tool's M2/M35/M42 comparison table shows roughly 1.25-1.6x
// for M35 cobalt and 1.4-2.0x for M42 cobalt vs M2 HSS, material-dependent).
// Solid carbide and PCD taps are not a standard commercial tap material for
// general shop rigid tapping, so they intentionally are NOT offered as tap
// tool-material options in the UI (see TOOL_MATERIALS usage in ToolForm) —
// only hss/cobalt apply here.
export const TAP_TOOL_MATERIAL_MULT = {
  hss: 1.0,
  cobalt: 1.4,
};

// Tap style multipliers/notes/chip direction. This is the single most
// important tap-selection decision after diameter/pitch: get the chip
// direction wrong for the hole type and the tap jams or breaks.
//   - Spiral point (gun/gun-nose): angled gash at the chamfer drives chips
//     FORWARD, ahead of the tap, out the far side. Through-holes ONLY — in a
//     blind hole the chips have nowhere to go and pack at the bottom.
//   - Spiral flute: helical flutes pull chips BACKWARD, up and out through
//     the hole entrance, like a drill in reverse. Made for blind holes;
//     works in through-holes too but usually not necessary there.
//   - Straight flute: no helix, chips are simply stored in the flute
//     gullets. Depth-limited (~1.5xD) in blind holes since the flutes fill
//     up; fine for through-holes, brass, or interrupted cuts (keyways).
//   - Forming/roll: no chip produced at all (material is cold-formed into
//     the thread), so hole type is a non-issue — works in either, but only
//     in ductile materials (aluminum, mild steel, copper/brass — NOT cast
//     iron or anything that doesn't flow plastically).
// chipDirection: "forward" | "backward" | "stored" | "none" — used by the
// engine to flag a hole-type / tap-style mismatch.
// holeFit: which holeType values this style is well-suited to.
// Sources: GWS Tool Group tap style/chip management guide
// (gwstoolgroup.com/tap-style-selections-by-chip-management/), Cutronix
// spiral point vs spiral flute vs forming taps guide
// (cutronix.com.au/blog/metal-cutting-basics-1/spiral-point-vs-spiral-flute-taps-which-to-use-when-and-why-8)
// — "Never [use spiral point] in a blind hole... the single most common
// tapping failure", Cutwel spiral point vs spiral flute guide
// (cutwel.co.uk/blog/spiral-point-taps-vs-spiral-flute-taps), Travers Tool
// spiral pointed vs fluted guide
// (solutions.travers.com/metalworking-machining/threading/spiral-pointed-spiral-fluted-taps-which-when),
// OPT Cutting Tools on straight-flute depth limits in blind holes
// (optcuttingtools.com/news/what-is-the-advantage-of-a-spiral-flute-tap-vs-a-straight-flute-tap-when-tapping-a-blind-hole/).
export const TAP_STYLES = [
  { id: "spiral_point", name: "Spiral Point (Gun Nose)", sfmMult: 1.0, chipDirection: "forward", holeFit: ["through"], note: "Pushes chips forward, ahead of the tap — through-holes only." },
  { id: "spiral_flute", name: "Spiral Flute", sfmMult: 0.95, chipDirection: "backward", holeFit: ["blind", "through"], note: "Pulls chips backward, up and out through the hole entrance — built for blind holes." },
  { id: "straight_flute", name: "Straight / Hand Flute", sfmMult: 0.85, chipDirection: "stored", holeFit: ["through"], note: "Chips stay in the flute gullets — fine for through-holes, brass, or interrupted cuts; depth-limited (~1.5×D) in blind holes." },
  { id: "forming", name: "Forming / Roll Tap", sfmMult: 1.2, chipDirection: "none", holeFit: ["blind", "through"], note: "Cold-forms the thread, no chip at all — works in either hole type, but ductile materials only (aluminum, mild steel, copper/brass; not cast iron)." },
];

// Hole type — drives the tap-style recommendation/mismatch check above and
// the depth default (blind holes conventionally spec'd shallower relative
// to diameter than a full clearance through-hole).
export const HOLE_TYPES = [
  { id: "through", name: "Through Hole" },
  { id: "blind", name: "Blind Hole" },
];

// Common thread designations: major diameter (in) and pitch (in/rev = 1/TPI
// for UNC/UNF, mm/rev converted to inches for metric). TPI kept for UI
// display on unified threads. Metric entries store pitchMm for display too.
// Sources: Slugger Tool thread chart (sluggertool.com/thread-chart/),
// CarbideDepot UNC/UNF tap chart (carbidedepot.com/formulas-tap-standard.htm),
// MLC tap drill & clearance chart (mlc.org.uk/guides/metric-tap-drill-chart),
// MechCodex ISO metric thread pitch chart (mechcodex.com/reference/iso-metric-thread-pitch),
// ThreadSpec.org metric coarse/fine chart (threadspec.org, threadspec.org/metric-fine/).
export const THREAD_TABLE = [
  { id: "custom", name: "Custom / Manual Entry", major: null, pitch: null, tpi: null, pitchMm: null, unit: null },
  // --- UNC (Unified National Coarse) ---
  { id: "unc_4_40", name: "#4-40 UNC", major: 0.1120, tpi: 40, pitch: 1 / 40, unit: "in" },
  { id: "unc_6_32", name: "#6-32 UNC", major: 0.1380, tpi: 32, pitch: 1 / 32, unit: "in" },
  { id: "unc_8_32", name: "#8-32 UNC", major: 0.1640, tpi: 32, pitch: 1 / 32, unit: "in" },
  { id: "unc_10_24", name: "#10-24 UNC", major: 0.1900, tpi: 24, pitch: 1 / 24, unit: "in" },
  { id: "unc_1_4_20", name: "1/4-20 UNC", major: 0.2500, tpi: 20, pitch: 1 / 20, unit: "in" },
  { id: "unc_5_16_18", name: "5/16-18 UNC", major: 0.3125, tpi: 18, pitch: 1 / 18, unit: "in" },
  { id: "unc_3_8_16", name: "3/8-16 UNC", major: 0.3750, tpi: 16, pitch: 1 / 16, unit: "in" },
  { id: "unc_7_16_14", name: "7/16-14 UNC", major: 0.4375, tpi: 14, pitch: 1 / 14, unit: "in" },
  { id: "unc_1_2_13", name: "1/2-13 UNC", major: 0.5000, tpi: 13, pitch: 1 / 13, unit: "in" },
  { id: "unc_9_16_12", name: "9/16-12 UNC", major: 0.5625, tpi: 12, pitch: 1 / 12, unit: "in" },
  { id: "unc_5_8_11", name: "5/8-11 UNC", major: 0.6250, tpi: 11, pitch: 1 / 11, unit: "in" },
  { id: "unc_3_4_10", name: "3/4-10 UNC", major: 0.7500, tpi: 10, pitch: 1 / 10, unit: "in" },
  // --- UNF (Unified National Fine) ---
  { id: "unf_4_48", name: "#4-48 UNF", major: 0.1120, tpi: 48, pitch: 1 / 48, unit: "in" },
  { id: "unf_6_40", name: "#6-40 UNF", major: 0.1380, tpi: 40, pitch: 1 / 40, unit: "in" },
  { id: "unf_8_36", name: "#8-36 UNF", major: 0.1640, tpi: 36, pitch: 1 / 36, unit: "in" },
  { id: "unf_10_32", name: "#10-32 UNF", major: 0.1900, tpi: 32, pitch: 1 / 32, unit: "in" },
  { id: "unf_1_4_28", name: "1/4-28 UNF", major: 0.2500, tpi: 28, pitch: 1 / 28, unit: "in" },
  { id: "unf_5_16_24", name: "5/16-24 UNF", major: 0.3125, tpi: 24, pitch: 1 / 24, unit: "in" },
  { id: "unf_3_8_24", name: "3/8-24 UNF", major: 0.3750, tpi: 24, pitch: 1 / 24, unit: "in" },
  { id: "unf_7_16_20", name: "7/16-20 UNF", major: 0.4375, tpi: 20, pitch: 1 / 20, unit: "in" },
  { id: "unf_1_2_20", name: "1/2-20 UNF", major: 0.5000, tpi: 20, pitch: 1 / 20, unit: "in" },
  { id: "unf_9_16_18", name: "9/16-18 UNF", major: 0.5625, tpi: 18, pitch: 1 / 18, unit: "in" },
  { id: "unf_5_8_18", name: "5/8-18 UNF", major: 0.6250, tpi: 18, pitch: 1 / 18, unit: "in" },
  // --- Metric Coarse ---
  { id: "m3_coarse", name: "M3 x 0.5", major: 3 / 25.4, tpi: null, pitch: 0.5 / 25.4, pitchMm: 0.5, unit: "mm" },
  { id: "m4_coarse", name: "M4 x 0.7", major: 4 / 25.4, tpi: null, pitch: 0.7 / 25.4, pitchMm: 0.7, unit: "mm" },
  { id: "m5_coarse", name: "M5 x 0.8", major: 5 / 25.4, tpi: null, pitch: 0.8 / 25.4, pitchMm: 0.8, unit: "mm" },
  { id: "m6_coarse", name: "M6 x 1.0", major: 6 / 25.4, tpi: null, pitch: 1.0 / 25.4, pitchMm: 1.0, unit: "mm" },
  { id: "m8_coarse", name: "M8 x 1.25", major: 8 / 25.4, tpi: null, pitch: 1.25 / 25.4, pitchMm: 1.25, unit: "mm" },
  { id: "m10_coarse", name: "M10 x 1.5", major: 10 / 25.4, tpi: null, pitch: 1.5 / 25.4, pitchMm: 1.5, unit: "mm" },
  { id: "m12_coarse", name: "M12 x 1.75", major: 12 / 25.4, tpi: null, pitch: 1.75 / 25.4, pitchMm: 1.75, unit: "mm" },
  { id: "m14_coarse", name: "M14 x 2.0", major: 14 / 25.4, tpi: null, pitch: 2.0 / 25.4, pitchMm: 2.0, unit: "mm" },
  { id: "m16_coarse", name: "M16 x 2.0", major: 16 / 25.4, tpi: null, pitch: 2.0 / 25.4, pitchMm: 2.0, unit: "mm" },
  { id: "m20_coarse", name: "M20 x 2.5", major: 20 / 25.4, tpi: null, pitch: 2.5 / 25.4, pitchMm: 2.5, unit: "mm" },
  { id: "m24_coarse", name: "M24 x 3.0", major: 24 / 25.4, tpi: null, pitch: 3.0 / 25.4, pitchMm: 3.0, unit: "mm" },
  // --- Metric Fine ---
  { id: "m8_fine", name: "M8 x 1.0 (Fine)", major: 8 / 25.4, tpi: null, pitch: 1.0 / 25.4, pitchMm: 1.0, unit: "mm" },
  { id: "m10_fine", name: "M10 x 1.25 (Fine)", major: 10 / 25.4, tpi: null, pitch: 1.25 / 25.4, pitchMm: 1.25, unit: "mm" },
  { id: "m12_fine", name: "M12 x 1.5 (Fine)", major: 12 / 25.4, tpi: null, pitch: 1.5 / 25.4, pitchMm: 1.5, unit: "mm" },
];

// --- Standard drill index (ANSI/ASME B94.11M) ---------------------------
// Every commercially stocked twist-drill size in the four standard series,
// as decimal inches. Used to snap a computed theoretical tap-drill diameter
// to the nearest size a machinist can actually buy/chuck up.
// Number series #1 (largest, 0.2280") to #80 (smallest, 0.0135") and letter
// series A-Z: Newman Tools decimal-equivalent chart (newmantools.com/decinch.htm).
// Fractional series 1/64"-1" in 1/64 increments: standard, universally
// tabulated (e.g. Newman Tools, Misumi USA drill-bit-size-chart).
const NUMBER_DRILLS = {
  1: 0.2280, 2: 0.2210, 3: 0.2130, 4: 0.2090, 5: 0.2055, 6: 0.2040, 7: 0.2010, 8: 0.1990,
  9: 0.1960, 10: 0.1935, 11: 0.1910, 12: 0.1890, 13: 0.1850, 14: 0.1820, 15: 0.1800, 16: 0.1770,
  17: 0.1730, 18: 0.1695, 19: 0.1660, 20: 0.1610, 21: 0.1590, 22: 0.1570, 23: 0.1540, 24: 0.1520,
  25: 0.1495, 26: 0.1470, 27: 0.1440, 28: 0.1405, 29: 0.1360, 30: 0.1285, 31: 0.1200, 32: 0.1160,
  33: 0.1130, 34: 0.1110, 35: 0.1100, 36: 0.1065, 37: 0.1040, 38: 0.1015, 39: 0.0995, 40: 0.0980,
  41: 0.0960, 42: 0.0935, 43: 0.0890, 44: 0.0860, 45: 0.0820, 46: 0.0810, 47: 0.0785, 48: 0.0760,
  49: 0.0730, 50: 0.0700, 51: 0.0670, 52: 0.0635, 53: 0.0595, 54: 0.0550, 55: 0.0520, 56: 0.0465,
  57: 0.0430, 58: 0.0420, 59: 0.0410, 60: 0.0400, 61: 0.0390, 62: 0.0380, 63: 0.0370, 64: 0.0360,
  65: 0.0350, 66: 0.0330, 67: 0.0320, 68: 0.0310, 69: 0.02925, 70: 0.0280, 71: 0.0260, 72: 0.0250,
  73: 0.0240, 74: 0.0225, 75: 0.0210, 76: 0.0200, 77: 0.0180, 78: 0.0160, 79: 0.0145, 80: 0.0135,
};
const LETTER_DRILLS = {
  A: 0.234, B: 0.238, C: 0.242, D: 0.246, E: 0.250, F: 0.257, G: 0.261, H: 0.266,
  I: 0.272, J: 0.277, K: 0.281, L: 0.290, M: 0.295, N: 0.302, O: 0.316, P: 0.323,
  Q: 0.332, R: 0.339, S: 0.348, T: 0.358, U: 0.368, V: 0.377, W: 0.386, X: 0.397,
  Y: 0.404, Z: 0.413,
};
const FRACTIONAL_NUMER_MAX = 64; // 1/64" increments up to 1" (64/64)
function fracLabel(n, d) {
  const g = (a, b) => (b ? g(b, a % b) : a);
  const div = g(n, d) || 1;
  return `${n / div}/${d / div}"`;
}

// Flat, sorted (ascending) list of every standard drill: { label, dec, kind }.
// Built once at module load; small (~150 entries), negligible cost.
export const STANDARD_DRILLS = [
  ...Array.from({ length: FRACTIONAL_NUMER_MAX }, (_, i) => i + 1).map((n) => ({
    label: fracLabel(n, 64), dec: n / 64, kind: "fractional",
  })),
  ...Object.entries(NUMBER_DRILLS).map(([n, dec]) => ({ label: `#${n}`, dec, kind: "number" })),
  ...Object.entries(LETTER_DRILLS).map(([l, dec]) => ({ label: l, dec, kind: "letter" })),
].sort((a, b) => a.dec - b.dec);

// Nearest standard (imperial) drill to a theoretical decimal-inch diameter.
export function nearestStandardDrill(dec) {
  if (!dec || dec <= 0) return null;
  let best = STANDARD_DRILLS[0];
  let bestDiff = Math.abs(best.dec - dec);
  for (const d of STANDARD_DRILLS) {
    const diff = Math.abs(d.dec - dec);
    if (diff < bestDiff) { best = d; bestDiff = diff; }
  }
  return best;
}

// Nearest common metric drill (0.1mm steps from 1.0mm to 25.0mm, the
// standard metric jobber-drill increment stocked by every tooling vendor).
export function nearestMetricDrill(mm) {
  if (!mm || mm <= 0) return null;
  const step = Math.round(mm * 10) / 10;
  return Math.max(1.0, Math.min(25.0, step));
}

// --- Tap drill size calculator -------------------------------------------
// Cutting taps remove material to form the thread; forming/roll taps
// displace it, so they need a LARGER starting hole (less material to push
// out of the way) for the same % thread engagement. Both formulas below are
// the Machinery's Handbook / ASME B1.1 relations, industry-standard 75%
// thread engagement (the standard machine-shop default — full 100% engagement
// gives negligible extra strength for dramatically higher tapping torque and
// break risk):
//   Cutting, inch:    drill = major - 0.01299 x %E / TPI            (%E=75 -> major - 0.974/TPI)
//   Cutting, metric:  drill = major - %E x pitch / 76.98            (%E=75 -> major - 0.974 x pitch, i.e. the classic "major minus pitch" shop rule)
//   Forming, inch:    drill = major - 0.0068  x %E / TPI
//   Forming, metric:  drill = major - %E x pitch / 147.06
// Sources: Tapmatic tapping formulas (tapmatic.com/tapping-formulas.php),
// Texas Metal Works tap & drill calculator
// (texasmetalworks.com/tap-drill-size-calculator/), LBL forming-tap drill
// chart PDF
// (www-eng.lbl.gov/~shuman/NEXT/MATERIALS&COMPONENTS/Pressure_vessels/roll_form_tap_drill_chart.pdf),
// cross-checked against the published UNC/UNF tap-drill table (Welders
// Supply, welders-supply.com/reference-charts/drill-bit-size-chart/ — e.g.
// 1/4-20 -> #7 (0.201"), 3/8-16 -> 5/16" (0.3125"), 5/8-11 -> 17/32" (0.5312")).
export function tapDrillSize(thread, { isForming = false, engagementPct = 75 } = {}) {
  if (!thread || !thread.major) return null;
  const isMetric = thread.unit === "mm";
  let dec;
  if (isMetric) {
    const pitch = thread.pitchMm; // mm
    const k = isForming ? 147.06 : 76.98;
    const decMm = (thread.major * 25.4) - (engagementPct * pitch) / k;
    dec = decMm / 25.4;
    const nearestMm = nearestMetricDrill(decMm);
    return {
      decimal: dec,
      display: `${nearestMm.toFixed(1)} mm`,
      nearestDec: nearestMm / 25.4,
      theoreticalDec: dec,
      unit: "mm",
    };
  }
  const tpi = thread.tpi;
  if (!tpi) return null;
  const k = isForming ? 0.0068 : 0.01299;
  dec = thread.major - (k * engagementPct) / tpi;
  const nearest = nearestStandardDrill(dec);
  return {
    decimal: dec,
    display: nearest ? nearest.label : dec.toFixed(4) + '"',
    nearestDec: nearest ? nearest.dec : dec,
    theoreticalDec: dec,
    unit: "in",
  };
}

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

// Base feed per REVOLUTION (inches) for DRILLING, at the aluminum/soft-metal
// baseline (scaled down for harder materials by the same mat.chipLoadFactor
// already used for milling). The end-mill per-TOOTH table above is the wrong
// physical quantity for a drill's feed formula (rpm * chipLoad, no flute
// multiplier — see cncEngine.js) — reusing it silently returned an end-mill
// per-tooth chip thickness as if it were a drill's per-revolution advance,
// underfeeding every drilling calculation in the app by roughly 2.5-3x
// relative to manufacturer drill feed charts. This table is the central
// tendency of general/medium-cut IPR-by-diameter charts, cross-checked at the
// aluminum baseline (chipLoadFactor 1.0) and at A36/304-stainless scaling:
// Redline Tools cobalt & HSS drill feed charts (redlinetools.com/customer/docs/SKUDocs/Drill-Cobalt-HSS-Speeds-Feeds-p340.pdf,
// redlinetools.com/customer/docs/RedLineToolsDrillsTechInfo.pdf),
// Norseman Drill (norsemandrill.com/feeds-speeds-drill.php),
// ProtoCutter light-metals feed table (protocutter.com/feed-rates-light-metals),
// University of Florida EML2322L drilling speeds/feeds (web.mae.ufl.edu/designlab/lab%20assignments/eml2322l-drilling%20and%20milling%20speeds%20and%20feeds.pdf),
// Tru-Edge solid carbide drill feeds incl. per-material IPR (tru-edge.com/wp-content/uploads/2019/11/Feeds-and-Speeds-Drills.pdf),
// Rock River Tool drilling speeds & feeds (rockrivertool.com/wp-content/uploads/2024/05/drilling-speeds-and-feeds-rrt.pdf),
// CarbideDepot HSS twist drill feed table (carbidedepot.com/formulas-drills-speeds.htm),
// Morse HSS & Cobalt drill speed/feed recommendations (cuttingtoolsales.com/wp-content/uploads/2015/11/Morse_Drills_Speeds.pdf).
const CHIP_LOAD_TABLE_DRILL = [
  [0.03125, 0.0010],
  [0.0625, 0.0015],
  [0.09375, 0.0018],
  [0.125, 0.0022],
  [0.1875, 0.0035],
  [0.25, 0.0050],
  [0.3125, 0.0060],
  [0.375, 0.0070],
  [0.5, 0.0090],
  [0.625, 0.0110],
  [0.75, 0.0130],
  [1.0, 0.0170],
  [1.25, 0.0220],
  [1.5, 0.0280],
  [2.0, 0.0350],
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
  const table = curve === "drill" ? CHIP_LOAD_TABLE_DRILL : curve === "soft" ? CHIP_LOAD_TABLE_SOFT : CHIP_LOAD_TABLE_METAL;
  return interpTable(table, diameter);
}

export function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
