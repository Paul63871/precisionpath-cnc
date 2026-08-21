import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Trash2, AlertTriangle } from "lucide-react";
import ResponsiveSelect from "@/components/cnc/ResponsiveSelect";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

export default function Settings() {
  const [prefId, setPrefId] = useState(null);
  const [aggressiveness, setAggressiveness] = useState(0.6);
  const [units, setUnits] = useState("imperial");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

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

  const requestDeletion = async () => {
    setDeleting(true);
    try {
      // Automated purge: delete every owned entity (calculations, materials,
      // machine profiles, preferences) via the backend function, then sign out.
      await base44.functions.invoke("deleteAccount", {});
      toast({
        title: "Account deleted",
        description: "Your saved data and preferences have been permanently removed.",
      });
      await base44.auth.logout();
    } catch (e) {
      toast({
        title: "Deletion failed",
        description: "Could not complete deletion. Please try again or contact Base44 support.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
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
        <div className="space-y-6">
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
              <ResponsiveSelect
                value={units}
                onValueChange={setUnits}
                placeholder="Select units"
                options={[
                  { value: "imperial", label: "Imperial (in, IPM, SFM, HP)" },
                  { value: "metric", label: "Metric (mm, mm/min, m/min, kW)" },
                ]}
              />
            </div>
            <Button onClick={save} disabled={saving} className="min-h-[44px]">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : <><Save className="w-4 h-4 mr-2" />Save preferences</>}
            </Button>
          </div>

          <div className="space-y-4 rounded-xl border border-destructive/40 bg-destructive/5 p-5">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <h2 className="text-sm font-semibold tracking-tight">Account Deletion</h2>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p><span className="font-medium text-foreground">Permanent and irreversible.</span> Requesting account deletion will permanently remove your profile, saved calculations, custom materials, machine profiles, and preferences. This action cannot be undone.</p>
              <p>By proceeding you acknowledge that:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>All your data will be erased and cannot be recovered.</li>
                <li>Deletion is immediate and automated — your data is purged instantly.</li>
                <li>You will be signed out immediately after submitting the request.</li>
              </ul>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="min-h-[44px]" disabled={deleting}>
                  {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Delete my account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently erase all of your saved calculations, materials, machine profiles, and preferences. The action cannot be undone. You will be signed out immediately after confirming.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={requestDeletion}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Yes, delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}