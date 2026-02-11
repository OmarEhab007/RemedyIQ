import { useEffect, useRef, useState } from "react";

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
  const [fetched, setFetched] = useState(false);

  const elementRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const fetchAndSetData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
      setFetched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const element = elementRef.current;
    if (!element || fetched) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !fetched && !loading) {
          fetchAndSetData();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [fetched, loading]);

  return { data, loading, error, ref: elementRef, refetch: fetchAndSetData };
}
