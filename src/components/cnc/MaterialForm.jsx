import React, { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OPERATIONS } from "@/lib/cncData";

export default function MaterialForm({ materials, materialId, operationId, onChange }) {
  const categories = useMemo(() => {
    const map = {};
    materials.forEach((m) => { (map[m.category] = map[m.category] || []).push(m); });
    return map;
  }, [materials]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Part Material</Label>
        <Select value={materialId} onValueChange={(v) => onChange({ materialId: v })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(categories).map(([cat, mats]) => (
              <div key={cat}>
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{cat}</div>
                {mats.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}{m.custom ? " ✓" : ""}</SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
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