import React from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import referenceText from "./referenceText";

export default function Reference() {
  const downloadTxt = () => {
    const blob = new Blob([referenceText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "PrecisionPath_CNC_Reference.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex gap-2 mb-4 print:hidden">
        <Button onClick={downloadTxt} size="sm"><Download className="w-4 h-4 mr-2" />Download .txt</Button>
        <Button onClick={() => window.print()} variant="outline" size="sm"><Printer className="w-4 h-4 mr-2" />Print / Save as PDF</Button>
      </div>
      <pre className="whitespace-pre-wrap text-[11px] leading-relaxed font-mono bg-card border rounded-lg p-4">
{referenceText}
      </pre>
    </div>
  );
}