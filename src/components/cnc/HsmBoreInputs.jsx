import React from "react";
import NumberField from "@/components/NumberField";
import ResponsiveSelect from "./ResponsiveSelect";
import { UNITS, lenFromImp, lenToImp } from "@/lib/units";

const checks = [
  ["toolApproved", "HSMWorks library tool diameter/flutes/LOC match. Exact cutter approved for helical boring in this material/coolant; ramp limit checked against its catalog."],
  ["geometryVerified", "Both proposed operations verified: internal straight vertical bore, selected face, top/bottom heights, actual stock, holder/reach, lead/rapid clearances and simulation."],
  ["postVerified", "Post/control verified: G94, correct units, centerline feed corrected only once; axis speed/acceleration limits checked."],
  ["passesVerified", "HSMWorks simulation matches proposed number/stepover for rough and linked finish; no cutting orbit is smaller than its preview. Icon field tooltips checked."],
];

export default function HsmBoreInputs({ adaptive, setAdaptive, units, verifyKey }) {
  const h = adaptive.hsmBore || {};
  const setH = (key, value) => setAdaptive(a => ({ ...a, hsmBore: { ...a.hsmBore, [key]: value } }));
  const dimensional = (key, label) => <label className="space-y-1.5 block text-xs text-muted-foreground" key={key}>
    <span>{label} ({UNITS[units].length})</span>
    <NumberField id={`hsm-${key}`} data-testid={`hsm-${key}`} className="h-10" allowClear placeholder="Required"
      value={Number.isFinite(adaptive[key]) ? lenFromImp(adaptive[key], units) : undefined}
      onValueChange={n => setAdaptive(a => ({ ...a, [key]: n === undefined ? undefined : lenToImp(n, units) }))} />
  </label>;
  return <fieldset data-testid="hsm-bore-inputs" className="rounded-lg border border-brand/30 p-3 space-y-3 min-w-0">
    <legend className="px-1 font-semibold text-xs">HSMWorks Bore setup</legend>
    <p className="text-xs text-muted-foreground">Matches your Bore screenshots, not Adaptive. Pitch is descent per bore orbit. DOC, Optimal Load and a separate entry-helix diameter are not fields to paste into this operation.</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {dimensional("featureDiameter", "Finished bore diameter")}
      {dimensional("featureDepth", "Bore depth (hole top to bottom)")}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Actual starting stock</label>
        <ResponsiveSelect value={h.stockState || "unknown"} onValueChange={v => setH("stockState", v)} options={[
          { value: "unknown", label: "Not confirmed" }, { value: "solid", label: "Solid material" }, { value: "pilot", label: "Measured existing hole" },
        ]} />
      </div>
      {h.stockState === "pilot" && dimensional("pilotDiameter", "Actual existing hole diameter")}
      <label className="space-y-1.5 block text-xs text-muted-foreground">
        <span>Exact-tool maximum helical ramp angle (degrees)</span>
        <NumberField id="hsm-max-ramp-angle" data-testid="hsm-max-ramp-angle" className="h-10" allowClear placeholder="From exact-tool catalog" value={h.maxRampAngle} onValueChange={n => setH("maxRampAngle", n)} />
      </label>
      <label className="space-y-1.5 block text-xs text-muted-foreground">
        <span>Pitch override (optional, {UNITS[units].length} per bore orbit)</span>
        <NumberField id="hsm-pitch" data-testid="hsm-pitch" className="h-10" allowClear placeholder="Auto, never above model/tool limit"
          value={Number.isFinite(h.pitchOverride) ? lenFromImp(h.pitchOverride, units) : undefined}
          onValueChange={n => setH("pitchOverride", n === undefined ? undefined : lenToImp(n, units))} />
      </label>
    </div>
    <p className="text-xs text-muted-foreground">Confirmations reset when physical inputs change. They record your review, not an automatic post/toolpath/machine test. Do not guess an angle or clearances to unlock outputs.</p>
    {checks.map(([key, text]) => <label key={key} className="flex items-start gap-2 text-xs leading-relaxed">
      <input data-testid={`hsm-check-${key}`} type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
        checked={h.verifiedFor === verifyKey && h[key] === true}
        onChange={e => setAdaptive(a => ({ ...a, hsmBore: {
          ...a.hsmBore,
          ...(a.hsmBore?.verifiedFor !== verifyKey ? Object.fromEntries(checks.map(([k]) => [k, false])) : {}),
          verifiedFor: verifyKey, [key]: e.target.checked,
        } }))} />
      <span>{text}</span>
    </label>)}
  </fieldset>;
}
