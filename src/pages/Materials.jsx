import React, { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useEntityList } from "@/lib/useEntityList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NumberField from "@/components/NumberField";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import PullToRefresh from "@/components/PullToRefresh";

const EMPTY = {
  name: "", category: "Custom", sfm_min: 200, sfm_max: 600,
  chip_load_factor: 0.7, hp_factor: 0.5, slot_depth_factor: 0.7, profile_depth_factor: 2.0,
};

function MaterialDialog({ initial, onSave, trigger }) {
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
        <DialogHeader><DialogTitle>{initial ? "Edit Material" : "New Material"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Input value={form.category} onChange={(e) => set("category", e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">HP factor</Label>
            <NumberField className="h-9" value={form.hp_factor} onValueChange={(n) => set("hp_factor", n)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">SFM min</Label>
            <NumberField className="h-9" value={form.sfm_min} onValueChange={(n) => set("sfm_min", n)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">SFM max</Label>
            <NumberField className="h-9" value={form.sfm_max} onValueChange={(n) => set("sfm_max", n)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Chip load factor</Label>
            <NumberField className="h-9" value={form.chip_load_factor} onValueChange={(n) => set("chip_load_factor", n)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Slot depth factor</Label>
            <NumberField className="h-9" value={form.slot_depth_factor} onValueChange={(n) => set("slot_depth_factor", n)} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs text-muted-foreground">Profile depth factor</Label>
            <NumberField className="h-9" value={form.profile_depth_factor} onValueChange={(n) => set("profile_depth_factor", n)} />
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={!form.name}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Materials() {
  const { items, loading, create, update, remove, reload } = useEntityList("CustomMaterial");
  return (
    <PullToRefresh onRefresh={reload}>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3 select-none">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Material Library</h1>
            <p className="text-xs text-muted-foreground">Define custom materials to refine calculation accuracy.</p>
          </div>
          <MaterialDialog onSave={create} trigger={<Button size="sm" className="h-9"><Plus className="w-4 h-4 mr-1.5" />Add</Button>} />
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground select-none">
            No custom materials yet. Add one to use it in the calculator.
          </div>
        ) : (
          <div className="rounded-xl border border-border shadow-card overflow-x-auto select-none">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Name</th>
                  <th className="text-left px-3 py-2 font-medium">Category</th>
                  <th className="text-left px-3 py-2 font-medium">SFM</th>
                  <th className="text-left px-3 py-2 font-medium">Chip</th>
                  <th className="text-left px-3 py-2 font-medium">HP</th>
                  <th className="text-left px-3 py-2 font-medium">Depth</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{m.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{m.category}</td>
                    <td className="px-3 py-2 font-mono">{m.sfm_min}–{m.sfm_max}</td>
                    <td className="px-3 py-2 font-mono">{m.chip_load_factor}</td>
                    <td className="px-3 py-2 font-mono">{m.hp_factor}</td>
                    <td className="px-3 py-2 font-mono">{m.slot_depth_factor}/{m.profile_depth_factor}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <MaterialDialog initial={m} onSave={(f) => update(m.id, f)} trigger={<Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Pencil className="w-3.5 h-3.5" /></Button>} />
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => remove(m.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}