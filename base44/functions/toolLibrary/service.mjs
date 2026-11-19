import { toolFields, validToolSpecs } from "./specs.mjs";

export class LibraryError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const missing = () => new LibraryError(404, "This library or tool is no longer available.");
const conflict = () => new LibraryError(409, "This tool has changed. Refresh and load the latest version, or save your changes as a new tool.");
const id = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const toolView = ({ id, name, kind, specs, revision }) => ({ id, name, kind, specs, revision });

async function all(entity, query) {
  const records = [];
  for (let offset = 0; ; offset += 100) {
    const page = await entity.filter(query, "id", 100, offset);
    records.push(...page);
    if (page.length < 100) return records;
  }
}

export async function runLibrary(entities, user, input) {
  if (!id(user?.id)) throw new LibraryError(401, "Sign in to use your tool library.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new LibraryError(400, "Invalid request.");
  const { LibraryTool: tools, ToolLibraryGrant: grants } = entities;
  const { action, ownerId = user.id, kind } = input;
  if (action === "libraries") {
    const shared = await all(grants, { editor_id: user.id });
    return [{ id: user.id, name: "My library", owned: true }, ...new Map(shared.map((grant) => [
      grant.owner_id, { id: grant.owner_id, name: grant.owner_label, owned: false },
    ])).values()];
  }
  if (!id(ownerId)) throw missing();
  const owned = ownerId === user.id;
  if (["editors", "share", "revoke"].includes(action)) {
    if (!owned) throw missing();
    if (action === "editors") return (await all(grants, { owner_id: user.id }))
      .map(({ editor_id, editor_email }) => ({ id: editor_id, email: editor_email }));
    if (action === "revoke") {
      if (!id(input.editorId)) throw new LibraryError(400, "Invalid editor.");
      await grants.deleteMany({ owner_id: user.id, editor_id: input.editorId });
      return null;
    }
    const email = typeof input.email === "string" ? input.email.trim() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new LibraryError(400, "Enter a valid coworker email.");
    const [editor] = await entities.User.filter({ email: email.toLowerCase() }, "id", 1);
    if (!id(editor?.id)) throw new LibraryError(400, "No PrecisionPath account found for that email. Ask your coworker to sign in first.");
    if (editor.id === user.id) throw new LibraryError(400, "You already own this library.");
    await grants.upsert([{
      owner_id: user.id, owner_label: `${user.full_name || user.email || "Coworker"}’s library`,
      editor_id: editor.id, editor_email: editor.email,
    }], { key: ["owner_id", "editor_id"] });
    return null;
  }
  if (!owned && !(await grants.filter({ owner_id: ownerId, editor_id: user.id }, "id", 1)).length) throw missing();
  if (!Object.hasOwn(toolFields, kind)) throw new LibraryError(400, "Invalid tool family.");
  if (action === "list") return (await all(tools, { owner_id: ownerId, kind })).map(toolView);
  if (action === "delete" && !owned) throw missing();
  if (action === "delete" || action === "update") {
    if (!id(input.toolId) || !id(input.revision)) throw missing();
  } else if (action !== "create") {
    throw new LibraryError(400, "Unknown library action.");
  }
  const target = { id: input.toolId, owner_id: ownerId, kind };
  if (action === "delete") {
    const [current] = await tools.filter(target, "id", 1);
    if (!current) throw missing();
    if (current.revision !== input.revision) throw conflict();
    const result = await tools.deleteMany({ ...target, revision: input.revision });
    if (result.deleted !== 1) throw conflict();
    return null;
  }
  const specs = validToolSpecs(kind, input.specs);
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 100 || !specs) throw new LibraryError(400, "Enter a tool name and valid tool dimensions before saving.");
  const revision = crypto.randomUUID();
  if (action === "create") return toolView(await tools.create({ owner_id: ownerId, kind, name, specs, revision }));
  const result = await tools.updateMany({ ...target, revision: input.revision }, { $set: { name, specs, revision } });
  if (result.updated !== 1) throw conflict();
  return { id: input.toolId, kind, name, specs, revision };
}
