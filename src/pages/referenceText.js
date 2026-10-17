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
  pointAngle, radialLoad, axialDoc, featureDepth, gripDepth, jawTypeId, clampForce

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
    - Rough (facing_rough): DOC = diameter * 0.1 * lerp(0.7,1.2,agg)
    - Finish (facing_finish, op.finishing): DOC = min(lerp(0.005,0.010,agg), diameter*0.15)
      (light skim pass, ~diameter-independent per manufacturer finish-facing guidance)

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

  WORKHOLDING OVERHANG (gripDepth, profile/hem/peripheralRough ops only):
    - Workpiece-side rigidity check, NOT tool stickout. gripDepth = how much
      of the RAW STOCK the vise/chuck/fixture actually clamps (optional user
      input; UI label "Stock Height Gripped in Vise"). It is the physical
      stock in the jaws, NOT a dimension of the finished part: 2.25" stock
      with 0.25" in the jaws is gripDepth 0.25 even if the part ends 2" tall. cutHeight = featureDepth if set, else loc.
    - if gripDepth > 0 && cutHeight > 0:
        unsupported = max(0, cutHeight - gripDepth)
        ratio = unsupported / gripDepth
        severity = "none" (unsupported<=0) | "low" (ratio<=0.5) |
                   "moderate" (0.5 < ratio <= 1.0) | "high" (ratio > 1.0)
    - Physical basis: above the grip line the workpiece itself becomes the
      cantilever the cutting forces act on (same L^3 deflection scaling as
      tool stickout, just on the part side). LANG Technik's published vise-
      sizing rule of thumb caps workpiece height at ~2x the jaw/grip
      dimension, implying unsupported:grip ~1.0 is the practical ceiling for
      typical loads: https://lang-technik.de/en/service/faq/workholding
    - No manufacturer source gives a numeric feed/speed derate for this
      ratio, so it stays a quantified WARNING (see 3.11) rather than an
      automatic doc/woc/feed reduction.

  CLAMPING FORCE / SLIP-PULLOUT CHECK (jawTypeId, clampForce; ALL milling
  ops, NOT restricted to profile/hem/peripheralRough — runs for slotting,
  pocketing, facing, adaptive, contour, everything except drill/tap):
    - Distinct failure mode from WORKHOLDING OVERHANG above: overhang is a
      geometric tipping/deflection PROXY (no sourced moment formula exists);
      this check is a direct FORCE balance — does the vise have enough grip
      at all to keep the part from sliding/pulling out under the actual
      cutting load, independent of part height or grip depth.
    - cuttingForce (lbf) = (hpRequired * 33000) / sfm
      Standard shop formula bridging horsepower to tangential cutting force,
      using hpRequired/sfm this engine already computes (post HP-governor).
      Source: Tooling World "Calculating the Clamping Force for Machining"
      http://www.toolingworld.com/sites/default/files/CLAMPING_FORCE_FOR_MACHINING.pdf
      Independently corroborated (same Fc = HP*33000/V relationship):
      https://www.mitsubishicarbide.net/contents/mhg/enuk/html/product/technical_information/information/formula4.html
      https://ctemag.com/articles/understanding-tangential-cutting-force-when-milling/
    - jaw = WORKHOLDING_JAW_TYPES lookup (cncData.js), default smooth_steel
      (mu=0.20) when jawTypeId unset — the conservative/lower-grip default:
        smooth_steel (mu=0.20), serrated (mu=0.50), soft_jaw_steel (mu=0.50),
        soft_jaw_aluminum (mu=0.25, forceDerate=0.4), grippy_plate (mu=0.65)
    - safetyFactor = 4 if op.slotDerate (full-radial/interrupted engagement:
      slotting, boring) else 3 (continuous engagement: contour, adaptive,
      pocket, face) — both inside the sourced 2-5x range.
    - requiredClampForce = (cuttingForce * safetyFactor) / jaw.mu
    - if clampForce (user's vise rating) provided:
        usableClampForce = clampForce * jaw.forceDerate
        clampMargin = usableClampForce / requiredClampForce
        insufficient = clampMargin < 1.0
        jawLimited = insufficient && jaw.forceDerate < 1 &&
                     clampForce / requiredClampForce >= 1  (vise is enough,
                     the aluminum jaw is the weak link -> dedicated warning)
    - forceDerate: aluminum (6061-T6) jaws only reliably carry ~30-50% of an
      equivalent steel jaw's clamping force before yielding (machally.com
      vise-jaw-selection-guide, ctemag.com fixture-considerations). The lower
      end (0.4) is used because overstating usable force is the unsafe
      direction. Steel jaws (smooth, serrated, steel soft jaws) = 1.0.
      else: ratedClampForce/clampMargin = null, insufficient = false (still
      reports the requirement as an estimate for the machinist to compare).
    - Source for the full slip-prevention formula chain, friction
      coefficients, and safety-factor ranges by operation type:
      https://machally.com/us/blog/workholding-clamping-force-calculation/
      (continuous milling n=2.0-3.0, slot milling full radial n=2.5-3.5,
       interrupted/entry-exit shock n=3.0-5.0; smooth jaw/steel mu=0.15-0.25,
       serrated/waffle mu=0.40-0.60)
    - Skipped entirely for drilling/tapping (op.docMode drill/tap or
      tt.isDrill/isTap) — those load the part axially into the table/vise
      base, not sideways against the jaws, so this specific slip mode
      doesn't apply the same way.

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
  radialThinningFactor, radialEngagementPct (%), adaptive (bool),
  overhang { unsupportedHeight, gripDepth, ratio, severity } | null,
  workholding { cuttingForce, requiredClampForce, ratedClampForce, clampMargin,
                jawTypeId, mu, safetyFactor, insufficient } | null,
  warnings[]

