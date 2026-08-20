import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { useEntityList } from "@/lib/useEntityList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NumberField from "@/components/NumberField";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

const EMPTY = { name: "", hp: 5, max_rpm: 10000, min_rpm: 60, max_ipm: 200, notes: "" };

function MachineDialog({ initial, onSave, trigger }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial || EMPTY);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    await onSave(form);
    setOpen(false);
    setForm(initial || EMPTY);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{initial ? "Edit Machine Profile" : "New Machine Profile"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Spindle HP</Label>
            <NumberField className="h-9" value={form.hp} onValueChange={(n) => set("hp", n)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Max Feed (IPM)</Label>
            <NumberField className="h-9" value={form.max_ipm} onValueChange={(n) => set("max_ipm", n)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Max RPM</Label>
            <NumberField className="h-9" value={form.max_rpm} onValueChange={(n) => set("max_rpm", n)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Min RPM</Label>
            <NumberField className="h-9" value={form.min_rpm} onValueChange={(n) => set("min_rpm", n)} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={!form.name}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MachineProfiles() {
  const { items, loading, create, update, remove } = useEntityList("MachineProfile");
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Machine Profiles</h1>
          <p className="text-xs text-muted-foreground">Store spindle HP, RPM, and feed limits for quick selection.</p>
        </div>
        <MachineDialog onSave={create} trigger={<Button size="sm" className="h-9"><Plus className="w-4 h-4 mr-1.5" />Add</Button>} />
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No machine profiles yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-medium text-sm">{m.name}</h3>
              {m.notes && <p className="text-xs text-muted-foreground mt-0.5">{m.notes}</p>}
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {[["HP", m.hp], ["Max RPM", m.max_rpm], ["Min RPM", m.min_rpm], ["Max IPM", m.max_ipm]].map(([l, v]) => (
                  <div key={l} className="rounded-md bg-muted px-1 py-1.5">
                    <div className="text-[10px] text-muted-foreground">{l}</div>
                    <div className="font-mono text-sm">{v ?? "—"}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="h-8 flex-1" onClick={() => navigate("/", { state: { machineProfile: m } })}>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />Use
                </Button>
                <MachineDialog initial={m} onSave={(f) => update(m.id, f)} trigger={<Button size="sm" variant="outline" className="h-8 w-9 p-0"><Pencil className="w-3.5 h-3.5" /></Button>} />
                <Button size="sm" variant="outline" className="h-8 w-9 p-0" onClick={() => remove(m.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}