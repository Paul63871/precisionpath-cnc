import React from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Upload, Bookmark } from "lucide-react";
import { useEntityList } from "@/lib/useEntityList";
import { Button } from "@/components/ui/button";
import { PART_MATERIALS, OPERATIONS, TOOL_TYPES } from "@/lib/cncData";
import PullToRefresh from "@/components/PullToRefresh";

export default function SavedCalculations() {
  const { items, loading, remove, reload } = useEntityList("SavedCalculation");
  const navigate = useNavigate();

  const matName = (id) => PART_MATERIALS.find((m) => m.id === id)?.name || id;
  const opName = (id) => OPERATIONS.find((o) => o.id === id)?.name || id;
  const toolName = (id) => TOOL_TYPES.find((t) => t.id === id)?.name || id;

  return (
    <PullToRefresh onRefresh={reload}>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 select-none">
          <h1 className="text-2xl font-bold tracking-tight">Saved Calculations</h1>
          <p className="text-xs text-muted-foreground">Revisit settings for parts you machine often.</p>
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center select-none">
            <Bookmark className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No saved calculations yet. Save one from the calculator.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {items.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card shadow-card p-4 select-none">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm truncate">{c.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {toolName(c.tool_type_id)} · {matName(c.material_id)} · {opName(c.operation_id)}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {new Date(c.created_date).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {[["RPM", c.result_rpm], ["IPM", c.result_ipm], ["DOC", c.result_doc], ["HP", c.result_hp]].map(([l, v]) => (
                    <div key={l} className="rounded-md bg-muted px-1 py-1.5">
                      <div className="text-[10px] text-muted-foreground">{l}</div>
                      <div className="font-mono text-sm">{v ?? "—"}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="h-8 flex-1" onClick={() => navigate("/", { state: { savedCalc: c } })}>
                    <Upload className="w-3.5 h-3.5 mr-1.5" />Load
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 w-9 p-0" onClick={() => remove(c.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}