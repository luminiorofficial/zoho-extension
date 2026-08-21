import { Layout } from '@/components';

export default function SettingsPage() {
  return (
    <Layout>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Settings
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Organisation and integration settings.
        </p>
      </div>

      <div className="space-y-5">

        <section className="rounded-xl border border-slate-200 bg-white p-6">

          <h2 className="font-semibold text-slate-900">
            Organisation
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Organisation information and preferences will be managed here.
          </p>

        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">

          <h2 className="font-semibold text-slate-900">
            Project Activity
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Project activity connection settings are managed by your administrator.
          </p>

        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">

          <h2 className="font-semibold text-slate-900">
            Roles & Permissions
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Admin, department head and team member permissions will be configured later.
          </p>

        </section>

      </div>

    </Layout>
  );
}