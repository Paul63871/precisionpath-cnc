// Tool-only values. All lengths are inches, independent of display units.
const grade = ["gradeId"];
const insert = ["shapeId", "ic", "noseRadius"];
export const toolFields = {
  milling: ["toolTypeId", "toolMaterialId", "coatingId", "diameter", "flutes", "loc", "inserts",
    "cornerRadius", "insertIc", "includedAngle", "tipDiameter", "leadAngle", "pointAngle",
    "thickness", "neckDiameter", "threadId", "tapStyle", "helixAngle", "pitch"],
  turn_insert: [...grade, ...insert],
  turn_bar: [...grade, ...insert, "barId", "barDiameter", "barOverhang"],
  turn_drill: [...grade, "drillDiameter"],
  turn_groove: [...grade, "shapeId", "ic", "width"],
  turn_parting: [...grade, "shapeId", "ic", "width"],
  turn_thread: grade,
};

const ids = new Set(["toolTypeId", "toolMaterialId", "coatingId", "threadId", "tapStyle", "helixAngle", "gradeId", "shapeId", "barId"]);

export function pickToolSpecs(kind, input) {
  if (!Object.hasOwn(toolFields, kind) || !input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(toolFields[kind].filter((key) => Object.hasOwn(input, key)).map((key) => [key, input[key]]));
}

export function validToolSpecs(kind, input) {
  const specs = pickToolSpecs(kind, input);
  if (Object.entries(specs).some(([key, value]) => ids.has(key)
    ? typeof value !== "string" || !/^[A-Za-z0-9_.-]{1,80}$/.test(value)
    : typeof value !== "number" || !Number.isFinite(value) || value < 0 ||
      (["flutes", "inserts"].includes(key) && (!Number.isSafeInteger(value) || value < 1)))) return null;
  if (kind === "milling") {
    if (!specs.toolTypeId || !specs.toolMaterialId || !specs.coatingId || !(specs.diameter > 0)) return null;
    if (specs.toolTypeId === "tap" && specs.threadId === "custom" && !(specs.pitch > 0)) return null;
  } else if (!specs.gradeId ||
    (toolFields[kind]?.includes("shapeId") && (!specs.shapeId || !(specs.ic > 0))) ||
    (kind === "turn_bar" && (!specs.barId || !(specs.barDiameter > 0) || !(specs.barOverhang > 0))) ||
    (kind === "turn_drill" && !(specs.drillDiameter > 0))) return null;
  return specs;
}
