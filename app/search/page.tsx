import { notFound } from 'next/navigation';
import SearchResults from '@/components/search/SearchResults';

export const dynamic = 'force-dynamic';

interface SearchResultsPageProps {
  searchParams: {
    q?: string;
  };
}

export default function SearchResultsPage({ searchParams }: SearchResultsPageProps) {
  const query = searchParams.q?.trim();

  if (!query) {
    return (
      <div className="flex-1 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Search</h1>
          <p className="text-slate-600">Enter a search term to find departments, members, goals, actions, projects, and tasks.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Search Results</h1>
        <SearchResults query={query} />
      </div>
    </div>
  );
}