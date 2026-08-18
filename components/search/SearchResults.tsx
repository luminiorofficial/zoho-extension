'use client';

import Link from 'next/link';
import {
  useEffect,
  useState,
} from 'react';

import {
  Building2,
  CheckSquare,
  ClipboardList,
  FolderKanban,
  Loader2,
  Search,
  Target,
  Users,
  X,
} from 'lucide-react';

interface SearchResultItem {
  type: string;
  id: string;
  title: string;
  description?: string | null;
  subtitle: string;
  href: string;
}

interface SearchResponse {
  results: {
    departments: SearchResultItem[];
    members: SearchResultItem[];
    goals: SearchResultItem[];
    actions: SearchResultItem[];
    projects: SearchResultItem[];
    tasks: SearchResultItem[];
  };

  totalResults: number;
  query: string;
}

const sectionIcons = {
  departments: Building2,
  members: Users,
  goals: Target,
  actions: CheckSquare,
  projects: FolderKanban,
  tasks: ClipboardList,
};

const sections = [
  {
    key: 'departments',
    label: 'Departments',
  },
  {
    key: 'members',
    label: 'Members',
  },
  {
    key: 'goals',
    label: 'Goals',
  },
  {
    key: 'actions',
    label: 'Actions',
  },
  {
    key: 'projects',
    label: 'Projects',
  },
  {
    key: 'tasks',
    label: 'Tasks',
  },
] as const;

export default function SearchResults({
  query,
}: {
  query: string;
}) {
  const [results, setResults] =
    useState<SearchResponse | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchResults() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(
            query,
          )}`,
          {
            cache: 'no-store',
          },
        );

        if (!response.ok) {
          throw new Error(
            'Search failed.',
          );
        }

        const data =
          (await response.json()) as SearchResponse;

        if (!cancelled) {
          setResults(data);
        }
      } catch {
        if (!cancelled) {
          setError(
            'Failed to load search results. Please try again.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchResults();

    return () => {
      cancelled = true;
    };
  }, [query]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />

          <span className="text-slate-600">
            Searching...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <X className="h-12 w-12 text-red-400" />

          <p className="text-slate-600">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!results) {
    return null;
  }

  const {
    results: grouped,
    totalResults,
    query: searchQuery,
  } = results;

  const hasResults =
    sections.some(
      (section) =>
        grouped[section.key]
          .length > 0,
    );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">
          Found{' '}
          <span className="font-semibold text-slate-900">
            {totalResults}
          </span>{' '}
          result
          {totalResults !== 1
            ? 's'
            : ''}{' '}
          for
        </p>

        <p className="mt-1 text-lg font-semibold text-slate-900">
          &ldquo;{searchQuery}&rdquo;
        </p>
      </div>

      {!hasResults ? (
        <div className="py-12 text-center">
          <Search className="mx-auto h-12 w-12 text-slate-300" />

          <p className="mt-4 text-slate-600">
            No results found. Try
            different keywords.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map(
            (section) => {
              const items =
                grouped[
                  section.key
                ];

              if (
                items.length === 0
              ) {
                return null;
              }

              const Icon =
                sectionIcons[
                  section.key
                ];

              return (
                <section
                  key={
                    section.key
                  }
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Icon
                        size={16}
                        className="text-slate-500"
                      />

                      {
                        section.label
                      }

                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1 text-xs font-medium text-blue-700">
                        {
                          items.length
                        }
                      </span>
                    </h3>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {items.map(
                      (item) => (
                        <Link
                          key={`${item.type}-${item.id}`}
                          href={
                            item.href
                          }
                          className="block p-4 transition-colors hover:bg-slate-50"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                              <Icon
                                size={
                                  18
                                }
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <h4 className="truncate font-medium text-slate-900">
                                {
                                  item.title
                                }
                              </h4>

                              {item.description && (
                                <p className="mt-1 truncate text-sm text-slate-500">
                                  {
                                    item.description
                                  }
                                </p>
                              )}

                              <p className="mt-1 text-sm text-slate-400">
                                {
                                  item.subtitle
                                }
                              </p>
                            </div>
                          </div>
                        </Link>
                      ),
                    )}
                  </div>
                </section>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}