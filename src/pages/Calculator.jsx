import React, { useState, useMemo } from "react";
import { Cpu, Sliders, Wrench, Boxes, Cog, Sparkles } from "lucide-react";
import ToolForm from "@/components/cnc/ToolForm";
import MaterialForm from "@/components/cnc/MaterialForm";
import MachineForm from "@/components/cnc/MachineForm";
import ResultsPanel from "@/components/cnc/ResultsPanel";
import BrandLookup from "@/components/cnc/BrandLookup";
import { calculate } from "@/lib/cncEngine";
import { PART_MATERIALS } from "@/lib/cncData";

function Section({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-amber-600" />
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function Calculator() {
  const [tool, setTool] = useState({
    toolTypeId: "end_mill", toolMaterialId: "carbide", coatingId: "altin",
    diameter: 0.25, flutes: 3, loc: 0.75,
  });
  const [materialId, setMaterialId] = useState("alum_6061");
  const [operationId, setOperationId] = useState("slotting");
  const [machine, setMachine] = useState({ hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 });
  const [aggressiveness, setAggressiveness] = useState(0.6);
  const [override, setOverride] = useState(null);

  const result = useMemo(() => {
    if (!tool.diameter || tool.diameter <= 0) return null;
    return calculate({
      diameter: tool.diameter, flutes: tool.flutes, loc: tool.loc,
      toolMaterialId: tool.toolMaterialId, coatingId: tool.coatingId,
      toolTypeId: tool.toolTypeId, materialId, operationId, aggressiveness,
      machine,
    });
  }, [tool, materialId, operationId, aggressiveness, machine]);

  // NOTE: override (from brand lookup) is informational; the engine computes from
  // tool/material class. A future enhancement can feed override SFM/chipLoad directly.
  const materialName = PART_MATERIALS.find((m) => m.id === materialId)?.name || "";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Feeds &amp; Speeds Studio</h1>
              <p className="text-xs text-muted-foreground">Conservative, physics-based CNC parameters for any tool and material.</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-5">
          {/* Inputs */}
          <div className="lg:col-span-3 space-y-5">
            <Section icon={Wrench} title="Tool">
              <ToolForm value={tool} onChange={setTool} />
            </Section>
            <Section icon={Boxes} title="Material & Operation">
              <MaterialForm
                materialId={materialId} operationId={operationId}
                onChange={(v) => {
                  if (v.materialId) setMaterialId(v.materialId);
                  if (v.operationId) setOperationId(v.operationId);
                }}
              />
            </Section>
            <Section icon={Cog} title="Machine">
              <MachineForm value={machine} onChange={setMachine} />
            </Section>
            <Section icon={Sparkles} title="Brand / Model Lookup (optional)">
              <BrandLookup materialName={materialName} onApply={setOverride} />
            </Section>
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-8 space-y-5">
              <Section icon={Sliders} title="Aggressiveness">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Conservative</span>
                    <span className="font-mono text-amber-600">{Math.round(aggressiveness * 100)}%</span>
                    <span className="text-muted-foreground">Aggressive</span>
                  </div>
                  <input
                    type="range" min="0" max="1" step="0.05" value={aggressiveness}
                    onChange={(e) => setAggressiveness(parseFloat(e.target.value))}
                    className="w-full accent-amber-600"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Default 60% gives slightly conservative, reliable rates. Push higher only with rigid setups and good chip evacuation.
                  </p>
                </div>
              </Section>

              <Section icon={Cpu} title="Recommended Parameters">
                {result ? <ResultsPanel result={result} /> : (
                  <p className="text-sm text-muted-foreground">Enter a valid tool diameter to see results.</p>
                )}
              </Section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}