import React from "react";
import { lenFromImp, feedFromImp, UNITS } from "@/lib/units";
import FinishingCompanion from "./FinishingCompanion";
const fmt = (n, places = 3) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: places });

export default function ProcessExplanation({ result, units = "imperial" }) {
  if (!result) return null;
  const u = UNITS[units];
  const len = (x) => `${fmt(lenFromImp(x || 0, units), units === "metric" ? 3 : 5)} ${u.length}`;
  const stock = result.stockPlan;
  const corner = result.corner;
  return (
    <div className="space-y-3 min-w-0">
      <p className="text-[11px] leading-relaxed text-muted-foreground">Generic starting recommendation, not exact-tool validation. Confirm catalog limits and prove out the setup; no slider setting guarantees against breakage.</p>
      {result.runnable === false && (
        <div role="alert" className="rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-3 text-xs space-y-1">
          <p className="font-semibold">Setup needs correction. These numbers are not a runnable recommendation.</p>
          {(result.blockingReasons || []).map((s, i) => <p key={i}>{s}</p>)}
        </div>
      )}
      {stock && (
        <section className="rounded-lg border border-border bg-card p-3 space-y-2">
          <h3 className="text-xs font-semibold">Operation stock to leave {stock.estimate ? "(estimate)" : ""}</h3>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between gap-3"><dt>Radial, per side</dt><dd className="font-mono">{len(stock.radial)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Axial, floor / face</dt><dd className="font-mono">{len(stock.axial)}</dd></div>
            {!!stock.normal && <div className="flex justify-between gap-3"><dt>Normal to 3D surface</dt><dd className="font-mono">{len(stock.normal)}</dd></div>}
          </dl>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{stock.reason}</p>
          {stock.estimate && <p className="text-[11px] text-muted-foreground">Starting allowance only. Incoming stock is separate from stock to leave. Confirm finish-tool engagement, tolerance and roughing error.</p>}
        </section>
      )}
      {corner && (
        <section className="rounded-lg border border-amber-400/50 bg-amber-500/5 p-3 space-y-2">
          <h3 className="text-xs font-semibold">Prior-tool corner stock: planar estimate</h3>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between gap-3"><dt>Straight-wall stock</dt><dd className="font-mono">{len(corner.straightStock)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Corner stock, bisector</dt><dd className="font-mono">{len(corner.cornerStock)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Planned radial pass</dt><dd className="font-mono">{len(corner.nominalWoc)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Straight-wall feed</dt><dd className="font-mono">{fmt(feedFromImp(corner.straightFeedIpm, units), 2)} {u.feed}</dd></div>
            {corner.cornerFeedIpm != null && <div className="flex justify-between gap-3"><dt>Inside-arc centerline feed</dt><dd data-testid="corner-feed-output" className="font-mono">{fmt(feedFromImp(corner.cornerFeedIpm, units), 2)} {u.feed} ({fmt(corner.feedPercent, 1)}%)</dd></div>}
          </dl>
          <p className="text-xs font-semibold">Feed strategy: {corner.feedMode === "cap" ? corner.userFeedCapPercent != null ? `radius correction, capped at ${fmt(corner.userFeedCapPercent, 1)}% of straight feed` : "radius correction; enter a valid feed cap" : corner.feedMode === "rest" ? "rest-clear / semi-finish first" : "automatic radius correction"}</p>
          {corner.feedBlockReason && <p className="text-xs">{corner.feedBlockReason}</p>}
          {corner.cornerFeedIpm == null && <p data-testid="corner-feed-withheld" className="text-xs font-semibold">No single-pass corner feed issued. Resolve the stock, geometry or strategy condition first.</p>}
          <p className="text-xs text-muted-foreground leading-relaxed">Automatic feed = straight-wall feed × (inside radius − cutter radius) / inside radius. A custom cap never raises this value. This is a centerline kinematic correction, not constant-engagement simulation or a guaranteed tool-protection limit. Use smooth CAM feed transitions and verify actual contact; very low feeds may rub.</p>
          <p className="text-xs leading-relaxed">{corner.reason}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{corner.is3D ? "3D: only a planar cross-section is modeled. " : ""}Assumes tangent walls, a circular corner and the prior cutter reaching both walls. Bisector stock is not a full engagement-angle calculation. Verify stock in CAM; a feed reduction alone cannot establish safety.</p>
        </section>
      )}
      <FinishingCompanion plan={result.companionFinish} units={units} />
      {!!result.reasoning?.length && (
        <details className="rounded-lg border border-border bg-card p-3">
          <summary className="cursor-pointer text-xs font-semibold min-h-[32px]">Why these recommendations?</summary>
          <p className="text-[10px] text-muted-foreground mb-3">Formula working below uses inches, SFM and IPM. Metrics and allowances above follow your selected units.</p>
          <div className="space-y-3">
            {result.reasoning.map((row, i) => (
              <div key={i} className="text-[11px] leading-relaxed break-words">
                <h4 className="font-semibold mb-0.5">{row.label}</h4>
                <p className="text-muted-foreground">{row.text}</p>
                {row.source && <a href={row.source} target="_blank" rel="noreferrer" className="text-brand underline">Read the method guidance</a>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
