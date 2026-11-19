# Base44 Project

Use this repository to run and edit the app locally, then publish changes back through Base44.

Any change pushed to the repo will also be reflected in the Base44 Builder.

## Prerequisites

1. Clone the repository using the project's Git URL.
2. Navigate to the project directory.
3. Install dependencies: `npm install`.
4. Install the Base44 CLI: `npm install -g base44@latest`.

See the [Base44 CLI docs](https://docs.base44.com/developers/references/cli/get-started/overview) if you want to run Base44 commands directly.

## Run Locally

Run the full local development environment from the project root:

```bash
base44 dev
```

`base44 dev` starts the local Base44 development backend and, when this app is configured for it, also starts the frontend dev server for you. Use the frontend URL printed by the command.

For example, when the Base44 project config includes a `serveCommand`, `base44 dev` can launch the frontend too:

```json5
{
  "site": {
    "serveCommand": "npm run dev"
  }
}
```

In a Base44 project this lives in `base44/config.jsonc`.

## Run Only The Frontend

If you only want to work on the frontend against the hosted Base44 backend, run:

```bash
npm run dev
```

Open the local URL printed by Vite.

## Use The Hosted Backend

For frontend-only development, create or update `.env.local` in the project root:

```bash
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
```

`VITE_BASE44_APP_ID` identifies the Base44 app.

`VITE_BASE44_APP_BASE_URL` tells the Base44 Vite plugin where to send local `/api` requests. Point it at your deployed Base44 app URL when you want the local frontend to use the hosted backend.

When you use `base44 dev`, the command injects the local Base44 values for you, so `.env.local` is mainly needed for frontend-only workflows.

## Publish Your Changes

After pushing your changes to git, open the Base44 dashboard and publish the app:

```bash
base44 dashboard open
```

## Docs & Support

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Base44 CLI command reference: [https://docs.base44.com/developers/references/cli/commands/introduction](https://docs.base44.com/developers/references/cli/commands/introduction)

Support: [https://app.base44.com/support](https://app.base44.com/support)
# Calculation audit and process guidance

The October 22, 2026 audit is in [docs/feeds-speeds-audit-2026-10-22.md](docs/feeds-speeds-audit-2026-10-22.md).
Run `npm run test:audit` for numerical invariant sweeps and retained regression fixtures.
Run `node tests/generate-report-appendix.mjs` after the tests to refresh the report's app-data snapshot.
Use `npm run build:preview` for the attached opaque-origin static preview. It
uses hash routing, relative/embedded assets and temporary in-page storage
compatibility for the SDK. Normal `npm run build` keeps Base44 routing/auth
behavior; static preview data/AI integrations are not a working Base44 backend.

## Tool Library

In **Calculator → Tool** or **Turning → Insert / Tool**, open **Tool Library**.
Save the current specs under a name or load an editable copy. Turning lists tools
for the current turning operation family. The library stores tool dimensions in
inches regardless of display units. It does not apply stock, operation choices,
hole depth/type, engagement, or CAM confirmations. Threading on the lathe saves
the tool grade, not the workpiece thread pitch or number of passes. Verify the
actual cutter and setup after loading, including any preset bar overhang.

Each signed-in account owns one initially private library. An owner can grant
editor access to an existing PrecisionPath account by its sign-in email and can
later revoke access. The shared library appears in the coworker’s library list;
there is no public link or email invitation. Editors can load, add and explicitly
update tools, but cannot change access or remove tools. Removing access cannot
recall any tool data someone already loaded or copied. Updates require the revision
of the loaded or just-saved tool; to resolve a conflict, load the latest revision
or use **Save as new tool**. The static preview only demonstrates a local library.

Before publishing to Base44, deploy `LibraryTool` and `ToolLibraryGrant` with
their deny-all direct entity rules, then the `toolLibrary` and `deleteAccount`
functions and frontend from the same revision. Validate using test accounts:
owner and editor can use the shared library, another account and anonymous caller
cannot, only owner can manage access/delete, revoked users cannot reopen or save
to the shared library, and direct app-user entity reads/writes are denied. Use
`npm run test:tool-library` for the local contract tests.

These tests establish numerical behavior, not physical validation of every tool.
The shared intensity policy reserves at least 20% of entered HP at its top setting,
but this is an application estimate, not a tool-strength or chatter guarantee.
Stock allowances and prior-tool corner screening must be verified against the
actual finishing cutter, incoming stock and CAM geometry.
