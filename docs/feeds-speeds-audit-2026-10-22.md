# PrecisionPath CNC: feeds, speeds and process-planning audit

Audit date: October 22, 2026. Scope: the current application engine, material/tool/operation tables, slider/objectives, stock allowances, contour corner stock, explanations and responsive UI.

## Executive finding

The calculator is a combination of published starting data, standard machining equations, tool-geometry corrections and application estimates. It is not a physical simulation of every cutter, and a passing software test cannot certify a cutting process. This audit corrects identifiable logic defects and makes the remaining assumptions visible instead of describing all outputs as universally accurate.

Manufacturer data is appropriate input, not something to avoid. The claim that tool companies necessarily recommend maximum, tool-breaking settings is not supported: Harvey's Machining Advisor Pro describes its outputs as starting references, warns against overstating setup rigidity, and says the machinist must exercise judgment ([Harvey user guide](https://www.harveyperformance.com/machining-advisor-pro-user-guide/)). PrecisionPath does use public maker/processor guidance; it also uses generic tables and estimated multipliers, and it must not claim exact equivalence to a specific manufacturer's toolbot.

The most important practical conclusion is this: **100% on the intensity slider is not 100% machine power, and neither is a promise against tool breakage.** Tool strength, chatter, runout, holder geometry, real stock, coolant, material condition and machine torque remain relevant even below an HP budget.

## What was corrected

- **Power policy:** the old milling HP target could reach the full entered rating. The shared policy now budgets 20% to 80% of entered HP as the slider moves from 0% to 100%, with additional reductions for objective-specific loading. This is an explicit application-policy estimate, not a material-specific safety factor.
- **Tool-life objective:** tool life is now a separate choice. It biases the cutting-speed window lower and moderates loading. Surface quality, balanced and productivity modes remain separate. No setting predicts tool-life hours.
- **Speed mode:** removed the positive aggressiveness shift that could force the geometric/feed selector to its maximum early. Speed mode retains all caps.
- **Coating boost:** a generic coating name no longer increases speed above the generic coated-carbide baseline. Exact coating performance needs exact-grade/catalog conditions.
- **Pitch locking:** tapping no longer clamps feed independently of RPM. Feed-limited tapping/threading lowers RPM and feed together. If the machine minimum RPM is incompatible with the feed limit, the setup is marked not runnable.
- **Actual speed:** reported SFM follows achieved RPM, including RPM limits and the HP solve, not just the original target.
- **Cutting length:** a user-entered axial DOC does not override cutting length. Deeper features require multiple levels.
- **Slotting derate:** the conventional slot speed factor is no longer applied twice.
- **Stock allowances:** removed the same wall-and-floor allowance from every roughing operation. Facing has zero radial stock, wall contours/bores have no automatic floor stock, and final finishing leaves zero on the finished surfaces.
- **Finishing-tool basis:** allowance uses an optional planned finishing-cutter diameter, rather than always using the roughing cutter.
- **Corner stock:** prior-tool inputs distinguish nominal straight-wall stock from leftover inside-corner material. Excess material triggers rest-clearing/semi-finishing guidance instead of a false single-pass feed recommendation.
- **Compatibility:** mismatched drilling/tapping tools, unsupported face-mill/saw paths, generic thread milling without a thread-mill model, invalid geometry and selected unsuitable grades receive explicit not-runnable states. Numbers retained for UI stability are not approved cutting recommendations.
- **Workholding honesty:** removed the unsupported universal claim that an aluminum jaw transmits only 40% of vise rating. Jaw strength cannot be calculated from material alone. The friction model remains an estimate, not a jaw-yield or holding-capacity certification.
- **Output explanations:** operation-specific reasoning, source guidance, target/achieved speed, feed relationships, allowances, policy and limitations are available in the calculator.
- **Display precision:** small feed/tooth and engagement values get more digits rather than appearing as zero. The numeric field rejects nonfinite values.

These are application changes established by code review and tests. They do not establish measured tool life or measured surface finish.

## Where the numbers come from

### Standard equations

