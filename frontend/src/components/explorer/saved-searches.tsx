"use client";

import { useState, useEffect } from "react";
import { getApiHeaders } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

interface SavedSearch {
  id: string;
  name: string;
  kql_query: string;
  created_at: string;
}

interface SavedSearchesProps {
  jobId?: string;
  onLoadSearch: (query: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SavedSearches({ jobId: _jobId, onLoadSearch }: SavedSearchesProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [currentQuery, setCurrentQuery] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSearches();
  }, []);

  const fetchSearches = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/search/saved`, {
        headers: getApiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSearches(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch saved searches:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!saveName.trim() || !currentQuery.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/search/saved`, {
        method: "POST",
        headers: {
          ...getApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: saveName.trim(),
          kql_query: currentQuery.trim(),
        }),
      });

      if (res.ok) {
        setSaveName("");
        setCurrentQuery("");
        setShowSaveForm(false);
        fetchSearches();
      }
    } catch (err) {
      console.error("Failed to save search:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/search/saved/${id}`, {
        method: "DELETE",
        headers: getApiHeaders(),
      });
      if (res.ok) {
        setSearches(searches.filter((s) => s.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete search:", err);
    }
  };

  return (
    <div className="p-2 border rounded-lg bg-card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">Saved Searches</h3>
        <button
          onClick={() => setShowSaveForm(!showSaveForm)}
          className="text-xs text-primary hover:text-primary/80"
        >
          + Save Current
        </button>
      </div>

      {showSaveForm && (
        <div className="mb-3 p-2 border rounded bg-muted/50">
          <input
            type="text"
            placeholder="Query to save"
            value={currentQuery}
            onChange={(e) => setCurrentQuery(e.target.value)}
            className="w-full text-xs px-2 py-1 border rounded mb-2"
          />
          <input
            type="text"
            placeholder="Search name"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            className="w-full text-xs px-2 py-1 border rounded mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !saveName.trim() || !currentQuery.trim()}
              className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setShowSaveForm(false)}
              className="text-xs px-2 py-1 border rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-muted-foreground">Loading...</div>
      ) : searches.length === 0 ? (
        <div className="text-xs text-muted-foreground">No saved searches</div>
      ) : (
        <ul className="space-y-1">
          {searches.map((search) => (
            <li
              key={search.id}
              className="flex items-center justify-between text-xs group"
            >
              <button
                onClick={() => onLoadSearch(search.kql_query)}
                className="flex-1 text-left hover:text-primary truncate mr-2"
                title={search.kql_query}
              >
                {search.name}
              </button>
              <button
                onClick={() => handleDelete(search.id)}
                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