3.11 WARNINGS GENERATED
  - Lead-angle / radial chip-thinning notes (informational)
  - HP required > machine HP
  - Spindle min/max RPM clamped (with direction)
  - Machine max IPM limiting feed
  - Per-pass DOC > flute LOC (chip evacuation risk)
  - Workholding overhang: unsupported workpiece height above the grip is
    moderate (0.5-1.0x grip depth) or high (>1.0x grip depth) — see 3.4
  - Workholding clamping force: user's entered vise rating is below the
    computed required clamping force (insufficient=true) — hard warning.
    If no vise rating entered but the overhang check is moderate/high,
    surfaces the estimated requirement as a cross-reference note instead.
  - Slotting with 4+ flutes at diameter >= 0.5" (chip packing)
  - Bull-nose full-width slot deeper than corner radius x 2
  - Work-hardening alloys (Stainless/Titanium/Superalloy) — keep chip load up
  - Abrasive composites (CFRP/G10/G11) — rapid wear, diamond-coated recommended; G11 gets an
    extra note (higher-crosslink resin, DOC already reduced ~12% vs G10)
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
acrylic     | Acrylic (PMMA)                | Plastic | 500-1000 | 0.7 | 0.14 | 0.5 | 1
delrin      | Acetal / Delrin (POM)         | Plastic | 500-1000 | 0.85 | 0.13 | 0.5 | 1
abs         | ABS                           | Plastic | 300-600 | 0.7 | 0.14 | 0.5 | 1
polycarbonate| Polycarbonate (PC)            | Plastic | 500-1000 | 0.5 | 0.15 | 0.5 | 1
nylon66     | Nylon 6/6 (extruded)          | Plastic | 500-1000 | 0.6 | 0.13 | 0.5 | 1 | hp est.
nylon6_cast | Nylon 6 Cast (MC / Nylatron GS)| Plastic | 450-900 | 0.6 | 0.13 | 0.5 | 1 | hp est.
nylon_gf30  | Nylon 6/6 30% Glass-Filled    | Plastic | 200-400 | 0.35 | 0.25 | 0.5 | 0.5 | ABRASIVE | hp est.
uhmw        | UHMW-PE (UHMW Polyethylene)   | Plastic | 800-1400 | 1 | 0.1 | 0.5 | 1 | hp est.
hdpe        | HDPE                          | Plastic | 800-1400 | 1 | 0.1 | 0.5 | 1 | hp est.
polypropylene| Polypropylene (PP)            | Plastic | 400-700 | 0.6 | 0.1 | 0.4 | 1 | hp est.
pvc         | PVC (rigid)                   | Plastic | 300-600 | 0.5 | 0.12 | 0.5 | 1 | hp est.
ptfe        | PTFE (Teflon)                 | Plastic | 400-1000 | 0.4 | 0.1 | 0.5 | 1 | hp est.
peek        | PEEK (unfilled)               | Plastic | 500-900 | 0.6 | 0.2 | 0.5 | 1 | hp est.
peek_gf30   | PEEK 30% Glass / Carbon-Filled| Plastic | 350-650 | 0.4 | 0.28 | 0.4 | 0.8 | ABRASIVE | hp est.
pei_ultem   | Ultem PEI (1000, unfilled)    | Plastic | 700-1000 | 0.35 | 0.2 | 0.4 | 0.5 | hp est.
pet_ertalyte| PET-P (Ertalyte)              | Plastic | 250-450 | 0.45 | 0.15 | 0.5 | 1 | hp est.
phenolic_xx | Paper Phenolic XX (Bakelite)   | Phenolic | 400-1300 | 0.45 | 0.15 | 0.5 | 1.5 | drill 300-500 SFM | hp est.
phenolic_ce | Cotton Phenolic CE (Textolite / Micarta) | Phenolic | 400-1200 | 0.45 | 0.17 | 0.5 | 1.5 | drill 300-500 SFM | hp est.
phenolic_le | Linen Phenolic LE (fine weave, Micarta) | Phenolic | 400-1150 | 0.40 | 0.17 | 0.5 | 1.2 | drill 300-500 SFM | hp est.
phenolic_canvas | Canvas Phenolic C (Textolite / Micarta) | Phenolic | 350-1050 | 0.40 | 0.20 | 0.4 | 1.0 | drill 250-450 SFM | hp est.
phenolic_glass | Glass Phenolic G-3 / GP-01 | Phenolic (class composite) | 300-550 est. | 0.6 (metal curve) | 0.25 | 0.9 | 1.5 | ABRASIVE | drill 200-350 SFM | hp est.
cfrp        | Carbon Fiber (CFRP)      | Composite    | 200-450  | 0.6  | 0.28 | 0.6  | 1.5
g10         | G10 / FR4                | Composite    | 250-500  | 0.7  | 0.25 | 0.7  | 1.7
g11         | G11 / FR5                | Composite    | 225-450  | 0.7  | 0.28 | 0.62 | 1.5

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
corner_round| Corner Rounding Radius Cutter | 1.0 | 0.67 | 1.0 | false | flutes | flutes, loc, cornerRadius, radiusEngagement
concave_radius| Concave Radius Cutter | 1.0 | 0.67 | 1.0 | false | flutes | flutes, loc, cornerRadius, radiusEngagement
round_insert| Round-Insert Radius Cutter | 1.0 | 1.0 | 0.5 | false | inserts | inserts, loc, insertIc
roughing    | Roughing / Corn Cob  | 1.1 | 1.2 | 1.3 | false | flutes  | flutes, loc
chamfer     | Chamfer / V-Bit      | 1.0 | 0.8 | 0.6 | false | flutes  | flutes, loc, includedAngle, tipDiameter
face_mill   | Face Mill (Indexable)| 1.0 | 1.1 | 0.5 | false | inserts | inserts, loc, leadAngle
drill       | Drill                | 1.0 | 1.0 | 1.0 | true  | flutes  | flutes, pointAngle, loc
slitting_saw| Slitting Saw         | 0.9 | 0.8 | 1.0 | false | flutes  | flutes, thickness
t_slot      | T-Slot Cutter        | 0.95| 0.9 | 1.0 | false | flutes  | flutes, neckDiameter

