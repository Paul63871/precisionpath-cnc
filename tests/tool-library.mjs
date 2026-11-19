import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runLibrary } from "../base44/functions/toolLibrary/service.mjs";
import { pickToolSpecs, validToolSpecs } from "../base44/functions/toolLibrary/specs.mjs";

function table(seed = []) {
  const rows = structuredClone(seed);
  const matches = (query) => (row) => Object.entries(query).every(([key, value]) => row[key] === value);
  return {
    filter: async (query, sort, limit = 100, offset = 0) =>
      structuredClone(rows.filter(matches(query)).sort((a, b) => a[sort].localeCompare(b[sort])).slice(offset, offset + limit)),
    create: async (entry) => {
      const row = { ...structuredClone(entry), id: crypto.randomUUID() };
      rows.push(row);
      return structuredClone(row);
    },
    updateMany: async (query, update) => {
      const found = rows.filter(matches(query));
      for (const row of found) Object.assign(row, structuredClone(update.$set));
      return { updated: found.length };
    },
    deleteMany: async (query) => {
      const found = rows.filter(matches(query));
      for (const row of found) rows.splice(rows.indexOf(row), 1);
      return { deleted: found.length };
    },
    upsert: async (entries, { key }) => {
      for (const entry of entries) {
        const query = Object.fromEntries(key.map((k) => [k, entry[k]]));
        const row = rows.find(matches(query));
        if (row) Object.assign(row, structuredClone(entry));
        else rows.push({ ...structuredClone(entry), id: crypto.randomUUID() });
      }
    },
  };
}

const owner = { id: "owner-1", email: "owner@example.test", full_name: "Shop A" };
const editor = { id: "editor-1", email: "editor@example.test" };
const stranger = { id: "stranger-1", email: "stranger@example.test", role: "admin" };
const milling = {
  toolTypeId: "bull_nose", toolMaterialId: "carbide", coatingId: "zrn", diameter: 0.625, loc: 0.75,
  flutes: 3, cornerRadius: 0.03, helixAngle: "variable",
};

function fixture(seed = []) {
  const entities = {
    LibraryTool: table(seed),
    ToolLibraryGrant: table(),
    User: table([owner, editor, stranger]),
  };
  return (user, request) => runLibrary(entities, user, { kind: "milling", ...request });
}

test("anonymous calls and direct entity permissions are denied", async () => {
  await assert.rejects(fixture()(null, { action: "libraries" }), { status: 401 });
  for (const name of ["LibraryTool", "ToolLibraryGrant"]) {
    const schema = JSON.parse(readFileSync(new URL(`../base44/entities/${name}.jsonc`, import.meta.url)));
    assert.deepEqual(schema.rls, { read: false, create: false, update: false, delete: false });
  }
});

test("private by default, owner grants/revokes, editor can add and update but not manage access", async () => {
  const call = fixture();
  const source = await call(owner, { action: "create", name: "  5/8 Bull Nose ", specs: milling });
  const shared = { ownerId: owner.id };
  assert.equal(source.name, "5/8 Bull Nose");
  assert.deepEqual(source.specs, milling);
  assert.deepEqual(await call(editor, { action: "libraries" }), [{ id: editor.id, name: "My library", owned: true }]);
  for (const user of [editor, stranger]) {
    await assert.rejects(call(user, { ...shared, action: "list" }), { status: 404 });
    await assert.rejects(call(user, { ...shared, action: "create", name: "Injected", specs: milling }), { status: 404 });
  }
  await assert.rejects(call(owner, { action: "share", email: "missing@example.test" }), { status: 400 });
  await assert.rejects(call(owner, { action: "share", email: owner.email }), { status: 400 });
  await call(owner, { action: "share", email: " EDITOR@example.test " });
  await call(owner, { action: "share", email: editor.email });
  assert.deepEqual(await call(owner, { action: "editors" }), [{ id: editor.id, email: editor.email }]);
  assert.deepEqual((await call(editor, { action: "libraries" }))[1], { id: owner.id, name: "Shop A’s library", owned: false });
  const [working] = await call(editor, { ...shared, action: "list" });
  working.specs.diameter = 0.5;
  assert.equal((await call(owner, { action: "list" }))[0].specs.diameter, 0.625);
  const updated = await call(editor, { ...shared, action: "update", toolId: working.id, revision: working.revision,
    name: working.name, specs: working.specs });
  assert.equal(updated.specs.diameter, 0.5);
  const future = await call(editor, { ...shared, action: "create", name: "Another", specs: milling });
  assert.equal((await call(owner, { action: "list" })).length, 2);
  assert.deepEqual(await call(editor, { action: "list" }), []);
  for (const action of ["share", "editors", "revoke", "delete"]) {
    await assert.rejects(call(editor, { ...shared, action, toolId: future.id, revision: future.revision }), { status: 404 });
  }
  await assert.rejects(call(stranger, { ...shared, action: "list" }), { status: 404 });
  await call(owner, { action: "revoke", editorId: editor.id });
  assert.equal((await call(editor, { action: "libraries" })).length, 1);
  for (const action of ["list", "create", "update"]) {
    await assert.rejects(call(editor, { ...shared, action, toolId: future.id, revision: future.revision, name: future.name, specs: milling }), { status: 404 });
  }
});

