import { formatHeroName } from "./formatHeroName";
import { formatItemName } from "./formatItemName";

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeText(value = "") {
  return String(value).trim().toLowerCase();
}

function formatGameStateLabel(gameState = "") {
  if (!gameState) {
    return "No match detected";
  }

  return gameState
    .replace(/^DOTA_GAMERULES_STATE_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function calculateHealthPercent(entry) {
  const directPercent = toNumber(
    entry.healthPercent ?? entry.health_percent ?? entry.hp_percent
  );

  if (directPercent !== null) {
    return Math.max(0, Math.min(100, Math.round(directPercent)));
  }

  const health = toNumber(entry.health ?? entry.player_health ?? entry.hp);
  const maxHealth = toNumber(entry.maxHealth ?? entry.max_health ?? entry.health_max);

  if (health === null || maxHealth === null || maxHealth <= 0) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round((health / maxHealth) * 100)));
}

function normalizeInventory(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      id: toNumber(item.id ?? item.item_id),
      slot: item.slot || item.slot_name || item.slot_index || `slot-${index + 1}`,
      name: formatItemName(item.name || item.localized_name || "Unknown Item"),
      imageUrl: item.imageUrl || item.image_url || item.image || null,
      raw: item,
    }))
    .filter((item) => item.name && item.name.toLowerCase() !== "empty");
}

function sameEntity(left, right) {
  if (!left || !right) {
    return false;
  }

  if (left.id && right.id) {
    return String(left.id) === String(right.id);
  }

  return normalizeText(left.name) === normalizeText(right.name);
}

function normalizeHeroEntry(entry = {}, index = 0) {
  const name = formatHeroName(
    entry.name || entry.localized_name || entry.heroName || entry.hero_name || `Enemy ${index + 1}`
  );

  return {
    id: toNumber(entry.id ?? entry.heroId ?? entry.hero_id),
    name,
    imageUrl: entry.imageUrl || entry.image_url || entry.image || null,
    team: entry.team || entry.team_name || null,
    health: toNumber(entry.health ?? entry.player_health ?? entry.hp),
    maxHealth: toNumber(entry.maxHealth ?? entry.max_health ?? entry.health_max),
    healthPercent: calculateHealthPercent(entry),
    items: normalizeInventory(entry.items),
    raw: entry,
  };
}

function mergeEnemyData(heroEntries, playerEntries) {
  const merged = [];
  const consumedPlayers = new Set();

  for (const heroEntry of heroEntries) {
    const matchingPlayerIndex = playerEntries.findIndex((playerEntry) =>
      sameEntity(heroEntry, playerEntry)
    );
    const matchingPlayer = matchingPlayerIndex >= 0 ? playerEntries[matchingPlayerIndex] : null;

    if (matchingPlayerIndex >= 0) {
      consumedPlayers.add(matchingPlayerIndex);
    }

    merged.push({
      ...heroEntry,
      items: matchingPlayer?.items?.length ? matchingPlayer.items : heroEntry.items,
      health: matchingPlayer?.health ?? heroEntry.health,
      maxHealth: matchingPlayer?.maxHealth ?? heroEntry.maxHealth,
      healthPercent: matchingPlayer?.healthPercent ?? heroEntry.healthPercent,
    });
  }

  playerEntries.forEach((playerEntry, index) => {
    if (!consumedPlayers.has(index)) {
      merged.push(playerEntry);
    }
  });

  return merged;
}

function formatClockTime(clockTime) {
  if (typeof clockTime !== "number") {
    return "--:--";
  }

  const sign = clockTime < 0 ? "-" : "";
  const absoluteValue = Math.abs(clockTime);
  const minutes = Math.floor(absoluteValue / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(absoluteValue % 60)
    .toString()
    .padStart(2, "0");

  return `${sign}${minutes}:${seconds}`;
}

function detectPhase({ gameState, clockTime, enemyHeroes, enemyHealth }) {
  const normalizedState = normalizeText(gameState);
  const hasEnemyHeroes = enemyHeroes.length > 0;
  const hasEnemyHealth = enemyHealth.length > 0;

  const isDraftState =
    normalizedState.includes("hero_selection") ||
    normalizedState.includes("strategy") ||
    normalizedState.includes("showcase") ||
    normalizedState.includes("wait_for_players") ||
    normalizedState.includes("custom_game_setup");

  const isLiveState =
    normalizedState.includes("game_in_progress") ||
    normalizedState.includes("pre_game") ||
    normalizedState.includes("post_game") ||
    normalizedState.includes("last") ||
    (typeof clockTime === "number" && clockTime >= 0) ||
    hasEnemyHealth;

  if (isDraftState || (hasEnemyHeroes && !isLiveState)) {
    return "draft";
  }

  if (isLiveState) {
    return "match";
  }

  return "idle";
}

function deriveMatchInsights(matchState) {
  const map = matchState?.map || {};
  const hero = matchState?.hero || {};
  const player = matchState?.player || {};
  const heroEntries = (matchState?.enemyHeroes || []).map(normalizeHeroEntry);
  const playerEntries = (matchState?.enemyPlayers || []).map(normalizeHeroEntry);
  const enemyHeroes = mergeEnemyData(heroEntries, playerEntries);
  const enemyHeroIds = enemyHeroes.map((entry) => entry.id).filter(Boolean);
  const enemyInventories = enemyHeroes
    .filter((entry) => entry.items.length)
    .map((entry) => ({
      heroId: entry.id,
      heroName: entry.name,
      imageUrl: entry.imageUrl,
      items: entry.items,
    }));
  const enemyItemsFlat = enemyInventories.flatMap((inventory) => inventory.items);
  const enemyItemIds = enemyItemsFlat.map((item) => item.id).filter(Boolean);
  const enemyHealth = enemyHeroes.filter((entry) => entry.healthPercent !== null);
  const phase = detectPhase({
    gameState: map.game_state,
    clockTime: map.clock_time,
    enemyHeroes,
    enemyHealth,
  });

  return {
    phase,
    phaseLabel:
      phase === "draft" ? "Draft phase" : phase === "match" ? "Live match" : "Awaiting Dota 2",
    mapStateLabel: formatGameStateLabel(map.game_state),
    clockLabel: formatClockTime(map.clock_time),
    heroId: toNumber(hero.id ?? player.hero_id),
    heroName: formatHeroName(hero.name || player.hero_name || "Unknown Hero"),
    playerLevel: toNumber(player.level ?? hero.level),
    currentItems: normalizeInventory(matchState?.items),
    enemyHeroes,
    enemyHeroIds,
    enemyInventories,
    enemyItemsFlat,
    enemyItemIds,
    enemyHealth,
  };
}

export { deriveMatchInsights, formatGameStateLabel };