4.4b WORKHOLDING JAW TYPES (5) [id | name | mu (dry friction) | forceDerate]
smooth_steel      | Smooth hard jaw (steel)                          | 0.20 | 1.0
serrated          | Serrated / waffle / pyramid jaw (steel)          | 0.50 | 1.0
soft_jaw_steel    | Soft jaw, steel (1018/12L14), bored to part      | 0.50 | 1.0
soft_jaw_aluminum | Soft jaw, aluminum (6061-T6), bored to part      | 0.25 | 0.4
grippy_plate      | Diamond-coated / grippy plate (steel)            | 0.65 | 1.0
Source: https://machally.com/us/blog/workholding-clamping-force-calculation/
(dry values used as default/conservative; coolant/wet reduces mu ~30-50%,
applied as user judgment, not a silent multiplier in the engine)

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

4.6 OPERATIONS (29)
[id | name | category | sfmMult | chipMult | feedMult | wocFactor | docMode | adaptive | flags]

2D / 2.5-AXIS:
2d_adaptive_rough | 2D Adaptive Clearing (Rough) | 2D | 1 | 1.1 | 1 | 0.15 | hem | true | -
2d_adaptive_finish | 2D Adaptive Finishing | 2D | 1.1 | 0.8 | 1 | 0.04 | hem | true | finishing
2d_pocket | 2D Pocket | 2D | 1 | 1 | 1 | 0.3 | hem | true | -
2d_contour_rough | 2D Contour / Peripheral (Rough) | 2D | 1 | 1 | 1 | 0.35 | profile | true | peripheralRough
2d_contour_finish | 2D Contour / Peripheral (Finish) | 2D | 1.1 | 0.7 | 1 | 0.08 | profile | true | finishing
facing_rough | Face (Rough) | 2D | 0.95 | 1 | 1 | 1 | face | false | -
facing_finish | Face (Finish) | 2D | 1.05 | 0.65 | 1 | 1 | face | false | finishing
slotting | Slot | 2D | 0.8 | 1 | 1 | 1 | slot | false | -
bore | Circular / Bore (legacy: full-width slot) | 2D | 0.8 | 1 | 1 | 1 | slot | false | LEGACY (hidden from picker)
2d_bore_rough | 2D Bore - Helical (Rough) | 2D | 1 | 1 | 1 | 0.15 | hem | true | circular:internal/bore_rough
2d_bore_finish | 2D Bore / Circular Wall (Finish) | 2D | 1.1 | 0.7 | 1 | 0.04 | profile | true | finishing,circular:internal/bore_finish
2d_circular_pocket | 2D Circular Pocket (Rough) | 2D | 1 | 1 | 1 | 0.3 | hem | true | circular:internal/pocket_rough
2d_circular_boss_rough | 2D Circular Boss (Rough) | 2D | 1 | 1 | 1 | 0.35 | profile | true | peripheralRough,circular:external/boss_rough
2d_circular_boss_finish | 2D Circular Boss (Finish) | 2D | 1.1 | 0.7 | 1 | 0.04 | profile | true | finishing,circular:external/boss_finish
thread | Thread Milling | 2D | 0.8 | 0.6 | 1 | 0.03 | profile | false | -
drilling | Drilling | 2D | 0.8 | 1 | 1 | 1 | drill | false | -
tapping | Tapping | 2D | 1 | 1 | 1 | 1 | tap | false | -
engrave | 2D Engrave | 2D | 1 | 0.4 | 1 | 0.02 | profile | false | -

3D / HIGH-SPEED MACHINING:
3d_adaptive_rough | 3D Adaptive Clearing (Rough) | 3D | 1 | 1 | 1 | 0.15 | hem | true | fineStepup
3d_adaptive_finish | 3D Adaptive Finishing | 3D | 1.1 | 0.8 | 1 | 0.04 | hem | true | finishing,fineStepup
3d_pocket | Pocket / Contour (3D) | 3D | 0.95 | 1 | 1 | 0.08 | hem | true | fineStepup
3d_parallel | Parallel | 3D | 1.1 | 0.7 | 1 | 0.06 | profile | true | finishing
3d_waterline | Contour (Waterline) | 3D | 1.05 | 0.7 | 1 | 0.08 | profile | true | finishing
3d_morph | Morph / Blend | 3D | 1.1 | 0.7 | 1 | 0.06 | profile | true | finishing
3d_project | Project | 3D | 1.1 | 0.7 | 1 | 0.06 | profile | true | finishing
3d_pencil | Pencil / Rest Machining | 3D | 1.1 | 0.6 | 1 | 0.05 | profile | true | finishing
3d_radial | Radial / Spiral / Flow | 3D | 1.1 | 0.7 | 1 | 0.06 | profile | true | finishing

MULTI-AXIS & SPECIAL:
3plus2 | 3+2 Positioning (Indexed) | Multi-Axis | 1 | 0.8 | 1 | 0.08 | profile | true | -
5axis | Simultaneous 5-Axis | Multi-Axis | 1 | 0.8 | 1 | 0.08 | profile | true | -

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
6b. VISE LOOKUP (AI) -- src/components/cnc/ViseLookup.jsx
================================================================================
Same architecture as BRAND LOOKUP above, applied to workholding instead of
cutting data. Input: vise brand + model/part number + optional handle torque
applied (ft-lbs). Process:
1. Search web (Gemini 3.1 Pro + Google grounding) for the manufacturer's
   official product page, spec sheet, or install manual for that exact vise
   model (Kurt, Gerardi, Chick, TE-CO, Orange Vise, Toolex all publish
   clamping-force charts or a single max rating).
