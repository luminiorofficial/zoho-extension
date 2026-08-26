import {
  ZohoProjectMappingOverviewPanel,
  ZohoProjectMembersPanel,
} from '@/components/zoho/ZohoRelationshipPanels';

import {
  getZohoProjectMappingOverviewState,
  getZohoProjectRelationshipState,
} from '@/lib/zoho/relationship-data';

interface ProjectZohoPanelProps {
  projectId: string;
}

/* =========================================================
 * PROJECT DETAIL ZOHO PANEL
 *
 * This is a Server Component.
 * It intentionally owns its own Zoho fetch so that
 * the parent page can place it inside <Suspense>.
 * ======================================================= */

export async function AsyncZohoProjectMembersPanel({
  projectId,
}: ProjectZohoPanelProps) {
  const state =
    await getZohoProjectRelationshipState(
      projectId,
    );

  return (
    <ZohoProjectMembersPanel
      state={state}
    />
  );
}

/* =========================================================
 * PROJECT LIST MAPPING PANEL
 * ======================================================= */

export async function AsyncZohoProjectMappingOverviewPanel() {
  const state =
    await getZohoProjectMappingOverviewState();

  return (
    <ZohoProjectMappingOverviewPanel
      state={state}
    />
  );
}

/* =========================================================
 * FALLBACK / SKELETON
 * ======================================================= */

export function ZohoPanelSkeleton({
  title = 'Loading Zoho data…',
}: {
  title?: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="h-5 w-52 animate-pulse rounded bg-slate-200" />

        <div className="mt-2 h-3 w-80 max-w-full animate-pulse rounded bg-slate-100" />
      </div>

      <div className="p-5 sm:p-6">
        <p className="text-sm font-medium text-slate-500">
          {title}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {Array.from({
            length: 4,
          }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>

        <div className="mt-5 space-y-3">
          <div className="h-14 animate-pulse rounded-xl bg-slate-100" />

          <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    </section>
  );
}