import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function MachineForm({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Spindle HP</Label>
        <Input type="number" step="0.1" min="0.1" value={value.hp}
          onChange={(e) => set("hp", parseFloat(e.target.value))} className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Max Feed (IPM)</Label>
        <Input type="number" step="1" min="1" value={value.maxIpm}
          onChange={(e) => set("maxIpm", parseFloat(e.target.value))} className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Max RPM</Label>
        <Input type="number" step="100" min="100" value={value.maxRpm}
          onChange={(e) => set("maxRpm", parseFloat(e.target.value))} className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Min RPM</Label>
        <Input type="number" step="100" min="0" value={value.minRpm}
          onChange={(e) => set("minRpm", parseFloat(e.target.value))} className="h-9" />
      </div>
    </div>
  );
}