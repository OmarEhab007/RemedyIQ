import { useCallback, useEffect, useRef, useState } from "react";

export interface UseLazySectionResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  ref: React.RefObject<HTMLDivElement | null>;
  refetch: () => void;
}

export function useLazySection<T>(
  fetchFn: () => Promise<T>,
): UseLazySectionResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const elementRef = useRef<HTMLDivElement>(null);

  const fetchAndSetData = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
      fetchedRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  // Fetch eagerly on mount. The dashboard page already guards rendering
  // behind the main dashboard load, so these calls only start once the
  // page is ready. Five lightweight section calls (<50 KB each) are not
  // worth the complexity and fragility of IntersectionObserver in nested
  // scroll layouts (flex h-screen + overflow-auto main).
  useEffect(() => {
    fetchAndSetData();
  }, [fetchAndSetData]);

  return { data, loading, error, ref: elementRef, refetch: fetchAndSetData };
}
