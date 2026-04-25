import { requireSupabase } from "./supabaseClient";
import { formatHeroName } from "../utils/formatHeroName";

function isRpcSignatureError(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return (
    message.includes("could not find the function") ||
    message.includes("no function matches") ||
    message.includes("function public.get_best_counter_picks")
  );
}

async function callCounterPickRpc(params) {
  const supabase = requireSupabase();
  const attempts = [
    {
      p_role: params.role || null,
      p_enemy_hero_ids: params.enemyHeroIds,
      p_limit: params.limit,
    },
    {
      role: params.role || null,
      enemy_hero_ids: params.enemyHeroIds,
      limit: params.limit,
    },
    {
      selected_role: params.role || null,
      selected_enemy_heroes: params.enemyHeroIds,
      max_results: params.limit,
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

function mapCounterPick(result) {
  const score =
    result.score ??
    result.final_score ??
    result.total_score ??
    result.advantage_score ??
    result.counter_score ??
    0;

  return {
    heroId: result.hero_id ?? result.id ?? null,
    heroName: formatHeroName(result.hero_name || result.name || "Unknown Hero"),
    imageUrl: result.image_url || result.hero_image_url || result.icon_url || null,
    primaryAttribute: result.primary_attribute || null,
    score,
    reason:
      result.reason ||
      result.summary ||
      `Strong projected lane and matchup value versus the selected enemy pool.`,
    raw: result,
  };
}

async function getCounterPicks({
  role,
  enemyHeroIds = [],
  limit = 8,
}) {
  if (!enemyHeroIds.length) {
    return [];
  }

  const results = await callCounterPickRpc({
    role,
    enemyHeroIds,
    limit,
  });

  return results.map(mapCounterPick);
}

export const counterPicksApi = {
  getCounterPicks,
};
