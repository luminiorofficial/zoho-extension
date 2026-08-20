import { redirect } from 'next/navigation';

import { getZohoRelationshipSnapshotState } from '@/lib/zoho/relationship-data';

export const dynamic = 'force-dynamic';

interface ZohoProjectBridgePageProps {
  params: Promise<{
    zohoProjectId: string;
  }>;
}

export default async function ZohoProjectBridgePage({
  params,
}: ZohoProjectBridgePageProps) {
  const { zohoProjectId } = await params;

  if (!/^\d+$/.test(zohoProjectId)) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6">
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

  const state = await getZohoRelationshipSnapshotState();

  if (state.status !== 'READY' || !state.data) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6">
          <h1 className="text-xl font-semibold">
            Zoho connection unavailable
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            {state.error ?? 'Could not load Zoho relationship data.'}
          </p>
        </div>
      </main>
    );
  }

  const matchedProject = state.data.projects.find(
    (project) => project.zohoProjectId === zohoProjectId,
  );

  if (!matchedProject) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6">
          <h1 className="text-xl font-semibold">
            Zoho project not found
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Zoho Project ID: {zohoProjectId}
          </p>
        </div>
      </main>
    );
  }

  if (!matchedProject.localProjectId) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6">
          <h1 className="text-xl font-semibold">
            Project mapping required
          </h1>

          <p className="mt-3 text-sm text-slate-600">
            {matchedProject.zohoProjectName}
          </p>

          <p className="mt-2 text-sm text-slate-600">
            This Zoho project is not currently mapped to a local CRM project.
          </p>

          <p className="mt-3 text-xs text-slate-500">
            Mapping status: {matchedProject.mappingSource}
          </p>
        </div>
      </main>
    );
  }

  redirect(
    `/projects/${matchedProject.localProjectId}?embed=zoho`,
  );
}