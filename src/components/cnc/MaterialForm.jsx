import React from "react";
import { Label } from "@/components/ui/label";
import ResponsiveSelect from "@/components/cnc/ResponsiveSelect";
import { OPERATIONS } from "@/lib/cncData";
import MaterialSearch from "@/components/cnc/MaterialSearch";

const OP_GROUPS = [
  { category: "2D", label: "2D / 2.5-Axis" },
  { category: "3D", label: "3D / HSM" },
  { category: "Multi-Axis", label: "Multi-Axis & Special" },
];

const opOptions = OP_GROUPS.flatMap((g) =>
  OPERATIONS.filter((o) => o.category === g.category).map((o) => ({
    value: o.id,
    label: o.name,
    group: g.label,
  }))
);

export default function MaterialForm({ materials, materialId, operationId, onChange }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Part Material</Label>
        <MaterialSearch materials={materials} value={materialId} onChange={(id) => onChange({ materialId: id })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Operation</Label>
        <ResponsiveSelect
          value={operationId}
          onValueChange={(v) => onChange({ operationId: v })}
          options={opOptions}
        />
      </div>
    </div>
  );
}