2. Read the real page/chart -> extract exact model name, jaw width, jaw type
   (smooth/serrated/soft-jaw), and clamping force in lbf (identity/force must
   come from the real source, never fabricated; kN converted to lbf x224.8
   if that's what the manufacturer publishes).
3. Manufacturers often publish clamping force AS A TABLE vs handle torque
   (e.g. Kurt D688: 60 ft-lbs -> 5,391 lbf) rather than one fixed number.
   If the user gave a torque, the LLM reads/interpolates the table at that
   torque and reports is_max_rating=false; otherwise reports the vise's
   published MAXIMUM at its recommended/max torque, is_max_rating=true.
4. Client-side plausibilityCheck() flags (does not block) values outside a
   real-world clamping-force band (~500-26,000 lbf, sourced from Kurt's own
   selection guide -- small toolmaker vises up to their largest D100 -- and
   several small hobby-vise listings) or an unusual force/torque ratio, and
   always flags a missing source_url.
5. "Apply to calculator" passes {clampForce, jawTypeId} -- jawTypeId comes
   from a structured standard_jaw_type enum the LLM must fill (smooth_steel |
   serrated | soft_jaw_steel | soft_jaw_aluminum | grippy_plate) describing
   what the vise SHIPS with (optional accessory jaws are ignored); anything
   unrecognized defaults to smooth_steel. The user can still change jaw type
   manually in the Jaw Type dropdown afterward. The friction coefficient used
   by the clamping-force check (3.4) updates along with the force number,
   not just the raw lbf value.
5b. Silent-substitution guard: if the model the LLM resolved to does not
   contain the model the user typed (normalized, case/punctuation-insensitive),
   an amber notice shows both names (e.g. typed "D6X", found "DX6 CrossOver").
   When the result is the vise's maximum rating, a note reminds the user to
   enter their real handle torque for the force actually available.
6. Same environment dependency as BRAND LOOKUP: requires the Base44 LLM
   integration proxy (InvokeLLM), so it only resolves once deployed to the
   live Base44-hosted app, not in a bare local dev server.

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

================================================================================
10. FINISH-QUALITY MODEL (Optimize For: Finish quality | Balanced | Speed)
================================================================================
input.priority = "finish" | "balanced" | "speed". The UI default is "finish"
(stored in localStorage as pp_priority). The ENGINE default when priority is
omitted is "balanced" = the original IMCO-ToolBot-benchmarked behaviour, so all
regression tests and saved results are unchanged.

Effective aggressiveness for chip load, WOC, DOC and the HP budget:
  finish   : aggressiveness - 0.20
  balanced : aggressiveness
  speed    : aggressiveness + 0.15
Surface speed (SFM) stays on the UNSHIFTED slider in every mode: a higher
surface speed with a lighter chip improves finish and discourages built-up edge.
The +/-0.20 / +0.15 shifts are a documented SHOP-JUDGEMENT bias, not a
manufacturer constant. Everything below is sourced.

10.1 Finishing passes (any op flagged finishing:true — 2D contour/bore/boss
     finish, face finish, adaptive finish, and the 3D parallel / waterline /
     morph / project / radial finishing strategies)
- Radial engagement of flat-tool finishing = Harvey peripheral-finishing band
  3-5% of D (WOC_CLASS_TARGETS.finishPct), not the 8% roughing-derived factor.
- Ball-nose stepover from the scallop formula
    h = R - sqrt(R^2 - (s/2)^2)   ->   s = 2 sqrt(2 R h - h^2)
  where the allowed cusp is h = (4/3) x Ra_target. Theoretical Ra of a cusp
  profile = h/4 and measured roughness runs ~3x theory (built-up edge, runout,
  deflection), so h = 4 Ra / 3 lands on the target. Default target Ra = 32 uin
  (0.8 um); editable per cut (input.targetRa).
- Feed-mark cap: cusp Rt = fz^2 / (4 D). Programmed feed per tooth is limited
  so Rt <= h (same allowed cusp).
- Finish stock on the preceding rough: 1.5% of diameter (2% below 1/8"), min
  0.002" (Seco: 1-2% of D; a 1/2" tool leaves <= 0.005-0.010"); finish with a
  fresh tool; one spring pass (repeat at zero radial infeed); climb milling.
- Tool deflection warning: cantilever delta = F L^3 / (3 E I), E carbide
  87 Msi / HSS 30 Msi, flute core 0.8 D, F = tangential cutting force (an
  UPPER BOUND on radial force), L = flute length. Flagged when > 0.001" on a
  finishing op. Labelled "worst-case estimate".

SOURCES
- https://www.secotools.com/article/finish_stock_allowance_with_solid_end_mills
- https://www.mitsubishicarbide.net/contents/mmus/enus/manual/end_mills_SRF_INCH.pdf
- https://machinecalcs.com/ball-nose-stepover-calculator
- https://engicalchub.com/guides/ball-nose-surface-finish-guide/
- Wojciechowski et al., ball-end milling surface texture (Rt = fz^2 / 4D):
  https://yadda.icm.edu.pl/baztech/element/bwmeta1.element.baztech-15ff926f-4537-405d-8d9c-13cd60431fe7/c/Wojciechowski.pdf
- Harvey Tool peripheral-finishing engagement bands (see section 4)

================================================================================
11. CIRCULAR TOOLPATHS (independent bore / circular-pocket / boss operations)
================================================================================
The old single "Circular / Bore" full-width-slot operation (id bore) is kept
only as a LEGACY id so saved calculations still open; it no longer appears in
the operation picker. New, independently selectable operations:
  2d_bore_rough         2D Bore - Helical (Rough)        internal
  2d_bore_finish        2D Bore / Circular Wall (Finish) internal, finishing
  2d_circular_pocket    2D Circular Pocket (Rough)       internal, ring clearing
  2d_circular_boss_rough  2D Circular Boss (Rough)       external
  2d_circular_boss_finish 2D Circular Boss (Finish)      external, finishing
New inputs: featureDiameter (hole / pocket / boss diameter) and, for helical
bore, pilotDiameter (blank = open from solid -> full-width slot loading with the
slot speed derate).

Feed correction on the G2/G3 path. The programmed feed acts on the tool
CENTERLINE; chip load is set at the cutting EDGE:
  internal  F_centerline = F_edge x (D_feature - D_tool) / D_feature
  external  F_centerline = F_edge x (D_feature + D_tool) / D_feature
Worked example (Shader7): 50 mm bore, 12 mm cutter, 500 mm/min at the edge ->
380 mm/min on the centerline (-24%). Results show BOTH numbers.
Warnings: bore <= 1.05 x tool (cannot orbit); bore < 1.2 x tool (rubbing / poor
chip evacuation; keep >= 20% radial clearance); opening Dh > 2 x Dt from solid
leaves a core slug of (Dh - 2 Dt); helix ramp capped at 3 deg (end mills 3-5
deg) so pitch <= pi (Dh - Dt) tan 3 deg; ring passes = ceil(radius / WOC).
Bore finish: stock-to-leave + spring pass; tolerance tighter than IT7 -> boring
head or reamer, not an interpolated end mill.
SOURCES
- https://www.shader7.com/cnc-circular-interpolation-g02-g03
- https://carbide-tooling.com/tools/helical-interpolation-calculator/
- https://www.ctemag.com/sites/www.ctemag.com/files/archive_pdf/0608-HelicalInterpol.pdf
- Sandvik Coromant Milling technical guide (internal circular interpolation, tool-centre feed)

================================================================================
12. PLASTICS
================================================================================
16 plastics replace the old acrylic / Delrin / "ABS-Polycarbonate" entries
(table in 4.1): acrylic, Delrin, ABS, polycarbonate, nylon 6/6, cast nylon 6,
30% glass-filled nylon, UHMW-PE, HDPE, polypropylene, PVC, PTFE, PEEK,
glass-filled PEEK, PEI (Ultem), PET (Ertalyte). chipCurve = "plastic" uses
Harvey Tool's semi-roughing unfilled-plastics chip load (3.16% D up to 1/4",
2.68% D from 5/16", extended proportionally beyond the published range).
Speeds follow Harvey's plastics chart (hard unfilled 800-1200 SFM, soft
unfilled 1200-1600) tempered by each processor's guide (Ready Plastics,
Curbell). Every material carries notes[] shown as warnings: moisture and
thermal growth (nylon), melting/gumming (PE, PP, PTFE), stress cracking and
coolant compatibility (acrylic, PC, PEI), clamp distortion, annealing, and
abrasive fillers (glass-filled grades: carbide minimum, diamond/PCD for volume;
HSS warns). hpFactor for plastics is an engineering estimate (flagged).
SOURCES
- https://harveyperformance.widen.net/content/hnlndl2mif/pdf/SF_852000.pdf
- https://www.readyplastics.com/resources/materials/<slug>/machining
- https://www.curbellplastics.com/services-capabilities/fabrication-machined-parts/plastic-machining-guidelines/

