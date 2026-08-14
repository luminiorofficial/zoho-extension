import { notFound } from 'next/navigation';

import { Layout, MemberAttendancePanel, MemberWorkClient } from '@/components';
import { getLeaveRequests, getMemberAttendanceSummary } from '@/lib/attendance-data';
import { getStructureData } from '@/lib/structure-data';
import { getMemberWorkData } from '@/lib/work-data';

export const dynamic = 'force-dynamic';

interface MemberPageProps {
  params: Promise<{ id: string }>;
}

export default async function MemberPage({ params }: MemberPageProps) {
  const { id } = await params;
  const [{ departments, members }, work, attendance, leaveRequests] = await Promise.all([
    getStructureData(),
    getMemberWorkData(id),
    getMemberAttendanceSummary(id),
    getLeaveRequests({ memberId: id }),
  ]);
  const member = members.find((item) => item.id === id);

  if (!member) notFound();

  const departmentNames = (member.departmentIds ?? [member.departmentId])
    .map((departmentId) => departments.find((department) => department.id === departmentId)?.name)
    .filter((name): name is string => Boolean(name));
  const memberDepartments = (member.departmentIds ?? [member.departmentId])
    .map((departmentId) => departments.find((department) => department.id === departmentId))
    .filter((department): department is NonNullable<typeof department> => Boolean(department))
    .map((department) => ({ id: department.id, name: department.name }));

  return (
    <Layout>
      <div className="mb-8">
        <p className="text-sm font-medium text-blue-600">Member Work Plan</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{member.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {member.role} · {departmentNames.join(', ') || 'Unassigned'}
        </p>
      </div>

      <MemberAttendancePanel
        member={member}
        departments={memberDepartments}
        summary={attendance}
        leaveRequests={leaveRequests}
      />

      <MemberWorkClient
        key={work.tasks.map((task) => task.id).join(':')}
        member={member}
        initialWork={work}
      />
    </Layout>
  );
}
