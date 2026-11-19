import React, { useEffect, useId, useState } from "react";
import { Library, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { currentToolSpecs, libraryFamilyName, libraryRequest, loadableToolSpecs, previewLibrary } from "@/lib/toolLibrary";

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function ToolLibrary(props) {
  const { user } = useAuth();
  return <ToolLibraryPanel key={`${user?.id ?? ""}:${props.kind}:${props.resetKey ?? ""}`} {...props} userId={user?.id} />;
}

function ToolLibraryPanel({ kind, specs, onLoad, describe, userId }) {
  const ids = useId();
  const signedIn = previewLibrary || !!userId;
  const [open, setOpen] = useState(false);
  const [libraries, setLibraries] = useState(null);
  const [ownerId, setOwnerId] = useState("");
  const [tools, setTools] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [loaded, setLoaded] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [editors, setEditors] = useState(null);
  const [manage, setManage] = useState(false);
  const [pendingDelete, setPendingDelete] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const library = libraries?.find(({ id }) => id === ownerId);
  const selected = tools?.find(({ id }) => id === selectedId);
  const workingSource = loaded;
  const updateSource = workingSource?.ownerId === ownerId ? workingSource : null;

  useEffect(() => {
    if (!open || !signedIn) return;
    let ignore = false;
    libraryRequest({ action: "libraries" }).then((rows) => {
      if (ignore) return;
      setLibraries(rows);
      setOwnerId((previous) => rows.some(({ id }) => id === previous) ? previous : rows[0]?.id ?? "");
    }).catch((error) => { if (!ignore) setFailure(error.message); });
    return () => { ignore = true; };
  }, [open, signedIn, refresh]);

  useEffect(() => {
    setTools(null);
    if (!open || !signedIn || !ownerId) return;
    let ignore = false;
    libraryRequest({ action: "list", ownerId, kind }).then((rows) => {
      if (!ignore) setTools(rows.sort((a, b) => a.name.localeCompare(b.name)));
    }).catch((error) => { if (!ignore) setFailure(error.message); });
    return () => { ignore = true; };
  }, [open, signedIn, ownerId, kind, refresh]);

  useEffect(() => {
    setEditors(null);
    if (!open || !signedIn || !manage || !library?.owned || previewLibrary) return;
    let ignore = false;
    libraryRequest({ action: "editors", ownerId }).then((rows) => {
      if (!ignore) setEditors(rows);
    }).catch((error) => { if (!ignore) setFailure(error.message); });
    return () => { ignore = true; };
  }, [open, signedIn, manage, library?.owned, ownerId, refresh]);

  function show(next) {
    if (busy) return;
    setOpen(next);
    setNotice("");
    setFailure("");
    setPendingDelete("");
    if (next) {
      setLibraries(null);
      setTools(null);
      setSelectedId("");
      setName(workingSource?.name ?? "");
    } else {
      setManage(false);
      setEmail("");
    }
  }

  async function mutate(payload, onSuccess) {
    setFailure("");
    setNotice("");
    setBusy(true);
    try {
      onSuccess(await libraryRequest({ ownerId, kind, ...payload }));
      setRefresh((value) => value + 1);
    } catch (error) {
      setFailure(error.message);
    } finally {
      setBusy(false);
    }
  }

  function save(update) {
    const snapshot = currentToolSpecs(kind, specs);
    if (!loadableToolSpecs(kind, snapshot)) {
      setFailure("Check the tool type and dimensions before saving.");
      return;
    }
    void mutate({
      action: update ? "update" : "create", name, specs: snapshot,
      ...(update ? { toolId: updateSource.id, revision: updateSource.revision } : {}),
    }, (tool) => {
      setLoaded({ ...tool, ownerId });
      setSelectedId(tool.id);
      setName(tool.name);
      setNotice(update ? "Library tool updated." : "New tool saved to the selected library.");
    });
  }

  function load() {
    const snapshot = loadableToolSpecs(kind, selected?.specs);
    if (!snapshot) {
      setFailure("This tool has incompatible specs and could not be loaded. Check the saved entry before use.");
      return;
    }
    onLoad(snapshot);
    setLoaded({ ...selected, ownerId });
    show(false);
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold">Saved tooling</p>
          <p role="status" className="break-words text-xs text-muted-foreground">
            {workingSource ? `Working copy: ${workingSource.name}. Verify the loaded specs before use.` : "Load a saved tool or store your current specs."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={show}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-9"><Library className="mr-1.5 h-4 w-4" />Tool Library</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85dvh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-xl p-4 sm:p-6">
            <DialogHeader className="pr-6 text-left">
              <DialogTitle>Tool Library</DialogTitle>
              <DialogDescription>{libraryFamilyName[kind]} · Loading a tool fills editable inputs without changing the library entry.</DialogDescription>
            </DialogHeader>
            {!signedIn ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Sign in to save tools to your private library or access a coworker’s shared library.</p>
                <Button onClick={() => base44.auth.redirectToLogin(window.location.href)}>Sign in</Button>
              </div>
            ) : (
              <div className="min-w-0 space-y-4">
                {previewLibrary && <p className="rounded-md border border-border p-2 text-xs text-muted-foreground">Preview only: tools stay in this browser and may reset on reload. Coworker sharing requires the hosted app.</p>}
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                  <p>Verify the actual tool and setup before using results. A saved entry is not a confirmation.</p>
                </div>
                {failure && <p role="alert" className="break-words rounded-md border border-destructive/30 p-2 text-sm text-destructive">{failure}</p>}
                {notice && <p role="status" className="rounded-md bg-muted p-2 text-xs">{notice}</p>}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor={`${ids}-library`}>Library</Label>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setFailure(""); setRefresh((value) => value + 1); }}>Refresh</Button>
                  </div>
                  <select id={`${ids}-library`} className={selectClass} value={library ? ownerId : ""} disabled={!libraries || busy}
                    onChange={(event) => { setOwnerId(event.target.value); setTools(null); setSelectedId(""); setPendingDelete(""); setManage(false); setNotice(""); setFailure(""); }}>
                    {!library && <option value="">Loading libraries…</option>}
                    {libraries?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <Label htmlFor={`${ids}-tool`}>Saved tool</Label>
                  <select id={`${ids}-tool`} className={selectClass} value={selected?.id ?? ""} disabled={!tools?.length || busy}
                    onChange={(event) => { setSelectedId(event.target.value); setPendingDelete(""); setFailure(""); }}>
                    <option value="">{!tools ? "Loading tools…" : tools.length ? "Choose a saved tool" : "No saved tools in this family"}</option>
                    {tools?.map((tool) => <option key={tool.id} value={tool.id}>{tool.name} · {describe(tool.specs)}</option>)}
                  </select>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" disabled={!selected || busy} onClick={load}>Load editable copy</Button>
                    {library?.owned && selected && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPendingDelete(selected.id)}>Remove tool</Button>}
                  </div>
                  {selected && pendingDelete === selected.id && (
                    <div className="space-y-2 rounded-md border border-destructive/30 p-2">
                      <p className="break-words text-xs">Remove “{selected.name}” from this library for everyone with access?</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => mutate({
                          action: "delete", toolId: selected.id, revision: selected.revision,
                        }, () => { setSelectedId(""); setPendingDelete(""); if (updateSource?.id === selected.id) setLoaded(null); setNotice("Tool removed."); })}>Confirm removal</Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPendingDelete("")}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <Label htmlFor={`${ids}-name`}>Name for current tool</Label>
                  <Input id={`${ids}-name`} maxLength={100} placeholder="e.g. IMCO M223N, 5/8 in" value={name} onChange={(event) => setName(event.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    {updateSource ? `“${updateSource.name}” changes for everyone only if you choose Update saved tool.` : "Saves the tool specs, not stock, operation settings or setup confirmations."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={!library || !name.trim() || busy} onClick={() => save(false)}>Save as new tool</Button>
                    {updateSource && <Button size="sm" variant="outline" disabled={!library || !name.trim() || busy} onClick={() => save(true)}>Update saved tool</Button>}
                  </div>
                </div>
                {!previewLibrary && library?.owned && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <Button size="sm" variant="outline" aria-expanded={manage} disabled={busy} onClick={() => setManage(!manage)}>Manage coworker access</Button>
                    {manage && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Private unless shared. Editors can load, add and update tools in this entire library, including future entries. Only you can manage access or remove tools.</p>
                        <form className="space-y-2" onSubmit={(event) => {
                          event.preventDefault();
                          void mutate({ action: "share", email }, () => { setEmail(""); setNotice("Editor access granted. Your coworker can now open this library in PrecisionPath."); });
                        }}>
                          <Label htmlFor={`${ids}-email`}>Coworker’s PrecisionPath sign-in email</Label>
                          <div className="flex flex-wrap gap-2">
                            <Input id={`${ids}-email`} type="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} className="min-w-0 flex-1" />
                            <Button size="sm" disabled={busy || !email.trim()} type="submit">Grant editor access</Button>
                          </div>
                        </form>
                        {!editors ? <p className="text-xs text-muted-foreground">Loading editors…</p> :
                          editors.length ? <ul className="space-y-1">{editors.map((editor) => (
                            <li key={editor.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-1 text-xs">
                              <span className="min-w-0 break-all">{editor.email}</span>
                              <Button size="sm" variant="ghost" aria-label={`Revoke access for ${editor.email}`} disabled={busy} onClick={() => mutate(
                                { action: "revoke", editorId: editor.id }, () => setNotice("Editor access revoked."),
                              )}>Revoke</Button>
                            </li>
                          ))}</ul> : <p className="text-xs text-muted-foreground">No coworker access granted.</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
