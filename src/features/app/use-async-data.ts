import { useCallback, useEffect, useState } from "react";

export function useAsyncData<T>(load: () => Promise<T>, dependencies: React.DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(
    async () => {
      setLoading(true);
      setError(null);
      try {
        setData(await load());
      } catch {
        setError("This part of Lorne could not be loaded.");
      } finally {
        setLoading(false);
      }
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: the caller intentionally owns the refresh dependency list.
    dependencies
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { data, error, loading, refresh, setData };
}
