const referenceText = `================================================================================
PRECISIONPATH CNC — COMPLETE TECHNICAL & DATA REFERENCE
================================================================================

--------------------------------------------------------------------------------
1. PURPOSE
--------------------------------------------------------------------------------
A physics-based CNC feeds & speeds calculator. Input = machine + tool + workpiece
material + operation. Output = RPM, IPM (feed), chip load, DOC (axial depth of
cut), WOC (radial width of cut), MRR, spindle HP, peck-drilling G-code, multi-pass
stepdown, chip-thinning factors, and safety warnings. Calibrated against proven
manufacturer (coated-carbide) reference charts so default output is shop-reliable.

--------------------------------------------------------------------------------
2. TECH STACK
--------------------------------------------------------------------------------
React + Vite + Tailwind CSS + shadcn/ui + lucide-react icons. Backend = Base44 BaaS
(auth, database entities with Row-Level Security, LLM/file/email integrations,
hosting). AI brand lookup = Gemini 3.1 Pro via InvokeLLM with Google search
grounding.

--------------------------------------------------------------------------------
3. THE CALCULATION ENGINE — calculate(input)
--------------------------------------------------------------------------------

INPUT OBJECT:
  diameter (in), flutes (feed-count), loc (in), toolMaterialId, coatingId,
  toolTypeId, materialId, operationId, aggressiveness (0..1, default 0.6),
  override? { sfm, chipLoad },
  machine { hp, maxRpm, minRpm, maxIpm },
  leadAngle, cornerRadius, includedAngle, tipDiameter, thickness, neckDiameter,
  pointAngle, radialLoad, axialDoc, featureDepth

3.1 SURFACE SPEED (SFM)
  - If override.sfm exists:  SFM = override.sfm * op.sfmMult
  - Else:                   SFM = lerp(sfmMin, sfmMax, agg) * tm.sfmMult
                                * coat.sfmMult * op.sfmMult * tt.sfmMult
    (sfmMin/sfmMax = material's calibrated range; agg = aggressiveness 0..1)

3.2 SPINDLE SPEED (RPM)
  - rpmIdeal = (SFM * 3.82) / diameter
  - rpm = clamp(rpmIdeal, machine.minRpm, machine.maxRpm)
  - rpmClamped flag if |rpm - rpmIdeal| > 0.5

3.3 CHIP LOAD PER TOOTH
  - If override.chipLoad: chipLoad = override.chipLoad * op.chipMult * lerp(0.8, 1.0, agg)
  - Else: chipLoad = baseChipLoad(diameter) * mat.chipLoadFactor * op.chipMult
                         * tt.chipMult * lerp(0.75, 1.05, agg)

3.4 DEPTH & WIDTH OF CUT (DOC / WOC)
  Branches by operation mode (op.docMode) and tool type:

  DRILLING (op.docMode === "drill" OR tt.isDrill):
    - holeDepth = featureDepth || loc || diameter*3
    - depthRatio = holeDepth / diameter
    - Peck base by material category:
        Stainless/Titanium/Superalloy = 0.5*D
        Composite                     = 0.6*D
        Steel/Iron                    = 0.75*D
        else (Aluminum/Wood/Plastic/Copper) = 1.0*D
    - deepHoleFeedFactor = clamp(1 - max(0, depthRatio-3) * 0.06, 0.4, 1.0)
      (feed reduced up to 60% for very deep holes)
    - peckDepth = max(diameter * peckBase * deepHoleFeedFactor,
                      max(0.05, diameter*0.15))
    - peckCount = max(1, ceil(holeDepth / peckDepth))
    - final peckDepth = holeDepth / peckCount
    - retract = max(0.1, diameter*0.2)
    - dwell = 0.3s (Stainless/Titanium/Superalloy) else 0.1s
    - cycle = G83 if depthRatio > 3 else G81
    - WOC = diameter; DOC = holeDepth

  SLOTTING SAW (with thickness):
    - WOC = blade thickness
    - DOC = diameter * mat.slotDepthFactor * tt.docMult * lerp(0.6,1.0,agg)
    - capped to LOC if present

  SLOT (docMode === "slot"):
    - WOC = diameter
    - DOC = diameter * mat.slotDepthFactor * tt.docMult * lerp(0.6,1.0,agg)
    - if diameter > 0.5: DOC capped to diameter*1.2

  FACE (docMode === "face"):
    - WOC = diameter
    - DOC = diameter * 0.1 * lerp(0.7,1.2,agg)

  HEM / ADAPTIVE (docMode === "hem"):
    - WOC = diameter * op.wocFactor * lerp(0.8,1.1,agg)
    - DOC = diameter * 2.0 * lerp(0.7,1.2,agg)  (deep axial, light radial)

  PROFILE / DEFAULT:
    - WOC = diameter * op.wocFactor * lerp(0.8,1.1,agg)
    - DOC = diameter * mat.profileDepthFactor * tt.docMult * lerp(0.6,1.0,agg)

  CAM-DRIVEN OVERRIDES (adaptive operations):
    - if op.adaptive && radialLoad > 0 -> WOC = radialLoad (user's "Optimal Load")
    - if op.docMode !== "drill" && !tt.isDrill && axialDoc > 0 -> DOC = axialDoc
      (user's set stepdown). Axial DOC is NOT capped to flute LOC.

  MULTI-PASS FROM FEATURE DEPTH:
    - if featureDepth > 0 && doc > 0 (non-drill):
        passes = max(1, ceil(featureDepth / doc))
        stepdown = featureDepth / passes
        doc = stepdown  (per-pass depth never exceeds feature depth)

3.5 FEED MULTIPLIERS (CHIP THINNING)
  - feedMult = op.feedMult
  - Lead-angle (axial) chip thinning (face mill, leadAngle < 90 deg):
        feedMult *= 1 / sin(leadAngle in radians)
  - Radial chip thinning (adaptive, WOC < 0.5*D):
        ratio = min(0.5, woc/diameter)
        radialThinningFactor = 1 / sqrt(1 - (1 - 2*ratio)^2)
        feedMult *= radialThinningFactor
    Uses the standard 90-deg-cutter RCTF. (The simplified 1/sqrt(Ae/D) is
    incorrect — over-states the factor by ~2x.)

3.6 FEED (IPM)
  - Drilling: ipm = rpm * chipLoad * deepHoleFeedFactor
      (feed per revolution, reduced for deep holes)
  - Milling:  ipm = rpm * chipLoad * flutes * feedMult
  - ipm = min(ipm, machine.maxIpm); ipmClamped flag if reduced

3.7 MATERIAL REMOVAL RATE (MRR)
  - Drilling: MRR = (pi/4) * diameter^2 * ipm
  - Milling:  MRR = WOC * DOC * ipm

3.8 SPINDLE POWER (HP)
  - hpRequired = MRR * mat.hpFactor
    (hpFactor = net unit power, already including ~80% drive efficiency x
     dulling allowance, so output matches manufacturer tool-bot spindle HP)

3.9 PROGRAMMED FEED PER TOOTH
  - programmedFpt = ipm / (rpm * flutes)
    (the value entered in CAM; exceeds actual chip thickness when chip
     thinning applies. Null for drills or invalid flute/rpm.)

3.10 OUTPUT OBJECT
  sfm, rpm, chipLoad, programmedFpt, ipm, woc (3 decimals), doc (3 decimals),
  mrr, hpRequired, hpAvailable, hpUtilization (%),
  passes, stepdown,
  drilling { holeDepth, depthRatio, cycle, peckDepth, peckCount, retract, dwell,
             notes[] },
  radialThinningFactor, radialEngagementPct (%), adaptive (bool), warnings[]

3.11 WARNINGS GENERATED
  - Lead-angle / radial chip-thinning notes (informational)
  - HP required > machine HP
  - Spindle min/max RPM clamped (with direction)
  - Machine max IPM limiting feed
  - Per-pass DOC > flute LOC (chip evacuation risk)
  - Slotting with 4+ flutes at diameter >= 0.5" (chip packing)
  - Bull-nose full-width slot deeper than corner radius x 2
  - Work-hardening alloys (Stainless/Titanium/Superalloy) — keep chip load up
  - Abrasive composites (CFRP/G10) — rapid wear, diamond-coated recommended
  - Drilling notes: shallow vs deep hole, very-deep feed reduction,
    hole depth > LOC, carbide pecking risk, work-hardening peck guidance

================================================================================
4. COMPLETE DATA TABLES (cncData.js)
================================================================================

4.1 PART MATERIALS (28)
[id | name | category | SFM range | chipLoad | hpFactor | slotDepth | profileDepth]

alum_6061   | Aluminum 6061            | Aluminum     | 500-1200 | 1.0  | 0.35 | 1.0  | 3.0
alum_7075   | Aluminum 7075            | Aluminum     | 450-1000 | 0.9  | 0.40 | 0.9  | 2.5
alum_cast   | Cast Aluminum            | Aluminum     | 350-800  | 0.85 | 0.38 | 0.8  | 2.0
brass       | Brass                    | Copper Alloys| 250-600  | 0.8  | 0.65 | 0.8  | 2.5
copper      | Copper                   | Copper Alloys| 200-500  | 0.7  | 0.70 | 0.7  | 2.0
bronze      | Bronze                   | Copper Alloys| 180-400  | 0.7  | 0.75 | 0.7  | 2.0
steel_1018  | Mild Steel 1018          | Steel        | 280-450  | 0.57 | 1.4  | 0.5  | 1.5
steel_1045  | Medium Carbon 1045       | Steel        | 250-400  | 0.52 | 1.5  | 0.45 | 1.3
steel_4140  | Alloy Steel 4140         | Steel        | 200-360  | 0.46 | 1.75 | 0.4  | 1.2
steel_a36   | A36 Structural           | Steel        | 280-450  | 0.55 | 1.5  | 0.48 | 1.4
steel_a572  | A572 Gr 50               | Steel        | 270-430  | 0.53 | 1.55 | 0.46 | 1.35
steel_12l14 | 12L14 Free-Machining     | Steel        | 380-600  | 0.69 | 1.25 | 0.55 | 1.6
ss_303      | Stainless 303            | Stainless    | 250-400  | 0.52 | 1.7  | 0.45 | 1.3
ss_304      | Stainless 304            | Stainless    | 200-320  | 0.46 | 1.9  | 0.4  | 1.2
ss_316      | Stainless 316            | Stainless    | 180-290  | 0.44 | 2.0  | 0.4  | 1.1
ss_17-4     | Stainless 17-4 PH        | Stainless    | 150-260  | 0.40 | 2.3  | 0.35 | 1.0
cast_iron   | Cast Iron (Gray)         | Iron         | 350-550  | 0.69 | 1.1  | 0.7  | 2.0
ductile_iron| Ductile Iron             | Iron         | 300-450  | 0.58 | 1.25 | 0.6  | 1.7
titanium_gr2| Titanium Grade 2         | Titanium     | 150-260  | 0.40 | 1.8  | 0.4  | 1.2
titanium_gr5| Titanium Grade 5 (Ti-6Al-4V)| Titanium  | 80-170   | 0.35 | 2.2  | 0.35 | 1.0
inconel     | Inconel 718              | Superalloy   | 40-95    | 0.29 | 3.2  | 0.25 | 0.8
tool_steel  | Tool Steel (A2/D2)       | Steel        | 150-280  | 0.35 | 2.3  | 0.3  | 0.9
wood_hard   | Hardwood (Maple/Oak)     | Wood         | 500-1000 | 1.2  | 0.12 | 1.0  | 3.0
wood_soft   | Softwood (Pine)          | Wood         | 600-1100 | 1.3  | 0.10 | 1.0  | 3.0
mdf         | MDF / Plywood            | Wood         | 500-1000 | 1.1  | 0.10 | 1.0  | 2.5
acrylic     | Acrylic (PMMA)           | Plastic      | 300-600  | 0.9  | 0.14 | 0.9  | 2.0
delrin      | Delrin (POM)             | Plastic      | 400-800  | 1.0  | 0.13 | 1.0  | 2.5
abs         | ABS / Polycarbonate      | Plastic      | 300-600  | 0.9  | 0.14 | 0.9  | 2.0
cfrp        | Carbon Fiber (CFRP)      | Composite    | 200-450  | 0.6  | 0.28 | 0.6  | 1.5
g10         | G10 / FR4                | Composite    | 250-500  | 0.7  | 0.25 | 0.7  | 1.7

4.2 TOOL MATERIALS [id | name | sfmMult]
carbide   | Solid Carbide        | 1.0
hss       | High Speed Steel     | 0.35
cobalt    | Cobalt (HSS-Co)      | 0.45
indexable | Indexable Insert     | 1.1

4.3 COATINGS (15) [id | name | sfmMult]
none     | Uncoated (Bright)                | 0.85
tin      | TiN                               | 0.95
ticn     | TiCN                              | 1.0
crn      | CrN                               | 0.95
zrn      | ZrN                               | 0.98
tialn    | TiAlN                             | 1.0
altin    | AlTiN                             | 1.03
tib2     | TiB2 (aluminum)                   | 1.0
alcrn    | AlCrN                             | 1.05
alcrnx   | AlCrNX (enhanced)                 | 1.08
alcrsin  | AlCrSiN (nanocomposite)           | 1.07
naco     | nACo (AlTiN-Si nanocomposite)     | 1.1
tialsin  | TiAlSiN (nanocomposite)           | 1.08
dlc      | DLC / Diamond-like Carbon        | 1.05
diamond  | Diamond (PCD)                     | 1.15

4.4 TOOL TYPES (9)
[id | name | sfmMult | chipMult | docMult | isDrill | countField | fields]

end_mill    | Square End Mill      | 1.0 | 1.0 | 1.0 | false | flutes  | flutes, loc
ball_end    | Ball End Mill        | 1.0 | 0.9 | 0.85| false | flutes  | flutes, loc
bull_nose   | Bull-Nose End Mill   | 1.0 | 1.0 | 1.0 | false | flutes  | flutes, loc, cornerRadius
roughing    | Roughing / Corn Cob  | 1.1 | 1.2 | 1.3 | false | flutes  | flutes, loc
chamfer     | Chamfer / V-Bit      | 1.0 | 0.8 | 0.6 | false | flutes  | flutes, loc, includedAngle, tipDiameter
face_mill   | Face Mill (Indexable)| 1.0 | 1.1 | 0.5 | false | inserts | inserts, loc, leadAngle
drill       | Drill                | 1.0 | 1.0 | 1.0 | true  | flutes  | flutes, pointAngle, loc
slitting_saw| Slitting Saw         | 0.9 | 0.8 | 1.0 | false | flutes  | flutes, thickness
t_slot      | T-Slot Cutter        | 0.95| 0.9 | 1.0 | false | flutes  | flutes, neckDiameter

4.5 FIELD DEFINITIONS (type-specific inputs)
flutes        | int    | 1-12  | step 1
inserts       | int    | 1-24  | step 1
loc           | length | step 0.01
cornerRadius  | length | step 0.001
includedAngle | angle  | step 1
tipDiameter   | length | step 0.001
leadAngle     | angle  | step 1
pointAngle    | angle  | step 1
thickness     | length | step 0.001
neckDiameter  | length | step 0.001

4.6 OPERATIONS (22)
[id | name | category | sfmMult | chipMult | feedMult | wocFactor | docMode | adaptive | fineStepup]

2D / 2.5-AXIS:
2d_adaptive_rough | 2D Adaptive Clearing (Rough) | 2D | 1.0 | 1.1 | 1.0 | 0.055| hem     | true  | -
2d_adaptive_finish| 2D Adaptive Finishing       | 2D | 1.1 | 0.8 | 1.0 | 0.04 | hem     | true  | -
2d_pocket        | 2D Pocket                    | 2D | 1.0 | 1.0 | 1.0 | 0.3  | hem     | true  | -
2d_contour       | 2D Contour                   | 2D | 1.1 | 0.7 | 1.0 | 0.08 | profile | true  | -
facing           | Face                         | 2D | 0.95| 1.0 | 1.0 | 1.0  | face    | false | -
slotting         | Slot                         | 2D | 0.9 | 1.0 | 1.0 | 1.0  | slot    | false | -
bore             | Circular / Bore              | 2D | 0.9 | 1.0 | 1.0 | 1.0  | slot    | false | -
thread           | Thread Milling               | 2D | 0.8 | 0.6 | 1.0 | 0.03 | profile | false | -
drilling         | Drilling                     | 2D | 0.8 | 1.0 | 1.0 | 1.0  | drill   | false | -
engrave          | 2D Engrave                   | 2D | 1.0 | 0.4 | 1.0 | 0.02 | profile | false | -

3D / HIGH-SPEED MACHINING:
3d_adaptive_rough | 3D Adaptive Clearing (Rough)| 3D | 1.0 | 1.0 | 1.0 | 0.06 | hem     | true | true
3d_adaptive_finish| 3D Adaptive Finishing       | 3D | 1.1 | 0.8 | 1.0 | 0.04 | hem     | true | true
3d_pocket         | Pocket / Contour (3D)       | 3D | 0.95| 1.0 | 1.0 | 0.08 | hem     | true | true
3d_parallel       | Parallel                    | 3D | 1.1 | 0.7 | 1.0 | 0.06 | profile | true | -
3d_waterline      | Contour (Waterline)         | 3D | 1.05| 0.7 | 1.0 | 0.08 | profile | true | -
3d_morph          | Morph / Blend               | 3D | 1.1 | 0.7 | 1.0 | 0.06 | profile | true | -
3d_project        | Project                     | 3D | 1.1 | 0.7 | 1.0 | 0.06 | profile | true | -
3d_pencil         | Pencil / Rest Machining      | 3D | 1.1 | 0.6 | 1.0 | 0.05 | profile | true | -
3d_radial         | Radial / Spiral / Flow      | 3D | 1.1 | 0.7 | 1.0 | 0.06 | profile | true | -

MULTI-AXIS & SPECIAL:
3plus2 | 3+2 Positioning (Indexed) | Multi-Axis | 1.0 | 0.8 | 1.0 | 0.08 | profile | true | -
5axis  | Simultaneous 5-Axis        | Multi-Axis | 1.0 | 0.8 | 1.0 | 0.08 | profile | true | -

4.7 BASE CHIP LOAD TABLE (inches per tooth, by diameter)
Interpolated linearly between rows; clamped to [0.005", 2.0"].

Diameter (in) | Chip load (in/tooth)
0.03125 | 0.0003
0.0625  | 0.0006
0.09375 | 0.0009
0.125   | 0.0012
0.1875  | 0.0019
0.25    | 0.0026
0.3125  | 0.0033
0.375   | 0.0040
0.5     | 0.0055
0.625   | 0.0070
0.75    | 0.0085
1.0     | 0.0110
1.25    | 0.0135
1.5     | 0.0160
2.0     | 0.0210

4.8 HELPER FUNCTIONS
- baseChipLoad(diameter): clamps to [0.005, 2.0], linearly interpolates table
- lerp(a, b, t): a + (b-a) * clamp(t, 0, 1)
- clamp(v, min, max): max(min, min(max, v))

================================================================================
5. UNITS (units.js)
================================================================================
Internal engine runs Imperial. UI converts for display.
- Length:        in  <-> mm      (x25.4)
- Feed:          IPM <-> mm/min  (x25.4)
- Surface speed: SFM <-> m/min   (x0.3048)
- Power:         HP  <-> kW      (x0.7457)
- MRR:           in^3/min <-> cm^3/min (x16.387)
User preference sets the system (imperial/metric).

================================================================================
6. BRAND LOOKUP (AI)
================================================================================
Input: brand + exact model/part number + workpiece material. Process:
1. Search web (Gemini 3.1 Pro + Google grounding) for manufacturer's official
   product page — same as Googling "brand partnumber".
2. Read the real product page -> extract EXACT product title, diameter, flutes,
   coating, series (identity must come from the page, never fabricated).
3. Dig further for the manufacturer's published speeds & feeds chart / online
   calculator (IMCO Pow-R-Path, Harvey, Helical, Kennametal, Niagara, OSG, YG1
   tool-bots) for that tool in the workpiece material -> use real SFM + chip-
   load-per-tooth, is_estimate=false.
4. Only if no chart exists -> engineering estimate from coating/material class,
   is_estimate=true (labeled in UI).
5. Exact-match computed CLIENT-SIDE (normalized alphanumeric string compare of
   part numbers) — not self-reported by AI, so it can't be faked. Shows "Exact"
   badge or "Part # mismatch" warning + source link.
6. Apply button passes {sfm, chipLoad} as engine overrides.

================================================================================
7. PERSISTENT ENTITIES (Base44, all RLS = user sees only their own records)
================================================================================
- SavedCalculation: name + tool_data, tool_type_id, tool_material_id, coating_id,
  diameter, flutes, loc, material_id, operation_id, machine_hp, machine_max_rpm,
  machine_min_rpm, machine_max_ipm, aggressiveness, result_rpm, result_ipm,
  result_doc, result_woc, result_chip_load, result_mrr, result_hp
- MachineProfile: name, hp, max_rpm, min_rpm, max_ipm, notes
- CustomMaterial: name, category, sfm_min, sfm_max, chip_load_factor, hp_factor,
  slot_depth_factor, profile_depth_factor
- UserPreference: aggressiveness, units (imperial/metric)
- User (built-in): id, email, full_name, role (admin/user)

================================================================================
8. PAGES & UI
================================================================================
- Calculator (main, "/"): machine form + tool form (+ brand lookup) + material
  search + operation selector + adaptive inputs (radial load, axial DOC, feature
  depth; hole depth for drilling) + aggressiveness slider + real-time results
  panel + save calculation
- Saved Calculations ("/saved-calculations"): list, reload, delete
- Materials ("/materials"): custom material library CRUD
- Machine Profiles ("/machine-profiles"): create/edit/delete/select machine configs
- Settings ("/settings"): aggressiveness default, unit system
- Auth: Login, Register (-> OTP -> verify -> redirect), Forgot/Reset Password,
  Google OAuth — all behind ProtectedRoute
- Layout: sidebar nav wrapping all authenticated pages via <Outlet />

================================================================================
9. KEY DESIGN DECISIONS & PREFERENCES
================================================================================
- Numeric inputs: free-form typing + clearing, no auto-snap to step
- Tool material and coating are separate selections (decoupled)
- Radial WOC shown to 3 decimal places
- HSMWorks "Optimal Load" terminology for radial stepover; in-app hints map
  engine WOC -> that CAM field
- Axial DOC decoupled from flute LOC (over-extension warning instead of hard cap)
- Effective axial DOC capped to per-pass stepdown (never exceeds feature depth)
- SFM calibrated to proven coated-carbide charts — default 60% aggressiveness
  lands slightly conservative vs brand tool-bots; top of slider reaches proven
  aggressive values
- HP calc matches manufacturer tool-bot output (net cutting power / efficiency
  x dulling)
- HEM/adaptive defaults: 5-7% diameter radial (tightened to match IMCO ~5.5%
  steel HEM)
- Standard 90-deg-cutter radial chip-thinning formula (not the over-stated
  simplified version)
- G83 peck cycles for holes > 3xD with material-scaled peck depths; G81 for
  shallow
- Conservative defaults + user-driven aggressiveness — never auto-pushes unsafe
  params
`;

export default referenceText;