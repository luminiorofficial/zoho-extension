import SearchResults from '@/components/search/SearchResults';

export const dynamic =
  'force-dynamic';

interface SearchResultsPageProps {
  searchParams: Promise<{
    q?: string;
  }>;
}

export default async function SearchResultsPage({
  searchParams,
}: SearchResultsPageProps) {
  const params =
    await searchParams;

  const query =
    params.q?.trim() ?? '';

  if (!query) {
    return (
      <div className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <h1 className="mb-6 text-2xl font-bold text-slate-900">
            Search
          </h1>

          <p className="text-slate-600">
            Enter a search term to
            find departments,
            members, goals,
            actions, projects and
            tasks.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">
          Search Results
        </h1>

        <SearchResults
          query={query}
        />
      </div>
    </div>
  );
}