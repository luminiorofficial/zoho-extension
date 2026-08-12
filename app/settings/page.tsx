import { Layout, Sidebar, Header, ProgressBar } from '@/components';

export default function SettingsPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-zinc-800 mb-6">Settings</h1>

        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-800 mb-4">Organisation</h2>
            <p className="text-zinc-500 text-sm mb-4">
              Configure organisation-wide settings.
            </p>
            <div className="bg-zinc-50 rounded-lg p-4">
              <p className="text-sm text-zinc-600">
                Organisation name and branding settings will be configured here.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-zinc-800 mb-4">Department Settings</h2>
            <p className="text-zinc-500 text-sm mb-4">
              Manage department-level configurations.
            </p>
            <div className="bg-zinc-50 rounded-lg p-4">
              <p className="text-sm text-zinc-600">
                Department configuration settings will appear here.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-zinc-800 mb-4">Goal Rules</h2>
            <p className="text-zinc-500 text-sm mb-4">
              Define default goal creation rules and policies.
            </p>
            <div className="bg-zinc-50 rounded-lg p-4">
              <p className="text-sm text-zinc-600">
                Goal rules and templates will be configured here.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-zinc-800 mb-4">User Roles</h2>
            <p className="text-zinc-500 text-sm mb-4">
              Assign and manage user roles and permissions.
            </p>
            <div className="bg-zinc-50 rounded-lg p-4">
              <p className="text-sm text-zinc-600">
                User role assignments will appear here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}