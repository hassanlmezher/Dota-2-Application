import { useEffect, useState } from "react";
import ItemCard from "../components/ItemCard";
import Loader from "../components/Loader";
import SearchBar from "../components/SearchBar";
import { useItemSuggestions } from "../hooks/useItemSuggestions";
import { supabase } from "../api/supabaseClient";
import { ITEM_CATEGORY_LABELS } from "../constants/dotaItemCategories";

function saveRecentSearch(entry) {
  const storageKey = "dota-helper:recent-item-searches";
  const current = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
  const next = [entry, ...current].slice(0, 10);
  window.localStorage.setItem(storageKey, JSON.stringify(next));
}

export default function ItemAssistant() {
  const [myHeroId, setMyHeroId] = useState(null);
  const [enemyHeroIds, setEnemyHeroIds] = useState([]);
  const [enemyItemIds, setEnemyItemIds] = useState([]);
  const [heroes, setHeroes] = useState([]);
  const [items, setItems] = useState([]);
  const [directoryError, setDirectoryError] = useState("");
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const { results, loading, error, runItemSearch } = useItemSuggestions();

  useEffect(() => {
    let isMounted = true;

    async function loadDirectories() {
      setLoadingDirectory(true);
      setDirectoryError("");

      if (!supabase) {
        setDirectoryError("Supabase client is not configured.");
        setLoadingDirectory(false);
        return;
      }

      const [heroesResponse, itemsResponse] = await Promise.all([
        supabase
          .from("heroes")
          .select("hero_id, hero_name, image_url, primary_attribute")
          .order("hero_name", { ascending: true }),
        supabase
          .from("items")
          .select("item_id, item_name, image_url, category, cost")
          .order("item_name", { ascending: true }),
      ]);

      if (!isMounted) {
        return;
      }

      if (heroesResponse.error) {
        setDirectoryError(heroesResponse.error.message);
        setLoadingDirectory(false);
        return;
      }

      if (itemsResponse.error) {
        setDirectoryError(itemsResponse.error.message);
        setLoadingDirectory(false);
        return;
      }

      setHeroes(
        (heroesResponse.data || []).map((hero) => ({
          value: hero.hero_id,
          label: hero.hero_name,
          imageUrl: hero.image_url,
          meta: hero.primary_attribute,
        }))
      );

      setItems(
        (itemsResponse.data || []).map((item) => ({
          value: item.item_id,
          label: item.item_name,
          imageUrl: item.image_url,
          meta: ITEM_CATEGORY_LABELS[item.category] || item.category,
        }))
      );

      setLoadingDirectory(false);
    }

    loadDirectories();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    const nextResults = await runItemSearch({
      heroId: myHeroId,
      enemyHeroIds,
      enemyItemIds,
    });

    if (nextResults.length) {
      saveRecentSearch({
        id: crypto.randomUUID(),
        heroName: heroes.find((hero) => hero.value === myHeroId)?.label || "Unknown Hero",
        enemyHeroes: heroes
          .filter((hero) => enemyHeroIds.includes(hero.value))
          .map((hero) => hero.label),
        createdAt: new Date().toISOString(),
      });
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Item Assistant</p>
          <h1>Itemize against enemy heroes and threat items</h1>
          <p className="page-lead">
            Combine hero matchup context with enemy item pressure and translate it
            into a prioritized buy list.
          </p>
        </div>
      </div>

      <div className="page-grid page-grid--two-column">
        <form className="panel form-panel" onSubmit={handleSubmit}>
          {loadingDirectory ? (
            <Loader label="Loading heroes and items..." />
          ) : (
            <>
              <SearchBar
                label="My Hero"
                placeholder="Choose your hero..."
                options={heroes}
                value={myHeroId}
                onChange={setMyHeroId}
                multi={false}
              />

              <SearchBar
                label="Enemy Heroes"
                placeholder="Search enemy heroes..."
                options={heroes}
                value={enemyHeroIds}
                onChange={setEnemyHeroIds}
                multi
              />

              <SearchBar
                label="Enemy Items"
                placeholder="Search enemy items..."
                options={items}
                value={enemyItemIds}
                onChange={setEnemyItemIds}
                multi
              />
            </>
          )}

          {directoryError ? <p className="error-text">{directoryError}</p> : null}

          <button
            type="submit"
            className="button button-primary button-full"
            disabled={loading || loadingDirectory || !myHeroId}
          >
            {loading ? "Generating build..." : "Get Best Items To Buy"}
          </button>
        </form>

        <div className="panel result-panel">
          <div className="section-heading">
            <h2>Recommended Items</h2>
            <span>{results.length} items</span>
          </div>

          {loading ? <Loader label="Evaluating item responses..." /> : null}
          {error ? <p className="error-text">{error}</p> : null}

          {!loading && !results.length && !error ? (
            <p className="empty-state">
              Select your hero, add optional enemy context, and run the search to see
              item recommendations.
            </p>
          ) : null}

          <div className="result-stack">
            {results.map((item) => (
              <ItemCard key={`${item.itemId}-${item.itemName}`} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
