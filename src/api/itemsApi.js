import { formatItemName } from "../utils/formatItemName";
import { getItemCatalog, requireSupabase } from "./supabaseClient";

function isRpcSignatureError(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return (
    message.includes("could not find the function") ||
    message.includes("no function matches") ||
    message.includes("function public.get_best_items_to_buy")
  );
}

function toScore(value) {
  const numericValue = Number(
    value?.total_score ??
      value?.score ??
      value?.final_score ??
      value?.response_score ??
      0
  );

  return Number.isFinite(numericValue) ? numericValue : 0;
}

async function callItemRpc({ heroId, enemyHeroIds, enemyItemIds }) {
  const supabase = requireSupabase();
  const attempts = [
    {
      my_hero_id: heroId,
      enemy_hero_ids: enemyHeroIds,
      enemy_item_ids: enemyItemIds,
    },
    {
      p_hero_id: heroId,
      p_enemy_hero_ids: enemyHeroIds,
      p_enemy_item_ids: enemyItemIds,
    },
    {
      hero_id: heroId,
      enemy_hero_ids: enemyHeroIds,
      enemy_item_ids: enemyItemIds,
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

async function getItemSuggestions({
  heroId,
  enemyHeroIds = [],
  enemyItemIds = [],
  limit = 8,
}) {
  const normalizedHeroId = Number(heroId);
  const normalizedEnemyHeroIds = enemyHeroIds
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
  const normalizedEnemyItemIds = enemyItemIds
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));

  if (!Number.isInteger(normalizedHeroId)) {
    return [];
  }

  const [results, itemCatalog] = await Promise.all([
    callItemRpc({
      heroId: normalizedHeroId,
      enemyHeroIds: normalizedEnemyHeroIds,
      enemyItemIds: normalizedEnemyItemIds,
    }),
    getItemCatalog(),
  ]);
  const itemsById = new Map(itemCatalog.map((item) => [String(item.itemId), item]));
  const itemsByName = new Map(itemCatalog.map((item) => [item.itemName, item]));

  return results.slice(0, limit).map((result) => {
    const itemId = result.item_id ?? result.id ?? null;
    const itemName = formatItemName(result.item_name || result.name || "Unknown Item");
    const meta =
      (itemId !== null ? itemsById.get(String(itemId)) : null) ||
      itemsByName.get(itemName) ||
      null;

    return {
      itemId: meta?.itemId ?? itemId,
      itemName: meta?.itemName || itemName,
      imageUrl: meta?.imageUrl || result.image_url || result.item_image_url || null,
      category: meta?.category || result.category || result.item_category || "utility",
      cost: meta?.cost ?? result.cost ?? null,
      score: toScore(result),
      reason:
        result.reason ||
        result.summary ||
        "Recommended from the current enemy hero lineup and detected threat items.",
      raw: result,
    };
  });
}

export const itemsApi = {
  getItemSuggestions,
};
