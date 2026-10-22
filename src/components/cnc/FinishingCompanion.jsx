import React from "react";
import { lenFromImp, feedFromImp, surfaceFromImp, UNITS } from "@/lib/units";

const fmt = (n, p = 3) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: p });

export default function FinishingCompanion({ plan, units = "imperial" }) {
  if (!plan) return null;
  const u = UNITS[units];
  const len = (n) => `${fmt(lenFromImp(n, units), units === "metric" ? 4 : 6)} ${u.length}`;
  return (
    <section data-testid="finishing-companion" className="rounded-lg border border-brand/40 bg-card p-3 space-y-3 min-w-0 text-xs leading-relaxed break-words">
      <h3 className="font-semibold">Linked finishing recommendations</h3>
      <p className="text-muted-foreground">Separate from roughing. Finish each surface from the allowance above, leaving zero on that finished surface. Estimated parameters, not a CAM program or cutting guarantee.</p>
      {plan.steps.map((step, i) => {
        const r = step.result;
        const turning = !!r.kind;
        const conditional = !!step.notes?.length;
        return (
          <div key={i} data-testid={`finish-step-${i}`} className="rounded-md border border-border p-3 space-y-2 min-w-0">
            <h4 className="font-semibold">{step.label}</h4>
            <p className={r.runnable === false || conditional ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}>
              {r.runnable === false ? "Review required: not a runnable recommendation." : conditional ? "Conditional reference: verify the geometry and engagement in CAM." : "Starting recommendation: verify the tool and prove out the setup."}
            </p>
            <p>Incoming: {step.incoming.radial > 0 ? `${len(step.incoming.radial)} radial per side` : step.incoming.axial > 0 ? `${len(step.incoming.axial)} axial` : `${len(step.incoming.normal)} normal to surface`}.</p>
            {step.diameter && <p>Cutter Ø: {len(step.diameter)}</p>}
            {turning && step.label !== "Face finish" && <p>Start Ø {len(step.workDiameter)} → finish Ø {len(step.finishDiameter)}</p>}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {[
                ["Objective", ({ finish: "Surface quality", life: "Tool life", balanced: "Balanced", speed: "Productivity" })[r.priority] || r.priority],
                ["Spindle", `${fmt(r.rpm, 0)} RPM`],
                ["Table feed", `${fmt(feedFromImp(r.ipm, units))} ${u.feed}`],
                ["Surface speed", `${fmt(surfaceFromImp(r.sfm, units), 1)} ${u.surface}`],
                [turning ? "Feed / revolution" : "Programmed feed / tooth", `${len(turning ? r.feedIpr : r.programmedFpt)} / ${turning ? "rev" : "tooth"}`],
                ...(!turning ? [["Radial engagement", len(r.woc)]] : []),
                [turning && r.kind !== "face" ? "Radial DOC / pass" : "Axial DOC / pass", len(r.doc)],
                ["Depth levels", fmt(turning ? r.passes?.finishPasses || 1 : r.passes || 1, 0)],
                ["Stock to leave", len(0)],
              ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono break-words">{value}</dd></div>)}
            </dl>
            {[...(r.blockingReasons || []), ...(step.notes || [])].map((note, n) => <p key={n} className="text-amber-700 dark:text-amber-300">{note}</p>)}
            {r.corner && <p className="text-muted-foreground">Inside-corner feed: {r.corner.cornerFeedIpm == null ? "withheld; resolve corner stock/strategy first" : `${fmt(feedFromImp(r.corner.cornerFeedIpm, units))} ${u.feed} (${fmt(r.corner.feedPercent, 1)}% of straight feed)`}. Geometry correction{r.corner.feedMode === "cap" ? " plus your feed cap" : ""}; verify transitions and actual engagement in CAM.</p>}
            <details>
              <summary data-testid={`finish-reasoning-${i}`} className="cursor-pointer py-2 font-semibold">Finish reasoning and cautions</summary>
              <div className="space-y-2 pt-2">
                <p>The incoming allowance sets this finish cut's engagement, not the roughing stepover. RPM, feed and power are recalculated for the finishing operation; depth levels split the reserved stock when cutting-length or power limits require it.</p>
                {(r.reasoning || []).map((row, n) => <p key={n}><span className="font-semibold">{row.label}: </span>{row.text}</p>)}
                {[...(r.warnings || []), ...(r.estimates || [])].map((note, n) => <p key={n} className="text-muted-foreground">{note}</p>)}
              </div>
            </details>
          </div>
        );
      })}
      {plan.steps.length === 0 ? (
        <div role="status" className="space-y-2">{plan.assumptions.map((note, i) => <p key={i}>{note}</p>)}</div>
      ) : <details>
        <summary data-testid="finish-assumptions" className="cursor-pointer py-2 font-semibold">Finish-plan assumptions</summary>
        <div className="space-y-2 pt-2">{plan.assumptions.map((note, i) => <p key={i} className="text-muted-foreground">{note}</p>)}</div>
      </details>}
    </section>
  );
}
