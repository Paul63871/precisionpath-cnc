import React, { useId } from "react";
import { ClipboardList } from "lucide-react";
import { UNITS, lenFromImp } from "@/lib/units";

export function reviewLength(value, units) {
  if (!Number.isFinite(value) || value <= 0) return "Not entered";
  return `${new Intl.NumberFormat("en-US", { useGrouping: false, maximumSignificantDigits: 8 }).format(lenFromImp(value, units))} ${UNITS[units].length}`;
}

function jumpToInput(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start" });
}

export default function ResultsInputReview({ toolFields, setupFields, toolTarget, setupTarget }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mb-4 rounded-lg border border-border bg-muted/30 p-3">
      <h3 id={headingId} className="flex items-center gap-2 text-sm font-semibold">
        <ClipboardList aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
        Verify inputs before using results
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Match these settings to the actual cutter, stock, and CAM operation. This summary does not verify the setup for you.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {[{ label: "Edit tool inputs", fields: toolFields, target: toolTarget },
          { label: "Edit stock material & operation", fields: setupFields, target: setupTarget }].map(({ label, fields, target }) => (
          <div key={target} className="min-w-0 rounded-md border border-border bg-card px-3 py-2">
            <dl className="space-y-2 text-xs">
              {fields.map(([name, value]) => (
                <div key={name}>
                  <dt className="text-muted-foreground">{name}</dt>
                  <dd className="break-words font-medium">{value ?? "Not confirmed"}</dd>
                </div>
              ))}
            </dl>
            <button type="button" onClick={() => jumpToInput(target)}
              className="mt-1 min-h-10 text-left text-xs font-semibold text-foreground underline decoration-muted-foreground underline-offset-4 hover:decoration-current">
              {label}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
