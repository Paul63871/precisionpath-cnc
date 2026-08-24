import React from "react";
import { Label } from "@/components/ui/label";
import ResponsiveSelect from "@/components/cnc/ResponsiveSelect";
import { TOOL_TYPES, TOOL_MATERIALS, COATINGS, FIELD_DEFS, THREAD_TABLE, TAP_STYLES } from "@/lib/cncData";
import { UNITS, lenFromImp, lenToImp } from "@/lib/units";
import NumberField from "@/components/NumberField";

export default function ToolForm({ value, onChange, units = "imperial" }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const u = UNITS[units];
  const toolType = TOOL_TYPES.find((t) => t.id === value.toolTypeId) || TOOL_TYPES[0];
  const fields = toolType.fields || [];
  const coating = COATINGS.find((c) => c.id === value.coatingId);
  const isTap = !!toolType.isTap;
  const selectedThread = THREAD_TABLE.find((t) => t.id === value.threadId) || THREAD_TABLE[0];

  const renderField = (key) => {
    const def = FIELD_DEFS[key];
    if (!def) return null;
    const raw = value[key] ?? (def.kind === "int" ? 2 : 0);
    if (def.kind === "length") {
      return (
        <div key={key} className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{def.label} ({u.length})</Label>
          <NumberField value={lenFromImp(raw, units)} onValueChange={(n) => set(key, lenToImp(n, units))} />
        </div>
      );
    }
    if (def.kind === "angle") {
      return (
        <div key={key} className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{def.label} (°)</Label>
          <NumberField value={raw} onValueChange={(n) => set(key, n)} />
        </div>
      );
    }
    if (def.kind === "thread") {
      return (
        <div key={key} className="space-y-1.5 col-span-3">
          <Label className="text-xs text-muted-foreground">{def.label}</Label>
          <ResponsiveSelect
            value={value.threadId || "custom"}
            onValueChange={(v) => set("threadId", v)}
            options={THREAD_TABLE.map((t) => ({ value: t.id, label: t.name }))}
          />
        </div>
      );
    }
    if (def.kind === "tapStyle") {
      return (
        <div key={key} className="space-y-1.5 col-span-3">
          <Label className="text-xs text-muted-foreground">{def.label}</Label>
          <ResponsiveSelect
            value={value.tapStyle || "spiral_point"}
            onValueChange={(v) => set("tapStyle", v)}
            options={TAP_STYLES.map((t) => ({ value: t.id, label: t.name }))}
          />
        </div>
      );
    }
    return (
      <div key={key} className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{def.label}</Label>
        <NumberField value={raw} onValueChange={(n) => set(key, Math.max(def.min, Math.round(n)))} />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tool Type</Label>
          <ResponsiveSelect
            value={value.toolTypeId}
            onValueChange={(v) => set("toolTypeId", v)}
            options={TOOL_TYPES.map((t) => ({ value: t.id, label: t.name }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tool Material</Label>
          <ResponsiveSelect
            value={value.toolMaterialId}
            onValueChange={(v) => set("toolMaterialId", v)}
            options={(isTap ? TOOL_MATERIALS.filter((t) => t.id === "hss" || t.id === "cobalt") : TOOL_MATERIALS).map((t) => ({ value: t.id, label: t.name }))}
          />
        </div>
      </div>
      {isTap ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Major Ø ({u.length})</Label>
            <NumberField
              disabled={value.threadId !== "custom"}
              value={lenFromImp(selectedThread.major != null ? selectedThread.major : value.diameter, units)}
              onValueChange={(n) => set("diameter", lenToImp(n, units))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Pitch (in/rev) {value.threadId !== "custom" ? "— auto" : ""}</Label>
            <NumberField
              disabled={value.threadId !== "custom"}
              step={0.001}
              value={selectedThread.pitch != null ? Number(selectedThread.pitch.toFixed(5)) : (value.pitch || 0)}
              onValueChange={(n) => set("pitch", n)}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Diameter ({u.length})</Label>
          <NumberField value={lenFromImp(value.diameter, units)} onValueChange={(n) => set("diameter", lenToImp(n, units))} />
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        {fields.map(renderField)}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Coating</Label>
        <ResponsiveSelect
          value={value.coatingId}
          onValueChange={(v) => set("coatingId", v)}
          options={COATINGS.map((c) => ({ value: c.id, label: c.name }))}
        />
        {coating && coating.verified === false && (
          <p className="text-xs text-muted-foreground/80 pt-0.5">
            No published manufacturer speed chart exists for this coating — the speed multiplier is an engineering estimate.
          </p>
        )}
      </div>
    </div>
  );
}