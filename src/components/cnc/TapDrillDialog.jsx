import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drill } from "lucide-react";
import { THREAD_TABLE, tapDrillSize } from "@/lib/cncData";

// Tap drill size reference. Physics-based (Machinery's Handbook / ASME B1.1,
// 75% thread engagement — the standard machine-shop default), not a static
// lookup table, so it stays correct for every thread in THREAD_TABLE
// including any added later. See tapDrillSize() in cncData.js for the full
// formula derivation and sources.
export default function TapDrillDialog({ open, onOpenChange, currentThreadId, isForming }) {
  const currentThread = THREAD_TABLE.find((t) => t.id === currentThreadId);
  const currentResult = currentThread && currentThread.major ? tapDrillSize(currentThread, { isForming }) : null;

  const rows = THREAD_TABLE.filter((t) => t.major).map((t) => ({
    thread: t,
    cutting: tapDrillSize(t, { isForming: false }),
    forming: tapDrillSize(t, { isForming: true }),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Drill className="h-4 w-4 text-brand" />
            Tap Drill Size Reference
          </DialogTitle>
        </DialogHeader>

        {currentThread && currentResult && (
          <div className="rounded-lg border border-brand/30 bg-brand/5 px-4 py-3 space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Selected: {currentThread.name} {isForming ? "(Forming/Roll Tap)" : "(Cutting Tap)"}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-brand">{currentResult.display}</span>
              <span className="text-xs text-muted-foreground">
                drill — theoretical {currentResult.theoreticalDec.toFixed(4)}{currentResult.unit === "mm" ? "mm" : '"'}, 75% thread engagement
              </span>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground leading-relaxed">
          Cutting taps remove material, so they use the standard formula below. Forming/roll taps
          displace material instead of cutting it, so they need a larger starting hole for the same
          75% thread engagement — using a cutting-tap drill with a forming tap will overload the tap
          and can snap it.
        </p>

        <div className="rounded-md bg-muted px-3 py-2 font-mono text-[11px] leading-relaxed">
          Cutting (in): drill = major − 0.974 / TPI<br />
          Cutting (mm): drill = major − 0.974 × pitch<br />
          Forming (in): drill = major − 0.51 / TPI<br />
          Forming (mm): drill = major − 0.51 × pitch
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Thread</th>
                <th className="text-right px-3 py-2 font-semibold">Cutting Tap Drill</th>
                <th className="text-right px-3 py-2 font-semibold">Forming Tap Drill</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ thread, cutting, forming }) => (
                <tr key={thread.id} className={thread.id === currentThreadId ? "bg-brand/10" : ""}>
                  <td className="px-3 py-1.5">{thread.name}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{cutting ? cutting.display : "—"}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{forming ? forming.display : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
          75% thread engagement is the industry-standard target (Machinery's Handbook / ASME B1.1) —
          full 100% engagement adds negligible extra strength for dramatically higher tapping torque
          and tap-breakage risk. Imperial sizes are snapped to the nearest standard fractional, number
          (#1–#80), or letter (A–Z) drill; metric sizes to the nearest 0.1mm.
        </p>
      </DialogContent>
    </Dialog>
  );
}
