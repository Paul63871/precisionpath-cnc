import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Cpu, Sliders, Wrench, Boxes, Cog, Sparkles, Save, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ToolForm from "@/components/cnc/ToolForm";
import MaterialForm from "@/components/cnc/MaterialForm";
import MachineForm from "@/components/cnc/MachineForm";
import ResultsPanel from "@/components/cnc/ResultsPanel";
import BrandLookup from "@/components/cnc/BrandLookup";
import UnitsToggle from "@/components/cnc/UnitsToggle";
import { calculate } from "@/lib/cncEngine";
import { PART_MATERIALS, TOOL_TYPES, OPERATIONS } from "@/lib/cncData";
import { UNITS, lenFromImp, lenToImp } from "@/lib/units";
import NumberField from "@/components/NumberField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const DEFAULT_TOOL = { toolTypeId: "end_mill", toolMaterialId: "carbide", coatingId: "altin", diameter: 0.25, flutes: 3, loc: 0.75, inserts: 4, cornerRadius: 0.03, includedAngle: 90, tipDiameter: 0, leadAngle: 45, pointAngle: 118, thickness: 0.0625, neckDiameter: 0 };

function Section({ icon: Icon, title, children, action, highlight }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      {highlight && <div className="h-1 bg-brand" />}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Icon className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          </div>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Calculator() {
  const location = useLocation();
  const [tool, setTool] = useState(DEFAULT_TOOL);
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
  const [adaptive, setAdaptive] = useState({ radialLoad: 0, axialDoc: 0, featureDepth: 0, fineStepup: 0 });
  const [prefId, setPrefId] = useState(null);

  // Load preferences, custom materials, and machine profiles on mount.
  useEffect(() => {
    (async () => {
      try {
        const prefs = await base44.entities.UserPreference.list();
        if (prefs.length) {
          setPrefId(prefs[0].id);
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
      setTool({ ...DEFAULT_TOOL, ...(c.tool_data || { toolTypeId: c.tool_type_id, toolMaterialId: c.tool_material_id, coatingId: c.coating_id, diameter: c.diameter, flutes: c.flutes, loc: c.loc }) });
      setMaterialId(c.material_id);
      setOperationId(c.operation_id);
      setMachine({ hp: c.machine_hp, maxRpm: c.machine_max_rpm, minRpm: c.machine_min_rpm, maxIpm: c.machine_max_ipm });
      setAggressiveness(c.aggressiveness);
    } else if (st.machineProfile) {
      const p = st.machineProfile;
      setMachine({ hp: p.hp, maxRpm: p.max_rpm, minRpm: p.min_rpm, maxIpm: p.max_ipm });
    }
  }, [location.state]);

  const changeUnits = async (u) => {
    if (u === units) return;
    setUnits(u);
    try {
      if (prefId) await base44.entities.UserPreference.update(prefId, { units: u });
      else { const r = await base44.entities.UserPreference.create({ units: u, aggressiveness }); setPrefId(r.id); }
    } catch { /* offline/unauth — local state still updates */ }
  };

  const combinedMaterials = useMemo(() => {
    const custom = customMaterials.map((m) => ({
      id: `custom_${m.id}`, name: m.name, category: m.category || "Custom",
      sfmRange: [m.sfm_min, m.sfm_max], chipLoadFactor: m.chip_load_factor,
      hpFactor: m.hp_factor, slotDepthFactor: m.slot_depth_factor, profileDepthFactor: m.profile_depth_factor, custom: true,
    }));
    return [...PART_MATERIALS, ...custom];
  }, [customMaterials]);

  const selectedMaterial = combinedMaterials.find((m) => m.id === materialId) || PART_MATERIALS[0];
  const selectedOp = OPERATIONS.find((o) => o.id === operationId);

  const result = useMemo(() => {
    if (!tool.diameter || tool.diameter <= 0) return null;
    const tt = TOOL_TYPES.find((t) => t.id === tool.toolTypeId);
    const feedCount = tool[tt?.countField] || tool.flutes || 2;
    return calculate({
      diameter: tool.diameter, flutes: feedCount, loc: tool.loc,
      toolMaterialId: tool.toolMaterialId, coatingId: tool.coatingId,
      toolTypeId: tool.toolTypeId, material: selectedMaterial, operationId, aggressiveness, machine, override,
      leadAngle: tool.leadAngle, cornerRadius: tool.cornerRadius, includedAngle: tool.includedAngle,
      tipDiameter: tool.tipDiameter, thickness: tool.thickness, neckDiameter: tool.neckDiameter, pointAngle: tool.pointAngle,
      radialLoad: adaptive.radialLoad, axialDoc: adaptive.axialDoc, featureDepth: adaptive.featureDepth,
    });
  }, [tool, selectedMaterial, operationId, aggressiveness, machine, override, adaptive]);

  const saveCalc = async () => {
    setSaving(true);
    try {
      await base44.entities.SavedCalculation.create({
        name: saveName || `Calc ${new Date().toLocaleString()}`,
        tool_data: tool,
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
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calculator</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Physics-based feeds &amp; speeds for any tool and material.</p>
        </div>
        <UnitsToggle value={units} onChange={changeUnits} />
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
          {operationId !== "drilling" && (
            <Section icon={Sliders} title="Path Engagement">
              <p className="text-[11px] text-muted-foreground mb-3">Enter the feature depth, Optimal Load (max radial stepover), and axial step-down from your CAM's Passes tab. Leave blank to auto-calculate. These load settings apply to both roughing and finishing adaptive paths.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Feature Depth ({UNITS[units].length})</Label>
                  <NumberField className="h-9" allowClear placeholder="Auto" value={adaptive.featureDepth || undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, featureDepth: n || 0 }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Axial DOC / pass ({UNITS[units].length})</Label>
                  <NumberField className="h-9" allowClear placeholder="Auto" value={adaptive.axialDoc || undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, axialDoc: n || 0 }))} />
                </div>
                {selectedOp?.adaptive && (
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs text-muted-foreground">Optimal Load — max stepover ({UNITS[units].length})</Label>
                    <NumberField className="h-9" allowClear placeholder="Auto" value={adaptive.radialLoad || undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, radialLoad: n || 0 }))} />
                    {result && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Set <span className="font-medium text-foreground">HSMWorks → Passes → Optimal Load</span> to{" "}
                        <span className="font-mono text-foreground">{lenFromImp(result.woc, units).toFixed(3)} {UNITS[units].length}</span>
                        {" "}({result.radialEngagementPct}% of Ø).
                        {result.radialThinningFactor > 1 && (
                          <> Radial chip thinning raises feed <span className="font-mono text-brand">{result.radialThinningFactor}×</span> to hold chip thickness — enter that feed in the toolpath.</>
                        )}
                      </p>
                    )}
                  </div>
                )}
                {selectedOp?.fineStepup && (
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs text-muted-foreground">Fine Stepup ({UNITS[units].length})</Label>
                    <NumberField className="h-9" allowClear placeholder="Auto" value={adaptive.fineStepup || undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, fineStepup: n || 0 }))} />
                    {result && (() => {
                      const base = adaptive.axialDoc > 0 ? adaptive.axialDoc : result.doc;
                      const rec = lenFromImp(base * 0.125, units);
                      return (
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          3D Adaptive only — shaves the stair-steps left on angled walls after the deep rough. Set <span className="font-medium text-foreground">Passes → Fine Stepup</span> to ~10–15% of max stepdown (≈ <span className="font-mono text-foreground">{rec.toFixed(3)} {UNITS[units].length}</span>).
                        </p>
                      );
                    })()}
                  </div>
                )}
              </div>
            </Section>
          )}
          {operationId === "drilling" && (
            <Section icon={Sliders} title="Hole">
              <p className="text-[11px] text-muted-foreground mb-3">Enter the total hole depth. The calculator generates a peck-drilling cycle (G83, full retract) for holes deeper than 3× diameter, scaled to the tool, material, and depth.</p>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Hole Depth ({UNITS[units].length})</Label>
                <NumberField className="h-9" allowClear placeholder="Auto (3×D)" value={adaptive.featureDepth || undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, featureDepth: n || 0 }))} />
              </div>
            </Section>
          )}
          <Section icon={Cog} title="Machine">
            <MachineForm
              value={machine} onChange={setMachine} units={units} profiles={profiles}
              onLoadProfile={(p) => setMachine({ hp: p.hp, maxRpm: p.max_rpm, minRpm: p.min_rpm, maxIpm: p.max_ipm })}
            />
          </Section>
          <Section icon={Sparkles} title="Brand / Model Lookup (optional)">
            <BrandLookup materialName={selectedMaterial.name} materialId={selectedMaterial.id} onApply={(v) => setOverride(v)} />
          </Section>
        </div>
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-20 space-y-5">
            <Section icon={Sliders} title="Aggressiveness">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Conservative</span>
                  <span className="font-mono text-brand font-semibold">{Math.round(aggressiveness * 100)}%</span>
                  <span className="text-muted-foreground">Aggressive</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={aggressiveness} onChange={(e) => setAggressiveness(parseFloat(e.target.value))} className="w-full accent-brand" />
                <p className="text-[11px] text-muted-foreground">Default 60% gives slightly conservative, reliable rates.</p>
              </div>
            </Section>
            <Section
              icon={Cpu}
              title="Recommended Parameters"
              highlight
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