import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TOOL_TYPES, TOOL_MATERIALS, COATINGS, FIELD_DEFS } from "@/lib/cncData";
import { UNITS, lenFromImp, lenToImp } from "@/lib/units";
import NumberField from "@/components/NumberField";

export default function ToolForm({ value, onChange, units = "imperial" }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const u = UNITS[units];
  const toolType = TOOL_TYPES.find((t) => t.id === value.toolTypeId) || TOOL_TYPES[0];
  const fields = toolType.fields || [];

  const renderField = (key) => {
    const def = FIELD_DEFS[key];
    if (!def) return null;
    const raw = value[key] ?? (def.kind === "int" ? 2 : 0);
    if (def.kind === "length") {
      return (
        <div key={key} className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{def.label} ({u.length})</Label>
          <NumberField className="h-9" value={lenFromImp(raw, units)} onValueChange={(n) => set(key, lenToImp(n, units))} />
        </div>
      );
    }
    if (def.kind === "angle") {
      return (
        <div key={key} className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{def.label} (°)</Label>
          <NumberField className="h-9" value={raw} onValueChange={(n) => set(key, n)} />
        </div>
      );
    }
    return (
      <div key={key} className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{def.label}</Label>
        <NumberField className="h-9" value={raw} onValueChange={(n) => set(key, Math.max(def.min, Math.round(n)))} />
      </div>
    );
  };

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
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Diameter ({u.length})</Label>
        <NumberField className="h-9" value={lenFromImp(value.diameter, units)} onValueChange={(n) => set("diameter", lenToImp(n, units))} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {fields.map(renderField)}
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