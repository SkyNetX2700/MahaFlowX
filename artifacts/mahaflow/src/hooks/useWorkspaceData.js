import { useCallback, useEffect, useRef, useState } from "react";

export const useWorkspaceData = (loader) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { const loaded = await loaderRef.current(); setData(loaded ?? []); }
    catch (requestError) { setError(requestError.message || "Request failed"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  return { data, setData, loading, error, reload };
};