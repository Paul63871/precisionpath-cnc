// Linked process estimates, not generated CAM toolpaths. Both engines call
// their single-operation calculator here, so finishing can never recurse.
export function millingFinishCompanion(input, rough, calculateSingle) {
  const stock = rough.stockPlan;
  if (!stock?.estimate || !(stock.radial > 0 || stock.axial > 0 || stock.normal > 0)) return null;
  const diameter = Number.isFinite(input.finishToolDiameter) && input.finishToolDiameter > 0
    ? input.finishToolDiameter : input.diameter;
  const changedTool = Math.abs(diameter - input.diameter) > 1e-9;
  const assumptions = [
    "Finishing is recalculated with your selected objective and the same slider/machine limits (Surface quality if no objective is supplied). Stock to leave is zero; incoming stock comes from the roughing reserve.",
    changedTool
      ? "Different finish diameter: flute count, material, coating, cutting length and geometry are still inherited. These are provisional values; select the actual finish cutter separately before use."
      : "Same cutter assumed. If a dedicated finish tool is used, recalculate with its actual geometry, grade, flutes and cutting length.",
    "Roughing must actually leave this allowance in CAM. Rest-clear excess corner stock first; no stock simulation or G-code is generated.",
  ];
  const steps = [];
  const common = {
    ...input, diameter, priority: input.priority || "finish",
    targetRa: input.targetRa > 0 ? input.targetRa : input.priority === "speed" ? 63 : 32,
    radialLoad: undefined, axialDoc: undefined, finishToolDiameter: undefined,
    previousToolDiameter: undefined, previousStock: undefined,
    insideCornerRadius: undefined, cornerAngleDeg: undefined,
    // A brand/tool override for the rough cutter is not a verified finish chart.
    override: undefined, entryMethod: "predrilled", helixDiameter: undefined,
  };
  const add = (label, operationId, incoming, pins, extra = []) => {
    const result = calculateSingle({ ...common, operationId, ...pins });
    if (!result) return;
    const reasons = [...(result.blockingReasons || [])];
    if (rough.runnable === false) reasons.push("Correct the blocked roughing setup before using this linked finish plan.");
    if (changedTool) reasons.push("Verify the actual finish tool; diameter alone is not a complete tool definition.");
    if (["corner_round", "concave_radius", "t_slot", "slitting_saw", "chamfer"].includes(input.toolTypeId)) {
      reasons.push("Form/slot cutter: confirm the actual cutting profile and finish contact in CAM; generic wall/floor engagement is insufficient.");
    }
    // Conservatively retain all reasons instead of making a blocked rough cut
    // appear approved simply because the lighter companion cut meets its caps.
    result.blockingReasons = [...new Set(reasons)];
    result.runnable = reasons.length === 0;
    steps.push({ label, operationId, incoming, diameter, result, notes: extra });
  };
  const id = input.operationId || "";
  if (stock.radial > 0) {
    const operationId = /boss/.test(id) ? "2d_circular_boss_finish"
      : /bore|circular_pocket/.test(id) && input.featureDiameter > 0 ? "2d_bore_finish"
        : /^3d_/.test(id) ? "3d_waterline" : "2d_contour_finish";
    add("Wall finish", operationId, { radial: stock.radial, axial: 0, normal: 0 }, {
      radialLoad: stock.radial,
      // Use actual feature height when known, otherwise the roughing pass
      // height. Do not inherit a manually pinned roughing DOC.
      featureDepth: input.featureDepth > 0 ? input.featureDepth : rough.doc,
      ...(input.insideCornerRadius > 0 ? {
        previousToolDiameter: input.diameter, previousStock: stock.radial,
        insideCornerRadius: input.insideCornerRadius, cornerAngleDeg: input.cornerAngleDeg,
      } : {}),
    }, /slot/.test(id) ? [
      "Conditional: the slot must have room for a side finish. A full-width cutter cannot leave stock on both walls at final slot width; use an undersize rougher/finish cutter and verify the slot dimensions.",
    ] : []);
  }
  if (stock.axial > 0) {
    add(/facing/.test(id) ? "Face finish" : "Floor finish", "facing_finish",
      { radial: 0, axial: stock.axial, normal: 0 },
      { axialDoc: stock.axial, featureDepth: stock.axial },
      /^3d_/.test(id) ? ["Planar floor only. Slopes and sculpted floors need a separate normal-stock finishing strategy."] : []);
  }
  if (stock.normal > 0) {
    add("3D surface finish (reference)", "3d_parallel",
      { radial: 0, axial: 0, normal: stock.normal },
      { axialDoc: stock.normal, featureDepth: stock.normal },
      ["Conditional horizontal-reference calculation only: normal allowance is not generally axial DOC. Confirm slope, tool orientation, contact diameter and engagement in CAM; these values are not a validated multi-axis toolpath."]);
  }
  return { steps, assumptions, estimate: true };
}

export function turningFinishCompanion(input, rough, calculateSingle) {
  if (rough.error || rough.op?.finishing || !["od", "id", "face"].includes(rough.kind)) return null;
  const stock = rough.stockPlan;
  const allowance = rough.kind === "face" ? stock.axial : stock.radial;
  if (!(allowance > 0)) return { steps: [], estimate: true, assumptions: ["No positive stock is available for a separate finish pass. Correct the stock dimensions before planning roughing plus finishing."] };
  const D0 = Number.isFinite(input.workDiameter) ? input.workDiameter : 1;
  const D1 = Number.isFinite(input.finishDiameter) ? input.finishDiameter : rough.kind === "id" ? D0 + 0.1 : D0 - 0.2;
  const workDiameter = rough.kind === "face" ? D0 : D1 + (rough.kind === "id" ? -2 : 2) * allowance;
  const operationId = `${rough.kind === "id" ? "bore" : rough.kind}_finish`;
  const result = calculateSingle({ ...input, operationId, priority: input.priority || "finish", workDiameter, finishDiameter: D1, faceStock: allowance });
  if (!result || result.error) return { steps: [], estimate: true, assumptions: [result?.error || "Finish calculation unavailable."] };
  if (rough.runnable === false) {
    result.runnable = false;
    result.blockingReasons = [...(result.blockingReasons || []), "Correct the blocked roughing setup before using this linked finish plan."];
  }
  return {
    estimate: true,
    assumptions: [
      "Same insert, holder and machine assumed. Finishing uses your selected objective and the same slider (Surface quality if no objective is supplied); verify chipbreaker minimum depth and nose-radius engagement.",
      "Reserve is an application estimate: up to 0.015 in per side/axially, or half the available stock when thinner. This is not a universal insert specification.",
    ],
    steps: [{
      label: rough.kind === "face" ? "Face finish" : `${rough.kind.toUpperCase()} finish`,
      operationId, incoming: { radial: stock.radial, axial: stock.axial, normal: 0 },
      workDiameter, finishDiameter: D1, result, notes: [],
    }],
  };
}