test("revisions, owner isolation, family isolation, and owner-only removal", async () => {
  const call = fixture();
  const saved = await call(owner, { action: "create", name: "Example", specs: milling });
  const update = { action: "update", toolId: saved.id, revision: saved.revision, name: saved.name, specs: { ...milling, flutes: 4 } };
  await assert.rejects(call(editor, update), { status: 409 });
  await assert.rejects(call(owner, { ...update, kind: "turn_thread", specs: { gradeId: "coated" } }), { status: 409 });
  const writes = await Promise.allSettled([call(owner, update), call(owner, update)]);
  const successful = writes.find((item) => item.status === "fulfilled").value;
  assert.equal(writes.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(writes.find((item) => item.status === "rejected").reason.status, 409);
  const remove = { action: "delete", toolId: saved.id, revision: saved.revision };
  await assert.rejects(call(owner, remove), { status: 409 });
  await call(owner, { ...remove, revision: successful.revision });
  assert.deepEqual(await call(owner, { action: "list" }), []);
});

test("tool-only snapshots retain insert/tooth counts and tool geometry, not setup data", async () => {
  const call = fixture();
  const examples = {
    milling: [
      { ...milling, toolTypeId: "face_mill", inserts: 8, leadAngle: 45 },
      { ...milling, toolTypeId: "slitting_saw", flutes: 48, thickness: 0.04 },
      { ...milling, toolTypeId: "tap", toolMaterialId: "hss", threadId: "custom", pitch: 0.03125, tapStyle: "spiral_flute" },
    ],
    turn_insert: [{ gradeId: "coated", shapeId: "C", ic: 0.5, noseRadius: 0.03125 }],
    turn_bar: [{ gradeId: "coated", shapeId: "C", ic: 0.5, noseRadius: 0.03125, barId: "steel", barDiameter: 0.75, barOverhang: 3 }],
    turn_drill: [{ gradeId: "hss", drillDiameter: 0.5 }],
    turn_groove: [{ gradeId: "coated", shapeId: "C", ic: 0.5, width: 0.118 }],
    turn_parting: [{ gradeId: "coated", shapeId: "C", ic: 0.5, width: 0 }],
    turn_thread: [{ gradeId: "coated" }],
  };
  for (const [kind, snapshots] of Object.entries(examples)) {
    for (const specs of snapshots) {
      const saved = await call(owner, { kind, action: "create", name: kind, specs: {
        ...specs, holeType: "blind", radiusEngagement: "some", materialId: "steel",
        drillDepth: 4, workDiameter: 5, depth: 0.25, passes: 7, operationId: "test", verifiedFor: "a",
      } });
      assert.deepEqual(saved.specs, specs);
    }
  }
  assert.equal(validToolSpecs("milling", { ...milling, flutes: 3.5 }), null);
  assert.equal(validToolSpecs("milling", { ...milling, diameter: Infinity }), null);
  assert.equal(validToolSpecs("milling", { ...milling, toolTypeId: "tap", threadId: "custom", pitch: 0 }), null);
  assert.deepEqual(pickToolSpecs("__proto__", milling), {});
});

test("list reads every page of the owner's tools", async () => {
  const seed = Array.from({ length: 205 }, (_, index) => ({
    id: `id${index}`, name: `Tool ${index}`, owner_id: owner.id, kind: "milling", specs: milling, revision: "r1",
  }));
  assert.equal((await fixture(seed)(owner, { action: "list" })).length, 205);
});