================================================================================
13. TURNING (lathe) — /turning, turningData.js, turningEngine.js
================================================================================
calculateTurning(input) -> rpm, SFM, feed per rev, depth of cut, MRR, power,
cutting force, predicted Ra, pass count, G50/G96 words, chuck + workpiece
checks, boring-bar checks, thread infeed schedule, parting parameters.

Operations: OD rough/finish, facing rough/finish, boring rough/finish, drilling
(delegates to the verified drilling model), OD/face grooving, parting off, OD/ID
threading. Wood and fiber composites (except glass phenolic, see section 14) are excluded (no published insert-turning
data).

13.1 Speed / feed windows. Coated-carbide catalogue windows by material class
(rough and finish SFM and IPR) from https://metronq.com/en/cutting-parameters-calculator,
cross-checked with Sandvik Coromant and MechCodex turning tables. A material not
published individually (e.g. 17-4PH vs 304) is scaled by the ratio of its own
end-mill SFM midpoint to the reference material's (clamped 0.6-1.3). Plastics have
per-material windows (Ready Plastics, Curbell); materials with no published
window are flagged as estimates.
13.2 Grade multipliers vs coated carbide: uncoated 0.72 on steels; cermet 1.14
on FINISH passes (MMS test, PVD cermet 1050 vs CVD carbide 918 SFM); ceramic
x4 in cast iron / superalloys; PCD x2.2 in aluminum; HSS uses absolute SFM rows
and is not offered for titanium / superalloys. Items without a published source
are flagged as estimates in the UI.
13.3 Feed. Rough: window value limited by the Sandvik max-feed-vs-nose-radius
table (RE 1/64 -> 0.009-0.014 IPR ... 3/32 -> 0.039-0.071). Finish: Ra =
f^2 / (32 r) with a 1.5x real-world allowance, so f = sqrt(32 r Ra / 1.5).
13.4 Depth of cut. ap_max = (2/3) x edge length x sin(kappa); edge length = IC x
shape factor (C 1.015, D 1.221, V 1.743, T 1.732, S 1.0, W 0.685); round inserts
0.25 x IC; also limited by the HP budget (HP = hpFactor x 12 x SFM x f x ap).
ap should be >= 2/3 of the nose radius (Sandvik); finish allowance 0.010-0.020"
per side; stainless / Ti / superalloy: finish depth >= 0.010" and feed >= 0.003 IPR
to cut beneath the work-hardened skin (BSSA).
13.5 Threading. Depth 0.61343 P external / 0.54127 P internal; feed = pitch;
constant RPM (G97); SFM 0.5x turning (0.45x internal). Infeed schedule =
Sandvik constant-chip-area: cumulative depth a(x) = H sqrt(phi_x / phi_N) with
phi = 0.3, 1, then x-1; pass-count heuristic ~2 + 2.67 x pitch(mm) (3-16,
flagged); last pass should not be under 0.002". Z feed (RPM x pitch) is checked
against the lathe's max IPM.
13.6 Parting / grooving. Blade width by diameter (Sandvik: <=0.4" 1.0 mm,
<=1.0" 1.5, <=1.6" 2.0, <=2.0" 2.5, <=2.6" 3.0). Max feed ~ 0.031 x width + 0.001
IPR (CTE), reduced 75% over the last 0.08" radius, stop 0.02" before centre,
centre height +/- 0.004". Parting 0.5x and grooving 0.7x turning SFM (estimate
from the Ready Plastics per-operation table).
13.7 Workholding. Stickout:diameter <= 3:1 chuck only; 3-6:1 tailstock; >6:1
steady/follow rest (10:1 absolute with a tailstock). Workpiece deflection:
cantilever F L^3 / 3EI (chuck only) or 7 F L^3 / 768 EI (chuck + tailstock /
steady, fixed-pinned) with handbook E (plastics 0.06-1.2 Msi). Chuck grip (Rohm):
F_spz = (F_s x S_z / mu) x (d_z / d_sp), S_z = 2.0 (L/D<=3) or 2.4 (3-6) new
chucks, 4.0 / 4.8 older; reduced with a tailstock. Chuck speed is capped by the
data-plate max RPM; grip force drops with RPM (centrifugal), so verify against
the chuck maker's speed chart. G96 CSS requires a G50 (G92) RPM clamp.
13.8 Boring bars. Max overhang (x bar diameter), Sandvik: steel 4 / carbide 6 /
damped steel 7 / carbide-reinforced damped 14 (grooving & threading 3 / 5 / 5 /
7). Feed cut 20% when overhang > 3 x diameter; cantilever deflection estimate
with bar modulus (steel 30 Msi, carbide 87 Msi).
SOURCES
- https://metronq.com/en/cutting-parameters-calculator
- https://mechcodex.com/reference/turning-speeds-feeds
- Sandvik turning guide https://coromantstrgprod.blob.core.windows.net/files/sitecollectiondocuments%2Fdownloads%2Fglobal%2Ftechnical%20guides%2Fen-gb%2Fc-1020-18.pdf
- Sandvik threading https://cdn.sandvik.coromant.com/files/sitecollectiondocuments/downloads/global/technical%20guides/en-gb/c-2920-031.pdf
- Sandvik parting off https://www.sandvik.coromant.com/en-gb/knowledge/parting-and-grooving/parting-off
- Sandvik tool set-up https://www.sandvik.coromant.com/en-us/knowledge/general-turning/tool-set-up
- CTE parting https://www.ctemag.com/sites/www.ctemag.com/files/archive_pdf/0102-partingknowhow.pdf
- Rohm clamping https://www.roehm.biz/fileadmin/products/media/en/DC0000221.PDF
- MMS cermet https://www.mmsonline.com/articles/whats-the-best-insert-for-finishing-steel
- Durrie PCD https://durrie.com/wp-content/uploads/2022/08/Catalog_ACT.pdf
- Curbell turning https://www.curbellplastics.com/services-capabilities/fabrication-machined-parts/plastic-machining-guidelines/plastic-turning-machining-guidelines/

