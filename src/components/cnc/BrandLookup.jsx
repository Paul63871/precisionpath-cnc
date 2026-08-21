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
      const prompt = `You are a CNC machining expert. A user is looking up a specific cutting tool by its exact manufacturer part number.

Brand: ${brand || "unspecified"}
Part number: ${model || "unspecified"}
Workpiece material: ${materialName || "unspecified"}

STEP 1 — Find the product page: Search the web for the manufacturer's official product page for this exact part number. A simple search of "[brand] [part number]" (e.g. "IMCO 0340538") typically returns the manufacturer's product page as the first result. Use the search result snippets and any retrievable page content.

STEP 2 — Identify the tool: From the actual product page / search results, extract the EXACT product title and the published specifications — tool diameter, flute count, coating, length of cut, and tool type/series. These identity fields MUST come from the real product page.

STEP 3 — Speeds & feeds: If the manufacturer publishes a speeds-and-feeds chart or recommended parameters for this tool in the workpiece material, use those values and set is_estimate=false. If no chart is published, give a best engineering estimate of SFM and chip load per tooth based on the tool's coating/material class and the workpiece material, and set is_estimate=true.

RULES:
- You MUST actually find the manufacturer's product page for this exact part number. Quote its exact product title in product_title.
- Never fabricate the tool's identity (diameter, flutes, coating, series) — these must come from the real product page. If you could not find a product page for this exact part number, set found=false and leave every other field empty.
- SFM and chip load may be engineering estimates when no chart is published, but the tool's geometry/identity must always be real.
- Do not return a "similar" or different tool. If the exact part number isn't found, found=false.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: "gemini_3_1_pro",
        response_json_schema: {
          type: "object",
          properties: {
            found: { type: "boolean" },
            part_number: { type: "string" },
            product_title: { type: "string" },
            description: { type: "string" },
            diameter_in: { type: "number" },
            flutes: { type: "number" },
            coating: { type: "string" },
            tool_type: { type: "string" },
            sfm: { type: "number" },
            chip_load_per_tooth: { type: "number" },
            is_estimate: { type: "boolean" },
            source_url: { type: "string" },
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

  // Exact match is computed from the actual part-number strings, not self-reported
  // by the AI, so it can't be faked for a different tool.
  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const requested = norm(model);
  const exact = result?.found && requested && norm(result.part_number) === requested;
  const isEstimate = result?.is_estimate;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Optionally look up a specific tool by brand and exact model number. We find the manufacturer's product page, pull the real tool specs, and apply its SFM and chip load to your setup.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Brand</Label>
          <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. IMCO" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Model / Part #</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. 0340538" className="h-9" />
        </div>
      </div>
      <Button onClick={lookup} disabled={loading || (!brand && !model)} variant="secondary" className="w-full h-9">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching…</> : <><Search className="w-4 h-4 mr-2" /> Look up tool</>}
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {result && (
        <div className="space-y-2">
          {!result.found ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              No product page found for that part number. Check the number or enter values manually.
            </div>
          ) : (
            <div className={`rounded-lg border p-3 space-y-1.5 text-xs ${exact ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-semibold text-foreground">{result.part_number || "—"}</span>
                {exact ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium"><BadgeCheck className="w-3.5 h-3.5" /> Exact</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-medium"><AlertTriangle className="w-3.5 h-3.5" /> Part # mismatch</span>
                )}
              </div>
              {result.product_title && <p className="font-medium text-foreground">{result.product_title}</p>}
              {result.description && <p className="text-muted-foreground">{result.description}</p>}
              <div className="grid grid-cols-2 gap-y-0.5 font-mono pt-0.5">
                <span className="text-muted-foreground">SFM:</span><span>{result.sfm || "—"}</span>
                <span className="text-muted-foreground">Chip load:</span><span>{result.chip_load_per_tooth || "—"}</span>
                {result.coating && <><span className="text-muted-foreground">Coating:</span><span>{result.coating}</span></>}
                {result.flutes ? <><span className="text-muted-foreground">Flutes:</span><span>{result.flutes}</span></> : null}
                {result.diameter_in ? <><span className="text-muted-foreground">Ø:</span><span>{result.diameter_in}"</span></> : null}
              </div>
              {isEstimate && (
                <p className="text-[11px] text-amber-700 pt-0.5">SFM / chip load are an engineering estimate — no manufacturer chart was published for this tool.</p>
              )}
              {result.source_url && (
                <a href={result.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline pt-0.5">
                  <ExternalLink className="w-3 h-3" /> Source
                </a>
              )}
              {result.notes && <p className="text-muted-foreground pt-0.5">{result.notes}</p>}
              {result.sfm && (
                <Button
                  size="sm"
                  variant={exact ? "default" : "outline"}
                  className="w-full h-8 mt-1"
                  onClick={() => onApply({ sfm: result.sfm, chipLoad: result.chip_load_per_tooth })}
                >
                  Apply to calculator
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}