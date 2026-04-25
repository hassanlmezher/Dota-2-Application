import { useState } from "react";
import { counterPicksApi } from "../api/counterPicksApi";

export function useCounterPicks() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runCounterPickSearch(params) {
    try {
      setLoading(true);
      setError("");
      const nextResults = await counterPicksApi.getCounterPicks(params);
      setResults(nextResults);
      return nextResults;
    } catch (requestError) {
      const message = requestError?.message || "Failed to fetch counter picks.";
      setError(message);
      setResults([]);
      return [];
    } finally {
      setLoading(false);
    }
  }

  return {
    results,
    loading,
    error,
    runCounterPickSearch,
  };
}
