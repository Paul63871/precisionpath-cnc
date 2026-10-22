// Process planning and transparent application policy, NOT universal tool limits.
// Manufacturer numbers are STARTING data, not guaranteed breakage thresholds:
// https://www.harveyperformance.com/machining-advisor-pro-user-guide/
// https://www.harveyperformance.com/in-the-loupe/speeds-and-feeds-101/
export const PROCESS_SOURCES = {
  basics: "https://www.harveyperformance.com/in-the-loupe/speeds-and-feeds-101/",
  starting: "https://www.harveyperformance.com/machining-advisor-pro-user-guide/",
  stock: "https://www.secotools.com/article/finish_stock_allowance_with_solid_end_mills",
  corners: "https://www.sandvik.coromant.com/en-us/knowledge/milling/milling-inside-corners",
  circle: "https://www1.mscdirect.com/images/solutions/kennametal/millingTechInfoInterpolation.pdf",
  tap: "https://www.tapmatic.com/tapping_questions_tapping_formulas.ydev",
};

const positive = (v, fallback = 0) => Number.isFinite(v) && v > 0 ? v : fallback;
export const validPriority = (p) => ["finish", "life", "balanced", "speed"].includes(p) ? p : "balanced";

export function processPolicy(slider, priority) {
  const setting = Math.max(0, Math.min(1, Number.isFinite(slider) ? slider : 0.6));
  const objective = validPriority(priority);
  // ESTIMATE / APPLICATION POLICY: reserve 20% of entered continuous HP at
  // the highest setting. This is not a manufacturer or physics-derived safety
  // factor, and does not certify tool strength or spindle torque availability.
  const powerFraction = 0.20 + 0.60 * setting;
  // ESTIMATE: choose within, not above, the stored speed window. Life biases
  // cutting speed down, rather than starving chip thickness toward rubbing.
  const speedPosition = setting * (objective === "life" ? 0.45 : 0.80);
  return { setting, objective, powerFraction, speedPosition, estimate: true };
}

export function stockPlan(op, diameter, finishDiameter = 0) {
  const id = op.id;
  const isFace = op.docMode === "face" || /^facing|^face_/.test(id);
  const hole = op.docMode === "drill" || op.docMode === "tap" || op.kind === "drill" || op.kind === "thread";
  const noStock = hole || /thread|engrave|chamfer|trace|parting|groov/.test(id);
  const wallOnly = /contour|bore|boss|profile|slot/.test(id) || op.kind === "od" || op.kind === "id";
  const finish = !!(op.finishing || op.finish);
  const pocket = /pocket|adaptive/.test(id);
  const surface = /parallel|scallop|pencil|morph|radial|spiral|flow|horizontal|3plus2|5axis/.test(id);
  const D = positive(finishDiameter, diameter);
  // Seco 1-2% refers to the FINISH cutter, especially hard milling, not a
  // material-universal floor allowance. Here midpoint is an ESTIMATE outside
  // that scope. If finish cutter is unknown, current diameter is provisional.
  const allowance = finish || noStock ? 0 : D * 0.015;
  const radial = isFace || noStock || surface ? 0 : allowance;
  const axial = isFace || pocket ? allowance : 0;
  const normal = surface ? allowance : 0;
  return {
    radial, axial, normal, estimate: !finish && !noStock,
    radialApplicable: !isFace && !noStock && !surface,
    axialApplicable: isFace || pocket, normalApplicable: surface,
    basisDiameter: D, finishToolKnown: positive(finishDiameter) > 0,
    source: PROCESS_SOURCES.stock,
    reason: finish
      ? "Final finishing pass: leave zero on the surfaces being finished. Incoming stock is a separate input, not stock to leave."
      : noStock
        ? "This operation uses finished feature dimensions; no generic wall/floor finish allowance is assigned."
        : isFace
          ? "Facing machines a plane: leave zero radial stock. Only an axial allowance for a later face finish is relevant."
          : /slot/.test(id)
            ? "Slot width is not specified. A radial finishing reserve only makes sense if the cutter/strategy leaves the slot undersize; no automatic floor allowance is assumed."
          : wallOnly
            ? "Wall contour/bore: reserve radial wall stock, not an automatic floor allowance. A separate floor operation controls its own axial stock."
            : surface
              ? "3D surface roughing: allowance is normal to the surface, not a universal radial or axial offset."
              : "Pocket/adaptive roughing: reserve wall and floor stock separately; rest-rough corners before the final finish.",
  };
}

