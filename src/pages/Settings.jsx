import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2 } from "lucide-react";

export default function Settings() {
  const [prefId, setPrefId] = useState(null);
  const [aggressiveness, setAggressiveness] = useState(0.6);
  const [units, setUnits] = useState("imperial");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.UserPreference.list();
        if (list.length) {
          const p = list[0];
          setPrefId(p.id);
          setAggressiveness(p.aggressiveness ?? 0.6);
          setUnits(p.units || "imperial");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const body = { aggressiveness, units };
      if (prefId) {
        await base44.entities.UserPreference.update(prefId, body);
      } else {
        const created = await base44.entities.UserPreference.create(body);
        setPrefId(created.id);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">Defaults applied to new calculations.</p>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-6 rounded-xl border border-border bg-card p-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Default Aggressiveness</Label>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Conservative</span>
              <span className="font-mono text-amber-600">{Math.round(aggressiveness * 100)}%</span>
              <span>Aggressive</span>
            </div>
            <input
              type="range" min="0" max="1" step="0.05" value={aggressiveness}
              onChange={(e) => setAggressiveness(parseFloat(e.target.value))}
              className="w-full accent-amber-600"
            />
            <p className="text-[11px] text-muted-foreground">Used as the starting aggressiveness for every new calculation.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Preferred Units</Label>
            <Select value={units} onValueChange={setUnits}>
              <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="imperial">Imperial (in, IPM, SFM, HP)</SelectItem>
                <SelectItem value="metric">Metric (mm, mm/min, m/min, kW)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} disabled={saving} className="h-9">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : <><Save className="w-4 h-4 mr-2" />Save preferences</>}
          </Button>
        </div>
      )}
    </div>
  );
}