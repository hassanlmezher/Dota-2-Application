import { useEffect, useMemo, useState } from "react";
import HeroCard from "../components/HeroCard";
import { useCounterPicks } from "../hooks/useCounterPicks";
import { resolveHeroNames } from "../api/supabaseClient";

function EmptyCard({ title, description }) {
  return (
    <div className="intel-empty">
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  );
}

export default function PickAssistant({
  role,
  enemyHeroNames = [],
  limit = 8,
  compact = false,
  active = true,
  feedScope = "unknown",
}) {
  const { results, loading, error, runCounterPickSearch } = useCounterPicks();
  const [resolvedHeroes, setResolvedHeroes] = useState([]);
  const [resolutionError, setResolutionError] = useState("");
  const [resolving, setResolving] = useState(false);
  const normalizedEnemyNames = useMemo(
    () => [...new Set(enemyHeroNames.filter(Boolean))],
    [enemyHeroNames]
  );
  const enemyKey = normalizedEnemyNames.join("|");
  const resolvedHeroIds = resolvedHeroes.map((hero) => hero.heroId).filter(Boolean);

  useEffect(() => {
    let isMounted = true;

    async function resolveEnemyHeroes() {
      if (!active || !normalizedEnemyNames.length) {
        setResolvedHeroes([]);
        setResolutionError("");
        setResolving(false);
        return;
      }

      try {
        setResolving(true);
        setResolutionError("");
        const nextHeroes = await resolveHeroNames(normalizedEnemyNames);

        if (!isMounted) {
          return;
        }

        setResolvedHeroes(nextHeroes);

        if (!nextHeroes.length) {
          setResolutionError(
            "Enemy heroes were detected from screen capture, but none matched the Supabase hero catalog."
          );
        }
      } catch (requestError) {
        if (isMounted) {
          setResolvedHeroes([]);
          setResolutionError(requestError?.message || "Failed to resolve enemy heroes.");
        }
      } finally {
        if (isMounted) {
          setResolving(false);
        }
      }
    }

    resolveEnemyHeroes();

    return () => {
      isMounted = false;
    };
  }, [active, enemyKey]);

  useEffect(() => {
    if (!active || !role || !resolvedHeroIds.length) {
      return;
    }

    runCounterPickSearch({
      role,
      enemyHeroIds: resolvedHeroIds,
      limit,
    });
  }, [active, limit, role, resolvedHeroIds.join(",")]);

  if (!active) {
    return null;
  }

  if (!normalizedEnemyNames.length) {
    return (
      <EmptyCard
        title="No enemy heroes detected yet"
        description={
          feedScope === "player"
            ? "The capture is running, but the draft HUD is not readable enough yet to identify enemy heroes."
            : "As soon as the draft HUD exposes enemy heroes clearly, counter picks will appear here automatically."
        }
      />
    );
  }

  if (resolving) {
    return (
      <EmptyCard
        title="Resolving enemy heroes"
        description="Matching detected hero names against the Supabase hero table."
      />
    );
  }

  if (resolutionError) {
    return (
      <EmptyCard
        title="Hero resolution failed"
        description={resolutionError}
      />
    );
  }

  if (loading) {
    return (
      <EmptyCard
        title="Scoring counter picks"
        description="Calling get_best_counter_picks with the detected enemy draft."
      />
    );
  }

  if (error) {
    return (
      <EmptyCard
        title="Counter-pick RPC failed"
        description={error}
      />
    );
  }

  if (!results.length) {
    return (
      <EmptyCard
        title="No hero suggestions yet"
        description="Enemy heroes are known, but the counter-pick function has not returned recommendations for this role."
      />
    );
  }

  return (
    <div className="intel-suggestion-list">
      {results.map((hero) => (
        <HeroCard key={`${hero.heroId}-${hero.heroName}`} hero={hero} compact={compact} />
      ))}
    </div>
  );
}
