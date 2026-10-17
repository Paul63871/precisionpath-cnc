import React, { useState, useMemo, useEffect } from "react";
import { Disc3, Wrench, Boxes, Cog, Sliders, Sparkles, Gauge, Activity, Layers, Zap, AlertTriangle, Ruler, Grip, Cylinder } from "lucide-react";
import { base44 } from "@/api/base44Client";
import MachineForm from "@/components/cnc/MachineForm";
import MaterialSearch from "@/components/cnc/MaterialSearch";
import ResponsiveSelect from "@/components/cnc/ResponsiveSelect";
import ToolIcon from "@/components/cnc/ToolIcon";
import UnitsToggle from "@/components/cnc/UnitsToggle";
import NumberField from "@/components/NumberField";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PART_MATERIALS, WORKHOLDING_JAW_TYPES, THREAD_TABLE } from "@/lib/cncData";
import {
  TURNING_OPERATIONS, TURNING_GRADES, INSERT_SHAPES, IC_SIZES, NOSE_RADII, BORING_BARS, isTurnable, partingWidthFor,
} from "@/lib/turningData";
import { calculateTurning } from "@/lib/turningEngine";
import { UNITS, lenFromImp, lenToImp, surfaceFromImp, powerFromImp, mrrFromImp, feedFromImp } from "@/lib/units";

function Section({ icon: Icon, title, children, highlight }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      {highlight && <div className="h-1 bg-brand" />}
      <div className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand"><Icon className="w-4 h-4" /></span>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, unit, accent }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-muted/30 px-3 py-3 sm:px-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[11px] uppercase tracking-wide font-medium truncate">{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1 flex-wrap">
        <span className={`font-mono text-xl sm:text-2xl tabular-nums leading-tight ${accent || "text-foreground"}`}>{value}</span>
        <span className="text-sm text-muted-foreground font-sans">{unit}</span>
      </div>
    </div>
  );
}

const Row = ({ k, v }) => (
  <div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">{k}</span><span className="font-mono text-right">{v}</span></div>
);

