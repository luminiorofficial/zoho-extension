import type { QueryResultRow } from 'pg';

import { redirect } from 'next/navigation';

import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ZohoProjectBridgePageProps {
  params: Promise<{
    zohoProjectId: string;
  }>;
}

interface MappingRow extends QueryResultRow {
  local_project_id: string;
  local_project_name: string;
}

export default async function ZohoProjectBridgePage({
  params,
}: ZohoProjectBridgePageProps) {
  const { zohoProjectId } = await params;

  /*
   * Zoho project IDs are numeric.
   */
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

  /*
   * ======================================================
   * IMPORTANT PERFORMANCE + RELIABILITY FIX
   *
   * DO NOT call Zoho API here.
   *
   * Zoho already gave us its Project ID in the URL.
   * We only need to find the corresponding local project.
   *
   * This means:
   *
   * Zoho Web Tab
   *      ↓
   * Zoho Project ID
   *      ↓
   * PostgreSQL mapping
   *      ↓
   * Local Project
   *
   * No OAuth refresh.
   * No Zoho API.
   * No full relationship snapshot.
   * ======================================================
   */

  const mappingResult =
    await db.query<MappingRow>(
      `
      SELECT
        p.id AS local_project_id,
        p.name AS local_project_name

      FROM zoho_mappings zm

      JOIN projects p
        ON p.id = zm.local_id

      WHERE
        zm.entity_type = 'PROJECT'

        AND p.is_active = TRUE

        AND (
          zm.zoho_entity_id = $1
          OR zm.zoho_project_id = $1
        )

      LIMIT 1
      `,
      [zohoProjectId],
    );

  const mapping =
    mappingResult.rows[0];

  /*
   * Mapping exists.
   *
   * Go straight into the CRM UI embedded inside Zoho.
   */
  if (mapping) {
    redirect(
      `/projects/${mapping.local_project_id}?embed=zoho`,
    );
  }

  /*
   * No permanent mapping.
   *
   * We intentionally DO NOT guess a project here.
   */
  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-8">
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-lg">
            !
          </div>

          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Project mapping required
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              This Zoho project has not yet been permanently mapped
              to a local CRM project.
            </p>

            <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Zoho Project ID
              </p>

              <p className="mt-1 font-mono text-sm text-slate-700">
                {zohoProjectId}
              </p>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              No Zoho write operation was attempted.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}