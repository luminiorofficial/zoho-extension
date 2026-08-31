'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  FolderKanban,
  KeyRound,
  ListChecks,
  Loader2,
  Search,
  Target,
  Users,
  X,
} from 'lucide-react';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const GROUP_RESULT_LIMIT = 5;

interface SearchResultItem {
  type: string;
  id: string;
  title: string;
  description: string | null;
  subtitle: string;
  href: string;
}

interface GroupedResults {
  departments: SearchResultItem[];
  members: SearchResultItem[];
  keys: SearchResultItem[];
  subGoals: SearchResultItem[];
  projects: SearchResultItem[];
  tasks: SearchResultItem[];
}

interface SearchResponse {
  results: GroupedResults;
  totalResults: number;
  query: string;
}

interface SearchState {
  query: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  response: SearchResponse | null;
  error: string | null;
}

const GROUPS: { key: keyof GroupedResults; label: string; icon: typeof Building2 }[] = [
  { key: 'departments', label: 'Departments', icon: Building2 },
  { key: 'members', label: 'Members', icon: Users },
  { key: 'keys', label: 'Keys / Goals', icon: KeyRound },
  { key: 'subGoals', label: 'Sub Goals', icon: Target },
  { key: 'projects', label: 'Projects', icon: FolderKanban },
  { key: 'tasks', label: 'Tasks', icon: ListChecks },
];

export default function HeaderSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    status: 'idle',
    response: null,
    error: null,
  });

  const trimmedQuery = inputValue.trim();

  useEffect(() => {
    if (trimmedQuery.length < MIN_QUERY_LENGTH) return;

    const controller = new AbortController();

    const timer = setTimeout(() => {
      setSearchState({
        query: trimmedQuery,
        status: 'loading',
        response: null,
        error: null,
      });

      fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}&limit=${GROUP_RESULT_LIMIT}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error('Search failed.');
          return res.json() as Promise<SearchResponse>;
        })
        .then((data) => {
          if (controller.signal.aborted) return;

          setSearchState({
            query: trimmedQuery,
            status: 'success',
            response: data,
            error: null,
          });
          setActiveIndex(-1);
        })
        .catch(() => {
          if (controller.signal.aborted) return;

          setSearchState({
            query: trimmedQuery,
            status: 'error',
            response: null,
            error: 'Failed to load search results. Please try again.',
          });
          setActiveIndex(-1);
        });
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const response = searchState.query === trimmedQuery ? searchState.response : null;
  const flatResults = useMemo<SearchResultItem[]>(
    () => response ? GROUPS.flatMap((group) => response.results[group.key]) : [],
    [response],
  );
  const resultIndices = useMemo(
    () => new Map(flatResults.map((item, index) => [`${item.type}-${item.id}`, index])),
    [flatResults],
  );

  useEffect(() => {
    if (activeIndex < 0) return;

    document
      .getElementById(`header-search-option-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function navigateTo(item: SearchResultItem) {
    setIsOpen(false);
    setInputValue('');
    setActiveIndex(-1);
    router.push(item.href);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      if (flatResults.length === 0) return;
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, flatResults.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      if (flatResults.length === 0) return;
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      const target = activeIndex >= 0 ? flatResults[activeIndex] : flatResults[0];
      if (target) {
        event.preventDefault();
        navigateTo(target);
      } else if (trimmedQuery.length >= MIN_QUERY_LENGTH) {
        event.preventDefault();
        setIsOpen(false);
        router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
      }
      return;
    }

    if (event.key === 'Escape') {
      if (isOpen) {
        event.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
  }

  const showDropdown = isOpen && trimmedQuery.length >= MIN_QUERY_LENGTH;
  const loading = showDropdown && (
    searchState.query !== trimmedQuery || searchState.status === 'loading'
  );
  const error = searchState.query === trimmedQuery ? searchState.error : null;
  const hasResults = flatResults.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative">
        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

        <input
          type="search"
          role="combobox"
          aria-label="Global CRM search"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls="header-search-listbox"
          aria-activedescendant={activeIndex >= 0 ? `header-search-option-${activeIndex}` : undefined}
          placeholder="Search departments, members, goals, projects, tasks..."
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (trimmedQuery.length >= MIN_QUERY_LENGTH) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
      </div>

      {showDropdown && (
        <div
          id="header-search-listbox"
          role="listbox"
          aria-busy={loading}
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[28rem] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          {loading ? (
            <div role="status" className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Searching...
            </div>
          ) : error ? (
            <div role="alert" className="flex flex-col items-center gap-2 p-6 text-center text-sm text-slate-500">
              <X size={20} className="text-red-400" />
              {error}
            </div>
          ) : !hasResults ? (
            <div role="status" className="flex flex-col items-center gap-2 p-6 text-center text-sm text-slate-500">
              <Search size={20} className="text-slate-300" />
              No results for &ldquo;{trimmedQuery}&rdquo;
            </div>
          ) : (
            <div>
              {GROUPS.map((group) => {
                const items = response?.results[group.key] ?? [];
                if (items.length === 0) return null;
                const Icon = group.icon;

                return (
                  <div key={group.key} className="border-b border-slate-100 last:border-b-0">
                    <p className="flex items-center gap-2 px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <Icon size={13} />
                      {group.label}
                    </p>

                    {items.map((item) => {
                      const index = resultIndices.get(`${item.type}-${item.id}`) ?? -1;
                      const active = index === activeIndex;

                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          type="button"
                          id={`header-search-option-${index}`}
                          role="option"
                          aria-selected={active}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => navigateTo(item)}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={`block w-full px-4 py-2 text-left transition-colors ${
                            active ? 'bg-blue-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <p title={item.title} className="truncate text-sm font-medium text-slate-900">{item.title}</p>

                          {item.description && (
                            <p title={item.description} className="truncate text-xs text-slate-500">{item.description}</p>
                          )}

                          <p title={item.subtitle} className="truncate text-xs text-slate-400">{item.subtitle}</p>
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              <Link
                href={`/search?q=${encodeURIComponent(trimmedQuery)}`}
                onClick={() => setIsOpen(false)}
                className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-blue-600 hover:bg-slate-50"
              >
                View all results
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
