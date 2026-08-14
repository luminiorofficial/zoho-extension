'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Loader2, X, Building2, Users, Target, CheckSquare, FolderKanban, ClipboardList } from 'lucide-react';

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

export default function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) {
          throw new Error('Search failed');
        }
        const data = await res.json();
        setResults(data);
      } catch (err) {
        setError('Failed to load search results. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-slate-600">Searching...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <X className="h-12 w-12 text-red-400" />
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!results) {
    return null;
  }

  const { results: grouped, totalResults, query: searchQuery } = results;

  const sections = [
    { key: 'departments', label: 'Departments' },
    { key: 'members', label: 'Members' },
    { key: 'goals', label: 'Goals' },
    { key: 'actions', label: 'Actions' },
    { key: 'projects', label: 'Projects' },
    { key: 'tasks', label: 'Tasks' },
  ];

  const hasResults = sections.some(section => grouped[section.key as keyof typeof grouped].length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            Found <span className="font-semibold text-slate-900">{totalResults}</span> result{totalResults !== 1 ? 's' : ''} for
          </p>
          <p className="text-lg font-semibold text-slate-900">"{searchQuery}"</p>
        </div>
      </div>

      {!hasResults ? (
        <div className="text-center py-12">
          <Search className="h-12 w-12 mx-auto text-slate-300" />
          <p className="mt-4 text-slate-600">No results found. Try different keywords.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => {
            const items = grouped[section.key as keyof typeof grouped];
            if (items.length === 0) return null;

            const Icon = sectionIcons[section.key as keyof typeof sectionIcons];

            return (
              <div key={section.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Icon size={16} className="text-slate-500" />
                    {section.label}
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                      {items.length}
                    </span>
                  </h3>
                </div>

                <div className="divide-y divide-slate-200">
                  {items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="block p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 truncate">{item.title}</h4>
                          {item.description && (
                            <p className="mt-1 text-sm text-slate-500 truncate">{item.description}</p>
                          )}
                          <p className="mt-1 text-sm text-slate-400">{item.subtitle}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}