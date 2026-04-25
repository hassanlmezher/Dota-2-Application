import { formatHeroName } from "../utils/formatHeroName";
import { getHeroCatalog, requireSupabase } from "./supabaseClient";

function isRpcSignatureError(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return (
    message.includes("could not find the function") ||
    message.includes("no function matches") ||
    message.includes("function public.get_best_counter_picks")
  );
}

function toScore(value) {
  const numericValue = Number(
    value?.total_score ??
      value?.score ??
      value?.final_score ??
      value?.advantage_score ??
      value?.counter_score ??
      0
  );

  return Number.isFinite(numericValue) ? numericValue : 0;
}

async function callCounterPickRpc({ role, enemyHeroIds }) {
  const supabase = requireSupabase();
  const attempts = [
    {
      enemy_ids: enemyHeroIds,
      desired_role: role,
    },
    {
      p_enemy_hero_ids: enemyHeroIds,
      p_role: role,
    },
    {
      enemy_hero_ids: enemyHeroIds,
      role,
    },
  ];

  let lastError = null;

  for (const rpcArgs of attempts) {
    const response = await supabase.rpc("get_best_counter_picks", rpcArgs);

    if (!response.error) {
      return response.data || [];
    }

    lastError = response.error;

    if (!isRpcSignatureError(response.error)) {
      throw response.error;
    }
  }

  throw lastError;
}

async function getCounterPicks({ role, enemyHeroIds = [], limit = 8 }) {
  const normalizedEnemyIds = enemyHeroIds
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));

  if (!normalizedEnemyIds.length) {
    return [];
  }

  const [results, heroCatalog] = await Promise.all([
    callCounterPickRpc({
      role,
      enemyHeroIds: normalizedEnemyIds,
    }),
    getHeroCatalog(),
  ]);
  const heroesById = new Map(heroCatalog.map((hero) => [String(hero.heroId), hero]));
  const heroesByName = new Map(heroCatalog.map((hero) => [hero.heroName, hero]));

  return results.slice(0, limit).map((result) => {
    const heroId = result.hero_id ?? result.id ?? null;
    const heroName = formatHeroName(result.hero_name || result.name || "Unknown Hero");
    const meta =
      (heroId !== null ? heroesById.get(String(heroId)) : null) ||
      heroesByName.get(heroName) ||
      null;

    return {
      heroId: meta?.heroId ?? heroId,
      heroName: meta?.heroName || heroName,
      imageUrl: meta?.imageUrl || result.image_url || result.hero_image_url || null,
      primaryAttribute: meta?.primaryAttribute || result.primary_attribute || null,
      score: toScore(result),
      reason:
        result.reason ||
        result.summary ||
        `Recommended against ${normalizedEnemyIds.length} detected enemy heroes for the ${role} role.`,
      raw: result,
    };
  });
}

export const counterPicksApi = {
  getCounterPicks,
};
