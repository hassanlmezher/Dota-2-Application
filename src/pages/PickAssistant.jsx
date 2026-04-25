import { useEffect, useState } from "react";
import HeroCard from "../components/HeroCard";
import Loader from "../components/Loader";
import RoleSelector from "../components/RoleSelector";
import SearchBar from "../components/SearchBar";
import { useCounterPicks } from "../hooks/useCounterPicks";
import { ROLE_LOOKUP } from "../constants/roles";
import { supabase } from "../api/supabaseClient";

function saveRecentSearch(entry) {
  const storageKey = "dota-helper:recent-counter-searches";
  const current = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
  const next = [entry, ...current].slice(0, 10);
  window.localStorage.setItem(storageKey, JSON.stringify(next));
}

export default function PickAssistant() {
  const [selectedRole, setSelectedRole] = useState("carry");
  const [enemyHeroIds, setEnemyHeroIds] = useState([]);
  const [heroes, setHeroes] = useState([]);
  const [directoryError, setDirectoryError] = useState("");
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const { results, loading, error, runCounterPickSearch } = useCounterPicks();

  useEffect(() => {
    let isMounted = true;

    async function loadHeroes() {
      setLoadingDirectory(true);
      setDirectoryError("");

      if (!supabase) {
        setDirectoryError("Supabase client is not configured.");
        setLoadingDirectory(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("heroes")
        .select("hero_id, hero_name, image_url, primary_attribute")
        .order("hero_name", { ascending: true });

      if (!isMounted) {
        return;
      }

      if (fetchError) {
        setDirectoryError(fetchError.message);
        setLoadingDirectory(false);
        return;
      }

      setHeroes(
        (data || []).map((hero) => ({
          value: hero.hero_id,
          label: hero.hero_name,
          imageUrl: hero.image_url,
          meta: hero.primary_attribute,
        }))
      );
      setLoadingDirectory(false);
    }

    loadHeroes();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    const nextResults = await runCounterPickSearch({
      role: selectedRole,
      enemyHeroIds,
    });

    if (nextResults.length) {
      const enemyHeroes = heroes
        .filter((hero) => enemyHeroIds.includes(hero.value))
        .map((hero) => hero.label);

      saveRecentSearch({
        id: crypto.randomUUID(),
        role: selectedRole,
        roleLabel: ROLE_LOOKUP[selectedRole],
        enemyHeroes,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Pick Assistant</p>
          <h1>Counter the enemy draft by role</h1>
          <p className="page-lead">
            Choose the lane you plan to play, add enemy heroes, and query your
            Supabase matchup function.
          </p>
        </div>
      </div>

      <div className="page-grid page-grid--two-column">
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <RoleSelector value={selectedRole} onChange={setSelectedRole} />

          {loadingDirectory ? (
            <Loader label="Loading hero directory..." />
          ) : (
            <SearchBar
              label="Enemy Heroes"
              placeholder="Search enemy heroes..."
              options={heroes}
              value={enemyHeroIds}
              onChange={setEnemyHeroIds}
              multi
            />
          )}

          {directoryError ? <p className="error-text">{directoryError}</p> : null}

          <button
            type="submit"
            className="button button-primary button-full"
            disabled={loading || loadingDirectory || !enemyHeroIds.length}
          >
            {loading ? "Finding counters..." : "Get Best Counter Picks"}
          </button>
        </form>

        <div className="panel result-panel">
          <div className="section-heading">
            <h2>Suggested Counter Picks</h2>
            <span>{results.length} heroes</span>
          </div>

          {loading ? <Loader label="Scoring heroes..." /> : null}
          {error ? <p className="error-text">{error}</p> : null}

          {!loading && !results.length && !error ? (
            <p className="empty-state">
              Add at least one enemy hero and run the search to populate this panel.
            </p>
          ) : null}

          <div className="result-stack">
            {results.map((hero) => (
              <HeroCard key={`${hero.heroId}-${hero.heroName}`} hero={hero} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
