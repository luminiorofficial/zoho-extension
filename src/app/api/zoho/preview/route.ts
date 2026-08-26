import { getZohoRelationshipSnapshotState } from '@/lib/zoho/relationship-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const state = await getZohoRelationshipSnapshotState();

  if (state.status === 'NOT_CONNECTED') {
    return Response.json(
      {
        mode: 'PREVIEW_ONLY',
        databaseChanged: false,
        error: state.error ?? 'Zoho is not connected.',
      },
      { status: 400 },
    );
  }

  if (state.status === 'ERROR' || !state.data) {
    return Response.json(
      {
        mode: 'PREVIEW_ONLY',
        databaseChanged: false,
        error: state.error ?? 'Could not load Zoho relationship data.',
      },
      { status: 500 },
    );
  }

  const snapshot = state.data;

  return Response.json({
    mode: 'PREVIEW_ONLY',
    databaseChanged: false,
    zohoWriteOperations: false,
    message:
      'Projects, project users, tasks, and task owners are read directly from Zoho. Permanent local mappings are used first. Unresolved records are never force-attached.',
    mappingPriority: [
      'zoho_mappings by Zoho Project ID',
      'exact master_job_no',
      'exact unique project code',
      'unresolved/manual review',
    ],
    portal: snapshot.portal,
    summary: snapshot.summary,
    unresolvedPortalUsers: snapshot.unresolvedPortalUsers,
    unresolvedLocalProjects: snapshot.unresolvedLocalProjects,
    unresolvedZohoProjects: snapshot.unresolvedZohoProjects,
    departments: snapshot.departments,
    members: snapshot.members,
    projects: snapshot.projects,
  });
}