import { useEffect, useMemo } from "react";
import { useCounterPicks } from "./useCounterPicks";
import { useItemSuggestions } from "./useItemSuggestions";
import { deriveMatchInsights } from "../utils/matchState";

export function useOverlayInsights({
  matchState,
  role,
  counterLimit = 4,
  itemLimit = 5,
}) {
  const counterPicks = useCounterPicks();
  const itemSuggestions = useItemSuggestions();

  const insights = useMemo(() => deriveMatchInsights(matchState), [matchState]);
  const enemyHeroKey = insights.enemyHeroIds.join(",");
  const enemyItemKey = insights.enemyItemIds.join(",");

  useEffect(() => {
    if (insights.phase !== "draft" || !role || !insights.enemyHeroIds.length) {
      return;
    }

    counterPicks.runCounterPickSearch({
      role,
      enemyHeroIds: insights.enemyHeroIds,
      limit: counterLimit,
    });
  }, [counterLimit, enemyHeroKey, insights.phase, role]);

  useEffect(() => {
    if (insights.phase !== "match" || !insights.heroId) {
      return;
    }

    itemSuggestions.runItemSearch({
      heroId: insights.heroId,
      enemyHeroIds: insights.enemyHeroIds,
      enemyItemIds: insights.enemyItemIds,
      limit: itemLimit,
    });
  }, [enemyHeroKey, enemyItemKey, insights.heroId, insights.phase, itemLimit]);

  return {
    ...insights,
    counterPickResults: counterPicks.results,
    counterPickLoading: counterPicks.loading,
    counterPickError: counterPicks.error,
    itemResults: itemSuggestions.results,
    itemLoading: itemSuggestions.loading,
    itemError: itemSuggestions.error,
  };
}
