import { useEffect, useMemo, useState } from "react";
import ItemCard from "../components/ItemCard";
import { resolveHeroName, resolveHeroNames, resolveItemNames } from "../api/supabaseClient";
import { useItemSuggestions } from "../hooks/useItemSuggestions";

function EmptyCard({ title, description }) {
  return (
    <div className="intel-empty">
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  );
}

export default function ItemAssistant({
  myHeroName = "",
  enemyHeroNames = [],
  enemyItemNames = [],
  limit = 8,
  active = true,
  feedScope = "unknown",
}) {
  const { results, loading, error, runItemSearch } = useItemSuggestions();
  const [resolvedMyHero, setResolvedMyHero] = useState(null);
  const [resolvedEnemyHeroes, setResolvedEnemyHeroes] = useState([]);
  const [resolvedEnemyItems, setResolvedEnemyItems] = useState([]);
  const [resolutionError, setResolutionError] = useState("");
  const [resolving, setResolving] = useState(false);
  const normalizedEnemyNames = useMemo(
    () => [...new Set(enemyHeroNames.filter(Boolean))],
    [enemyHeroNames]
  );
  const normalizedEnemyItemNames = useMemo(
    () => [...new Set(enemyItemNames.filter(Boolean))],
    [enemyItemNames]
  );
  const enemyHeroKey = normalizedEnemyNames.join("|");
  const enemyItemKey = normalizedEnemyItemNames.join("|");
  const enemyHeroIds = resolvedEnemyHeroes.map((hero) => hero.heroId).filter(Boolean);
  const enemyItemIds = resolvedEnemyItems.map((item) => item.itemId).filter(Boolean);

  useEffect(() => {
    let isMounted = true;

    async function resolveMatchContext() {
      if (!active) {
        setResolvedMyHero(null);
        setResolvedEnemyHeroes([]);
        setResolvedEnemyItems([]);
        setResolutionError("");
        setResolving(false);
        return;
      }

      if (!myHeroName) {
        setResolvedMyHero(null);
        setResolvedEnemyHeroes([]);
        setResolvedEnemyItems([]);
        setResolutionError("");
        setResolving(false);
        return;
      }

      try {
        setResolving(true);
        setResolutionError("");
        const [nextMyHero, nextEnemyHeroes, nextEnemyItems] = await Promise.all([
          resolveHeroName(myHeroName),
          resolveHeroNames(normalizedEnemyNames),
          resolveItemNames(normalizedEnemyItemNames),
        ]);

        if (!isMounted) {
          return;
        }

        setResolvedMyHero(nextMyHero || null);
        setResolvedEnemyHeroes(nextEnemyHeroes);
        setResolvedEnemyItems(nextEnemyItems);

        if (!nextMyHero) {
          setResolutionError(
            `Your current hero "${myHeroName}" was not found in the Supabase heroes table.`
          );
        } else if (!nextEnemyHeroes.length && normalizedEnemyNames.length) {
          setResolutionError(
            "Enemy heroes were detected from screen capture, but none matched the Supabase hero catalog."
          );
        }
      } catch (requestError) {
        if (isMounted) {
          setResolutionError(requestError?.message || "Failed to resolve match context.");
          setResolvedMyHero(null);
          setResolvedEnemyHeroes([]);
          setResolvedEnemyItems([]);
        }
      } finally {
        if (isMounted) {
          setResolving(false);
        }
      }
    }

    resolveMatchContext();

    return () => {
      isMounted = false;
    };
  }, [active, myHeroName, enemyHeroKey, enemyItemKey]);

  useEffect(() => {
    if (!active || !resolvedMyHero?.heroId || !enemyHeroIds.length) {
      return;
    }

    runItemSearch({
      heroId: resolvedMyHero.heroId,
      enemyHeroIds,
      enemyItemIds,
      limit,
    });
  }, [
    active,
    limit,
    resolvedMyHero?.heroId,
    enemyHeroIds.join(","),
    enemyItemIds.join(","),
  ]);

  if (!active) {
    return null;
  }

  if (!myHeroName) {
    return (
      <EmptyCard
        title="Waiting for your hero"
        description="The item assistant starts once the capture pipeline can identify the current focus hero."
      />
    );
  }

  if (!normalizedEnemyNames.length) {
    return (
      <EmptyCard
        title="No enemy heroes detected yet"
        description={
          feedScope === "player"
            ? "The current screen view has not exposed the enemy lineup clearly enough yet."
            : "Item recommendations require at least one enemy hero from the live screen feed."
        }
      />
    );
  }

  if (resolving) {
    return (
      <EmptyCard
        title="Resolving live match context"
        description="Matching the detected hero lineup against Supabase tables."
      />
    );
  }

  if (resolutionError) {
    return (
      <EmptyCard
        title="Context resolution failed"
        description={resolutionError}
      />
    );
  }

  if (loading) {
    return (
      <EmptyCard
        title="Scoring item responses"
        description="Calling get_best_items_to_buy with the detected enemy lineup."
      />
    );
  }

  if (error) {
    return (
      <EmptyCard
        title="Item RPC failed"
        description={error}
      />
    );
  }

  if (!results.length) {
    return (
      <EmptyCard
        title="No item suggestions yet"
        description="The live context is present, but the item function has not returned any recommendations."
      />
    );
  }

  return (
    <div className="intel-suggestion-list">
      {results.map((item) => (
        <ItemCard key={`${item.itemId}-${item.itemName}`} item={item} />
      ))}
    </div>
  );
}
