import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { UNITS, feedFromImp, feedToImp, powerFromImp, powerToImp } from "@/lib/units";

export default function MachineForm({ value, onChange, units = "imperial", profiles = [], onLoadProfile }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const u = UNITS[units];
  return (
    <div className="space-y-4">
      {profiles.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Load Profile</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value=""
            onChange={(e) => {
              const p = profiles.find((x) => x.id === e.target.value);
              if (p) onLoadProfile(p);
              e.target.value = "";
            }}
          >
            <option value="" disabled>Select a saved machine…</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Spindle ({u.power})</Label>
          <Input type="number" step="0.1" min="0.1" value={powerFromImp(value.hp, units)} onChange={(e) => set("hp", powerToImp(parseFloat(e.target.value), units))} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Max Feed ({u.feed})</Label>
          <Input type="number" step="1" min="1" value={feedFromImp(value.maxIpm, units)} onChange={(e) => set("maxIpm", feedToImp(parseFloat(e.target.value), units))} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Max RPM</Label>
          <Input type="number" step="100" min="100" value={value.maxRpm} onChange={(e) => set("maxRpm", parseFloat(e.target.value))} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Min RPM</Label>
          <Input type="number" step="100" min="0" value={value.minRpm} onChange={(e) => set("minRpm", parseFloat(e.target.value))} className="h-9" />
        </div>
      </div>
    </div>
  );
}