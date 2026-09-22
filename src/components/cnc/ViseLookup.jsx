import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2, AlertTriangle, ExternalLink, BadgeCheck, ShieldAlert } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Client-side result cache — same brand+model lookup within a session reuses
// the prior answer instead of re-running the LLM+web search every time.
const lookupCache = new Map();

// Plausibility bounds for a REPORTED vise clamping force. Real vises span
// roughly 500 lbf (small hobby/toolmaker vises) up to ~26,000 lbf (large
// industrial CNC vises like Kurt's D100 at max torque) — anything outside a
// generous margin around that band is more likely a hallucination, a unit
// mix-up (kN vs lbf), or a mismatched product page than a genuine value.
// Sources for the real-world range used here:
// https://www.kurtworkholding.com/wp-content/uploads/2020/05/2015-Kurt-Vise-Selection-Guide.pdf
// https://www.penntoolco.com/content/Kurt-D-Series-Vise.pdf (D100 up to 26,277 lbf)
// https://thetoolstrunk.com/best-bench-vises/ (small vises ~1,200-4,400 lbf)
function plausibilityCheck(res) {
  const flags = [];
  if (!res.source_url) flags.push("No source URL was returned — this value cannot be independently verified.");
  if (res.clamp_force_lbf != null) {
    if (res.clamp_force_lbf < 200 || res.clamp_force_lbf > 35000) {
      flags.push(`Reported clamping force (${res.clamp_force_lbf} lbf) is far outside the range real vises publish (roughly 500-26,000 lbf) — double-check units (kN vs lbf) before trusting this value.`);
    }
  }
  if (res.jaw_width_in && (res.jaw_width_in <= 0 || res.jaw_width_in > 24)) {
    flags.push(`Reported jaw width (${res.jaw_width_in}") looks implausible for a milling vise.`);
  }
  if (res.rated_torque_ftlb && res.clamp_force_lbf && res.rated_torque_ftlb > 0) {
    // Sanity ratio: force/torque for real vises (per sourced charts above)
    // typically lands somewhere around 60-200 lbf of clamp per ft-lb of
    // torque, depending on vise design (AngLock, screw pitch, etc). Wildly
    // outside that is worth a second look, not an automatic reject.
    const ratio = res.clamp_force_lbf / res.rated_torque_ftlb;
    if (ratio < 20 || ratio > 400) {
      flags.push(`The reported force-to-torque ratio (${ratio.toFixed(0)} lbf per ft-lb) is unusual for a manual vise — worth confirming against the manufacturer's own chart.`);
    }
  }
  return flags;
}

// Maps the LLM's free-text jaw_type description to a WORKHOLDING_JAW_TYPES
// id (cncData.js) so the friction coefficient updates along with the force,
// not just the number. Defaults to smooth_steel (the conservative case) when
// the description doesn't clearly indicate a grippier jaw style.
function guessJawTypeId(jawTypeText) {
  const t = (jawTypeText || "").toLowerCase();
  if (t.includes("serrat") || t.includes("waffle") || t.includes("pyramid")) return "serrated";
  if (t.includes("soft") || t.includes("conform")) return "soft_jaw";
  if (t.includes("diamond") || t.includes("grip")) return "grippy_plate";
  return "smooth_steel";
}

