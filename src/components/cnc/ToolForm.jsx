import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import ResponsiveSelect from "@/components/cnc/ResponsiveSelect";
import { TOOL_TYPES, TOOL_MATERIALS, COATINGS, FIELD_DEFS, THREAD_TABLE, TAP_STYLES, HOLE_TYPES, RADIUS_ENGAGEMENTS } from "@/lib/cncData";
import { UNITS, lenFromImp, lenToImp } from "@/lib/units";
import NumberField from "@/components/NumberField";
import TapDrillDialog from "@/components/cnc/TapDrillDialog";
import { Drill } from "lucide-react";
import ToolIcon from "@/components/cnc/ToolIcon";

const TOOL_BLURB = {
  end_mill: "Flat-bottom cutter for slotting, pockets and profiling.",
  ball_end: "Full-radius tip for 3D surfacing and fillets.",
  bull_nose: "Flat end with corner radius: stronger corners, smoother floors.",
  corner_round: "Form cutter that puts a radius on an outside edge.",
  concave_radius: "Large-radius profile that cuts concave fillets and coves.",
  round_insert: "Indexable round-insert cutter for copy milling and radius work.",
  roughing: "Serrated (corn-cob) flutes break chips for heavy roughing.",
  chamfer: "Angled V-bit for chamfers, deburring and engraving.",
  face_mill: "Indexable face mill for wide, flat surfaces.",
  drill: "Twist drill; feed is per revolution.",
  tap: "Cuts or forms internal threads; feed equals thread pitch.",
  slitting_saw: "Thin disc saw for deep slots and cut-off.",
  t_slot: "Neck and wide head to cut T-slots from an open slot.",
};

export default function ToolForm({ value, onChange, units = "imperial" }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const u = UNITS[units];
  const toolType = TOOL_TYPES.find((t) => t.id === value.toolTypeId) || TOOL_TYPES[0];
  const fields = toolType.fields || [];
  const coating = COATINGS.find((c) => c.id === value.coatingId);
  const isTap = !!toolType.isTap;
  const selectedThread = THREAD_TABLE.find((t) => t.id === value.threadId) || THREAD_TABLE[0];
  const [drillDialogOpen, setDrillDialogOpen] = useState(false);

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
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">{def.label}</Label>
            <button
              type="button"
              onClick={() => setDrillDialogOpen(true)}
              className="flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
              title="Show tap drill size for this thread"
            >
              <Drill className="h-3 w-3" /> Drill size
            </button>
          </div>
          <ResponsiveSelect
            value={value.threadId || "custom"}
            onValueChange={(v) => set("threadId", v)}
            options={THREAD_TABLE.map((t) => ({ value: t.id, label: t.name }))}
          />
        </div>
      );
    }
    if (def.kind === "holeType") {
      return (
        <div key={key} className="space-y-1.5 col-span-3">
          <Label className="text-xs text-muted-foreground">{def.label}</Label>
          <ResponsiveSelect
            value={value.holeType || "through"}
            onValueChange={(v) => {
              // Auto-suggest the matching tap style when the hole type changes,
              // so a spiral-point tap doesn't stay selected for a blind hole
              // by default — the user can still override it afterward.
              const current = TAP_STYLES.find((s) => s.id === value.tapStyle);
              const stillFits = current && current.holeFit.includes(v);
              const suggested = v === "blind" ? "spiral_flute" : "spiral_point";
              onChange({ ...value, holeType: v, tapStyle: stillFits ? value.tapStyle : suggested });
            }}
            options={HOLE_TYPES.map((h) => ({ value: h.id, label: h.name }))}
          />
        </div>
      );
    }
    if (def.kind === "radiusEngagement") {
      const list = RADIUS_ENGAGEMENTS[toolType.radiusKind] || [];
      if (!list.length) return null;
      const cur = list.find((e) => e.id === value.radiusEngagement) || list[0];
      return (
        <div key={key} className="space-y-1.5 col-span-3">
          <Label className="text-xs text-muted-foreground">{def.label}</Label>
          <ResponsiveSelect
            value={cur.id}
            onValueChange={(v) => set("radiusEngagement", v)}
            options={list.map((e) => ({ value: e.id, label: e.name }))}
          />
        </div>
      );
    }
    if (def.kind === "tapStyle") {
      const mismatch = value.holeType === "blind" && value.tapStyle === "spiral_point";
      return (
        <div key={key} className="space-y-1.5 col-span-3">
          <Label className="text-xs text-muted-foreground">{def.label}</Label>
          <ResponsiveSelect
            value={value.tapStyle || "spiral_point"}
            onValueChange={(v) => set("tapStyle", v)}
            options={TAP_STYLES.map((t) => ({ value: t.id, label: t.name, icon: <ToolIcon kind="tap" id={t.id} className="w-8 h-8" /> }))}
          />
          {mismatch && (
            <p className="text-xs text-destructive pt-0.5">Spiral point taps push chips forward — not for blind holes. Pick Spiral Flute or Forming/Roll instead.</p>
          )}
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
            showIconInTrigger={false}
            value={value.toolTypeId}
            onValueChange={(v) => {
              // Taps are only made in HSS / cobalt here; keep the tool material valid when switching.
              const nt = TOOL_TYPES.find((t) => t.id === v);
              const badTapMat = nt && nt.isTap && value.toolMaterialId !== "hss" && value.toolMaterialId !== "cobalt";
              onChange({ ...value, toolTypeId: v, ...(badTapMat ? { toolMaterialId: "hss" } : {}) });
            }}
            options={TOOL_TYPES.map((t) => ({ value: t.id, label: t.name, icon: <ToolIcon kind="tool" id={t.id} className="w-11 h-11" /> }))}
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
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <ToolIcon kind={isTap ? "tap" : "tool"} id={isTap ? (value.tapStyle || "spiral_point") : toolType.id} className="w-16 h-16" title={toolType.name} />
        <div className="min-w-0">
          <div className="text-sm font-medium leading-tight break-words">{toolType.name}</div>
          <div className="text-[11px] text-muted-foreground leading-snug">{TOOL_BLURB[toolType.id] || ""}</div>
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
      {isTap && (
        <TapDrillDialog
          open={drillDialogOpen}
          onOpenChange={setDrillDialogOpen}
          currentThreadId={value.threadId}
          isForming={value.tapStyle === "forming"}
        />
      )}
    </div>
  );
}