================================================================================
14. PHENOLICS / TEXTOLITE / MICARTA / BAKELITE
================================================================================
Five laminates (table in 4.1): paper XX, cotton CE, linen LE, canvas C, and
glass-cloth G-3 / GP-01. Textolite (GE), Micarta (Norplex-Micarta) and Bakelite
are trade names for these NEMA LI-1 laminates, so they are in the material
names for search.
CLASS DESIGN. Organic-fibre grades use a NEW materialClass "phenolic" (low
abrasion, carbide standard, HSS viable at low volume) with entries in
TOOL_MATERIAL_CLASS_MULT (hss 0.50 / cobalt 0.55 / indexable 1.0 / pcd 1.0 -
all ESTIMATES), WOC_CLASS_TARGETS (rough 15-25% D, finish 5-8% D = Ready's
0.015-0.030 in radial finish pass; rough band an ESTIMATE),
PERIPHERAL_ROUGH_WOC_TARGETS (30-45% D, ESTIMATE) and TAP_SFM_BY_CLASS
(40-70 SFM, ESTIMATE). Glass phenolic is as abrasive as G10 and uses class
"composite" with abrasive:true.
MILLING. Chip load uses the plastic curve (Harvey unfilled plastics) x 0.40-0.45
-> ~0.0033 in/tooth at 1/4 in and ~0.0056 at 1/2 in, bracketed by Ready routing
(80-150 IPM at 18-24k RPM, 2 flutes = 0.0017-0.0042 in/tooth) and Titan Tooling's
phenolic/compact-laminate chart (1/4 in 0.004-0.006, 1/2 in 0.008-0.010). SFM
range: 300-700 SFM conventional end-mill guidance (Ready paper/linen pages) up
to the routing-RPM equivalent at a 1/4 in router (XX 20-26k, CE/LE 18-24k,
canvas 16-22k RPM = ~1050-1300 SFM). The published speeds are for UNCOATED,
polished C-2 carbide, so the generic 0.72 uncoated derate is not applied to
phenolics. Axial DOC: Ready routing 0.060-0.200 in per pass (canvas: sheet/2).
DRILLING. materials carry drillSfmRange (absolute, bypasses the drilling op's 0.8
derate) and drillChipLoadFactor: 300-500 SFM / 0.004-0.008 IPR (paper, cotton,
linen), 250-450 / 0.003-0.007 (canvas), 200-350 / 0.003-0.006 (glass phenolic).
Notes: backing board always (G10/thermoset scrap 0.125 in or MDF, never metal),
feed -50% over the last 20% of depth, no pecking below 6xD, parabolic carbide
or HSS (HSS only low volume).
TAPPING. Cutting tap, 65-70% thread engagement (cotton/canvas fibre galls a
full-depth thread), forming taps not recommended, light mineral oil brushed on the
tap only and wiped immediately. The G10 "1.5-2.5xD engagement" rule is NOT used
for organic-fibre phenolics.
TURNING (turningData.js PHENOLIC_TURNING; every window is a published Ready
Plastics figure): SFM rough / finish, IPR rough / finish -
  XX     400-600 / 600-900,  0.008-0.012 / 0.003-0.007
  CE     350-550 / 550-750,  0.006-0.010 / 0.003-0.006
  LE     350-550 / 500-700,  0.005-0.009 / 0.003-0.006
  Canvas 300-480 / 450-650,  0.004-0.009 / 0.002-0.005
  Glass  250-380 / 380-550,  0.004-0.008 / 0.002-0.005 (flood, C-2 or PCD)
