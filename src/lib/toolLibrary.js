import { base44 } from "@/api/base44Client";
import { TOOL_TYPES, TOOL_MATERIALS, COATINGS, HELIX_ANGLES, THREAD_TABLE, TAP_STYLES } from "@/lib/cncData";
import { TURNING_GRADES, INSERT_SHAPES, IC_SIZES, NOSE_RADII, BORING_BARS } from "@/lib/turningData";
import { pickToolSpecs, validToolSpecs } from "../../base44/functions/toolLibrary/specs.mjs";

export const previewLibrary = import.meta.env.VITE_STATIC_PREVIEW === "true";
export const previewLibraryId = "preview-personal";
const previewKey = "precisionpath-preview-tool-library-v1";
let previewTools = [];

export const libraryFamilyName = {
  milling: "Milling & hole-making", turn_insert: "OD & facing inserts", turn_bar: "Boring bars",
  turn_drill: "Lathe drills", turn_groove: "Grooving tools", turn_parting: "Parting tools", turn_thread: "Threading tools",
};

const inCatalog = (rows, value) => rows.some(({ id }) => id === value);
export function currentToolSpecs(kind, input) {
  if (kind !== "milling") return pickToolSpecs(kind, input);
  const type = TOOL_TYPES.find(({ id }) => id === input.toolTypeId);
  const specs = pickToolSpecs(kind, input);
  const tapMajor = type?.isTap ? THREAD_TABLE.find(({ id }) => id === input.threadId)?.major : null;
  if (tapMajor != null) specs.diameter = tapMajor;
  const relevant = new Set(["toolTypeId", "toolMaterialId", "coatingId", "diameter", ...(type?.fields ?? []),
    ...(type?.isTap && input.threadId === "custom" ? ["pitch"] : [])]);
  return Object.fromEntries(Object.entries(specs).filter(([key]) => relevant.has(key)));
}

export function loadableToolSpecs(kind, input) {
  const specs = validToolSpecs(kind, input);
  if (!specs) return null;
  if (kind === "milling") {
    if (!inCatalog(TOOL_TYPES, specs.toolTypeId) || !inCatalog(TOOL_MATERIALS, specs.toolMaterialId) ||
        !inCatalog(COATINGS, specs.coatingId) || (specs.helixAngle && !inCatalog(HELIX_ANGLES, specs.helixAngle)) ||
        (specs.threadId && !inCatalog(THREAD_TABLE, specs.threadId)) || (specs.tapStyle && !inCatalog(TAP_STYLES, specs.tapStyle)) ||
        (specs.toolTypeId === "tap" && !["hss", "cobalt"].includes(specs.toolMaterialId))) return null;
  } else if (!inCatalog(TURNING_GRADES, specs.gradeId) ||
      (specs.shapeId && !inCatalog(INSERT_SHAPES, specs.shapeId)) ||
      (specs.ic !== undefined && !IC_SIZES.includes(specs.ic)) ||
      (specs.noseRadius !== undefined && !NOSE_RADII.some(({ value }) => value === specs.noseRadius)) ||
      (specs.barId && !inCatalog(BORING_BARS, specs.barId))) return null;
  return specs;
}

export async function libraryRequest(payload) {
  if (!previewLibrary) {
    try {
      const response = await base44.functions.invoke("toolLibrary", payload);
      if (!response.data || !Object.hasOwn(response.data, "result")) throw new Error("Unexpected tool library response.");
      return response.data.result;
    } catch (error) {
      throw new Error(error.response?.data?.error || "The tool library is unavailable. Try again shortly.");
    }
  }
  if (payload.action === "libraries") return [{ id: previewLibraryId, name: "My preview library", owned: true }];
  if (payload.ownerId !== previewLibraryId) throw new Error("This preview library is not available.");
  // Opaque preview frames may block storage. In that case, stay in memory.
  try {
    const stored = JSON.parse(localStorage.getItem(previewKey));
    if (Array.isArray(stored)) previewTools = stored;
  } catch { /* browser storage unavailable */ }
  const { action, kind, toolId, revision } = payload;
  if (action === "list") return structuredClone(previewTools.filter((tool) => tool.kind === kind));
  const index = previewTools.findIndex((tool) => tool.id === toolId && tool.kind === kind && tool.revision === revision);
  if (["update", "delete"].includes(action) && index === -1) throw new Error("This tool changed. Load the latest copy or save a new tool.");
  let saved = null;
  if (action === "delete") previewTools.splice(index, 1);
  else if (["create", "update"].includes(action)) {
    const name = payload.name?.trim();
    const specs = loadableToolSpecs(kind, payload.specs);
    if (!name || name.length > 100 || !specs) throw new Error("Enter a tool name and valid tool dimensions before saving.");
    saved = { id: action === "create" ? crypto.randomUUID() : toolId, revision: crypto.randomUUID(), name, kind, specs };
    if (action === "create") previewTools.push(saved);
    else previewTools[index] = saved;
  } else throw new Error("Coworker sharing requires the hosted Base44 app.");
  try { localStorage.setItem(previewKey, JSON.stringify(previewTools)); } catch { /* browser storage unavailable */ }
  return structuredClone(saved);
}
