import React from "react";
import { Label } from "@/components/ui/label";
import { UNITS, feedFromImp, feedToImp, powerFromImp, powerToImp } from "@/lib/units";
import NumberField from "@/components/NumberField";

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
          <NumberField className="h-9" value={powerFromImp(value.hp, units)} onValueChange={(n) => set("hp", powerToImp(n, units))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Max Feed ({u.feed})</Label>
          <NumberField className="h-9" value={feedFromImp(value.maxIpm, units)} onValueChange={(n) => set("maxIpm", feedToImp(n, units))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Max RPM</Label>
          <NumberField className="h-9" value={value.maxRpm} onValueChange={(n) => set("maxRpm", n)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Min RPM</Label>
          <NumberField className="h-9" value={value.minRpm} onValueChange={(n) => set("minRpm", n)} />
        </div>
      </div>
    </div>
  );
}