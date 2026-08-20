import React from "react";
import { AlertTriangle, Gauge, Activity, Layers, Ruler, Zap, TrendingUp } from "lucide-react";

function Metric({ icon: Icon, label, value, unit, accent }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <div className={`mt-1 font-mono text-2xl tabular-nums ${accent || "text-foreground"}`}>
        {value}
        <span className="ml-1 text-sm text-muted-foreground font-sans">{unit}</span>
      </div>
    </div>
  );
}

export default function ResultsPanel({ result }) {
  if (!result) return null;
  const hpColor = result.hpUtilization > 100
    ? "text-destructive"
    : result.hpUtilization > 85 ? "text-amber-500" : "text-emerald-600";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Metric icon={Gauge} label="Spindle Speed" value={result.rpm.toLocaleString()} unit="RPM" accent="text-amber-600" />
        <Metric icon={Activity} label="Feed Rate" value={result.ipm.toLocaleString()} unit="IPM" accent="text-amber-600" />
        <Metric icon={Layers} label="Axial DOC" value={result.doc} unit="in" />
        <Metric icon={Ruler} label="Radial WOC" value={result.woc} unit="in" />
        <Metric icon={TrendingUp} label="Chip Load" value={result.chipLoad} unit="in/tooth" />
        <Metric icon={Zap} label="Power" value={`${result.hpRequired}`} unit={`/ ${result.hpAvailable} HP`} accent={hpColor} />
      </div>

      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Surface Speed</span>
          <span className="font-mono">{result.sfm} SFM</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Material Removal Rate</span>
          <span className="font-mono">{result.mrr} in³/min</span>
        </div>
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