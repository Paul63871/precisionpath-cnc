import React from "react";
import { Label } from "@/components/ui/label";
import { UNITS, feedFromImp, feedToImp, powerFromImp, powerToImp } from "@/lib/units";
import NumberField from "@/components/NumberField";
import ResponsiveSelect from "@/components/cnc/ResponsiveSelect";

export default function MachineForm({ value, onChange, units = "imperial", profiles = [], onLoadProfile }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const u = UNITS[units];
  return (
    <div className="space-y-4">
      {profiles.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Load Profile</Label>
          <ResponsiveSelect
            value=""
            onValueChange={(id) => {
              const p = profiles.find((x) => x.id === id);
              if (p) onLoadProfile(p);
            }}
            placeholder="Select a saved machine…"
            options={profiles.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Spindle ({u.power})</Label>
          <NumberField value={powerFromImp(value.hp, units)} onValueChange={(n) => set("hp", powerToImp(n, units))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Max Feed ({u.feed})</Label>
          <NumberField value={feedFromImp(value.maxIpm, units)} onValueChange={(n) => set("maxIpm", feedToImp(n, units))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Max RPM</Label>
          <NumberField value={value.maxRpm} onValueChange={(n) => set("maxRpm", n)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Min RPM</Label>
          <NumberField value={value.minRpm} onValueChange={(n) => set("minRpm", n)} />
        </div>
      </div>
    </div>
  );
}