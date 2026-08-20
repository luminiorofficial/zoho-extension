export default function ProjectDetailLoading() {
  return (
    <div className="space-y-7">
      {/* Header */}

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />

          <div className="mt-3 h-8 w-80 max-w-full animate-pulse rounded bg-slate-200" />

          <div className="mt-2 h-4 w-56 animate-pulse rounded bg-slate-100" />
        </div>

        <div className="h-10 w-28 animate-pulse rounded-lg bg-slate-100" />
      </div>

      {/* Project information */}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({
            length: 8,
          }).map((_, index) => (
            <div
              key={index}
            >
              <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />

              <div className="mt-3 h-5 w-32 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </section>

      {/* Progress */}

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <div className="h-5 w-44 animate-pulse rounded bg-slate-200" />

          <div className="mt-5 h-3 w-full animate-pulse rounded-full bg-slate-100" />
        </section>

        <section className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>

      {/* Main sections */}

      <section className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white" />

      <div className="grid gap-7 xl:grid-cols-2">
        <section className="h-52 animate-pulse rounded-xl border border-slate-200 bg-white" />

        <section className="h-52 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}