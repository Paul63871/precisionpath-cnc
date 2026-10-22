// Reproducible app-data snapshot; these rows are NOT asserted to be independent
// maker-verified chart values. Rebuild after edits to engine/data or audit tests.
import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
const bundle = await build({
  stdin: { contents: 'export * from "./src/lib/cncData.js"; export * from "./src/lib/turningData.js"; export {calculate} from "./src/lib/cncEngine.js";', resolveDir: process.cwd() },
  bundle: true, write: false, format: "esm", platform: "node",
});
const M = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const path = "docs/feeds-speeds-audit-2026-10-22.md";
let text = (await readFile(path, "utf8")).split("\n<!-- GENERATED AUDIT APPENDIX -->")[0];
const A = JSON.parse(await readFile("tests/audit-results.json", "utf8"));
const L = JSON.parse(await readFile("tests/legacy-results.json", "utf8"));
const cell = (s) => String(s ?? "").replaceAll("|", "/").replaceAll("\n", " ");
const table = (head, rows) => `| ${head.map(cell).join(" | ")} |\n|${head.map(() => "---").join("|")}|\n${rows.map((r) => `| ${r.map(cell).join(" | ")} |`).join("\n")}\n`;
text += "\n<!-- GENERATED AUDIT APPENDIX -->\n\n## Audit receipt\n\n";
text += `Run timestamp: ${A.date}. Numerical/invariant audit only; no physical cutting certification.\n\n`;
text += table(["Item", "Actual result"], [
  ["Materials / tool types / milling ops / turning ops", `${A.materialCount} / ${A.toolTypeCount} / ${A.millingOperationCount} / ${A.turningOperationCount}`],
  ["Full material × tool type × operation × objective × 3 slider positions", A.fullCrossProductCases],
  ["Additional substrate/coating representative cases", A.matrixCases - A.fullCrossProductCases],
  ["Extra dimensional / bad-input cases", A.millingCases - A.matrixCases],
  ["Total milling/hole calculation cases", A.millingCases],
  ["Turning cases attempted", A.turningCases],
  ["Explicit unsupported turning cases", A.turningUnsupported],
  ["Blocked milling/hole cases (included in counts, NOT certified cuts)", A.blocked],
  ["Numerical assertions", A.checks],
  ["Failures", A.failures],
  ["Legacy fixture files passed", `${L.filter((r) => r.pass).length} / ${L.length}`],
]);
text += "\n## Current stored material inputs\n\nThese are read from the application, not newly certified manufacturer recommendations. Windows are pre-operation/substrate/coating/geometry adjustments; power factors are approximate HP per in³/min. A generic chip factor multiplies a diameter-based metal/soft/plastic/drill curve. Consult the source-family discussion above; no row claims exact-SKU validation.\n\n";
text += table(["Material", "Class", "Stored milling SFM", "Chip factor", "Power factor", "Special drill SFM"], M.PART_MATERIALS.map((m) => [m.name, m.materialClass, m.sfmRange.join("–"), m.chipLoadFactor, m.hpFactor, m.drillSfmRange?.join("–") || "generic drill adjustments"]));
text += "\n## Base diameter-to-chip curves\n\nRead from app interpolation tables. Values below are inches/tooth except drill, which is inches/revolution. The plastic base uses Harvey semi-roughing guidance, not an all-operation/all-polymer prescription ([Harvey chart](https://harveyperformance.widen.net/content/hnlndl2mif/pdf/SF_852000.pdf)). Generic metal/soft curves remain approximate starting curves.\n\n";
text += table(["Diameter (in)", "Metal IPT", "Soft IPT", "Plastic IPT", "Drill IPR"], [0.0625,0.125,0.25,0.5,0.75,1].map((d) => [d, ...["metal","soft","plastic","drill"].map((c) => M.baseChipLoad(d,c))]));
text += "\n## Current tool-type modifiers\n\nGeneric modifiers below are application estimates, not universal substrate/coating/geometry limits. Dedicated geometry may replace/modify them at runtime. No generic positive coating boost is applied above the coated baseline.\n\n";
text += table(["Tool", "Nominal speed multiplier", "Chip multiplier", "DOC multiplier"], M.TOOL_TYPES.map((t) => [t.name, t.sfmMult, t.chipMult, t.docMult]));
text += "\n## Current operation definitions\n\nThe speed/chip multipliers are application starting-policy estimates, not independently certified operation-specific chart limits. Runtime ceilings, geometry, power and compatibility still apply.\n\n";
text += table(["Operation", "Mode", "Finish?", "Speed factor", "Chip factor"], M.OPERATIONS.map((o) => [o.name, o.docMode, o.finishing ? "yes" : "no", o.sfmMult, o.chipMult]));
text += "\n## Stored coated-carbide turning windows\n\nThese are app reference rows based on the secondary catalog compilation and material-family mapping described above, not a fresh audit of every original catalog page ([MetronQ](https://metronq.com/en/cutting-parameters-calculator)). Material/grade/operation and application-policy adjustments still apply.\n\n";
text += table(["Family", "Rough SFM", "Finish SFM", "Rough IPR", "Finish IPR"], Object.values(M.TURNING_ROWS).map((r) => [r.name, r.rough?.join("–"), r.finish?.join("–"), r.fRough?.join("–"), r.fFinish?.join("–")]));
text += "\n## Formula checks you can reproduce\n\n";
const E = M.calculate({toolTypeId:"end_mill",toolMaterialId:"carbide",coatingId:"altin",diameter:0.5,loc:1,flutes:4,materialId:"alum_6061",operationId:"facing_rough",aggressiveness:0.6,priority:"finish",machine:{hp:10,maxRpm:12000,minRpm:60,maxIpm:400}});
text += `A 0.500 in four-flute carbide rough-facing example on 6061 (finish objective, 60% slider, 10 HP, 12,000 RPM and 400 IPM machine limits) returns ${E.rpm} RPM, ${E.sfm} actual SFM, ${E.ipm} IPM, ${E.programmedFpt || E.chipLoad} programmed IPT, ${E.doc} in DOC, ${E.woc} in WOC, radial stock ${E.stockPlan.radial} in and axial stock ${E.stockPlan.axial} in. This is an app example, not an endorsed cut for an unidentified tool.\n\n`;
text += "For the corner example in the report, √2 × 0.010 + (√2 − 1) × (0.375 − 0.150) = 0.107340187 in. This is calculated geometric bisector stock, not a measured chip thickness or shop result.\n";
await writeFile(path, text);
console.log(path);