export function contourCorner(input, result) {
  const { operationId = "", previousToolDiameter, previousStock, insideCornerRadius, cornerAngleDeg } = input;
  // No internal corner, no corner model. A prior cutter alone must not turn
  // a straight/outside contour into an impossible zero-radius inside corner.
  if (!( /contour|waterline/.test(operationId) || operationId === "3d_pocket") || !(positive(previousToolDiameter) > 0) || !(positive(insideCornerRadius) > 0)) return null;
  const D = positive(input.diameter);
  const R = positive(insideCornerRadius);
  const s = Number.isFinite(previousStock) && previousStock >= 0 ? previousStock : 0;
  const angle = Number.isFinite(cornerAngleDeg) && cornerAngleDeg > 0 && cornerAngleDeg < 180 ? cornerAngleDeg : 90;
  const csc = 1 / Math.sin(angle * Math.PI / 360);
  const previousRadius = Math.max(previousToolDiameter / 2, R - s);
  // Analytic PLANAR tangent-fillet model. Along the bisector, tangent fillet
  // location = r*(csc(theta/2)-1), wall offset contributes s*csc(theta/2).
  // This is not CAD stock simulation and is not a radial engagement integral.
  const cornerStock = Math.max(s, s * csc + (previousRadius - R) * (csc - 1));
  const straight = s;
  const nominal = positive(result.woc);
  const excess = cornerStock > nominal + 1e-6;
  const fits = R > D / 2;
  const factor = fits ? (R - D / 2) / R : 0; // Kennametal ID centerline correction
  const restPassesEstimate = nominal > 0 ? Math.ceil(cornerStock / nominal) : null;
  const stockKnown = Number.isFinite(previousStock) && previousStock >= 0;
  const feedMode = input.cornerFeedMode || "auto";
  const validMode = ["auto", "cap", "rest"].includes(feedMode);
  const capValid = Number.isFinite(input.cornerFeedPercent) && input.cornerFeedPercent > 0 && input.cornerFeedPercent <= 100;
  const feedBlockReason = !validMode ? "Choose a listed inside-corner feed strategy."
    : !stockKnown ? "Enter actual previous radial stock (including zero) before using a corner-feed recommendation."
      : feedMode === "rest" ? "Rest-clear / semi-finish first is selected. Verify the remaining stock in CAM, then select a feed strategy for the final pass."
        : feedMode === "cap" && !capValid ? "Enter a corner feed cap greater than 0 and no more than 100 percent of straight-wall feed."
          : null;
  const geometricFeed = result.ipm * factor;
  const limitedFeed = feedMode === "cap" && capValid
    ? Math.min(geometricFeed, result.ipm * input.cornerFeedPercent / 100) : geometricFeed;
  return {
    previousToolDiameter, previousStock: s, previousStockKnown: stockKnown,
    radius: R, angle, previousRadius, straightStock: straight, cornerStock,
    nominalWoc: nominal, exceedsStepover: excess, fits,
    restPassesEstimate, centerlineFactor: factor,
    // No single-pass feed recommendation when stock exceeds intended WOC.
    // Slowing alone cannot certify a deep, suddenly-engaged inside corner.
    cornerFeedIpm: fits && !excess && !feedBlockReason ? limitedFeed : null,
    feedMode, feedBlockReason, straightFeedIpm: result.ipm,
    geometricFeedIpm: fits ? geometricFeed : null,
    feedPercent: fits && !excess && !feedBlockReason && result.ipm > 0 ? limitedFeed / result.ipm * 100 : null,
    userFeedCapPercent: feedMode === "cap" && capValid ? input.cornerFeedPercent : null,
    estimate: true, is3D: /3d_/.test(operationId),
    reason: excess
      ? "Corner stock exceeds the calculated radial pass. Use rest/adaptive clearing or semi-finishing first; do not run the straight-wall feed into this corner."
      : "Planar corner stock is within the nominal pass. Reduce centerline feed around the inside radius and confirm engagement in CAM.",
    source: PROCESS_SOURCES.corners,
  };
}