export default function Turning() {
  const [units, setUnits] = useState("imperial");
  const [materialId, setMaterialId] = useState("steel_1018");
  const [operationId, setOperationId] = useState("od_rough");
  const [gradeId, setGradeId] = useState("coated");
  const [aggressiveness, setAggressiveness] = useState(0.6);
  const [priority, setPriorityState] = useState(() => { try { return localStorage.getItem("pp_priority") || "finish"; } catch { return "finish"; } });
  const setPriority = (p) => { setPriorityState(p); try { localStorage.setItem("pp_priority", p); } catch {} };
  const [machine, setMachine] = useState({ hp: 10, maxRpm: 3000, minRpm: 20, maxIpm: 400 });
  const [chuckMaxRpm, setChuckMaxRpm] = useState(0);
  const [profiles, setProfiles] = useState([]);
  const [work, setWork] = useState({ workDiameter: 2, finishDiameter: 1.8, cutLength: 2, targetRa: 0, drillDiameter: 0.5, drillDepth: 2, faceStock: 0.05 });
  const [insert, setInsert] = useState({ shapeId: "C", ic: 0.5, noseRadius: 1 / 32 });
  const [hold, setHold] = useState({ stickout: 3, gripDiameter: 0, jawTypeId: "serrated", chuckGripForce: 0, tailstock: false, steadyRest: false, chuckAge: "new" });
  const [bar, setBar] = useState({ id: "steel", diameter: 0.75, overhang: 3 });
  const [groove, setGroove] = useState({ width: 0, depth: 0.1 });
  const [thread, setThread] = useState({ threadId: "custom", pitch: 0.0625, passes: 0 });

  useEffect(() => {
    (async () => { try { setProfiles((await base44.entities.MachineProfile.list()) || []); } catch {} })();
  }, []);

  const materials = useMemo(() => PART_MATERIALS.filter(isTurnable), []);
  const mat = materials.find((m) => m.id === materialId) || materials[0];
  const op = TURNING_OPERATIONS.find((o) => o.id === operationId) || TURNING_OPERATIONS[0];
  const L = UNITS[units].length;
  const lf = (v) => (v ? lenFromImp(v, units) : undefined);
  const setW = (k) => (n) => setWork((w) => ({ ...w, [k]: n ? lenToImp(n, units) : 0 }));
  const LenField = ({ label, value, onChange, placeholder, auto }) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label} ({L})</Label>
      <NumberField className="h-9" allowClear={auto} placeholder={placeholder} value={lf(value)} onValueChange={onChange} />
    </div>
  );

  const result = useMemo(() => {
    if (!work.workDiameter || work.workDiameter <= 0) return null;
    return calculateTurning({
      material: mat, operationId, gradeId, aggressiveness, priority,
      workDiameter: work.workDiameter, finishDiameter: work.finishDiameter || undefined, cutLength: work.cutLength,
      targetRa: work.targetRa || undefined, faceStock: work.faceStock, drillDiameter: work.drillDiameter, drillDepth: work.drillDepth,
      insert, machine: { ...machine, chuckMaxRpm },
      workholding: { ...hold, gripDiameter: hold.gripDiameter || work.workDiameter },
      bar, groove: { width: groove.width || undefined, depth: groove.depth }, thread: { pitch: thread.pitch, passes: thread.passes || undefined },
    });
  }, [mat, operationId, gradeId, aggressiveness, priority, work, insert, machine, chuckMaxRpm, hold, bar, groove, thread]);

  const opOptions = TURNING_OPERATIONS.map((o) => ({ value: o.id, label: o.name, group: o.group, icon: <ToolIcon kind="turnop" id={o.kind} className="w-9 h-9" /> }));
  const needsFinishDia = op.kind === "od" || op.kind === "id";
  const showInsert = !["drill"].includes(op.kind);
  const isThread = op.kind === "thread";
  const sfmOut = (v) => (units === "metric" ? Math.round(surfaceFromImp(v, units)) : Math.round(v));
  const surfUnit = UNITS[units].surface;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Turning</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Lathe speeds, feeds, depth of cut, threading, parting and chuck checks for inserts, boring bars and HSS.</p>
        </div>
        <UnitsToggle value={units} onChange={setUnits} />
      </div>
      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-5">
          <Section icon={Boxes} title="Material & Operation">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Part Material</Label>
                <MaterialSearch materials={materials} value={materialId} onChange={setMaterialId} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Operation</Label>
                <ResponsiveSelect value={operationId} onValueChange={setOperationId} options={opOptions} />
              </div>
            </div>
          </Section>

          <Section icon={Wrench} title="Insert / Tool">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs text-muted-foreground">Insert Grade / Tool Material</Label>
                <ResponsiveSelect value={gradeId} onValueChange={setGradeId} options={TURNING_GRADES.map((g) => ({ value: g.id, label: g.name }))} />
              </div>
              {showInsert && !isThread && (
                <>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs text-muted-foreground">Insert Shape</Label>
                    <ResponsiveSelect value={insert.shapeId} onValueChange={(v) => setInsert((i) => ({ ...i, shapeId: v }))} options={INSERT_SHAPES.map((s) => ({ value: s.id, label: s.name, icon: <ToolIcon kind="insert" id={s.id} className="w-9 h-9" /> }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Inscribed Circle (IC)</Label>
                    <ResponsiveSelect value={String(insert.ic)} onValueChange={(v) => setInsert((i) => ({ ...i, ic: Number(v) }))} options={IC_SIZES.map((v) => ({ value: String(v), label: `${v}" (${(v * 25.4).toFixed(1)} mm)` }))} />
                  </div>
                  {op.kind !== "groove" && op.kind !== "parting" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Nose Radius</Label>
                      <ResponsiveSelect value={String(insert.noseRadius)} onValueChange={(v) => setInsert((i) => ({ ...i, noseRadius: Number(v) }))} options={NOSE_RADII.map((n) => ({ value: String(n.value), label: n.label }))} />
                    </div>
                  )}
                </>
              )}
              {op.kind === "drill" && (
                <>
                  <LenField label="Drill Ø" value={work.drillDiameter} onChange={setW("drillDiameter")} />
                  <LenField label="Hole depth" value={work.drillDepth} onChange={setW("drillDepth")} />
                </>
              )}
            </div>
          </Section>

          {op.kind !== "drill" && (
            <Section icon={Cylinder} title="Workpiece & Cut">
              <div className="grid grid-cols-2 gap-3">
                <LenField label={op.kind === "id" ? "Bore Ø at start" : op.kind === "parting" ? "Diameter being parted" : op.kind === "groove" ? "Diameter at groove" : "Stock Ø"} value={work.workDiameter} onChange={setW("workDiameter")} />
                {needsFinishDia && <LenField label={op.kind === "id" ? "Target bore Ø" : "Target Ø"} value={work.finishDiameter} onChange={setW("finishDiameter")} auto placeholder="Auto" />}
                {op.kind === "face" && <LenField label="Stock to face off" value={work.faceStock} onChange={setW("faceStock")} />}
                {(op.kind === "od" || op.kind === "id" || op.kind === "face") && <LenField label="Length of cut" value={work.cutLength} onChange={setW("cutLength")} />}
                {(op.kind === "groove") && (
                  <>
                    <LenField label="Groove width (insert)" value={groove.width} onChange={(n) => setGroove((g) => ({ ...g, width: n ? lenToImp(n, units) : 0 }))} auto placeholder="0.118 (3 mm)" />
                    <LenField label="Groove depth" value={groove.depth} onChange={(n) => setGroove((g) => ({ ...g, depth: n ? lenToImp(n, units) : 0 }))} />
                  </>
                )}
                {op.kind === "parting" && (
                  <LenField label="Blade width" value={groove.width} onChange={(n) => setGroove((g) => ({ ...g, width: n ? lenToImp(n, units) : 0 }))} auto placeholder={`Auto (${partingWidthFor(work.workDiameter).toFixed(3)}")`} />
                )}
                {op.finishing && (
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs text-muted-foreground">Target surface finish Ra (µin)</Label>
                    <NumberField className="h-9" allowClear placeholder={priority === "speed" ? "63 µin (1.6 µm) default" : "32 µin (0.8 µm) default"} value={work.targetRa || undefined} onValueChange={(n) => setWork((w) => ({ ...w, targetRa: n || 0 }))} />
                    <p className="text-[11px] text-muted-foreground">Feed per rev is limited so theoretical Ra = f² / (32 × nose radius) stays inside this target (with a 1.5× real-world allowance).</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {isThread && (
            <Section icon={Sliders} title="Thread">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs text-muted-foreground">Thread (optional preset)</Label>
                  <ResponsiveSelect
                    value={thread.threadId}
                    onValueChange={(id) => { const t = THREAD_TABLE.find((x) => x.id === id); setThread((th) => ({ ...th, threadId: id, pitch: t && t.pitch ? t.pitch : th.pitch })); if (t && t.major) setWork((w) => ({ ...w, workDiameter: t.major })); }}
                    options={THREAD_TABLE.map((t) => ({ value: t.id, label: t.name }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Pitch ({L})</Label>
                  <NumberField className="h-9" value={lf(thread.pitch)} onValueChange={(n) => setThread((th) => ({ ...th, pitch: n ? lenToImp(n, units) : 0.05, threadId: "custom" }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Number of passes</Label>
                  <NumberField className="h-9" allowClear placeholder="Auto" value={thread.passes || undefined} onValueChange={(n) => setThread((th) => ({ ...th, passes: n || 0 }))} />
                </div>
              </div>
            </Section>
          )}

          {op.kind === "id" && (
            <Section icon={Ruler} title="Boring Bar">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs text-muted-foreground">Bar Type</Label>
                  <ResponsiveSelect value={bar.id} onValueChange={(v) => setBar((b) => ({ ...b, id: v }))} options={BORING_BARS.map((b) => ({ value: b.id, label: `${b.name} (max ${b.maxLD}× Ø)`, icon: <ToolIcon kind="bar" id={b.id} className="w-10 h-10" /> }))} />
                </div>
                <LenField label="Bar Ø" value={bar.diameter} onChange={(n) => setBar((b) => ({ ...b, diameter: n ? lenToImp(n, units) : 0.5 }))} />
                <LenField label="Overhang" value={bar.overhang} onChange={(n) => setBar((b) => ({ ...b, overhang: n ? lenToImp(n, units) : 1 }))} />
              </div>
            </Section>
          )}

          {op.kind !== "drill" && (
            <Section icon={Grip} title="Chuck / Workholding">
              <div className="grid grid-cols-2 gap-3">
                <LenField label="Stickout from jaws" value={hold.stickout} onChange={(n) => setHold((h) => ({ ...h, stickout: n ? lenToImp(n, units) : 0 }))} auto placeholder="Skip check" />
                <LenField label="Gripped Ø" value={hold.gripDiameter} onChange={(n) => setHold((h) => ({ ...h, gripDiameter: n ? lenToImp(n, units) : 0 }))} auto placeholder="= stock Ø" />
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Jaw Type</Label>
                  <ResponsiveSelect value={hold.jawTypeId} onValueChange={(v) => setHold((h) => ({ ...h, jawTypeId: v }))} options={WORKHOLDING_JAW_TYPES.map((j) => ({ value: j.id, label: j.name }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Chuck Grip Force (lbf, total)</Label>
                  <NumberField className="h-9" allowClear placeholder="Optional" value={hold.chuckGripForce || undefined} onValueChange={(n) => setHold((h) => ({ ...h, chuckGripForce: n || 0 }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <Label className="text-xs">Tailstock center</Label>
                  <Switch checked={hold.tailstock} onCheckedChange={(v) => setHold((h) => ({ ...h, tailstock: v }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <Label className="text-xs">Steady / follow rest</Label>
                  <Switch checked={hold.steadyRest} onCheckedChange={(v) => setHold((h) => ({ ...h, steadyRest: v }))} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs text-muted-foreground">Chuck Condition (Röhm safety factor)</Label>
                  <ResponsiveSelect value={hold.chuckAge} onValueChange={(v) => setHold((h) => ({ ...h, chuckAge: v }))} options={[{ value: "new", label: "New / well-maintained (safety 2.0–2.4)" }, { value: "old", label: "Older / worn (safety 4.0–4.8)" }]} />
                </div>
              </div>
            </Section>
          )}

          <Section icon={Cog} title="Lathe">
            <MachineForm value={machine} onChange={setMachine} units={units} profiles={profiles} onLoadProfile={(p) => setMachine({ hp: p.hp, maxRpm: p.max_rpm, minRpm: p.min_rpm, maxIpm: p.max_ipm })} />
            <div className="space-y-1.5 mt-3">
              <Label className="text-xs text-muted-foreground">Chuck max speed (RPM) — from the chuck's data plate</Label>
              <NumberField className="h-9" allowClear placeholder="Optional" value={chuckMaxRpm || undefined} onValueChange={(n) => setChuckMaxRpm(n || 0)} />
            </div>
          </Section>
        </div>

        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-20 space-y-5">
            <Section icon={Sparkles} title="Optimize For">
              <div className="grid grid-cols-3 gap-1.5">
                {[["finish", "Finish quality"], ["balanced", "Balanced"], ["speed", "Speed / MRR"]].map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setPriority(id)} className={`rounded-lg border px-2 py-2 text-xs font-medium min-h-[40px] ${priority === id ? "border-brand bg-brand text-white" : "border-border bg-card hover:bg-accent"}`}>{label}</button>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Conservative</span>
                  <span className="font-mono text-brand font-semibold">{Math.round(aggressiveness * 100)}%</span>
                  <span className="text-muted-foreground">Aggressive</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={aggressiveness} onChange={(e) => setAggressiveness(parseFloat(e.target.value))} className="w-full accent-brand" />
              </div>
            </Section>
            <Section icon={Disc3} title="Recommended Parameters" highlight>
              <TurnResults result={result} units={units} sfmOut={sfmOut} surfUnit={surfUnit} op={op} />
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function TurnResults({ result, units, sfmOut, surfUnit, op }) {
  const u = UNITS[units];
  const fmt = (v, d = 2) => (v == null ? "—" : Number(v).toFixed(d));
  if (!result) return <p className="text-sm text-muted-foreground">Enter a valid diameter to see results.</p>;
  if (result.error) return <p className="text-sm text-destructive">{result.error}</p>;

  if (result.kind === "drill") {
    const d = result.drill;
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Metric icon={Gauge} label="Spindle Speed" value={d.rpm.toLocaleString()} unit="RPM" accent="text-brand" />
          <Metric icon={Activity} label="Feed / Rev" value={fmt(lenFromImp(result.ipr, units), units === "metric" ? 3 : 4)} unit={`${u.length}/rev`} accent="text-brand" />
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-1.5">
          <Row k="Feed rate" v={`${fmt(feedFromImp(d.ipm, units), 1)} ${u.feed}`} />
          <Row k="Surface speed" v={`${sfmOut(d.sfm)} ${surfUnit}`} />
          {d.drilling && <Row k="Cycle" v={`${d.drilling.cycle}${d.drilling.cycle === "G83" ? ` · peck ${fmt(lenFromImp(d.drilling.peckDepth, units), 3)} ${u.length}` : ""}`} />}
        </div>
        {result.warnings.map((w, i) => <Warn key={i} text={w} />)}
      </div>
    );
  }

  const power = powerFromImp(result.hpRequired, units);
  const pct = result.hpRequired && result.hpAvailable ? 0 : 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Metric icon={Gauge} label="Spindle Speed" value={result.rpm.toLocaleString()} unit="RPM" accent="text-brand" />
        <Metric icon={Activity} label="Feed / Rev" value={fmt(lenFromImp(result.feedIpr, units), units === "metric" ? 3 : 4)} unit={`${u.length}/rev`} accent="text-brand" />
        <Metric icon={Layers} label={result.kind === "thread" ? "Thread Depth" : "Depth of Cut"} value={fmt(lenFromImp(result.doc, units), units === "metric" ? 2 : 3)} unit={u.length} />
        <Metric icon={Ruler} label="Feed Rate" value={fmt(feedFromImp(result.ipm, units), 1)} unit={u.feed} />
        <Metric icon={Zap} label="Power at cut" value={fmt(power, 2)} unit={u.power} />
        <Metric icon={Gauge} label="Surface Speed" value={sfmOut(result.sfm)} unit={surfUnit} />
      </div>

      {result.css && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Program Words</span>
          <div className="rounded-md bg-muted px-3 py-2 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-nowrap">
            {result.css.useCss
              ? <>G50 S{result.css.g50}<br />G96 S{result.css.g96} M3<br />G99 F{fmt(result.feedIpr, 4)}</>
              : <>G97 S{result.rpm} M3<br />G99 F{fmt(result.feedIpr, 4)}</>}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{result.css.note} G50 shown in Fanuc style (G92 on Mazak/Haas-style controls — check your control).</p>
          {result.css.useCss && <Row k="RPM at start → end of cut" v={`${result.css.rpmAtStart} → ${result.css.rpmAtEnd}`} />}
        </div>
      )}

      {result.threadInfo && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Thread Infeed Schedule ({result.threadInfo.internal ? "internal" : "external"})</span>
          <Row k="Pitch / TPI" v={`${fmt(lenFromImp(result.threadInfo.pitch, units), 4)} ${u.length} / ${result.threadInfo.tpi} TPI`} />
          <Row k="Total thread depth" v={`${fmt(lenFromImp(result.threadInfo.depth, units), 4)} ${u.length}`} />
          <Row k="Passes" v={result.threadInfo.passes} />
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead><tr className="text-muted-foreground text-left"><th className="py-1 pr-2">Pass</th><th className="pr-2">Infeed</th><th>Cumulative</th></tr></thead>
              <tbody>
                {result.threadInfo.schedule.map((s) => (
                  <tr key={s.pass}><td className="py-0.5 pr-2">{s.pass}</td><td className="pr-2">{fmt(lenFromImp(s.increment, units), 4)}</td><td>{fmt(lenFromImp(s.cumulative, units), 4)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result.partInfo && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Parting Off</span>
          <Row k="Recommended blade width" v={`${fmt(lenFromImp(result.partInfo.recommendedWidth, units), 3)} ${u.length}`} />
          <Row k="Feed near centre (last 0.08″ radius)" v={`${fmt(lenFromImp(result.partInfo.nearCenterFeed, units), 4)} ${u.length}/rev`} />
          <Row k="Stop feeding before centre" v={`${fmt(lenFromImp(result.partInfo.stopBeforeCenter, units), 3)} ${u.length}`} />
        </div>
      )}

      <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-1.5">
        {result.mrr > 0 && <Row k="Material removal rate" v={`${fmt(mrrFromImp(result.mrr, units), 1)} ${u.mrr}`} />}
        {result.cuttingForce > 0 && <Row k="Tangential cutting force" v={`${Math.round(result.cuttingForce)} lbf`} />}
        {result.surface && <Row k="Predicted Ra (theory · expected)" v={`${fmt(result.surface.raTheoreticalUin, 0)} µin · ${fmt(result.surface.raExpectedLow, 0)}–${fmt(result.surface.raExpectedHigh, 0)} µin`} />}
        {result.passes && result.passes.roughPasses > 0 && <Row k="Roughing passes" v={`${result.passes.roughPasses} × ${fmt(lenFromImp(result.doc, units), 3)} ${u.length} (+${fmt(lenFromImp(result.passes.finishAllowance, units), 3)} finish)`} />}
        {result.passes && result.passes.finishPasses > 0 && <Row k="Finish passes" v={result.passes.finishPasses} />}
        {result.cutTimeMin != null && <Row k="Cutting time (no rapids)" v={`${fmt(result.cutTimeMin, 2)} min`} />}
        {result.hold && result.hold.ld != null && <Row k="Stickout : diameter" v={`${result.hold.ld}:1`} />}
        {result.hold && result.hold.requiredGripForce != null && <Row k="Grip force needed" v={`~${Math.round(result.hold.requiredGripForce)} lbf (SF ${result.hold.safety}, μ ${result.hold.mu})`} />}
        {result.hold && result.hold.deflection && <Row k="Workpiece deflection (worst-case est.)" v={`${fmt(lenFromImp(result.hold.deflection.estimateIn, units), units === "metric" ? 4 : 5)} ${u.length}`} />}
        {result.boring && <Row k="Bar overhang : Ø" v={`${result.boring.ld}:1 (max ${result.boring.maxLD}:1)`} />}
        {result.boring && <Row k="Bar deflection (worst-case est.)" v={`${fmt(lenFromImp(result.boring.deflectionIn, units), units === "metric" ? 4 : 5)} ${u.length}`} />}
        {result.inserts && <Row k="Max ap for this insert" v={`${fmt(lenFromImp(result.inserts.apMax, units), 3)} ${u.length}`} />}
        <Row k="Material row" v={`${result.window.rowName}${result.window.scale && result.window.scale !== 1 ? ` ×${result.window.scale}` : ""}`} />
      </div>

      {[...(result.feedNotes || []), ...(result.docNote ? [result.docNote] : []), ...(result.notes || [])].map((n, i) => (
        <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">• {n}</p>
      ))}
      {result.warnings.map((w, i) => <Warn key={i} text={w} />)}
      {result.estimates.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground space-y-1">
          <div className="font-semibold uppercase tracking-wide">Engineering estimates — verify</div>
          {result.estimates.map((e, i) => <p key={i}>• {e}</p>)}
        </div>
      )}
    </div>
  );
}

function Warn({ text }) {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{text}</span>
    </div>
  );
}
