import { useState } from "react";
import { itemsApi } from "../api/itemsApi";

export function useItemSuggestions() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runItemSearch(params) {
    try {
      setLoading(true);
      setError("");
      const nextResults = await itemsApi.getItemSuggestions(params);
      setResults(nextResults);
      return nextResults;
    } catch (requestError) {
      const message = requestError?.message || "Failed to fetch item suggestions.";
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
    runItemSearch,
  };
}