export function calculationReasoning({ op, mat, tool, policy, rpm, actualSfm, targetSfm, ipm, chipLoad, fpt, woc, doc, stock, override, limits }) {
  const hole = tool.isDrill || op.docMode === "drill";
  const tap = tool.isTap || op.docMode === "tap";
  const strategy = tap ? "Pitch synchronization controls feed; speed changes must change feed with it."
    : hole ? "Drill feed is per spindle revolution, not per tooth. Hole depth and chip evacuation determine cycle choice."
      : op.docMode === "face" ? "A wide radial sweep cuts the face with a shallow axial pass. Radial stepover is not radial stock to leave."
        : op.docMode === "hem" ? "Adaptive clearing uses small radial engagement and greater axial engagement. Its chip-thinning feed is valid only while engagement is controlled."
          : op.docMode === "slot" ? "Full-width slotting engages the cutter heavily; no radial chip-thinning increase applies."
            : op.finishing ? "Finishing uses light, consistent incoming stock. Feed marks/scallop estimates are geometric targets, not a measured surface-finish guarantee."
              : op.circular ? "Circular paths require separate cutting-edge and programmed centerline feeds. Entry from solid needs its own ramp settings."
                : "Cutting load is set by radial width, axial depth and chip thickness together. The cutter/holder and remaining stock still require CAM verification.";
  return [
    { label: op.name, text: strategy },
    { label: "Speed", text: `${override?.sfm ? "Entered/lookup" : "Generic material/tool"} speed target ${targetSfm.toFixed(1)} SFM; actual ${actualSfm.toFixed(1)} SFM at ${rpm.toFixed(0)} RPM. RPM = SFM × 3.82 ÷ effective cutting diameter. ${mat.name} data does not encode your exact tool geometry or material hardness.`, source: PROCESS_SOURCES.basics },
    { label: "Feed", text: tap ? `Feed = RPM × thread pitch; ${ipm.toFixed(2)} IPM. Never lower only feed.`
      : `${ipm.toFixed(2)} IPM; base ${chipLoad.toFixed(5)} ${hole ? "in/rev" : "in/tooth"}, programmed ${fpt.toFixed(5)} ${hole ? "in/rev" : "in/tooth"}. ${hole ? "No flute multiplier." : "Feed = RPM × effective teeth × programmed feed/tooth; actual feed limits are applied afterward."}`, source: tap ? PROCESS_SOURCES.tap : PROCESS_SOURCES.basics },
    { label: "Engagement", text: `DOC ${doc.toFixed(4)} in; radial WOC ${woc.toFixed(4)} in. User-pinned depths/widths are still limited by cutting length and power; they do not override physical constraints.` },
    { label: "Stock to leave", text: stock.reason, source: stock.source },
    { label: "Slider and objective", text: `${policy.objective}; setting ${Math.round(policy.setting * 100)}%. Maximum power budget ${Math.round(policy.powerFraction * 100)}% of entered HP. At 100% this application still reserves 20% HP. These policy margins are engineering estimates, not a proven tool-strength limit.` },
    { label: "Verification limits", text: `${limits || "Generic starting recommendation, not exact-tool validation."} Power, deflection, finish, coating/material multipliers and allowances are estimates. A coating name does not enable a generic speed boost above the coated baseline. Verify tool catalog, material condition, runout, coolant, holder, workholding and CAM stock; prove out the cut.`, source: PROCESS_SOURCES.starting },
  ];
}
