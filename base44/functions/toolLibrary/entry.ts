import { createClientFromRequest } from "npm:@base44/sdk@0.8.59";
import { LibraryError, runLibrary } from "./service.mjs";

export default async function(req: Request) {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });
  try {
    const client = createClientFromRequest(req);
    const user = await client.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: "Sign in to use your tool library." }, { status: 401 });
    const input = await req.json().catch(() => null);
    return Response.json({ result: await runLibrary(client.asServiceRole.entities, user, input) });
  } catch (error) {
    if (error instanceof LibraryError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Tool library request failed", error?.status ?? error?.name);
    return Response.json({ error: "The tool library is unavailable. Try again shortly." }, { status: 500 });
  }
}
