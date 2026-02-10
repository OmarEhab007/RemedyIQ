"use client";

import { useSearch } from "@/hooks/use-search";
import { SearchBar } from "@/components/explorer/search-bar";
import { FilterPanel } from "@/components/explorer/filter-panel";
import { LogTable } from "@/components/explorer/log-table";
import { DetailPanel } from "@/components/explorer/detail-panel";
import { useState, useEffect } from "react";
import type { SearchHit } from "@/hooks/use-search";

export default function ExplorerPage() {
  const [selectedEntry, setSelectedEntry] = useState<SearchHit | null>(null);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const { query, results, loading, error, search, page, goToPage } = useSearch(undefined, filters);

  // Trigger search when filters change
  useEffect(() => {
    if (query.trim()) {
      search(query);
    }
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar filters */}
      <div className="w-64 border-r p-4 overflow-y-auto hidden lg:block">
        <FilterPanel
          facets={results?.facets || {}}
          activeFilters={filters}
          onFilterChange={setFilters}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search bar */}
        <div className="p-4 border-b">
          <SearchBar value={query} onChange={search} />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-hidden">
          {error && (
            <div className="p-4 m-4 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Searching...
            </div>
          )}

          {results && !loading && (
            <>
              <div className="px-4 py-2 text-sm text-muted-foreground border-b">
                {results.total.toLocaleString()} results
                {results.total_pages > 1 && ` (page ${results.page} of ${results.total_pages})`}
              </div>
              <LogTable
                hits={results.results}
                onSelect={setSelectedEntry}
                selectedId={selectedEntry?.id}
              />
              {/* Pagination */}
              {results.total_pages > 1 && (
                <div className="flex items-center justify-center gap-2 p-3 border-t">
                  <button
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {results.total_pages}
                  </span>
                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= results.total_pages}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}

          {!results && !loading && !error && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Enter a search query to explore log entries
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedEntry && (
        <DetailPanel
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}
