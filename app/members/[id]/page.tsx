import { notFound } from 'next/navigation';

import { Layout, MemberWorkClient } from '@/components';
import { getStructureData } from '@/lib/structure-data';
import { getMemberWorkData } from '@/lib/work-data';

export const dynamic = 'force-dynamic';

interface MemberPageProps {
  params: Promise<{ id: string }>;
}

export default async function MemberPage({ params }: MemberPageProps) {
  const { id } = await params;
  const [{ departments, members }, work] = await Promise.all([
    getStructureData(),
    getMemberWorkData(id),
  ]);
  const member = members.find((item) => item.id === id);

  if (!member) notFound();

  const departmentNames = (member.departmentIds ?? [member.departmentId])
    .map((departmentId) => departments.find((department) => department.id === departmentId)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <Layout>
      <div className="mb-8">
        <p className="text-sm font-medium text-blue-600">Member Work Plan</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{member.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {member.role} · {departmentNames.join(', ') || 'Unassigned'}
        </p>
      </div>

      <MemberWorkClient member={member} initialWork={work} />
    </Layout>
  );
}
