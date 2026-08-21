import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2, CheckCircle2, AlertTriangle, ExternalLink, BadgeCheck } from "lucide-react";
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
      const prompt = `You are a CNC machining expert. Find the EXACT manufacturer-recommended cutting parameters for this specific end mill.

Brand: ${brand || "unspecified"}
Model / part number: ${model || "unspecified"}
Workpiece material: ${materialName || "unspecified"}

Search the web — prioritize the manufacturer's OFFICIAL speeds-and-feeds chart or product page (e.g. imcousa.com, harveytool.com, helicaltool.com, kennametal.com, niagaracutter.com, osgtool.com, yg1.com). Manufacturer charts are often PDF documents; read them carefully.

Return up to 5 candidate tools that match this part number. For each candidate extract:
- part_number: the exact part number as published by the manufacturer
- description: diameter, flute count, coating, and tool type
- diameter_in: diameter in inches (0 if unknown)
- flutes: flute count (0 if unknown)
- coating: coating name
- sfm: recommended surface speed (SFM) for the workpiece material (use the midpoint of any published range)
- chip_load_per_tooth: recommended feed per tooth (inches) for the workpiece material (use the midpoint of any published range)
- exact_match: true ONLY if the published part number matches the requested model EXACTLY (ignoring case, spaces, and dashes)
- source_url: the URL where the data was found
- notes: any relevant caveat

CRITICAL RULES:
- You MUST actually retrieve and read the manufacturer's product page for this exact part number. Quote the exact product title from the page in the description field.
- If web search does not return the actual manufacturer product page for this exact part number, set found=false and return an empty candidates array. Do NOT return "similar" or "closest" tools as if they were the requested tool.
- Never fabricate specifications. If you did not read a specific value (diameter, flutes, coating, SFM, chip load) on the actual product page or its speeds-and-feeds chart, set that field to null/0 — do not guess.
- Only set exact_match=true if the part number printed on the page matches the requested model exactly (ignoring case, spaces, and dashes).
- Sort candidates so exact matches come first.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: "gemini_3_1_pro",
        response_json_schema: {
          type: "object",
          properties: {
            found: { type: "boolean" },
            candidates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  part_number: { type: "string" },
                  description: { type: "string" },
                  diameter_in: { type: "number" },
                  flutes: { type: "number" },
                  coating: { type: "string" },
                  sfm: { type: "number" },
                  chip_load_per_tooth: { type: "number" },
                  exact_match: { type: "boolean" },
                  source_url: { type: "string" },
                  notes: { type: "string" },
                },
              },
            },
            notes: { type: "string" },
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

  // Compute the exact-match flag ourselves (normalized string compare of the
  // requested model vs. each candidate's published part number) so the AI cannot
  // self-report a false "exact match" for a different tool.
  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const requested = norm(model);
  const candidates = (result?.candidates || []).map((c) => ({
    ...c,
    exact_match: requested ? norm(c.part_number) === requested : !!c.exact_match,
  }));
  const exact = candidates.find((c) => c.exact_match);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Optionally look up a specific tool by brand and exact model number. We search the manufacturer's official speeds-and-feeds chart and return matching tools — apply the exact match to your setup.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Brand</Label>
          <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. IMCO" className="h-9" />
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
        <div className="space-y-2">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${exact ? "text-emerald-700" : "text-amber-700"}`}>
            {exact ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
            {exact
              ? "Exact match found — apply it below."
              : candidates.length
                ? "No exact part-number match — these are the closest tools found. Verify before applying."
                : "No matching tools found. Check the part number or enter values manually."}
          </div>

          {candidates.map((c, i) => (
            <div key={i} className={`rounded-lg border p-3 space-y-1.5 text-xs ${c.exact_match ? "border-emerald-300 bg-emerald-50" : "border-border bg-card"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-semibold text-foreground">{c.part_number || "—"}</span>
                {c.exact_match && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium"><BadgeCheck className="w-3.5 h-3.5" /> Exact</span>
                )}
              </div>
              {c.description && <p className="text-muted-foreground">{c.description}</p>}
              <div className="grid grid-cols-2 gap-y-0.5 font-mono pt-0.5">
                <span className="text-muted-foreground">SFM:</span><span>{c.sfm || "—"}</span>
                <span className="text-muted-foreground">Chip load:</span><span>{c.chip_load_per_tooth || "—"}</span>
                {c.coating && <><span className="text-muted-foreground">Coating:</span><span>{c.coating}</span></>}
              </div>
              {c.source_url && (
                <a href={c.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline pt-0.5">
                  <ExternalLink className="w-3 h-3" /> Source
                </a>
              )}
              {c.notes && <p className="text-muted-foreground pt-0.5">{c.notes}</p>}
              {c.sfm && (
                <Button
                  size="sm"
                  variant={c.exact_match ? "default" : "outline"}
                  className="w-full h-8 mt-1"
                  onClick={() => onApply({ sfm: c.sfm, chipLoad: c.chip_load_per_tooth })}
                >
                  Apply to calculator
                </Button>
              )}
            </div>
          ))}

          {result.notes && <p className="text-[11px] text-muted-foreground pt-1">{result.notes}</p>}
        </div>
      )}
    </div>
  );
}