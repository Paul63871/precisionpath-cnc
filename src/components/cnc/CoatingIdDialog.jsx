import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search } from "lucide-react";

// How to identify an end-mill coating. Color is only a first clue — suppliers
// can change a coating's appearance with process changes or additives, and
// different coatings can look alike. The safe identification order and the
// color-clue table follow published cutting-tool guidance (Sundi Cutting
// Tools coating selection guide; Wikipedia endmill coating table; cnc57
// coating types guide); lab-grade confirmation is XRF/EDS elemental analysis.
const COLOR_CLUES = [
  { color: "Gold / yellow", family: "Usually TiN", note: "The most recognizable coating; general-purpose wear protection." },
  { color: "Blue-gray / gray-purple", family: "Often TiCN or AlCrN-family", note: "Harder than TiN; TiCN less suited to high temperature." },
  { color: "Violet-bronze to dark grey/black", family: "TiAlN / AlTiN family", note: "The most common modern end-mill coatings; several systems look alike." },
  { color: "Mirror-like black", family: "DLC", note: "Smooth carbon structure gives the reflective look." },
  { color: "Silver / bare carbide", family: "Usually uncoated", note: "Confirm against the catalog — not proof by itself." },
];

const MATERIAL_FIT = [
  { material: "Steel / stainless / hardened", coatings: "TiAlN, AlTiN (and their nanocomposite variants)", caution: "" },
  { material: "Aluminum / copper / brass", coatings: "Uncoated polished, ZrN, TiB2, DLC", caution: "Aluminum-containing coatings (TiAlN/AlTiN family) risk chip welding / built-up edge on aluminum." },
  { material: "Titanium / nickel alloys", coatings: "TiAlN / AlTiN family per exact-tool catalog", caution: "Verify the specific tool's rated speeds." },
];

export default function CoatingIdDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-brand" />
            Identify a Tool Coating
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Color is a first clue, not a chemistry test — manufacturers can change appearance without changing
          performance, and several coatings look nearly identical. Identify in this order:
        </p>
        <ol className="list-decimal pl-5 space-y-1 text-xs leading-relaxed">
          <li>Find the supplier and part number on the tool or its packaging.</li>
          <li>Look up that part number in the supplier's catalog or website — the coating trade name and chemical family are listed there.</li>
          <li>Match substrate, edge preparation and the catalog's application table for that exact tool.</li>
          <li>Use color only as a secondary visual check.</li>
        </ol>
        <p className="text-xs text-muted-foreground leading-relaxed">
          If steps 1–3 are unavailable, treat the cutter as unidentified — select
          <strong> Unknown / not confirmed</strong> in the calculator. Lab-grade confirmation is XRF or EDS
          elemental analysis of the surface.
        </p>

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Appearance (clue only)</th>
                <th className="text-left px-3 py-2 font-medium">Common family</th>
              </tr>
            </thead>
            <tbody>
              {COLOR_CLUES.map((c) => (
                <tr key={c.color} className="border-t border-border">
                  <td className="px-3 py-2">{c.color}<div className="text-[10px] text-muted-foreground">{c.note}</div></td>
                  <td className="px-3 py-2">{c.family}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pt-1">Typical material fit</div>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <tbody>
              {MATERIAL_FIT.map((m) => (
                <tr key={m.material} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 align-top whitespace-nowrap">{m.material}</td>
                  <td className="px-3 py-2 align-top">{m.coatings}{m.caution && <div className="text-destructive pt-0.5">{m.caution}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Guidance summary from published cutting-tool references (Sundi Cutting Tools coating selection guide; cnc57 tool coating types; Wikipedia endmill). Not a substitute for the exact tool's catalog data.
        </p>
      </DialogContent>
    </Dialog>
  );
}
