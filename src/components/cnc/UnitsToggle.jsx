import React from "react";
import { cn } from "@/lib/utils";

export default function UnitsToggle({ value, onChange }) {
  const opts = [{ id: "imperial", label: "Imperial" }, { id: "metric", label: "Metric" }];
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 select-none shrink-0">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md min-h-[36px] transition-colors",
            value === o.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}