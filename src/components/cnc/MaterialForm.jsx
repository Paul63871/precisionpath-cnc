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

// Legacy operations (e.g. the old full-width "bore") stay resolvable for saved
// calculations but are hidden from the picker unless currently selected.
const buildOpOptions = (currentId) => OP_GROUPS.flatMap((g) =>
  OPERATIONS.filter((o) => o.category === g.category && (!o.legacy || o.id === currentId)).map((o) => ({
    value: o.id,
    label: o.name,
    group: g.label,
  }))
);

export default function MaterialForm({ materials, materialId, operationId, onChange }) {
  const opOptions = React.useMemo(() => buildOpOptions(operationId), [operationId]);
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