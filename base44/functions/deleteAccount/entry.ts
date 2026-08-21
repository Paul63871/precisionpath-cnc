import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Automated account data purge. Runs with the calling user's app-user token
// (RLS restricts to their own records), deletes every owned entity, then the
// frontend logs the user out. The User account record itself is managed by the
// platform and is removed on logout/auth cleanup.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const filter = { created_by_id: user.id };
    const deleted = {};
    deleted.saved_calculations = await base44.entities.SavedCalculation.deleteMany(filter);
    deleted.custom_materials = await base44.entities.CustomMaterial.deleteMany(filter);
    deleted.machine_profiles = await base44.entities.MachineProfile.deleteMany(filter);
    deleted.user_preferences = await base44.entities.UserPreference.deleteMany(filter);
    return Response.json({ ok: true, deleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}