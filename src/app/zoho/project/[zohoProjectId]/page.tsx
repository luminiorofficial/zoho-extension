import type { QueryResultRow } from 'pg';

import { redirect } from 'next/navigation';

import { db } from '@/lib/db';
import { syncZohoProjectById } from '@/lib/zoho/project-sync';

export const dynamic = 'force-dynamic';

interface ZohoProjectBridgePageProps {
  params: Promise<{ zohoProjectId: string }>;
}

interface MappingRow extends QueryResultRow {
  local_project_id: string;
  local_project_name: string;
}

async function findLocalProject(
  zohoProjectId: string,
): Promise<MappingRow | null> {
  const mappingResult = await db.query<MappingRow>(
    `
    SELECT
      p.id AS local_project_id,
      p.name AS local_project_name
    FROM zoho_mappings zm
    JOIN projects p ON p.id = zm.local_id
    WHERE zm.entity_type = 'PROJECT'
      AND p.is_active = TRUE
      AND (
        zm.zoho_entity_id = $1
        OR zm.zoho_project_id = $1
      )
    LIMIT 1
    `,
    [zohoProjectId],
  );

  return mappingResult.rows[0] ?? null;
}

export default async function ZohoProjectBridgePage({
  params,
}: ZohoProjectBridgePageProps) {
  const { zohoProjectId } = await params;

  if (!/^\d+$/.test(zohoProjectId)) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-red-700">
            Invalid Zoho Project
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            The supplied Zoho project ID is invalid.
          </p>
        </div>
      </main>
    );
  }

  let mapping = await findLocalProject(zohoProjectId);

  /*
   * Existing tabs remain a single local lookup. A new Zoho project takes this
   * ID-specific sync path once, then future visits use its permanent mapping.
   */
  if (!mapping) {
    let syncedLocalProjectId: string | null = null;

    try {
      const syncResult = await syncZohoProjectById(zohoProjectId);
      const syncedProject = syncResult.projects.find(
        (project) => project.zohoProjectId === zohoProjectId,
      );

      if (syncedProject) {
        syncedLocalProjectId = syncedProject.localProjectId;
      }
    } catch (error) {
      console.error(`Could not sync Zoho project ${zohoProjectId}:`, error);
    }

    if (syncedLocalProjectId) {
      redirect(`/projects/${syncedLocalProjectId}?embed=zoho`);
    }

    mapping = await findLocalProject(zohoProjectId);
  }

  if (mapping) {
    redirect(`/projects/${mapping.local_project_id}?embed=zoho`);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-8">
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-lg">
            !
          </div>

          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Project activity is not available
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              This project could not be synced from Zoho. Refresh the tab or
              ask an administrator to check the Zoho connection.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
