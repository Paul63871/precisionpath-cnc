import React from "react";
import { AlertTriangle, Gauge, Activity, Layers, Ruler, Zap, TrendingUp } from "lucide-react";
import { UNITS, lenFromImp, feedFromImp, surfaceFromImp, powerFromImp, mrrFromImp } from "@/lib/units";

function Metric({ icon: Icon, label, value, unit, accent }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <div className={`mt-1 font-mono text-2xl tabular-nums ${accent || "text-foreground"}`}>
        {value}<span className="ml-1 text-sm text-muted-foreground font-sans">{unit}</span>
      </div>
    </div>
  );
}

export default function ResultsPanel({ result, units = "imperial" }) {
  if (!result) return null;
  const u = UNITS[units];
  const fmt = (v, d = 2) => Number(v).toFixed(d);
  const hpColor = result.hpUtilization > 100 ? "text-destructive" : result.hpUtilization > 85 ? "text-amber-500" : "text-emerald-600";
  const power = powerFromImp(result.hpRequired, units);
  const powerAvail = powerFromImp(result.hpAvailable, units);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Metric icon={Gauge} label="Spindle Speed" value={result.rpm.toLocaleString()} unit="RPM" accent="text-amber-600" />
        <Metric icon={Activity} label="Feed Rate" value={feedFromImp(result.ipm, units).toLocaleString(undefined, { maximumFractionDigits: 1 })} unit={u.feed} accent="text-amber-600" />
        <Metric icon={Layers} label="Axial DOC" value={fmt(lenFromImp(result.doc, units), 2)} unit={u.length} />
        <Metric icon={Ruler} label="Radial WOC" value={fmt(lenFromImp(result.woc, units), 3)} unit={u.length} />
        <Metric icon={TrendingUp} label="Chip Load" value={fmt(lenFromImp(result.chipLoad, units), 4)} unit={`${u.length}/tooth`} />
        <Metric icon={Zap} label="Power" value={fmt(power, 2)} unit={`/ ${fmt(powerAvail, 1)} ${u.power}`} accent={hpColor} />
      </div>
      {result.adaptive && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          The <span className="font-medium">Radial WOC</span> above is your <span className="font-medium">Optimal Load</span> (max stepover) — enter it in HSMWorks → Passes → Optimal Load.
        </div>
      )}
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Surface Speed</span><span className="font-mono">{fmt(surfaceFromImp(result.sfm, units), 1)} {u.surface}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Material Removal Rate</span><span className="font-mono">{fmt(mrrFromImp(result.mrr, units), 1)} {u.mrr}</span>
        </div>
        {result.passes != null && (
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Axial Passes</span><span className="font-mono">{result.passes} × {fmt(lenFromImp(result.stepdown, units), 3)} {u.length}/pass</span>
          </div>
        )}
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Power Utilization</span>
            <span className={`font-mono ${hpColor}`}>{result.hpUtilization}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${result.hpUtilization > 100 ? "bg-destructive" : result.hpUtilization > 85 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(100, result.hpUtilization)}%` }}
            />
          </div>
        </div>
      </div>
      {result.warnings.length > 0 && (
        <div className="space-y-2">
          {result.warnings.map((w, i) => (
            <div key={i} className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}