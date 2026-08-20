import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function BrandLookup({ materialName, onApply }) {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const lookup = async () => {
    if (!brand && !model) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const prompt = `You are a CNC machining expert. Find manufacturer-recommended cutting parameters for this end mill:
Brand: ${brand || "unspecified"}
Model / part number: ${model || "unspecified"}
Workpiece material: ${materialName}

Search the web for the manufacturer's published speeds and feeds (e.g. Harvey Tool, IMCO, Kennametal, Niagara,YG1, OSG, etc.). Return realistic recommended values for this tool in this material. If exact data is unavailable, give a best-engineering estimate based on the tool's geometry/material class and the workpiece material.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: "gemini_3_flash",
        response_json_schema: {
          type: "object",
          properties: {
            found: { type: "boolean" },
            tool_material: { type: "string" },
            coating: { type: "string" },
            sfm_recommended: { type: "number" },
            chip_load_per_tooth: { type: "number" },
            notes: { type: "string" },
            source: { type: "string" },
          },
        },
      });
      setResult(res);
    } catch (e) {
      setError("Lookup failed. Try again or enter values manually.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Optionally look up a specific tool by brand and model. We'll search the web for the manufacturer's recommended SFM and chip load, then apply them to your setup.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Brand</Label>
          <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Harvey Tool" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Model / Part #</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. 50506-C3" className="h-9" />
        </div>
      </div>
      <Button onClick={lookup} disabled={loading || (!brand && !model)} variant="secondary" className="w-full h-9">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching…</> : <><Search className="w-4 h-4 mr-2" /> Look up tool</>}
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {result && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {result.found ? "Manufacturer data found" : "Engineering estimate"}
          </div>
          <div className="grid grid-cols-2 gap-y-1 font-mono">
            <span className="text-muted-foreground">Tool material:</span><span>{result.tool_material || "—"}</span>
            <span className="text-muted-foreground">Coating:</span><span>{result.coating || "—"}</span>
            <span className="text-muted-foreground">SFM:</span><span>{result.sfm_recommended || "—"}</span>
            <span className="text-muted-foreground">Chip load:</span><span>{result.chip_load_per_tooth || "—"}</span>
          </div>
          {result.notes && <p className="text-muted-foreground pt-1">{result.notes}</p>}
          {result.sfm_recommended && (
            <Button
              size="sm"
              className="w-full h-8 mt-1"
              onClick={() => onApply({ sfm: result.sfm_recommended, chipLoad: result.chip_load_per_tooth })}
            >
              Apply to calculator
            </Button>
          )}
        </div>
      )}
    </div>
  );
}