import { Layout } from '@/components';
import MemberList from '@/app/members/components/memberlist';

export default function MembersPage() {
  return (
    <Layout>
      <div className="container mx-auto px-8 py-4 max-w-full pt-24">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        </header>

        <MemberList />
      </div>
    </Layout>
  );
}