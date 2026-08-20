import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OPERATIONS } from "@/lib/cncData";
import MaterialSearch from "@/components/cnc/MaterialSearch";

export default function MaterialForm({ materials, materialId, operationId, onChange }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Part Material</Label>
        <MaterialSearch materials={materials} value={materialId} onChange={(id) => onChange({ materialId: id })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Operation</Label>
        <Select value={operationId} onValueChange={(v) => onChange({ operationId: v })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{OPERATIONS.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}