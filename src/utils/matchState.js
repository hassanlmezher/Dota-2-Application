import { formatHeroName } from "./formatHeroName";
import { formatItemName } from "./formatItemName";

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeText(value = "") {
  return String(value).trim().toLowerCase();
}

function normalizeTeam(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalizedValue = normalizeText(value);

  if (
    normalizedValue === "2" ||
    normalizedValue.includes("team2") ||
    normalizedValue.includes("radiant") ||
    normalizedValue.includes("goodguys")
  ) {
    return "Radiant";
  }

  if (
    normalizedValue === "3" ||
    normalizedValue.includes("team3") ||
    normalizedValue.includes("dire") ||
    normalizedValue.includes("badguys")
  ) {
    return "Dire";
  }

  if (normalizedValue.includes("enemy")) {
    return "Enemy";
  }

  return String(value);
}

function isOpposingTeam(team, localTeam) {
  if (!team || !localTeam) {
    return false;
  }

  if (team === "Enemy") {
    return true;
  }

  if (localTeam === "Radiant") {
    return team === "Dire";
  }

  if (localTeam === "Dire") {
    return team === "Radiant";
  }

  return false;
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

function normalizeHeroEntry(entry = {}, index = 0) {
  const name = formatHeroName(
    entry.heroName ||
      entry.hero_name ||
      entry.localized_name ||
      entry.name ||
      `Hero ${index + 1}`
  );

  return {
    id: toNumber(entry.id ?? entry.heroId ?? entry.hero_id),
    name,
    imageUrl: entry.imageUrl || entry.image_url || entry.image || null,
    team: normalizeTeam(entry.team || entry.team_name || entry.team_id),
    health: toNumber(entry.health ?? entry.player_health ?? entry.hp),
    maxHealth: toNumber(entry.maxHealth ?? entry.max_health ?? entry.health_max),
    healthPercent: calculateHealthPercent(entry),
    items: normalizeInventory(entry.items),
    raw: entry,
  };
}

function entityMatches(left, right) {
  if (!left || !right) {
    return false;
  }

  if (left.id && right.id) {
    return String(left.id) === String(right.id);
  }

  return normalizeText(left.name) === normalizeText(right.name);
}

function mergeVisibleHeroes(heroEntries, playerEntries) {
  const merged = [];
  const consumedPlayers = new Set();

  for (const heroEntry of heroEntries) {
    const matchingPlayerIndex = playerEntries.findIndex((playerEntry) =>
      entityMatches(heroEntry, playerEntry)
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
      team: matchingPlayer?.team || heroEntry.team,
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

function chooseTrackedHeroes({
  localTeam,
  localHeroId,
  localHeroName,
  explicitEnemies,
  explicitEnemyPlayers,
  visibleHeroes,
}) {
  const mergedEnemies = mergeVisibleHeroes(explicitEnemies, explicitEnemyPlayers);

  if (localTeam && mergedEnemies.length) {
    return mergedEnemies;
  }

  if (localTeam && visibleHeroes.length) {
    const opposingVisibleHeroes = visibleHeroes.filter((entry) =>
      isOpposingTeam(entry.team, localTeam)
    );

    if (opposingVisibleHeroes.length) {
      return opposingVisibleHeroes;
    }

    return visibleHeroes.filter((entry) => {
      if (localHeroId && entry.id) {
        return String(entry.id) !== String(localHeroId);
      }

      return normalizeText(entry.name) !== normalizeText(localHeroName);
    });
  }

  if (mergedEnemies.length) {
    return mergedEnemies;
  }

  return visibleHeroes;
}

function extractDraftHeroes(draft, localTeam) {
  if (!draft || typeof draft !== "object") {
    return [];
  }

  const candidates = [];
  const queue = [{ value: draft, path: "draft" }];
  const seenObjects = new Set();

  while (queue.length) {
    const current = queue.shift();

    if (!current || !current.value || typeof current.value !== "object") {
      continue;
    }

    if (seenObjects.has(current.value)) {
      continue;
    }

    seenObjects.add(current.value);

    if (Array.isArray(current.value)) {
      current.value.forEach((entry, index) => {
        queue.push({ value: entry, path: `${current.path}[${index}]` });
      });
      continue;
    }

    const heroLikeId = toNumber(
      current.value.hero_id ??
        current.value.heroId ??
        current.value.id
    );
    const heroLikeName = current.value.hero_name || current.value.heroName || current.value.localized_name || current.value.name;
    const team = normalizeTeam(
      current.value.team ||
        current.value.team_name ||
        current.value.team_id ||
        (current.path.includes("radiant") || current.path.includes("team2")
          ? "Radiant"
          : current.path.includes("dire") || current.path.includes("team3")
            ? "Dire"
            : null)
    );
    const pathText = normalizeText(current.path);
    const stateText = normalizeText(
      current.value.state || current.value.type || current.value.status || ""
    );
    const isBanned =
      current.value.banned === true ||
      current.value.is_ban === true ||
      pathText.includes("ban") ||
      stateText.includes("ban");
    const isPicked =
      current.value.selected === true ||
      current.value.picked === true ||
      current.value.is_pick === true ||
      current.value.is_selected === true ||
      pathText.includes("pick") ||
      stateText.includes("pick");

    if (!isBanned && (heroLikeId !== null || heroLikeName) && isPicked) {
      candidates.push(
        normalizeHeroEntry(
          {
            id: heroLikeId,
            heroName: heroLikeName,
            team,
            imageUrl: current.value.image_url || current.value.image || null,
          },
          candidates.length
        )
      );
    }

    Object.entries(current.value).forEach(([key, value]) => {
      if (value && typeof value === "object") {
        queue.push({ value, path: `${current.path}.${key}` });
      }
    });
  }

  const uniqueHeroes = [];

  for (const hero of candidates) {
    const alreadyIncluded = uniqueHeroes.some((existingHero) => entityMatches(existingHero, hero));

    if (!alreadyIncluded) {
      uniqueHeroes.push(hero);
    }
  }

  if (!localTeam) {
    return uniqueHeroes;
  }

  const enemyDraftHeroes = uniqueHeroes.filter((hero) => isOpposingTeam(hero.team, localTeam));

  return enemyDraftHeroes.length ? enemyDraftHeroes : uniqueHeroes;
}

function detectPhase({
  gameState,
  clockTime,
  trackedHeroes,
  trackedHealth,
  draft,
  map,
  provider,
  currentItems,
  localHeroId,
  visibleHeroes,
}) {
  const normalizedState = normalizeText(gameState);
  const hasClock = typeof clockTime === "number";
  const hasTrackedHeroes = trackedHeroes.length > 0;
  const hasTrackedHealth = trackedHealth.length > 0;
  const hasVisibleHeroes = visibleHeroes.length > 0;
  const hasDraftContext = Boolean(
    Array.isArray(draft)
      ? draft.length
      : draft && typeof draft === "object"
        ? Object.keys(draft).length
        : false
  );
  const hasMapContext = Boolean(
    map?.matchid ||
      map?.match_id ||
      map?.name ||
      map?.game_time ||
      map?.game_state ||
      map?.clock_time
  );
  const hasProviderContext = Boolean(provider?.appid || provider?.version || provider?.name);
  const hasLocalContext = Boolean(localHeroId || currentItems.length);

  const isExplicitDraftState =
    normalizedState.includes("hero_selection") ||
    normalizedState.includes("strategy") ||
    normalizedState.includes("showcase");
  const isSetupDraftState =
    normalizedState.includes("wait_for_players") ||
    normalizedState.includes("custom_game_setup");

  const isExplicitLiveState =
    normalizedState.includes("game_in_progress") ||
    normalizedState.includes("pre_game") ||
    normalizedState.includes("post_game") ||
    normalizedState.includes("last");

  const isLiveState =
    isExplicitLiveState ||
    normalizedState.includes("last") ||
    hasClock ||
    hasTrackedHealth ||
    (hasMapContext && (hasVisibleHeroes || hasLocalContext)) ||
    (hasProviderContext && (hasVisibleHeroes || hasLocalContext));

  if (isExplicitDraftState) {
    return "draft";
  }

  if ((isSetupDraftState || hasDraftContext) && !isExplicitLiveState && !hasTrackedHealth) {
    return "draft";
  }

  if (isLiveState) {
    return "match";
  }

  if (hasTrackedHeroes) {
    return "draft";
  }

  return "idle";
}

function deriveMatchInsights(matchState) {
  const map = matchState?.map || {};
  const hero = matchState?.hero || {};
  const player = matchState?.player || {};
  const localTeam = normalizeTeam(
    matchState?.localTeam ||
      hero.team ||
      hero.team_name ||
      hero.team_id ||
      player.team_name ||
      player.team ||
      player.team_id ||
      null
  );
  const localHeroId = toNumber(hero.id ?? player.hero_id);
  const localHeroName = formatHeroName(hero.name || player.hero_name || "Unknown Hero");
  const visibleHeroEntries = (matchState?.heroes || []).map(normalizeHeroEntry);
  const visiblePlayerEntries = (matchState?.players || []).map(normalizeHeroEntry);
  const visibleHeroes = mergeVisibleHeroes(visibleHeroEntries, visiblePlayerEntries);
  const draftEnemyHeroes = extractDraftHeroes(matchState?.draft, localTeam);
  const explicitEnemyHeroes = (
    (matchState?.enemyHeroes && matchState.enemyHeroes.length)
      ? matchState.enemyHeroes
      : draftEnemyHeroes
  ).map(normalizeHeroEntry);
  const explicitEnemyPlayers = (matchState?.enemyPlayers || []).map(normalizeHeroEntry);
  const trackedHeroes = chooseTrackedHeroes({
    localTeam,
    localHeroId,
    localHeroName,
    explicitEnemies: explicitEnemyHeroes,
    explicitEnemyPlayers,
    visibleHeroes,
  });
  const trackedHeroIds = trackedHeroes.map((entry) => entry.id).filter(Boolean);
  const trackedInventories = trackedHeroes
    .filter((entry) => entry.items.length)
    .map((entry) => ({
      heroId: entry.id,
      heroName: entry.name,
      imageUrl: entry.imageUrl,
      items: entry.items,
    }));
  const trackedItemsFlat = trackedInventories.flatMap((inventory) => inventory.items);
  const trackedItemIds = trackedItemsFlat.map((item) => item.id).filter(Boolean);
  const trackedHealth = trackedHeroes.filter((entry) => entry.healthPercent !== null);
  const currentItems = normalizeInventory(matchState?.items).length
    ? normalizeInventory(matchState?.items)
    : normalizeInventory(
        visibleHeroes.find((entry) =>
          localHeroId ? String(entry.id) === String(localHeroId) : false
        )?.items || []
      );
  const phase = detectPhase({
    gameState: map.game_state,
    clockTime: map.clock_time,
    trackedHeroes,
    trackedHealth,
    draft: matchState?.draft,
    map,
    provider: matchState?.provider,
    currentItems,
    localHeroId,
    visibleHeroes,
  });
  const audienceMode = localTeam || localHeroId ? "player" : trackedHeroes.length ? "spectator" : "idle";
  const displayHeroName =
    localHeroId || hero.name || player.hero_name
      ? localHeroName
      : audienceMode === "spectator"
        ? "Spectator Mode"
        : "Unknown Hero";

  return {
    phase,
    audienceMode,
    phaseLabel:
      phase === "draft"
        ? audienceMode === "spectator"
          ? "Observed draft"
          : "Draft phase"
        : phase === "match"
          ? audienceMode === "spectator"
            ? "Observed live match"
            : "Live match"
          : "Awaiting Dota 2",
    mapStateLabel: formatGameStateLabel(map.game_state),
    clockLabel: formatClockTime(map.clock_time),
    heroId: localHeroId,
    heroName: displayHeroName,
    playerLevel: toNumber(player.level ?? hero.level),
    currentItems,
    enemyLabel: audienceMode === "spectator" ? "Observed" : "Enemy",
    enemyHeroes: trackedHeroes,
    enemyHeroIds: trackedHeroIds,
    enemyInventories: trackedInventories,
    enemyItemsFlat: trackedItemsFlat,
    enemyItemIds: trackedItemIds,
    enemyHealth: trackedHealth,
    hasAnyLiveContext:
      phase !== "idle" ||
      Boolean(matchState?.provider?.appid || map?.game_state || map?.clock_time),
  };
}

export { deriveMatchInsights, formatGameStateLabel };