Glass phenolic is the only "composite" that is turnable; CFRP/G10/G11 still are
not. GRADE_MULT.phenolic / .composite (uncoated 1.0; PCD 1.0 ESTIMATE),
HSS_TURNING.phenolic (0.5x, ESTIMATE; composites: HSS not recommended).
Geometry: C-2 uncoated carbide, polished chip face, rake +5 to +10 deg, relief
8-12 deg, sharp edge, no T-land, no chipbreaker. Workpiece modulus: CE 1.5-1.6 Msi
(Norplex-Micarta NP310E; Plastic-Craft lists 1.1 Msi), XX 1.3 Msi and glass phenolic
2.5 Msi are ESTIMATES.
HAZARDS / COOLANT. Organic-fibre grades are hygroscopic: machine DRY with air
blast (coolant swells 0.001-0.004 in/in). Glass phenolic: flood coolant (glass does
not absorb water). Formaldehyde off-gases above ~120-140 C (paper max service
140 C, canvas/linen 125 C): LEV >= 100 FPM with an activated-carbon stage, nitrile
gloves, P100 for dust; glass grades add HEPA/H13 for fibre. OSHA formaldehyde PEL
0.75 ppm TWA / 2 ppm STEL. Measure at 68 F / 50% RH after ~24 h equilibration.
VENDOR CONFLICT: Ready's linen-phenolic page recommends water-soluble coolant;
its phenolic guide, thermoset hub and sheet guide all say dry only, which is what
the calculator follows.
SOURCES
- https://www.readyplastics.com/resources/machining/phenolic
- https://www.readyplastics.com/resources/machining
- https://www.readyplastics.com/resources/machining/thermoset-sheet
- https://titantooling.ca/panel-applications/feed-speed-guides.html
- https://www.atlasfibre.com/how-to-choose-the-right-phenolic-grade/
- https://www.proplasticsinc.com/en/materials/phenolic/
- https://www.plasticsintl.com/media/i3dhjbyn/phenolic-canvas-ce-data-sheet.pdf
- https://plastic-craft.com/wp-content/uploads/2026/03/phenolic.pdf
- https://www.boedeker.com/Product/Phenolic-CE

BUG FIX (found while adding phenolics): the engine ignored chipCurve "plastic"
(only "soft" was honoured), so all 16 plastics were using the metal chip-load
curve (~3-4x too light). Now fixed; plastic chip loads match the Harvey chart.

================================================================================
15. RADIUS CUTTERS (corner rounding / concave radius / round insert / bull nose)
================================================================================
Tool types corner_round, concave_radius and round_insert are new; bull_nose now
also uses its radius. All four reference speed and chip load to an EFFECTIVE
cutting diameter instead of the nominal one (engine result: effectiveDiameter,
radiusCutter{kind, radius, pilotDiameter, passes, passSchedule, axialThinning}).
- Corner rounding (Harvey Tool SF_712500): pilot = D - 2R; De = pilot + R when
  R/pilot < 2.5, else pilot + 0.7R. Chip load x1.0 rounding one side, x0.7 both
  sides (Harvey: 60-80%), x0.45 plunging into a hole (Harvey: 40-50%).
- Concave radius (Harvey SF_32800): De = D - 2R. Chip load x1.0 OD + radius one
  side, x0.6 both sides (-40%), x1.2 radius only one side (+20%), x0.75 radius
  only both sides (-25%).
- Both: absolute starting SFM from the Harvey charts by class (RADIUS_CUTTER_SFM:
  aluminum 1000, brass 500, steel 200, 300-series stainless 200, titanium 120,
  nickel alloys 60 - titanium/nickel blend the two charts, cast iron uses the
  steel value: ESTIMATES), scaled for the grade inside its class and +-15% with
  aggressiveness; no coating speed multiplier (the charts give one SFM), coated
  chip load +15% (Harvey: +10-20%). Plastics/wood/composites/phenolics are not
  charted: end-mill speed x 0.7 (ESTIMATE). Chip load = end-mill curve at De x
  0.67 (calibrated to the Harvey tables: steel 0.0016-0.0021 in/tooth at
  0.375-0.5 in De; aluminum ~0.0026 at 0.375 in), and a further x0.6 for concave
  cutters in ferrous/hard alloys (Harvey runs them at ~0.35-0.4x aluminum).
- Pass schedule (Harvey): radial stepover = the full radius R, axial passes as
  fractions of R: 1 pass 1.0R; 2 passes 0.7/0.3; 3 passes 0.4/0.4/0.2; 4 passes
  0.4/0.3/0.2/0.1. Pass count by class: corner rounding 1 (aluminum/soft),
  3 (steel/iron), 4 (stainless/titanium/nickel); concave 2 / 3 / 3. First pass
  is reported as axial DOC; the HP-solved stepover and radial chip thinning are
  NOT applied (fixed-profile cut).
