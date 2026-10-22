import React, { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Cpu, Sliders, Wrench, Boxes, Cog, Sparkles, Save, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ToolForm from "@/components/cnc/ToolForm";
import MaterialForm from "@/components/cnc/MaterialForm";
import MachineForm from "@/components/cnc/MachineForm";
import ResultsPanel from "@/components/cnc/ResultsPanel";
import BrandLookup from "@/components/cnc/BrandLookup";
import ViseLookup from "@/components/cnc/ViseLookup";
import UnitsToggle from "@/components/cnc/UnitsToggle";
import { calculate } from "@/lib/cncEngine";
import { PART_MATERIALS, TOOL_TYPES, OPERATIONS, WORKHOLDING_JAW_TYPES } from "@/lib/cncData";
import { UNITS, lenFromImp, lenToImp } from "@/lib/units";
import NumberField from "@/components/NumberField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ResponsiveSelect from "@/components/cnc/ResponsiveSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const DEFAULT_TOOL = { toolTypeId: "end_mill", toolMaterialId: "carbide", coatingId: "altin", diameter: 0.25, flutes: 3, loc: 0.75, inserts: 4, cornerRadius: 0.03, insertIc: 0.5, radiusEngagement: "one_side", includedAngle: 90, tipDiameter: 0, leadAngle: 45, pointAngle: 118, thickness: 0.0625, neckDiameter: 0, threadId: "unc_1_4_20", tapStyle: "spiral_point", holeType: "through" };

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
  const navigate = useNavigate();
  const [tool, setTool] = useState(DEFAULT_TOOL);
  const [materialId, setMaterialId] = useState("alum_6061");
  const [operationId, setOperationId] = useState("slotting");
  const [machine, setMachine] = useState({ hp: 5, maxRpm: 10000, minRpm: 60, maxIpm: 200 });
  const [aggressiveness, setAggressiveness] = useState(0.6);
  // Optimize-for priority: "finish" (default) biases every strategy toward surface quality.
  const [priority, setPriorityState] = useState(() => {
    try { return localStorage.getItem("pp_priority") || "finish"; } catch { return "finish"; }
  });
  const setPriority = (p) => { setPriorityState(p); try { localStorage.setItem("pp_priority", p); } catch {} };
  const [units, setUnits] = useState("imperial");
  const [customMaterials, setCustomMaterials] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [override, setOverride] = useState(null);
  const [adaptive, setAdaptive] = useState({ radialLoad: 0, axialDoc: 0, featureDepth: 0, fineStepup: 0, gripDepth: 0, jawTypeId: "smooth_steel", clampForce: 0, featureDiameter: 0, pilotDiameter: 0, targetRa: 0, entryMethod: "", helixDiameter: 0 });
  const [showViseLookup, setShowViseLookup] = useState(false);
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
      if (c.tool_data?.processData?.adaptive) setAdaptive(c.tool_data.processData.adaptive);
      if (c.tool_data?.processData?.priority) setPriority(c.tool_data.processData.priority);
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
      leadAngle: tool.leadAngle, cornerRadius: tool.cornerRadius, insertIc: tool.insertIc, radiusEngagement: tool.radiusEngagement, includedAngle: tool.includedAngle,
      tipDiameter: tool.tipDiameter, thickness: tool.thickness, neckDiameter: tool.neckDiameter, pointAngle: tool.pointAngle,
      radialLoad: adaptive.radialLoad, axialDoc: adaptive.axialDoc, featureDepth: adaptive.featureDepth,
      threadId: tool.threadId, tapStyle: tool.tapStyle, pitch: tool.pitch, holeType: tool.holeType,
      gripDepth: adaptive.gripDepth,
      jawTypeId: adaptive.jawTypeId, clampForce: adaptive.clampForce,
      priority, featureDiameter: adaptive.featureDiameter, pilotDiameter: adaptive.pilotDiameter, targetRa: adaptive.targetRa, entryMethod: adaptive.entryMethod || undefined, helixDiameter: adaptive.helixDiameter,
      previousToolDiameter: adaptive.previousToolDiameter, previousStock: adaptive.previousStock,
      insideCornerRadius: adaptive.insideCornerRadius, cornerAngleDeg: adaptive.cornerAngleDeg,
      cornerFeedMode: adaptive.cornerFeedMode, cornerFeedPercent: adaptive.cornerFeedPercent,
      finishToolDiameter: adaptive.finishToolDiameter,
    });
  }, [tool, selectedMaterial, operationId, aggressiveness, machine, override, adaptive, priority]);

  const saveCalc = async () => {
    setSaving(true);
    try {
      await base44.entities.SavedCalculation.create({
        name: saveName || `Calc ${new Date().toLocaleString()}`,
        tool_data: { ...tool, processData: { adaptive, priority } },
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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <h1 className="text-2xl font-bold tracking-tight">Calculator</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Physics-based feeds &amp; speeds for any tool and material.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={() => navigate("/speeds-feeds-assistant")}>
            <Sparkles className="w-4 h-4 mr-1.5 text-brand" />Guided
          </Button>
          <UnitsToggle value={units} onChange={changeUnits} />
        </div>
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
          {operationId !== "drilling" && operationId !== "tapping" && (
            <Section icon={Sliders} title="Path Engagement">
              <p className="text-[11px] text-muted-foreground mb-3">Enter the feature depth, Optimal Load (max radial stepover), and axial step-down from your CAM's Passes tab. Leave blank to auto-calculate. These load settings apply to both roughing and finishing adaptive paths.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Feature Depth ({UNITS[units].length})</Label>
                  <NumberField className="h-9" allowClear placeholder="Auto" value={adaptive.featureDepth ? lenFromImp(adaptive.featureDepth, units) : undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, featureDepth: n ? lenToImp(n, units) : 0 }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Axial DOC / pass ({UNITS[units].length})</Label>
                  <NumberField className="h-9" allowClear placeholder="Auto" value={adaptive.axialDoc ? lenFromImp(adaptive.axialDoc, units) : undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, axialDoc: n ? lenToImp(n, units) : 0 }))} />
                </div>
                {(selectedOp?.docMode === "profile" || selectedOp?.docMode === "hem" || selectedOp?.peripheralRough) && (
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs text-muted-foreground">Stock Height Gripped in Vise ({UNITS[units].length})</Label>
                    <NumberField className="h-9" allowClear placeholder="Auto (no check)" value={adaptive.gripDepth ? lenFromImp(adaptive.gripDepth, units) : undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, gripDepth: n ? lenToImp(n, units) : 0 }))} />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      How much of the RAW STOCK sits below the jaw line right now — measure the actual workpiece in the vise, not the finished part height. If your stock is taller than the finished part (common when machining features near the top), this is still just the gripped portion, e.g. 0.25" gripped out of 2.25" of stock is 0.25" here, even if the finished part will end up 2" tall. Leave blank to skip. The calculator warns when material above this line — the workpiece itself, not the tool — becomes the flexible cantilever during the cut.
                    </p>
                    {result?.overhang && result.overhang.severity !== "none" && (
                      <p className={`text-[11px] leading-relaxed font-medium ${result.overhang.severity === "high" ? "text-destructive" : "text-amber-600"}`}>
                        {result.overhang.unsupportedHeight} {UNITS[units].length} of this cut is unsupported above the grip ({result.overhang.ratio}× the grip depth).
                      </p>
                    )}
                  </div>
                )}
                {selectedOp?.circular && (
                  <div className="space-y-1.5 col-span-2 rounded-lg border border-brand/30 bg-brand/5 p-3">
                    <Label className="text-xs font-semibold text-foreground">
                      {selectedOp.circular === "external" ? "Boss (circular feature)" : selectedOp.circularKind === "pocket_rough" ? "Circular Pocket" : "Bore / Hole"}
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{selectedOp.circular === "external" ? "Boss" : selectedOp.circularKind === "pocket_rough" ? "Pocket" : "Finished bore"} Ø ({UNITS[units].length})</Label>
                        <NumberField className="h-9" allowClear placeholder="Required" value={adaptive.featureDiameter ? lenFromImp(adaptive.featureDiameter, units) : undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, featureDiameter: n ? lenToImp(n, units) : 0 }))} />
                      </div>
                      {selectedOp.circularKind === "bore_rough" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Pilot hole Ø ({UNITS[units].length})</Label>
                          <NumberField className="h-9" allowClear placeholder="None (solid)" value={adaptive.pilotDiameter ? lenFromImp(adaptive.pilotDiameter, units) : undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, pilotDiameter: n ? lenToImp(n, units) : 0 }))} />
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Needed for the circular-interpolation feed correction: the feed you program on a G2/G3 arc acts on the tool centerline, not the cutting edge.
                      {selectedOp.circularKind === "bore_rough" && " Leave the pilot blank to helix down from solid; enter it to size the ring passes."}
                    </p>
                  </div>
                )}
                {selectedOp && ["2d_pocket", "2d_adaptive_rough", "2d_circular_pocket", "2d_bore_rough", "bore", "slotting", "3d_pocket", "3d_adaptive_rough"].includes(selectedOp.id) && (
                  <div className="space-y-1.5 col-span-2 rounded-lg border border-border bg-muted/30 p-3">
                    <Label className="text-xs font-semibold text-foreground">Entry into stock</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">How the tool starts the cut</Label>
                        <ResponsiveSelect
                          className="h-9"
                          value={adaptive.entryMethod || "auto"}
                          onValueChange={(v) => setAdaptive((a) => ({ ...a, entryMethod: v === "auto" ? "" : v }))}
                          options={[
                            { value: "auto", label: selectedOp.id === "slotting" ? "Auto (linear ramp)" : "Auto (helical ramp)" },
                            { value: "helix", label: "Helical ramp (helix down)" },
                            { value: "ramp", label: "Linear ramp" },
                            { value: "plunge", label: "Plunge (center-cutting only)" },
                            { value: "predrilled", label: "Pre-drilled / side entry" },
                          ]}
                          placeholder="Entry method"
                        />
                      </div>
                      {(adaptive.entryMethod === "helix" || !adaptive.entryMethod) && selectedOp.id !== "slotting" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Helix hole Ø ({UNITS[units].length})</Label>
                          <NumberField className="h-9" allowClear placeholder="Auto (1.2× tool)" value={adaptive.helixDiameter ? lenFromImp(adaptive.helixDiameter, units) : undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, helixDiameter: n ? lenToImp(n, units) : 0 }))} />
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      When the same end mill starts the pocket, slot or bore, it is buried in solid: the ramp angle follows the material, the entry feed is cut to 50% of normal, and a helix feed is corrected to the tool centerline. Helix hole should be 1.2× the cutter or more.
                    </p>
                  </div>
                )}
                {selectedOp && (/contour|waterline/.test(selectedOp.id) || selectedOp.id === "3d_pocket") && (
                  <fieldset className="col-span-2 rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                    <legend className="text-xs font-semibold px-1">Previous roughing / inside corners</legend>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">All corner inputs are optional. Leave the inside radius blank or zero for straight/outside contours or when no inside-corner check is needed. A positive radius plus a previous cutter enables the planar corner-stock check. For 3D contours, verify the full geometry with the CAM stock model.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        ["previousToolDiameter", "Previous roughing tool Ø", "Optional"],
                        ["previousStock", "Previous radial stock left", "Enter actual CAM stock"],
                        ["insideCornerRadius", "Final inside corner radius (optional)", "Blank / 0 = no corner check"],
                      ].map(([key, title, placeholder]) => (
                        <div key={key} className="space-y-1.5">
                          <Label htmlFor={key} className="text-xs text-muted-foreground">{title} ({UNITS[units].length})</Label>
                          <NumberField id={key} className="h-10" allowClear placeholder={placeholder} value={adaptive[key] != null ? lenFromImp(adaptive[key], units) : undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, [key]: n == null ? undefined : lenToImp(n, units) }))} />
                        </div>
                      ))}
                      <div className="space-y-1.5">
                        <Label htmlFor="cornerAngleDeg" className="text-xs text-muted-foreground">Included wall angle (degrees)</Label>
                        <NumberField id="cornerAngleDeg" className="h-10" allowClear placeholder="90° default" value={adaptive.cornerAngleDeg} onValueChange={(n) => setAdaptive((a) => ({ ...a, cornerAngleDeg: n }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Inside-corner feed strategy</Label>
                        <ResponsiveSelect
                          value={adaptive.cornerFeedMode || "auto"}
                          onValueChange={(v) => setAdaptive((a) => ({ ...a, cornerFeedMode: v }))}
                          placeholder="Inside-corner feed strategy"
                          options={[
                            { value: "auto", label: "Automatic radius correction" },
                            { value: "cap", label: "Radius correction + feed cap" },
                            { value: "rest", label: "Rest-clear / semi-finish first" },
                          ]}
                        />
                      </div>
                      {adaptive.cornerFeedMode === "cap" && (
                        <div className="space-y-1.5">
                          <Label htmlFor="cornerFeedPercent" className="text-xs text-muted-foreground">Corner feed cap (% of straight feed)</Label>
                          <NumberField id="cornerFeedPercent" className="h-10" allowClear placeholder="Enter >0 to 100 percent" value={adaptive.cornerFeedPercent} onValueChange={(n) => setAdaptive((a) => ({ ...a, cornerFeedPercent: n }))} />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">Only applies when a positive inside radius and previous cutter are entered. Automatic mode corrects for the shorter tool-centerline arc; a custom cap can only lower that feed. Neither mode makes excess corner stock safe. Unknown stock or excess engagement withholds a corner feed; rest-clear and verify in CAM. Excessively low feed can rub/work-harden. Use CAM feed optimization and smooth entry/exit transitions, within the machine's acceleration and contour-control limits.</p>
                  </fieldset>
                )}
                {selectedOp && !selectedOp.finishing && !["drill", "tap"].includes(selectedOp.docMode) && (
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="finishToolDiameter" className="text-xs text-muted-foreground">Planned finishing cutter Ø ({UNITS[units].length})</Label>
                    <NumberField id="finishToolDiameter" className="h-10" allowClear placeholder="Optional; otherwise current tool is provisional" value={adaptive.finishToolDiameter ? lenFromImp(adaptive.finishToolDiameter, units) : undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, finishToolDiameter: n ? lenToImp(n, units) : undefined }))} />
                  </div>
                )}
                {selectedOp?.finishing && (
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs text-muted-foreground">Target surface finish Ra (µin)</Label>
                    <NumberField className="h-9" allowClear placeholder="32 µin (0.8 µm) default" value={adaptive.targetRa || undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, targetRa: n || 0 }))} />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">Drives the ball-nose scallop stepover and the maximum feed-per-tooth. 32 µin = 0.8 µm; 63 µin = 1.6 µm; 16 µin = 0.4 µm.</p>
                  </div>
                )}
                <div className="space-y-1.5 col-span-2 pt-2 border-t border-border/60">
                  <Label className="text-xs text-muted-foreground">Vise / Fixture Clamping</Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed -mt-1">
                    Checks whether the vise has enough grip to resist the cutting force itself — the part sliding or pulling out under load — for any operation, not just contour/adaptive paths. Independent of the grip-depth check above, which covers tipping/deflection.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Jaw Type</Label>
                      <ResponsiveSelect
                        className="h-9"
                        value={adaptive.jawTypeId || "smooth_steel"}
                        onValueChange={(v) => setAdaptive((a) => ({ ...a, jawTypeId: v }))}
                        options={WORKHOLDING_JAW_TYPES.map((j) => ({ value: j.id, label: j.name }))}
                        placeholder="Jaw type"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Vise Rated Clamp Force (lbf)</Label>
                      <NumberField className="h-9" allowClear placeholder="Optional" value={adaptive.clampForce || undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, clampForce: n || 0 }))} />
                    </div>
                  </div>
                  {result?.workholding && (
                    <p className={`text-[11px] leading-relaxed font-medium ${result.workholding.insufficient ? "text-destructive" : "text-muted-foreground"}`}>
                      Needs ~{Math.round(result.workholding.requiredClampForce)} lbf of clamping force ({Math.round(result.workholding.cuttingForce)} lbf cutting force × {result.workholding.safetyFactor}× safety ÷ {result.workholding.mu} friction){result.workholding.ratedClampForce ? (
                        result.workholding.forceDerate < 1.0
                          ? ` — vise rated for ${Math.round(result.workholding.ratedClampForce)} lbf, but this jaw material only delivers ~${Math.round(result.workholding.usableClampForce)} lbf (${Math.round(result.workholding.forceDerate * 100)}%) before it yields${result.workholding.insufficient ? ", not enough" : ", OK"}.`
                          : ` — vise rated for ${Math.round(result.workholding.ratedClampForce)} lbf${result.workholding.insufficient ? ", not enough" : ", OK"}.`
                      ) : ". Enter your vise's rating above to check it directly."}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowViseLookup((s) => !s)}
                    className="text-[11px] text-brand hover:underline font-medium pt-0.5"
                  >
                    {showViseLookup ? "Hide vise lookup" : "Don't know your vise's rating? Look it up by brand/model →"}
                  </button>
                  {showViseLookup && (
                    <div className="pt-2 border-t border-border/40">
                      <ViseLookup
                        onApply={(v) => setAdaptive((a) => ({ ...a, clampForce: v.clampForce, jawTypeId: v.jawTypeId || a.jawTypeId }))}
                      />
                    </div>
                  )}
                </div>
                {selectedOp?.adaptive && (
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs text-muted-foreground">Optimal Load — max stepover ({UNITS[units].length})</Label>
                    <NumberField className="h-9" allowClear placeholder="Auto" value={adaptive.radialLoad ? lenFromImp(adaptive.radialLoad, units) : undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, radialLoad: n ? lenToImp(n, units) : 0 }))} />
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
                    <NumberField className="h-9" allowClear placeholder="Auto" value={adaptive.fineStepup ? lenFromImp(adaptive.fineStepup, units) : undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, fineStepup: n ? lenToImp(n, units) : 0 }))} />
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
                <NumberField className="h-9" allowClear placeholder="Auto (3×D)" value={adaptive.featureDepth ? lenFromImp(adaptive.featureDepth, units) : undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, featureDepth: n ? lenToImp(n, units) : 0 }))} />
              </div>
            </Section>
          )}
          {operationId === "tapping" && (
            <Section icon={Sliders} title="Thread Depth">
              <p className="text-[11px] text-muted-foreground mb-3">Enter the full thread depth needed. Feed is locked to the thread pitch (F = RPM × pitch) — it is not adjustable by aggressiveness, which only affects spindle speed.</p>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Thread Depth ({UNITS[units].length})</Label>
                <NumberField className="h-9" allowClear placeholder="Auto (2×D)" value={adaptive.featureDepth ? lenFromImp(adaptive.featureDepth, units) : undefined} onValueChange={(n) => setAdaptive((a) => ({ ...a, featureDepth: n ? lenToImp(n, units) : 0 }))} />
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
            <Section icon={Sparkles} title="Optimize For">
              <div className="grid grid-cols-2 gap-1.5">
                {[["finish", "Finish quality"], ["life", "Tool life"], ["balanced", "Balanced"], ["speed", "Speed / MRR"]].map(([id, label]) => (
                  <button
                    key={id} type="button" onClick={() => setPriority(id)}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium min-h-[40px] ${priority === id ? "border-brand bg-brand text-white" : "border-border bg-card text-foreground hover:bg-accent"}`}
                  >{label}</button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                {priority === "finish" && "Biases chip load, engagement and geometric finish targets toward surface quality. Not a guarantee of actual Ra or tool life."}
                {priority === "life" && "Uses a lower position in the speed window and moderated loading. No prediction of tool-life hours; do not starve the edge into rubbing."}
                {priority === "balanced" && "General starting data with application headroom, not an exact-tool manufacturer match."}
                {priority === "speed" && "Higher productivity within the same speed, feed, length and power caps. Never disables safeguards or requests 100% spindle power."}
              </p>
            </Section>
            <Section icon={Sliders} title="Cutting intensity">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Conservative</span>
                  <span className="font-mono text-brand font-semibold">{Math.round(aggressiveness * 100)}%</span>
                  <span className="text-muted-foreground">Higher productivity</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={aggressiveness} onChange={(e) => setAggressiveness(parseFloat(e.target.value))} className="w-full accent-brand" />
                <p className="text-[11px] text-muted-foreground">100% is the top of the starting-policy range, not 100% machine power. Maximum HP budget is 80%; this estimate does not certify tool strength or stability.</p>
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
