export default function ProjectsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />

        <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-slate-100" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="h-5 w-56 animate-pulse rounded bg-slate-200" />

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {Array.from({
            length: 4,
          }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-3">
        {Array.from({
          length: 3,
        }).map((_, index) => (
          <div
            key={index}
            className="h-10 animate-pulse rounded-lg bg-slate-100"
          />
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({
          length: 6,
        }).map((_, index) => (
          <div
            key={index}
            className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    </div>
  );
}