The basic kinematic equations are not proprietary tool-company algorithms. Michigan Drill publishes the standard relationships among diameter, cutting speed, RPM, feed/tooth, tooth count, feed/minute and feed/revolution ([Michigan Drill speed, feed and power equations](https://michigandrill.com/catalog/technical_data_milling_calcs.php)).

\[
N \approx \frac{3.82V}{D_\mathrm{effective}},\qquad
F=N z f_{z,\mathrm{programmed}},\qquad
f_\mathrm{rev}=\frac{F}{N}
\]

Here \(V\) is SFM, \(D\) is inches, \(N\) is spindle RPM, \(z\) is effective teeth and \(F\) is IPM. Drilling uses a feed per revolution, so the engine does not multiply its IPR by flute count.

The milling volume/power screen uses \(Q=a_e a_p F\) and an approximate material power factor. Michigan Drill publishes the equivalent inverse-power-constant formulation, but its own constants explicitly incorporate particular efficiency and dulling assumptions; those assumptions must not be mistaken for universal machine/material properties ([Michigan Drill power table](https://michigandrill.com/catalog/technical_data_milling_calcs.php)).

### Baseline cutting speeds and feeds

- **General metal milling:** current material rows provide generic coated-carbide starting windows. Tool substrate, operation, diameter-based chip-load interpolation and engagement modify these. A material label such as “4140” does not establish hardness, heat treatment or machinability of the actual stock; each numeric row is not an independently certified exact-tool chart.
- **Plastic milling:** the app's unfilled-plastic base chip curve derives from Harvey's semi-roughing chart, which has specific radial/axial engagement conditions. Material-specific reductions and transferring the curve to other strategies remain estimates ([Harvey unfilled-plastics chart](https://harveyperformance.widen.net/content/hnlndl2mif/pdf/SF_852000.pdf)). Curbell independently supplies polymer-specific speed/geometry guidance, not one universal polymer setting ([Curbell plastic milling](https://www.curbellplastics.com/services-capabilities/fabrication-machined-parts/plastic-machining-guidelines/plastic-milling-machining-guidelines/)).
- **Nylon and filled plastics:** processor guidance supports sharp tooling, heat/chip management, and different treatment of unfilled versus glass-filled stock. A broad nylon name is not an exact material condition ([Ready Plastics nylon machining](https://www.readyplastics.com/resources/materials/nylon/machining)).
- **Phenolics/Textolite and glass laminates:** processor machining guidance is used for material families. Paper, cloth and glass reinforcement are not interchangeable. Material scaling, HP factors, some ramp choices and many allowances remain estimates rather than measured values for each laminate grade ([Ready Plastics phenolic guidance](https://www.readyplastics.com/resources/machining/phenolic)).
- **Drilling:** base feed is a diameter-indexed IPR curve, with material/depth/cycle adjustments. Generic drilling is not a substitute for a coolant-through drill's exact grade, flute-length, point geometry and depth-rating chart ([Norseman drill feeds and speeds](https://www.norsemandrill.com/feeds-speeds-drill.php)).
- **Tapping:** pitch/feed and drill-size equations follow standard tapping relationships. Tap style, substrate, material and blind/through-hole selection affect the starting speed; torque and form-tap displacement are not fully simulated ([Tapmatic formulas](https://www.tapmatic.com/tapping_questions_tapping_formulas.ydev)).
- **Metal turning:** the stored speed/feed windows were transcribed from a secondary catalog compilation, then mapped/scaled by material class. The compilation identifies underlying catalogs, but this audit does not claim that every current mapped value was independently reconciled to every original insert catalog ([MetronQ tables and explanation](https://metronq.com/en/cutting-parameters-calculator)). BSSA also stresses that cutting speed, feed, DOC and work-hardened layer interact, and that too-low speed can also be problematic ([BSSA stainless turning guidance](https://bssa.org.uk/bssa_articles/speeds-and-feeds-for-turning-stainless-steels/)).
- **Plastic turning:** processor windows and sharp-edge/heat guidance supplement generic material mapping. Curbell's table contains apparent inconsistencies in some feed headings/entries; it should not be copied blindly without checking the original context ([Curbell plastic turning](https://www.curbellplastics.com/services-capabilities/fabrication-machined-parts/plastic-machining-guidelines/plastic-turning-machining-guidelines/)).

The appended data inventory shows the exact stored material windows and factors. It is a transparent snapshot of app inputs, not a claim that all those inputs are literal maker-chart values.

### Why programmed feed can exceed nominal chip load

At small radial engagement, the programmed feed/tooth can exceed the desired maximum chip thickness. The current 90-degree peripheral-cutter radial-thinning relationship is:

\[
K_r=\frac{1}{\sqrt{1-(1-2a_e/D)^2}}\quad (a_e<D/2).
\]

At or above half-diameter engagement, the radial correction is one. This geometry is not permission to use the same elevated feed in a suddenly heavier corner. Face mills can also require entering-angle compensation; a generic compensation does not establish the load capacity of a particular insert.

Circular interpolation adds a different correction: for an internal feature, \(F_\mathrm{center}=F_\mathrm{edge}(D_\mathrm{feature}-D_\mathrm{tool})/D_\mathrm{feature}\). This is a path-radius correction, not radial chip thinning ([Kennametal interpolation technical guide](https://www1.mscdirect.com/images/solutions/kennametal/millingTechInfoInterpolation.pdf)).

### Tool families and what the engine actually knows

- **Square and serrated roughing end mills:** nominal diameter, teeth, length, generic material/operation windows and engagement. It does not know helix, edge preparation, variable-pitch tuning or flute core from a product model number alone.
- **Ball end mills:** contact/effective diameter and axial/radial thinning matter because the tip approaches zero cutting speed. A generic shallow-contact model is not full 3D surface-normal/contact simulation.
- **Bull-nose end mills:** corner-radius engagement changes effective diameter and chip thickness. Surface orientation and actual contact still matter.
- **Corner-rounding and concave-radius form cutters:** dedicated effective-diameter and engagement factors derive from specific Harvey form-tool charts. These are much better than treating them as ordinary end mills, but the exact tool's geometry must match the chart assumptions ([Harvey corner-rounding chart](https://harveyperformance.widen.net/content/57m86cyknv/pdf/SF_712500.pdf); [Harvey concave-radius chart](https://harveyperformance.widen.net/content/pba67otskw/pdf/SF_32800.pdf)).
- **Round-insert cutters:** insert diameter, axial engagement and effective diameter/thinning are modeled. Cutter-body ramp clearance and insert grade are not established by a generic “round insert” selection.
- **Face mills:** entering angle, shallow axial engagement, teeth and wide face coverage. Tooth runout and wiper placement can dominate finish. A generic face mill is not assumed to support every pocket/contour/ramp.
- **Chamfer cutters:** tip/angle engagement and matching edge/engraving paths. General buried pocketing is not certified.
- **Slitting saws:** saw/thickness-specific straight-slot behavior, not general bore/pocket/3D milling.
- **T-slot cutters:** neck and side-entry constraints. A pre-opened slot and clearance are necessary; the label alone cannot establish full geometry.
- **Drills and taps:** dedicated hole/pitch logic, not milling feed/tooth logic.
- **Turning inserts and bars:** shape, nose radius, grade family and approximate stiffness/overhang. Insert chipbreaker minimum feed/DOC, edge hone, holder dynamics and actual grade limits require catalog confirmation.

## Slider and optimization objectives

The intensity slider is an application preference inside a starting-data envelope. It is not a machine override knob or a tool utilization percentage.

| Setting | Shared upper HP budget | Generic speed-window position |
|---|---:|---:|
| 0% | 20% of entered HP | low end |
| 60% | 56% of entered HP | 48% through window; tool life 27% |
| 100% | 80% of entered HP | 80% through window; tool life 45% |

All numbers in this policy table are engineering application choices, not manufacturer-derived safety factors. Eighty percent through a window is not eighty percent of its upper speed, nor eighty percent of a tool's breaking load. A single entered/lookup speed is treated as a ceiling and moderated by the application, not copied as a guaranteed cut.

- **Surface quality:** lower geometric/feed intensity and geometric finish targets. Higher finish speed can sometimes reduce built-up edge, but it is not always appropriate, and no actual Ra is guaranteed.
- **Tool life:** lower speed-window position and moderated engagement. It does not simply turn feed toward zero; an excessively thin chip can rub and work-harden material.
- **Balanced:** intermediate generic starting policy, not an exact IMCO or other vendor-toolbot clone.
- **Speed/MRR:** the more productive end of the same constrained policy. It cannot turn off length, compatibility, feed, RPM or power checks.

The 20% HP reserve does not compensate for an unknown torque curve, poor holder, loose part, worn edge, interrupted engagement or chatter. Even less than 20% HP can break a small or poorly supported tool. Manufacturer starting recommendations also require setup judgment ([Harvey user guide](https://www.harveyperformance.com/machining-advisor-pro-user-guide/)).

## Stock to leave by operation

“Stock to leave” means material deliberately reserved after this operation. It is different from incoming material being removed by this pass.

| Operation | Radial allowance | Axial allowance | Practical interpretation |
|---|---|---|---|
| Rough facing, mill or lathe | zero | possible finish reserve | A face is a plane, not a wall. |
| Final facing | zero | zero | Finish the face to its target. |
| Rough wall contour / bore / boss | possible per-side wall reserve | not automatic | A separate floor pass controls a floor. |
| Final wall contour / bore | zero on finished wall | not implied | Incoming corner stock must still be checked. |
| Rough pocket / adaptive clearing | possible wall reserve | possible floor reserve | Specify both; the same numeric estimate is not proof both are optimal. |
| 3D surface work | normal allowance where applicable | not a universal axial offset | Requires knowledge of the surface and CAM strategy. |
| Drilling / tapping / thread / groove / part-off | no generic wall/floor reserve | no generic reserve | Use operation-specific feature and pass dimensions. |
| Turning OD / ID roughing | radial, per side | no automatic face reserve | Diameter allowance is twice radial allowance. |

For generic milling roughing, the app provisionally suggests 1.5% of the planned finish-cutter diameter. If the finish cutter is unknown, the current cutter is an explicit fallback. Seco discusses finish stock of about 1–2% of finishing diameter, particularly in hard milling, but applying that rule across soft alloys, plastics, floors and arbitrary stiffness is an extrapolation ([Seco finish-stock guidance](https://www.secotools.com/article/finish_stock_allowance_with_solid_end_mills)).

Therefore the allowance is marked an estimate. It must cover the roughing pass's form error, deflection, runout, roughness and work-hardened layer while staying within the finish tool's stable chip/DOC window. Too little can rub; too much can overload the finish tool. BSSA specifically warns about preserving sufficient finish depth in work-hardening stainless ([BSSA guidance](https://bssa.org.uk/bssa_articles/speeds-and-feeds-for-turning-stainless-steels/)).

The generic turning finish reserve remains 0.015 in per side where the pass planner applies it. This is an application estimate, not a universal chipbreaker minimum or a recommendation for every small part.

## Inside corners after a larger rougher

Sandvik explicitly notes that engagement rises in internal corners, destabilizing the process and potentially damaging the tool. A straight-wall feed is not automatically appropriate in that heavier engagement ([Sandvik inside-corner guidance](https://www.sandvik.coromant.com/en-us/knowledge/milling/milling-inside-corners)).

The new inputs are previous roughing tool diameter, previous radial wall stock, desired inside corner radius and included wall angle. The model assumes two tangent walls and a tangent circular fillet in a planar section:

\[
c=\csc(\theta/2), \quad
R_\mathrm{rough}=\max(R_\mathrm{previous},R_\mathrm{final}-s)
\]
\[
t_\mathrm{corner}=\max\{s,\;sc+(R_\mathrm{rough}-R_\mathrm{final})(c-1)\}.
\]

This formula is a geometric derivation for bisector material thickness, not a supplier feed recommendation and not a full cutter-engagement solution.

For example, a 0.750 in rougher, 0.010 in wall stock, 0.150 in final fillet and 90-degree walls leave about 0.10734 in along the corner bisector, despite only 0.010 in along a straight wall. If the final cutter is 0.250 in, it fits the radius, but a 0.010 in nominal radial finish pass is not a reasonable description of that corner stock.

When the estimate exceeds the planned radial pass, the result calls for rest/adaptive clearing or semi-finishing and is marked not runnable as a single finish pass. When it does not, an inside-arc centerline correction is shown conditionally; it is not a certified peak-engagement feed. The model does not infer a 3D stock mesh, wall slope, prior tool path coverage or residual cusp topology.

For 3D waterline and Pocket/Contour paths, the inputs remain a planar screening calculation. Use CAM stock comparison and engagement verification for the actual 3D feature.

## Helix, ramp, drilling and tapping checks

Helix pitch is axial drop per orbit, not feed per spindle revolution. The model uses path diameter \(D_\mathrm{hole}-D_\mathrm{tool}\), ramp angle and a pitch not exceeding axial engagement. Solid entry has no radial-thinning bonus, receives a reduced starting chip load, and is further limited by the power budget. The chosen angle is an estimate within/analogous to published class guidance, not the selected cutter's certified ramp limit ([Harvey ramping](https://www.harveyperformance.com/in-the-loupe/ramping-success/); [Harvey entry methods](https://www.harveyperformance.com/in-the-loupe/types-tool-entry/)).

Helix feed at the tool center is distinct from cutting-edge feed. A hole above twice tool diameter can leave a core slug, and the application does not authorize it as ordinary single-helix entry ([Sandvik ramping guidance](https://www.sandvik.coromant.com/en-us/knowledge/milling/milling-holes-cavities-pockets/ramping); [Kennametal centerline formulas](https://www1.mscdirect.com/images/solutions/kennametal/millingTechInfoInterpolation.pdf)).

Tapping and single-point threading retain \(F=Np\). For example, if pitch is 0.050 in/rev and the machine can feed only 0.5 IPM, synchronized RPM cannot exceed 10. If machine minimum RPM is 100, there is no feasible synchronized cut within those limits. The correct outcome is a blocked setup, not an arbitrary slower feed at 100 RPM ([Tapmatic pitch/feed equations](https://www.tapmatic.com/tapping_questions_tapping_formulas.ydev)).

Drill depth/peck guidance and tap-power estimates are not complete chip evacuation or torque simulations. Blind-hole lead, reversal travel, chip direction and clearance must be checked on the real tool and machine.

## Validation scope and limitations

The machine-readable receipt and reproducible test command are committed with the code. Run `npm run test:audit`; it includes the current cross-product/invariant checks and the retained regression fixtures.

The full tool-type/operation/material matrix checks 49 materials, 13 tool types, 29 milling operations, four objectives and slider positions 0%, 60%, 100%. Additional coverage combines material, tool type, substrate and coating at representative operations; it is not the astronomical full Cartesian product of every possible diameter, grade, coating, slider value and user geometry.

The audit checks finite outputs, displayed explanations, stock-plan availability, feed/RPM/power bounds, cutting length, pitch locking, compatibility states, independent corner geometry and selected malformed inputs. The receipt appended below records actual counts. Unsupported combinations are deliberately blocked or return explicit turning eligibility errors, not silently counted as physically valid.

Local browser checks covered all nine routes at 375 px width, with no document horizontal overflow, plus the calculator/turning controls at desktop width. The facing example, four objectives, 100% slider, 3D corner warning, explanation expansion and inch/mm round trip were exercised. The save dialog was opened and dismissed without creating a record. Base44 configuration/entity/assistant endpoints return 404 in this local environment because its app ID is not configured; authenticated live lookup/save behavior is not counted as passed.

Regression checks were retained for ball nose, form cutters, plastics, phenolics, facing, circular paths, tapping, turning, workholding and previous benchmark fixtures. The former aluminum-jaw test was corrected because it asserted the unsupported 40% material-only force rule. Entry tests now allow a further power-budget reduction below the nominal 50% entry factor.

Tests of numerical relationships are not measurements of tool strength, tool life, chatter, chip evacuation, actual corner engagement or finish. The inherited benchmark fixtures are not an independently reproduced manufacturer certification. A report of millions of assertions is not millions of shop cuts.

### What remains unverified

- **Exact SKU performance:** no physical cut test or complete catalog reconstruction for every diameter, flute form, edge prep, coating, chipbreaker, heat treatment and setup.
- **Machine dynamics:** no spindle torque-versus-RPM curve, continuous/intermittent rating distinction, measured holder stiffness or chatter stability lobe.
- **Real tool deflection:** LOC is not actual overhang; assumed flute-core diameter and force direction are uncertain. The displayed value is a screen, not a worst-case bound.
- **Real surface finish:** theoretical scallop/feed marks omit runout, tooth height, vibration, wear, built-up edge and machine motion. No guaranteed measured Ra.
- **Workholding strength:** no jaw stress/contact/deflection model or measured friction for the actual coolant/material interface.
- **3D rest stock:** no solid/mesh stock simulation, true peak engagement or collision check.
- **Thread milling:** a generic end mill is not a thread mill. Until dedicated profile/pitch data is provided, that menu combination is not runnable.
- **AI catalog lookup:** a retrieved URL/part number is not independent validation. Catalog chip load may already include engagement compensation; double compensation must be avoided.
- **Hosted behavior:** local calculation/UI checks do not prove authenticated Base44 lookup, saved-record or assistant-service behavior. Those need a separate live test.

## Recommended shop prove-out

- **Catalog match:** match tool SKU, diameter, flute count, substrate/coating, material condition and operation. Confirm whether feed is maximum chip thickness or already-compensated programmed feed.
- **Setup inputs:** enter usable continuous spindle power, actual feed/RPM limits, actual cutting length and actual incoming stock. Confirm holder, stickout, runout, clamp condition and coolant.
- **CAM stock:** check corners, entry, full-width moments, ramps, rest material and collisions. A nominal stepover does not describe every engagement.
- **First cut:** use a controlled prove-out, observe chip form and evacuation, sound, spindle load and edge condition, then measure the cooled part and finish.
- **Feedback record:** store the actual tool/material/setup and resulting wear, dimensions and finish. Those measured records, not a universal slider fraction, support reliable future calibration.

The app is more transparent and better constrained after this audit. It remains a starting and screening tool; claims of universal accuracy or guaranteed breakage prevention would be unjustified.

<!-- GENERATED AUDIT APPENDIX -->

## Audit receipt

Run timestamp: 2026-10-22T18:08:46.407Z. Numerical/invariant audit only; no physical cutting certification.

| Item | Actual result |
|---|---|
| Materials / tool types / milling ops / turning ops | 49 / 13 / 29 / 12 |
| Full material × tool type × operation × objective × 3 slider positions | 221676 |
| Additional substrate/coating representative cases | 178360 |
| Extra dimensional / bad-input cases | 202 |
| Total milling/hole calculation cases | 400238 |
| Turning cases attempted | 42336 |
| Explicit unsupported turning cases | 5184 |
| Blocked milling/hole cases (included in counts, NOT certified cuts) | 142461 |
| Numerical assertions | 6256554 |
| Failures | 0 |
| Legacy fixture files passed | 18 / 18 |

## Current stored material inputs

These are read from the application, not newly certified manufacturer recommendations. Windows are pre-operation/substrate/coating/geometry adjustments; power factors are approximate HP per in³/min. A generic chip factor multiplies a diameter-based metal/soft/plastic/drill curve. Consult the source-family discussion above; no row claims exact-SKU validation.

| Material | Class | Stored milling SFM | Chip factor | Power factor | Special drill SFM |
|---|---|---|---|---|---|
| Aluminum 6061 | aluminum | 700–1400 | 1 | 0.35 | generic drill adjustments |
| Aluminum 7075 | aluminum | 650–1300 | 0.9 | 0.4 | generic drill adjustments |
| Cast Aluminum | aluminum | 450–950 | 0.85 | 0.3 | generic drill adjustments |
| Brass | nonferrous_soft | 300–700 | 0.85 | 0.55 | generic drill adjustments |
| Copper | nonferrous_soft | 300–700 | 0.65 | 0.7 | generic drill adjustments |
| Bronze | nonferrous_soft | 220–450 | 0.7 | 0.7 | generic drill adjustments |
| Mild Steel 1018 | steel_mild | 350–600 | 0.62 | 1.4 | generic drill adjustments |
| Medium Carbon Steel 1045 | steel_mild | 300–500 | 0.56 | 1.71 | generic drill adjustments |
| Alloy Steel 4140 | steel_alloy | 250–450 | 0.58 | 1.75 | generic drill adjustments |
| A36 Structural Steel | steel_mild | 350–600 | 0.62 | 1.38 | generic drill adjustments |
| A572 Gr 50 Steel | steel_mild | 300–550 | 0.58 | 1.77 | generic drill adjustments |
| 12L14 Free-Machining Steel | steel_mild | 380–600 | 0.69 | 1.05 | generic drill adjustments |
| Stainless 303 | stainless | 250–400 | 0.52 | 1.3 | generic drill adjustments |
| Stainless 304 | stainless | 200–320 | 0.46 | 1.6 | generic drill adjustments |
| Stainless 316 | stainless | 180–290 | 0.44 | 1.7 | generic drill adjustments |
| Stainless 17-4 PH | stainless | 150–260 | 0.4 | 2.3 | generic drill adjustments |
| Cast Iron (Gray) | cast_iron | 350–650 | 0.69 | 1.1 | generic drill adjustments |
| Ductile Iron | cast_iron | 300–450 | 0.58 | 1.25 | generic drill adjustments |
| Titanium Grade 2 | titanium | 150–260 | 0.4 | 1.3 | generic drill adjustments |
| Titanium Grade 5 (Ti-6Al-4V) | titanium | 120–250 | 0.35 | 2.2 | generic drill adjustments |
| Inconel 718 | superalloy | 40–95 | 0.29 | 2.4 | generic drill adjustments |
| Tool Steel (A2/D2) | steel_alloy | 150–280 | 0.45 | 2.3 | generic drill adjustments |
| Hardwood (Maple/Oak) | wood | 400–600 | 1 | 0.12 | generic drill adjustments |
| Softwood (Pine) | wood | 400–1000 | 1.1 | 0.1 | generic drill adjustments |
| MDF / Plywood | wood | 500–1000 | 1 | 0.1 | generic drill adjustments |
| Acrylic (PMMA) | plastic | 500–1000 | 0.7 | 0.14 | generic drill adjustments |
| Acetal / Delrin (POM) | plastic | 500–1000 | 0.85 | 0.13 | generic drill adjustments |
| ABS | plastic | 300–600 | 0.7 | 0.14 | generic drill adjustments |
| Polycarbonate (PC) | plastic | 500–1000 | 0.5 | 0.15 | generic drill adjustments |
| Nylon 6/6 (extruded) | plastic | 500–1000 | 0.6 | 0.13 | generic drill adjustments |
| Nylon 6 Cast (MC / Nylatron GS) | plastic | 450–900 | 0.6 | 0.13 | generic drill adjustments |
| Nylon 6/6 30% Glass-Filled | plastic | 200–400 | 0.35 | 0.25 | generic drill adjustments |
| UHMW-PE (UHMW Polyethylene) | plastic | 800–1400 | 1 | 0.1 | generic drill adjustments |
| HDPE | plastic | 800–1400 | 1 | 0.1 | generic drill adjustments |
| Polypropylene (PP) | plastic | 400–700 | 0.6 | 0.1 | generic drill adjustments |
| PVC (rigid) | plastic | 300–600 | 0.5 | 0.12 | generic drill adjustments |
| PTFE (Teflon) | plastic | 400–1000 | 0.4 | 0.1 | generic drill adjustments |
| PEEK (unfilled) | plastic | 500–900 | 0.6 | 0.2 | generic drill adjustments |
| PEEK 30% Glass / Carbon-Filled | plastic | 350–650 | 0.4 | 0.28 | generic drill adjustments |
| Ultem PEI (1000, unfilled) | plastic | 700–1000 | 0.35 | 0.2 | generic drill adjustments |
| PET-P (Ertalyte) | plastic | 250–450 | 0.45 | 0.15 | generic drill adjustments |
| Paper Phenolic XX (Bakelite) | phenolic | 400–1300 | 0.45 | 0.15 | 300–500 |
| Cotton Phenolic CE (Textolite / Micarta) | phenolic | 400–1200 | 0.45 | 0.17 | 300–500 |
| Linen Phenolic LE (fine weave, Micarta) | phenolic | 400–1150 | 0.4 | 0.17 | 300–500 |
| Canvas Phenolic C (Textolite / Micarta) | phenolic | 350–1050 | 0.4 | 0.2 | 250–450 |
| Glass Phenolic G-3 / GP-01 (glass cloth) | composite | 300–550 | 0.6 | 0.25 | 200–350 |
| Carbon Fiber (CFRP) | composite | 300–600 | 0.6 | 0.28 | generic drill adjustments |
| G10 / FR4 | composite | 350–650 | 0.7 | 0.25 | generic drill adjustments |
| G11 / FR5 | composite | 315–585 | 0.7 | 0.28 | generic drill adjustments |

## Base diameter-to-chip curves

Read from app interpolation tables. Values below are inches/tooth except drill, which is inches/revolution. The plastic base uses Harvey semi-roughing guidance, not an all-operation/all-polymer prescription ([Harvey chart](https://harveyperformance.widen.net/content/hnlndl2mif/pdf/SF_852000.pdf)). Generic metal/soft curves remain approximate starting curves.

| Diameter (in) | Metal IPT | Soft IPT | Plastic IPT | Drill IPR |
|---|---|---|---|---|
| 0.0625 | 0.0006 | 0.002 | 0.00196 | 0.0015 |
| 0.125 | 0.0012 | 0.0035 | 0.00394 | 0.0022 |
| 0.25 | 0.0026 | 0.007 | 0.00789 | 0.005 |
| 0.5 | 0.0055 | 0.01 | 0.01341 | 0.009 |
| 0.75 | 0.0085 | 0.013 | 0.02011 | 0.013 |
| 1 | 0.011 | 0.015 | 0.02682 | 0.017 |

## Current tool-type modifiers

Generic modifiers below are application estimates, not universal substrate/coating/geometry limits. Dedicated geometry may replace/modify them at runtime. No generic positive coating boost is applied above the coated baseline.

| Tool | Nominal speed multiplier | Chip multiplier | DOC multiplier |
|---|---|---|---|
| Square End Mill | 1 | 1 | 1 |
| Ball End Mill | 1 | 0.9 | 0.85 |
| Bull-Nose End Mill | 1 | 1 | 1 |
| Corner Rounding Radius Cutter | 1 | 0.67 | 1 |
| Concave Radius Cutter | 1 | 0.67 | 1 |
| Round-Insert Radius Cutter | 1 | 1 | 0.5 |
| Roughing / Corn Cob | 1.1 | 1.2 | 1.3 |
| Chamfer / V-Bit | 1 | 0.8 | 0.6 |
| Face Mill (Indexable) | 1 | 1.1 | 0.5 |
| Drill | 1 | 1 | 1 |
| Tap | 1 | 1 | 1 |
| Slitting Saw | 0.9 | 0.8 | 1 |
| T-Slot Cutter | 0.95 | 0.9 | 1 |

## Current operation definitions

The speed/chip multipliers are application starting-policy estimates, not independently certified operation-specific chart limits. Runtime ceilings, geometry, power and compatibility still apply.

| Operation | Mode | Finish? | Speed factor | Chip factor |
|---|---|---|---|---|
| 2D Adaptive Clearing (Rough) | hem | no | 1 | 1.1 |
| 2D Adaptive Finishing | hem | yes | 1.1 | 0.8 |
| 2D Pocket | hem | no | 1 | 1 |
| 2D Contour / Peripheral (Rough) | profile | no | 1 | 1 |
| 2D Contour / Peripheral (Finish) | profile | yes | 1.1 | 0.7 |
| Face (Rough) | face | no | 0.95 | 1 |
| Face (Finish) | face | yes | 1.05 | 0.65 |
| Slot | slot | no | 0.8 | 1 |
| Circular / Bore (legacy: full-width slot) | slot | no | 0.8 | 1 |
| 2D Bore - Helical (Rough) | hem | no | 1 | 1 |
| 2D Bore / Circular Wall (Finish) | profile | yes | 1.1 | 0.7 |
| 2D Circular Pocket (Rough) | hem | no | 1 | 1 |
| 2D Circular Boss (Rough) | profile | no | 1 | 1 |
| 2D Circular Boss (Finish) | profile | yes | 1.1 | 0.7 |
| Thread Milling | profile | no | 0.8 | 0.6 |
| Drilling | drill | no | 0.8 | 1 |
| Tapping | tap | no | 1 | 1 |
| 2D Engrave | profile | no | 1 | 0.4 |
| 3D Adaptive Clearing (Rough) | hem | no | 1 | 1 |
| 3D Adaptive Finishing | hem | yes | 1.1 | 0.8 |
| Pocket / Contour (3D) | hem | no | 0.95 | 1 |
| Parallel | profile | yes | 1.1 | 0.7 |
| Contour (Waterline) | profile | yes | 1.05 | 0.7 |
| Morph / Blend | profile | yes | 1.1 | 0.7 |
| Project | profile | yes | 1.1 | 0.7 |
| Pencil / Rest Machining | profile | yes | 1.1 | 0.6 |
| Radial / Spiral / Flow | profile | yes | 1.1 | 0.7 |
| 3+2 Positioning (Indexed) | profile | no | 1 | 0.8 |
| Simultaneous 5-Axis | profile | no | 1 | 0.8 |

## Stored coated-carbide turning windows

These are app reference rows based on the secondary catalog compilation and material-family mapping described above, not a fresh audit of every original catalog page ([MetronQ](https://metronq.com/en/cutting-parameters-calculator)). Material/grade/operation and application-policy adjustments still apply.

| Family | Rough SFM | Finish SFM | Rough IPR | Finish IPR |
|---|---|---|---|---|
| Unalloyed / low-carbon steel | 656–1083 | 919–1378 | 0.012–0.02 | 0.004–0.01 |
| Low-alloy steel (normalised) | 558–951 | 787–1181 | 0.012–0.02 | 0.004–0.01 |
| Quenched & tempered / high-alloy steel | 394–656 | 525–853 | 0.01–0.016 | 0.004–0.008 |
| Austenitic stainless | 427–722 | 574–886 | 0.008–0.016 | 0.004–0.008 |
| Grey cast iron | 656–1115 | 853–1345 | 0.012–0.02 | 0.006–0.012 |
| Nodular / ductile cast iron | 591–984 | 755–1214 | 0.01–0.02 | 0.005–0.01 |
| Wrought aluminum | 984–2625 | 1312–3281 | 0.008–0.02 | 0.004–0.012 |
| Cast Al-Si alloys | 656–1640 | 820–1969 | 0.008–0.016 | 0.004–0.012 |
| Free-cutting brass | 820–1640 | 1050–1969 | 0.008–0.016 | 0.003–0.01 |
| Copper & lead-free bronzes | 492–984 | 656–1148 | 0.006–0.014 | 0.003–0.008 |
| Titanium alloys (Ti-6Al-4V) | 115–197 | 148–230 | 0.006–0.012 | 0.003–0.008 |
| Nickel superalloys (Inconel 718/625) | 82–148 | 115–197 | 0.006–0.01 | 0.003–0.006 |

## Formula checks you can reproduce

A 0.500 in four-flute carbide rough-facing example on 6061 (finish objective, 60% slider, 10 HP, 12,000 RPM and 400 IPM machine limits) returns 7519 RPM, 984 actual SFM, 143.91366 IPM, 0.00479 programmed IPT, 0.045 in DOC, 0.5 in WOC, radial stock 0 in and axial stock 0.0075 in. This is an app example, not an endorsed cut for an unidentified tool.

For the corner example in the report, √2 × 0.010 + (√2 − 1) × (0.375 − 0.150) = 0.107340187 in. This is calculated geometric bisector stock, not a measured chip thickness or shop result.