- Round-insert radius cutter (Mentor CNC / Sandvik): for ap < iC/2,
  De = D - iC + sqrt(iC^2 - (iC - 2 ap)^2) and the feed is raised by the axial
  chip-thinning factor 1/sqrt(1 - (1 - 2 ap/iC)^2) (capped at 3x). Needs the
  insert diameter (IC).
- Bull nose (cnc57 / Mentor): for ap < r, De = (D - 2r) + 2 sqrt(ap (2r - ap)) and
  the feed rises by 1/sin(kappa), sqrt(1 - (1 - ap/r)^2), capped at 2x. At or
  above the corner radius De = D and nothing changes (regression-neutral).
- Geometry guard: R >= D/2 (no core) is clamped to 0.45 D with a warning for corner rounding / concave, and IC >= D to 0.9 D for
  round inserts. The engine never returns an error object for these inputs (the UI reads results on every keystroke).
SOURCES
- https://harveyperformance.widen.net/content/57m86cyknv/pdf/SF_712500.pdf
- https://harveyperformance.widen.net/content/pba67otskw/pdf/SF_32800.pdf
- https://www.mentorcnc.com/en/cnc-milling-cutting-tools-guide/
- https://cnc57.com/en/technical_information/Effective-Diameter-and-Ball-Nose-Speed
- https://web.mae.ufl.edu/designlab/Advanced%20Manufacturing/Helical_Machining_Guidebook.pdf

16. HELICAL / RAMP ENTRY & FEED PER REV
When the SAME end mill starts a pocket, slot or bore from solid, the calculator adds an "Entry into Stock" block (2D pocket, adaptive, circular pocket, helical bore, slot, 3D pocket/adaptive). It is NOT added to finishing, contour, facing, drilling, tapping or thread operations, or to radius / chamfer / form cutters (do not ramp or plunge those).
Entry methods: Helical ramp (default), Linear ramp (default for slots), Plunge (center-cutting only), Pre-drilled / side entry (no ramp; also automatic when a bore pilot hole is entered).
Ramp angle by material class (Harvey / Helical Solutions "Ramping to Success", Global Cutting Tools Machining Methods): ferrous 1-3 deg, non-ferrous 3-10 deg. Stainless / titanium / superalloy 1-2 deg (Anebon). Steel and cast iron 2-3 deg. Aluminum 3-10 deg. ESTIMATE: copper/brass 3-8, plastics and wood 3-8, composites and phenolics 2-5 (chosen conservatively inside the published bands). The angle is placed inside the band by the finish / balanced / speed priority (finish priority = shallower).
Helix geometry: path circle diameter = helix hole diameter - tool diameter. Pitch per orbit = PI x pathDiameter x tan(angle), never more than the axial DOC (Sandvik: pitch can never exceed max ap). Turns = depth / pitch.
Helix hole size: default 1.2 x tool diameter. Harvey / Helical advise a helix of 110-120%+ of the cutter, Global Cutting Tools 115-130%, carbide-tooling.com at least 1.05x to enter and 1.2x for chip evacuation. Over 2x the tool leaves a core slug (Sandvik: max hole in one spiral = 2 x D). A corner-radius end mill is preferred for helical entry (Harvey).
Entry feed: a ramp or helix in solid is a slot-like cut, so there is no radial chip thinning and chip thickness = fz. Entry fz = 50% of normal chip load (Harvey: reduce feed by at least 50% on entry until fully engaged; plunge chip load -50%). ESTIMATE: Sandvik uses 75% of normal for linear ramps with inserted cutters and -30 to -50% for 2-axis ramping, Metanox -10 to -25% in steel; 0.5 is the conservative solid-carbide default. Spindle RPM is NOT changed for the ramp (CNCCookbook).
Helix centerline feed (the number to program on G2/G3): F_centerline = F_edge x (D_hole - D_tool) / D_hole (Kennametal ID interpolation, Sandvik tool-centre feed, Shader7). With cutter compensation use the edge feed. Counter-clockwise (G3) is climb milling (Sandvik). Helix path length vs. XY arc differs by under 2% for ramps up to 10 deg.
Linear ramp: ramp length = depth / tan(angle); Z feed = ramp feed x tan(angle); keep the reduced feed for about one cutter diameter after the ramp (Sandvik).
Plunge: plunge IPR = chip load x flutes x 0.5; plunge IPM = IPR x RPM. Center-cutting tools only.
Indexable cutters: maximum ramp angle depends on insert radius and body (Sandvik) - confirm in the catalog.
FEED PER REVOLUTION: for every milling operation the spindle feed per revolution (IPR) = feed / RPM = fz x flutes (shown under the main metrics). Drilling feed per rev is the chip load; tapping feed per rev equals the thread pitch. The entry block separates two different "per rev" numbers: pitch per orbit (Z drop per lap of the helix path circle) and Z per spindle rev (Z feed / RPM).
Sources: https://www.harveyperformance.com/in-the-loupe/ramping-success/ ; https://www.harveyperformance.com/in-the-loupe/types-tool-entry/ ; https://www.sandvik.coromant.com/en-us/knowledge/milling/milling-holes-cavities-pockets/ramping ; https://www1.mscdirect.com/images/solutions/kennametal/millingTechInfoInterpolation.pdf ; https://globalcuttingtools.com/wp-content/uploads/2014/10/Machining_Methods.pdf ; https://carbide-tooling.com/tools/helical-interpolation-calculator/ ; https://m.anebon.com/news/cnc-milling-helical-interpolation-mastery-circular-ramping-for-precision-holes-and-tool-life-extension ; https://metanox.ca/en/cutting-machining/ramp-milling-steel-stainless/ ; https://www.cnccookbook.com/fusion-360-feeds-speeds-made-easy-g-wizard/
`;

export default referenceText;