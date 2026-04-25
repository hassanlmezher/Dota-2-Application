import { requireSupabase } from "./supabaseClient";
import { formatItemName } from "../utils/formatItemName";

function isRpcSignatureError(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return (
    message.includes("could not find the function") ||
    message.includes("no function matches") ||
    message.includes("function public.get_best_items_to_buy")
  );
}

async function callItemRpc(params) {
  const supabase = requireSupabase();
  const attempts = [
    {
      p_hero_id: params.heroId,
      p_enemy_hero_ids: params.enemyHeroIds,
      p_enemy_item_ids: params.enemyItemIds,
      p_limit: params.limit,
    },
    {
      hero_id: params.heroId,
      enemy_hero_ids: params.enemyHeroIds,
      enemy_item_ids: params.enemyItemIds,
      limit: params.limit,
    },
    {
      selected_hero_id: params.heroId,
      selected_enemy_heroes: params.enemyHeroIds,
      selected_enemy_items: params.enemyItemIds,
      max_results: params.limit,
    },
  ];

  let lastError = null;

  for (const rpcArgs of attempts) {
    const response = await supabase.rpc("get_best_items_to_buy", rpcArgs);

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

function mapItemSuggestion(result) {
  const score =
    result.score ??
    result.final_score ??
    result.total_score ??
    result.response_score ??
    0;

  return {
    itemId: result.item_id ?? result.id ?? null,
    itemName: formatItemName(result.item_name || result.name || "Unknown Item"),
    imageUrl: result.image_url || result.item_image_url || result.icon_url || null,
    category: result.category || result.item_category || "utility",
    score,
    reason:
      result.reason ||
      result.summary ||
      "Recommended against the selected enemy heroes and active threat items.",
    raw: result,
  };
}

async function getItemSuggestions({
  heroId,
  enemyHeroIds = [],
  enemyItemIds = [],
  limit = 8,
}) {
  if (!heroId) {
    return [];
  }

  const results = await callItemRpc({
    heroId,
    enemyHeroIds,
    enemyItemIds,
    limit,
  });

  return results.map(mapItemSuggestion);
}

export const itemsApi = {
  getItemSuggestions,
};
