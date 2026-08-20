import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TOOL_TYPES, TOOL_MATERIALS, COATINGS } from "@/lib/cncData";
import { UNITS, lenFromImp, lenToImp } from "@/lib/units";

export default function ToolForm({ value, onChange, units = "imperial" }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const u = UNITS[units];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tool Type</Label>
          <Select value={value.toolTypeId} onValueChange={(v) => set("toolTypeId", v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{TOOL_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tool Material</Label>
          <Select value={value.toolMaterialId} onValueChange={(v) => set("toolMaterialId", v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{TOOL_MATERIALS.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Diameter ({u.length})</Label>
          <Input type="number" step="0.001" min="0" value={lenFromImp(value.diameter, units)} onChange={(e) => set("diameter", lenToImp(parseFloat(e.target.value), units))} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Flutes</Label>
          <Input type="number" step="1" min="1" max="12" value={value.flutes} onChange={(e) => set("flutes", parseInt(e.target.value || "1"))} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">LOC ({u.length})</Label>
          <Input type="number" step="0.01" min="0" value={lenFromImp(value.loc, units)} onChange={(e) => set("loc", lenToImp(parseFloat(e.target.value), units))} className="h-9" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Coating</Label>
        <Select value={value.coatingId} onValueChange={(v) => set("coatingId", v)}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{COATINGS.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}