import React from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import referenceText from "./referenceText";
import ToolIcon from "@/components/cnc/ToolIcon";
import { TOOL_TYPES, TAP_STYLES } from "@/lib/cncData";
import { INSERT_SHAPES, BORING_BARS, TURNING_OPERATIONS } from "@/lib/turningData";

function GalleryGroup({ title, items }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {items.map((it) => (
          <div key={it.key} className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-3 text-center">
            <ToolIcon kind={it.kind} id={it.id} className="w-16 h-16" title={it.name} />
            <span className="text-xs leading-tight break-words">{it.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolGallery() {
  const turnOps = [];
  const seen = new Set();
  TURNING_OPERATIONS.forEach((o) => { if (!seen.has(o.kind)) { seen.add(o.kind); turnOps.push(o); } });
  const opLabel = { od: "OD turning", face: "Facing", id: "Boring / ID", drill: "Drilling on lathe", groove: "Grooving", parting: "Parting off", thread: "Threading" };
  return (
    <div className="mb-4 space-y-4 rounded-lg border border-border bg-muted/20 p-3 sm:p-4 print:hidden">
      <h2 className="text-sm font-semibold">Tool gallery</h2>
      <GalleryGroup title="Milling and hole-making tools" items={TOOL_TYPES.map((t) => ({ key: t.id, kind: "tool", id: t.id, name: t.name }))} />
      <GalleryGroup title="Tap styles" items={TAP_STYLES.map((t) => ({ key: t.id, kind: "tap", id: t.id, name: t.name }))} />
      <GalleryGroup title="Turning insert shapes" items={INSERT_SHAPES.map((t) => ({ key: t.id, kind: "insert", id: t.id, name: t.name }))} />
      <GalleryGroup title="Boring bars" items={BORING_BARS.map((t) => ({ key: t.id, kind: "bar", id: t.id, name: t.name }))} />
      <GalleryGroup title="Turning operations" items={turnOps.map((o) => ({ key: o.kind, kind: "turnop", id: o.kind, name: opLabel[o.kind] || o.name }))} />
    </div>
  );
}

export default function Reference() {
  const downloadTxt = () => {
    const blob = new Blob([referenceText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "PrecisionPath_CNC_Reference.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto min-w-0 overflow-x-hidden">
      <div className="flex gap-2 mb-4 print:hidden">
        <Button onClick={downloadTxt} size="sm"><Download className="w-4 h-4 mr-2" />Download .txt</Button>
        <Button onClick={() => window.print()} variant="outline" size="sm"><Printer className="w-4 h-4 mr-2" />Print / Save as PDF</Button>
      </div>
      <ToolGallery />
      <pre className="whitespace-pre-wrap [overflow-wrap:anywhere] text-[11px] leading-relaxed font-mono bg-card border rounded-lg p-4">
{referenceText}
      </pre>
    </div>
  );
}