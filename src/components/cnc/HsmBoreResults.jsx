import React, { useState } from "react";
import { UNITS, lenFromImp, feedFromImp, surfaceFromImp } from "@/lib/units";

const clean = n => Number.isFinite(n) && n >= 0 ? n : null;
const fixedDown = (n, decimals = 6) => Number.isFinite(n) && n >= 0 ? String(Math.floor((n + 1e-12) * 10 ** decimals) / 10 ** decimals) : "—";

export default function HsmBoreResults({ result, units = "imperial", companion = false }) {
  const [copied, setCopied] = useState("");
  const plan = result.hsmBore, u = UNITS[units];
  if (!plan) return null;
  const len = n => Number.isFinite(n) && n >= 0 ? `${fixedDown(lenFromImp(n, units), 10)} ${u.length}` : "—";
  const feed = n => `${fixedDown(feedFromImp(n, units))} ${u.feed}`;
  const f = plan.fields;
  const rows = f ? [
    ["Tool", "Spindle speed", `${f.spindleSpeed} RPM`],
    ["Tool", "Surface speed (derived; do not enter independently)", `${fixedDown(surfaceFromImp(f.surfaceSpeed, units), 3)} ${u.surface}`],
    ["Tool", "Ramp spindle speed", `${f.rampSpindleSpeed} RPM`],
    ["Tool", "Cutting feedrate", feed(f.cuttingFeedrate)],
    ["Tool", "Feed per tooth (derived from Cutting feedrate)", `${len(f.feedPerTooth)} / tooth`],
    ["Tool", "Lead-in feedrate", feed(f.leadInFeedrate)],
    ["Tool", "Lead-out feedrate", feed(f.leadOutFeedrate)],
    ["Tool", "Ramp feedrate", feed(f.rampFeedrate)],
    ["Tool", "Plunge feedrate (air / cleared hole ONLY)", feed(f.plungeFeedrate)],
    ["Tool", "Feed per revolution (derived from PLUNGE feed)", `${len(f.plungeFeedPerRev)} / spindle rev`],
    ["Passes", "Pitch (top icon field, above Multiple passes)", `${len(f.pitch)} / bore orbit`],
    ["Passes", "Multiple passes", f.multiplePasses ? "On" : "Off"],
    ...(f.multiplePasses ? [
      ["Passes", "Number of stepovers (first field under Multiple passes)", String(f.numberOfStepovers)],
      ["Passes", "Stepover (next length field)", len(f.stepover)],
    ] : []),
    ["Passes", "Finishing passes", plan.finishing ? "Off; this is the final-size operation" : "Off; use the separate linked finish operation"],
    ["Passes", "Compensation type", f.compensationType],
    ["Passes", "Direction", f.direction],
    ["Passes", "Repeat passes", "Off"],
    ["Passes", "Stock to Leave", f.stockToLeave ? "On" : "Off"],
    ["Passes", "Radial Stock to Leave (per side)", len(f.radialStockToLeave)],
  ] : [];
  const context = `Tool Ø ${len(plan.setup.toolDiameter)}, ${plan.setup.flutes} flutes, LOC ${len(plan.setup.loc)}. ${plan.setup.material}. Target bore Ø ${len(plan.setup.holeDiameter)}, depth ${len(plan.setup.depth)}. Start: ${plan.solid ? "SOLID" : `existing hole Ø ${len(plan.setup.pilotDiameter)}`}.`;
  const text = `HSMWorks Bore ${plan.finishing ? "FINISH" : "ROUGH"} | ${units}\n${context}\n${rows.map(r => `${r[0]} > ${r[1]}: ${r[2]}`).join("\n")}\nCoolant: use verified exact-tool/material policy; not inferred.\nHeights and Linking: retain verified geometry-dependent settings; simulate and check posted code before machining.`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied("Setup sheet copied. Recheck units, CAM simulation and posted code."); }
    catch { setCopied("Clipboard unavailable. Expand the text sheet below to select and copy it."); }
  };
  return <section data-testid={companion ? "hsm-bore-finish-sheet" : "hsm-bore-sheet"} className="rounded-lg border border-brand/40 bg-card p-4 space-y-3 min-w-0 text-xs leading-relaxed">
    <h3 className="font-semibold">{companion ? "Linked finishing Bore" : "HSMWorks Bore field-by-field setup"}</h3>
    <p className="font-semibold">Units: {units === "metric" ? "Metric (mm)" : "Imperial (inches)"}</p>
    <p>{context}</p>
    <p className="text-muted-foreground">{plan.ready ? "Reviewed starting worksheet, not machine approval. Exact-tool limits and controlled prove-out still apply." : "NOT READY: entry fields are withheld until the setup and checks below are resolved."}</p>
    {!!plan.cautions?.length && <div className="space-y-2 text-amber-700 dark:text-amber-300">{plan.cautions.map((n, i) => <p key={i}>{n}</p>)}</div>}
    {!plan.ready && <ul className="space-y-2 text-destructive">{plan.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
    <div className="rounded-md border border-border p-3 space-y-1.5">
      <h4 className="font-semibold">Geometry preview for verification</h4>
      <p>Cutting diameter after stock: {len(plan.cutDiameter)}.</p>
      <p>Proposed radial cuts: {clean(plan.radialPasses) ?? "—"}. Radial increment: {len(plan.stepover)}.</p>
      <p>Minimum tool-center orbit Ø: {len(plan.minPathDiameter)}. Maximum pitch allowed by this model: {len(plan.maxPitch)} / orbit.</p>
      {Number.isFinite(plan.workholding?.requiredClampForce) && <p>Conservative grip-force estimate: {Math.ceil(plan.workholding.requiredClampForce)} lbf. {plan.workholding.usableClampForce ? "Compared against entered clamp force; jaw strength/contact geometry still need verification." : "No clamp rating entered: grip capacity is not numerically verified."}</p>}
      <p className="text-muted-foreground">Verify the actual CAM minimum orbit and pass count. The same pitch must satisfy the smallest radius, not just the finished bore.</p>
    </div>
    {plan.ready && <div data-testid="hsm-bore-field-rows" className="space-y-3">
      {["Tool", "Passes"].map(tab => <div key={tab}>
        <h4 className="font-semibold mb-2">{tab} tab</h4>
        <dl className="space-y-2">{rows.filter(r => r[0] === tab).map((r, i) => <div key={i} className="border-b border-border/50 pb-2 min-w-0">
          <dt className="text-muted-foreground">{r[1]}</dt><dd className="font-mono break-words">{r[2]}</dd>
        </div>)}</dl>
      </div>)}
      <p>Estimated worst-pass power: {fixedDown(plan.hpRequired, 3)} HP / {fixedDown(plan.hpBudget, 3)} HP policy budget. This is a unit-power estimate, not instantaneous force simulation.</p>
    </div>}
    <button type="button" data-testid={companion ? "hsm-copy-finish" : "hsm-copy"} disabled={!plan.ready} onClick={copy}
      className="rounded-md bg-emerald-700 hover:bg-emerald-800 px-3 py-2 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed">Copy reviewed setup sheet</button>
    {copied && <p role="status">{copied}</p>}
    {plan.ready && <details><summary className="cursor-pointer py-2">Text setup sheet</summary><pre className="whitespace-pre-wrap break-words rounded bg-muted p-3 font-mono text-xs">{text}</pre></details>}
    <details><summary className="cursor-pointer py-2 font-semibold">How to enter it without mixing up fields</summary>
      <div className="space-y-2 pt-2">{plan.notes.map((n, i) => <p key={i} className="text-muted-foreground">{n}</p>)}</div>
    </details>
    <p className="text-muted-foreground"><a data-testid="hsm-bore-help" className="underline" href={plan.source} target="_blank" rel="noreferrer">Autodesk HSM Bore reference</a>. Field positions also match your screenshots; tooltips and simulation must confirm your installed version.</p>
    {!companion && result.companionFinish?.steps.map((step, i) => step.result.hsmBore ? <HsmBoreResults key={i} result={step.result} units={units} companion /> : null)}
  </section>;
}
