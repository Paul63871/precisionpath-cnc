import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Cpu, Sliders, Wrench, Boxes, Cog, Sparkles, Save, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ToolForm from "@/components/cnc/ToolForm";
import MaterialForm from "@/components/cnc/MaterialForm";
import MachineForm from "@/components/cnc/MachineForm";
import ResultsPanel from "@/components/cnc/ResultsPanel";
import BrandLookup from "@/components/cnc/BrandLookup";
import { calculate } from "@/lib/cncEngine";
import { PART_MATERIALS } from "@/lib/cncData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

function Section({ icon: Icon, title, children, action }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-amber-600" />
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function Calculator() {
  const location = useLocation();
  const [tool, setTool] = useState({ toolTypeId: "end_mill", toolMaterialId: "carbide", coatingId: "altin", diameter: 0.25, flutes: 3, loc: 0.75 });
  const [materialId, setMaterialId] = useState("alum_6061");
  const [operationId, setOperationId] = useState("slotting");
  const [machine, setMachine] = useState({ hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 });
  const [aggressiveness, setAggressiveness] = useState(0.6);
  const [units, setUnits] = useState("imperial");
  const [customMaterials, setCustomMaterials] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [override, setOverride] = useState(null);

  // Load preferences, custom materials, and machine profiles on mount.
  useEffect(() => {
    (async () => {
      try {
        const prefs = await base44.entities.UserPreference.list();
        if (prefs.length) {
          setAggressiveness(prefs[0].aggressiveness ?? 0.6);
          setUnits(prefs[0].units || "imperial");
        }
      } catch { /* no prefs yet */ }
      try { setCustomMaterials((await base44.entities.CustomMaterial.list()) || []); } catch {}
      try { setProfiles((await base44.entities.MachineProfile.list()) || []); } catch {}
    })();
  }, []);

  // Apply incoming navigation state (saved calc or machine profile).
  useEffect(() => {
    const st = location.state;
    if (!st) return;
    if (st.savedCalc) {
      const c = st.savedCalc;
      setTool({ toolTypeId: c.tool_type_id, toolMaterialId: c.tool_material_id, coatingId: c.coating_id, diameter: c.diameter, flutes: c.flutes, loc: c.loc });
      setMaterialId(c.material_id);
      setOperationId(c.operation_id);
      setMachine({ hp: c.machine_hp, maxRpm: c.machine_max_rpm, minRpm: c.machine_min_rpm, maxIpm: c.machine_max_ipm });
      setAggressiveness(c.aggressiveness);
    } else if (st.machineProfile) {
      const p = st.machineProfile;
      setMachine({ hp: p.hp, maxRpm: p.max_rpm, minRpm: p.min_rpm, maxIpm: p.max_ipm });
    }
  }, [location.state]);

  const combinedMaterials = useMemo(() => {
    const custom = customMaterials.map((m) => ({
      id: `custom_${m.id}`, name: m.name, category: m.category || "Custom",
      sfmRange: [m.sfm_min, m.sfm_max], chipLoadFactor: m.chip_load_factor,
      hpFactor: m.hp_factor, slotDepthFactor: m.slot_depth_factor, profileDepthFactor: m.profile_depth_factor, custom: true,
    }));
    return [...PART_MATERIALS, ...custom];
  }, [customMaterials]);

  const selectedMaterial = combinedMaterials.find((m) => m.id === materialId) || PART_MATERIALS[0];

  const result = useMemo(() => {
    if (!tool.diameter || tool.diameter <= 0) return null;
    return calculate({
      diameter: tool.diameter, flutes: tool.flutes, loc: tool.loc,
      toolMaterialId: tool.toolMaterialId, coatingId: tool.coatingId,
      toolTypeId: tool.toolTypeId, material: selectedMaterial, operationId, aggressiveness, machine, override,
    });
  }, [tool, selectedMaterial, operationId, aggressiveness, machine]);

  const saveCalc = async () => {
    setSaving(true);
    try {
      await base44.entities.SavedCalculation.create({
        name: saveName || `Calc ${new Date().toLocaleString()}`,
        tool_type_id: tool.toolTypeId, tool_material_id: tool.toolMaterialId, coating_id: tool.coatingId,
        diameter: tool.diameter, flutes: tool.flutes, loc: tool.loc,
        material_id: materialId, operation_id: operationId,
        machine_hp: machine.hp, machine_max_rpm: machine.maxRpm, machine_min_rpm: machine.minRpm, machine_max_ipm: machine.maxIpm,
        aggressiveness,
        result_rpm: result?.rpm, result_ipm: result?.ipm, result_doc: result?.doc,
        result_woc: result?.woc, result_chip_load: result?.chipLoad, result_mrr: result?.mrr, result_hp: result?.hpRequired,
      });
      setSaveOpen(false);
      setSaveName("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Calculator</h1>
        <p className="text-xs text-muted-foreground">Conservative, physics-based CNC parameters for any tool and material.</p>
      </div>
      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-5">
          <Section icon={Wrench} title="Tool"><ToolForm value={tool} onChange={setTool} units={units} /></Section>
          <Section icon={Boxes} title="Material & Operation">
            <MaterialForm
              materials={combinedMaterials} materialId={materialId} operationId={operationId}
              onChange={(v) => { if (v.materialId) setMaterialId(v.materialId); if (v.operationId) setOperationId(v.operationId); }}
            />
          </Section>
          <Section icon={Cog} title="Machine">
            <MachineForm
              value={machine} onChange={setMachine} units={units} profiles={profiles}
              onLoadProfile={(p) => setMachine({ hp: p.hp, maxRpm: p.max_rpm, minRpm: p.min_rpm, maxIpm: p.max_ipm })}
            />
          </Section>
          <Section icon={Sparkles} title="Brand / Model Lookup (optional)">
            <BrandLookup materialName={selectedMaterial.name} onApply={(v) => setOverride(v)} />
          </Section>
        </div>
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-20 space-y-5">
            <Section icon={Sliders} title="Aggressiveness">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Conservative</span>
                  <span className="font-mono text-amber-600">{Math.round(aggressiveness * 100)}%</span>
                  <span className="text-muted-foreground">Aggressive</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={aggressiveness} onChange={(e) => setAggressiveness(parseFloat(e.target.value))} className="w-full accent-amber-600" />
                <p className="text-[11px] text-muted-foreground">Default 60% gives slightly conservative, reliable rates.</p>
              </div>
            </Section>
            <Section
              icon={Cpu}
              title="Recommended Parameters"
              action={result && (
                <Button size="sm" variant="outline" className="h-8" onClick={() => setSaveOpen(true)}>
                  <Save className="w-3.5 h-3.5 mr-1.5" />Save
                </Button>
              )}
            >
              {override && (
                <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <span>Using manufacturer values: {override.sfm} SFM · {override.chipLoad}"/tooth</span>
                  <button onClick={() => setOverride(null)} className="font-medium underline whitespace-nowrap">Clear</button>
                </div>
              )}
              {result ? <ResultsPanel result={result} units={units} /> : <p className="text-sm text-muted-foreground">Enter a valid tool diameter to see results.</p>}
            </Section>
          </div>
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Save Calculation</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g. 6061 bracket roughing" className="h-9" />
          </div>
          <DialogFooter>
            <Button onClick={saveCalc} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}