export default function ViseLookup({ onApply }) {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [torque, setTorque] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [flags, setFlags] = useState([]);
  const [error, setError] = useState("");
  const [fromCache, setFromCache] = useState(false);

  const lookup = async () => {
    if (!brand && !model) return;
    setLoading(true);
    setError("");
    setResult(null);
    setFlags([]);
    setFromCache(false);

    const torqueNote = torque ? ` The user applies approximately ${torque} ft-lbs of torque to the handle.` : "";
    const cacheKey = `${brand.trim().toLowerCase()}|${model.trim().toLowerCase()}|${torque || ""}`;
    if (lookupCache.has(cacheKey)) {
      const cached = lookupCache.get(cacheKey);
      setResult(cached);
      setFlags(cached.found ? plausibilityCheck(cached) : []);
      setFromCache(true);
      setLoading(false);
      return;
    }

    try {
      const prompt = `You are a CNC workholding expert. A machinist is looking up the actual RATED CLAMPING FORCE of their specific vise by brand and model, so a feeds-and-speeds calculator can check whether the vise can resist a given cutting force without the part slipping or being pulled out.

Brand: ${brand || "unspecified"}
Model / part number: ${model || "unspecified"}${torqueNote}

STEP 1 — Find the product page or spec sheet: Search the web for the manufacturer's official product page, spec sheet, or installation manual for this exact vise model (e.g. "Kurt D688 clamping force", "Kurt DX6 manual clamping force chart"). Manufacturers like Kurt, Gerardi, Chick, TE-CO, Orange Vise, and Toolex all publish clamping-force-vs-torque charts or a single maximum clamping force spec.

STEP 2 — Identify the vise: From the real product page, extract the exact model name/number, jaw width, and jaw type (smooth/serrated/soft-jaw — state what ships standard).

STEP 3 — Clamping force: Manufacturers often publish clamping force as a TABLE vs handle torque (e.g. "60 ft-lbs -> 5,391 lbf") rather than one fixed number. If the user gave an applied torque, read the table at (or interpolated near) that torque and report that as clamp_force_lbf, and set the torque you used as rated_torque_ftlb. If no torque was given, or no table exists, report the manufacturer's MAXIMUM rated clamping force at their recommended/max torque as clamp_force_lbf, and rated_torque_ftlb as the torque that maximum corresponds to. Always report force in POUNDS-FORCE (lbf) — if the source publishes kN, convert (1 kN = 224.8 lbf) and note the conversion in notes.

RULES:
- You MUST find the actual manufacturer product page, spec sheet, or manual for this exact model. Quote the exact model name in model_name.
- Never fabricate the clamping force — it must come from a real published chart or spec. If you cannot find a real source for this exact model, set found=false and leave every other field empty.
- Do not substitute a "similar" or different model's specs. If the exact model isn't found, found=false.
- State clearly in notes whether the value is the vise's MAXIMUM rated force, or a value read from the torque table at the user's stated torque.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: "gemini_3_1_pro",
        response_json_schema: {
          type: "object",
          properties: {
            found: { type: "boolean" },
            model_name: { type: "string" },
            brand_name: { type: "string" },
            jaw_width_in: { type: "number" },
            jaw_type: { type: "string" },
            clamp_force_lbf: { type: "number" },
            rated_torque_ftlb: { type: "number" },
            is_max_rating: { type: "boolean" },
            source_url: { type: "string" },
            notes: { type: "string" },
          },
        },
      });
      // A claim with no source URL is not actually verified — flag it via
      // plausibilityCheck rather than silently trusting an uncited figure.
      lookupCache.set(cacheKey, res);
      setResult(res);
      setFlags(res.found ? plausibilityCheck(res) : []);
    } catch (e) {
      setError("Lookup failed. Try again or enter the clamping force manually.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Look up your vise's actual rated clamping force by brand and model — no need to dig up the spec sheet yourself. We find the manufacturer's published clamping-force chart and apply it to the workholding check above.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Vise Brand</Label>
          <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Kurt" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Model / Part #</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. D688 or DX6" className="h-9" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Handle Torque Applied (ft-lbs, optional)</Label>
        <Input value={torque} onChange={(e) => setTorque(e.target.value)} placeholder="e.g. 60 — leave blank for max rating" className="h-9" type="number" />
      </div>
      <Button onClick={lookup} disabled={loading || (!brand && !model)} variant="secondary" className="w-full h-9">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching…</> : <><Search className="w-4 h-4 mr-2" /> Look up vise clamping force</>}
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {result && (
        <div className="space-y-2">
          {!result.found ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              No published clamping-force spec found for that model. Check the brand/model or enter the force manually.
            </div>
          ) : (
            <div className={`rounded-lg border p-3 space-y-1.5 text-xs ${flags.length === 0 ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-semibold text-foreground">{result.model_name || model || "—"}</span>
                {flags.length === 0 ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium"><BadgeCheck className="w-3.5 h-3.5" /> Verified</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-medium"><AlertTriangle className="w-3.5 h-3.5" /> Check value</span>
                )}
              </div>
              {result.brand_name && <p className="font-medium text-foreground">{result.brand_name}</p>}
              <div className="grid grid-cols-2 gap-y-0.5 font-mono pt-0.5">
                <span className="text-muted-foreground">Clamp force:</span><span>{result.clamp_force_lbf ? `${Math.round(result.clamp_force_lbf)} lbf` : "—"}</span>
                {result.rated_torque_ftlb ? <><span className="text-muted-foreground">At torque:</span><span>{result.rated_torque_ftlb} ft-lbs</span></> : null}
                {result.jaw_width_in ? <><span className="text-muted-foreground">Jaw width:</span><span>{result.jaw_width_in}"</span></> : null}
                {result.jaw_type && <><span className="text-muted-foreground">Jaw type:</span><span>{result.jaw_type}</span></>}
              </div>
              {result.is_max_rating === false && (
                <p className="text-[11px] text-muted-foreground pt-0.5">This is the force at your stated torque, not the vise's absolute maximum — apply more torque (within the manufacturer's recommended limit) for more grip if needed.</p>
              )}
              {result.source_url && (
                <a href={result.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline pt-0.5">
                  <ExternalLink className="w-3 h-3" /> Source
                </a>
              )}
              {result.notes && <p className="text-muted-foreground pt-0.5">{result.notes}</p>}
              {fromCache && <p className="text-[10px] text-muted-foreground/70 italic">Reused from an earlier lookup this session.</p>}
              {flags.length > 0 && (
                <div className="rounded-md border border-red-300 bg-red-50 p-2 space-y-1">
                  {flags.map((f, i) => (
                    <p key={i} className="flex items-start gap-1.5 text-[11px] text-red-700">
                      <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {f}
                    </p>
                  ))}
                </div>
              )}
              {result.clamp_force_lbf && (
                <Button
                  size="sm"
                  variant={flags.length === 0 ? "default" : "outline"}
                  className="w-full h-8 mt-1"
                  onClick={() => onApply({ clampForce: Math.round(result.clamp_force_lbf), jawTypeId: guessJawTypeId(result.jaw_type) })}
                >
                  {flags.length > 0 ? "Apply anyway (unverified)" : "Apply to calculator"}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
