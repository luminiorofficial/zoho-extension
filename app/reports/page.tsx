import { Layout } from '@/components';
import ReportsClient from '@/components/reports/ReportsClient';
import { getReportingData } from '@/lib/reporting-data';
import { isDate, isUuid } from '@/lib/planner-validation';
import { isReportPeriodType } from '@/lib/reporting-periods';

export const dynamic = 'force-dynamic';

interface ReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function todayInIndia(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Kolkata',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const query = await searchParams;
  const departmentId = one(query.departmentId);
  const memberId = one(query.memberId);
  const goalId = one(query.goalId);
  const requestedType = one(query.periodType);
  const requestedDate = one(query.periodDate);
  const data = await getReportingData({
    departmentId: isUuid(departmentId) ? departmentId : undefined,
    memberId: isUuid(memberId) ? memberId : undefined,
    goalId: isUuid(goalId) ? goalId : undefined,
    periodType: isReportPeriodType(requestedType) ? requestedType : 'MONTHLY',
    periodDate: isDate(requestedDate) ? requestedDate : todayInIndia(),
  });

  return (
    <Layout>
      <div className="mb-8"><h1 className="text-2xl font-bold text-slate-900">Progress Reports & Evaluations</h1><p className="mt-1 text-sm text-slate-500">Compare imported and planned work delivery with KPI achievement across weekly, monthly, financial-quarter, and Apr–Mar financial-year periods.</p></div>
      <ReportsClient
        key={[
          data.filters.departmentId,
          data.filters.memberId,
          data.filters.goalId,
          data.filters.periodType,
          data.periodStart,
        ].join(':')}
        data={data}
      />
    </Layout>
  );
}
