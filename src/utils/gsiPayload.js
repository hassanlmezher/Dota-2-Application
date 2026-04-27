import { formatHeroName, isLikelyHeroName, normalizeHeroLookupKey } from "./formatHeroName";
import { formatItemName, isLikelyItemName, normalizeItemLookupKey } from "./formatItemName";

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

function formatClockLabel(clockTime) {
  if (!Number.isFinite(clockTime)) {
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

function formatGameStateLabel(gameState = "") {
  if (!gameState) {
    return "No match detected";
  }

  return String(gameState)
    .replace(/^DOTA_GAMERULES_STATE_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeEntries(collection = {}, sourceName = "collection") {
  if (!collection) {
    return [];
  }

  if (Array.isArray(collection)) {
    return collection
      .map((entry, index) =>
        entry && typeof entry === "object"
          ? {
              entry,
              key: `${sourceName}-${index}`,
            }
          : null
      )
      .filter(Boolean);
  }

  if (typeof collection !== "object") {
    return [];
  }

  return Object.entries(collection)
    .map(([key, entry]) => {
      if (entry && typeof entry === "object") {
        return { entry, key };
      }

      if (typeof entry === "string" && isLikelyHeroName(entry)) {
        return {
          entry: { hero_name: entry },
          key,
        };
      }

      return null;
    })
    .filter(Boolean);
}

function flattenObserverTeamCollections(rawPayload = {}) {
  const mergedParticipants = new Map();
  const collections = [
    { collection: rawPayload.player, field: "player" },
    { collection: rawPayload.hero, field: "hero" },
    { collection: rawPayload.items, field: "items" },
  ];

  for (const { collection, field } of collections) {
    if (!collection || Array.isArray(collection) || typeof collection !== "object") {
      continue;
    }

    for (const [teamKey, teamEntries] of Object.entries(collection)) {
      if (!teamEntries || typeof teamEntries !== "object" || Array.isArray(teamEntries)) {
        continue;
      }

      const normalizedTeam = normalizeTeam(teamKey);

      for (const [playerKey, entry] of Object.entries(teamEntries)) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          continue;
        }

        const registryKey = `${normalizedTeam || teamKey}:${playerKey}`;
        const existingEntry = mergedParticipants.get(registryKey) || {
          key: registryKey,
          team_name: normalizedTeam || teamKey,
          slot: playerKey,
        };

        if (field === "player") {
          existingEntry.player = entry;
          existingEntry.player_name =
            entry.player_name || entry.name || entry.pro_name || existingEntry.player_name;
          existingEntry.steam_name =
            entry.steam_name || entry.name || existingEntry.steam_name;
          existingEntry.steamid = entry.steamid || entry.steam_id || existingEntry.steamid;
        }

        if (field === "hero") {
          existingEntry.hero = entry;
          existingEntry.hero_name =
            entry.hero_name || entry.localized_name || entry.name || existingEntry.hero_name;
          existingEntry.hero_id = entry.hero_id || entry.id || existingEntry.hero_id;
          existingEntry.health = entry.health ?? existingEntry.health;
          existingEntry.max_health = entry.max_health ?? existingEntry.max_health;
          existingEntry.health_percent =
            entry.health_percent ?? existingEntry.health_percent;
          existingEntry.image = entry.image || existingEntry.image;
          existingEntry.image_url = entry.image_url || existingEntry.image_url;
        }

        if (field === "items") {
          existingEntry.items = entry;
        }

        mergedParticipants.set(registryKey, existingEntry);
      }
    }
  }

  return [...mergedParticipants.values()];
}

function extractItemNames(collection) {
  const entries = normalizeEntries(collection, "items");

  return entries
    .map(({ entry, key }) => {
      const rawName =
        entry.item_name ||
        entry.localized_name ||
        entry.name ||
        (typeof key === "string" && isLikelyItemName(key) ? key : "");

      const normalizedKey = normalizeItemLookupKey(rawName);

      if (!normalizedKey || normalizedKey === "empty" || normalizedKey.startsWith("recipe")) {
        return null;
      }

      return formatItemName(rawName);
    })
    .filter(Boolean);
}

function extractHeroName(entry = {}, key = "") {
  const candidates = [
    entry.hero_name,
    entry.heroName,
    entry.localized_name,
    entry.hero_localized_name,
    entry.hero?.localized_name,
    entry.hero?.hero_name,
    entry.hero?.heroName,
    entry.hero?.name,
    entry.internal_name,
    isLikelyHeroName(entry.name) ? entry.name : null,
    isLikelyHeroName(key) ? key : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const formattedName = formatHeroName(candidate);

    if (formattedName) {
      return formattedName;
    }
  }

  return "";
}

function extractHealth(entry = {}) {
  const currentHealth = toNumber(
    entry.health ??
      entry.hp ??
      entry.player_health ??
      entry.state?.health ??
      entry.hero?.health ??
      entry.raw?.health
  );
  const maxHealth = toNumber(
    entry.max_health ??
      entry.maxHealth ??
      entry.health_max ??
      entry.state?.max_health ??
      entry.state?.health_max ??
      entry.hero?.max_health ??
      entry.raw?.max_health
  );
  const directPercent = toNumber(
    entry.health_percent ??
      entry.healthPercent ??
      entry.hp_percent ??
      entry.state?.health_percent ??
      entry.hero?.health_percent ??
      entry.raw?.health_percent
  );

  let healthPercent = directPercent;

  if (healthPercent === null && currentHealth !== null && maxHealth !== null && maxHealth > 0) {
    healthPercent = Math.round((currentHealth / maxHealth) * 100);
  }

  return {
    currentHealth,
    maxHealth,
    healthPercent,
  };
}

function mergeHeroRecord(existingRecord = {}, incomingRecord = {}) {
  const currentHealth =
    incomingRecord.currentHealth !== null && incomingRecord.currentHealth !== undefined
      ? incomingRecord.currentHealth
      : existingRecord.currentHealth ?? null;
  const maxHealth =
    incomingRecord.maxHealth !== null && incomingRecord.maxHealth !== undefined
      ? incomingRecord.maxHealth
      : existingRecord.maxHealth ?? null;
  const healthPercent =
    incomingRecord.healthPercent !== null && incomingRecord.healthPercent !== undefined
      ? incomingRecord.healthPercent
      : existingRecord.healthPercent ?? 100;

  return {
    key: incomingRecord.key || existingRecord.key,
    heroId: incomingRecord.heroId ?? existingRecord.heroId ?? null,
    heroName: incomingRecord.heroName || existingRecord.heroName || "",
    imageUrl: incomingRecord.imageUrl || existingRecord.imageUrl || null,
    team: incomingRecord.team || existingRecord.team || null,
    playerName: incomingRecord.playerName || existingRecord.playerName || null,
    currentHealth,
    maxHealth,
    healthPercent,
    itemNames: incomingRecord.itemNames?.length
      ? incomingRecord.itemNames
      : existingRecord.itemNames || [],
  };
}

function extractParticipant(entry, key) {
  const heroName = extractHeroName(entry, key);

  if (!heroName) {
    return null;
  }

  const { currentHealth, maxHealth, healthPercent } = extractHealth(entry);

  return {
    key: normalizeHeroLookupKey(heroName),
    heroId: toNumber(entry.hero_id ?? entry.id ?? entry.hero?.id),
    heroName,
    imageUrl: entry.image || entry.image_url || entry.hero?.image || entry.hero?.image_url || null,
    team: normalizeTeam(
      entry.team_name ||
        entry.team ||
        entry.team_id ||
        entry.hero?.team_name ||
        entry.hero?.team ||
        entry.hero?.team_id
    ),
    playerName:
      !isLikelyHeroName(entry.name) && typeof entry.name === "string"
        ? entry.name
        : entry.player_name || entry.steam_name || null,
    currentHealth,
    maxHealth,
    healthPercent,
    itemNames: extractItemNames(entry.items || entry.inventory || entry.backpack || {}),
  };
}

function buildParticipantMap(update = {}, rawPayload = {}) {
  const participants = new Map();
  const sources = [
    ...normalizeEntries(flattenObserverTeamCollections(rawPayload), "observer-flattened"),
    ...normalizeEntries(rawPayload.allplayers, "allplayers"),
    ...normalizeEntries(rawPayload.allheroes, "allheroes"),
    ...normalizeEntries(rawPayload.players, "players-raw"),
    ...normalizeEntries(rawPayload.heroes, "heroes-raw"),
    ...(Array.isArray(rawPayload.player) ? normalizeEntries(rawPayload.player, "player-array") : []),
    ...(Array.isArray(rawPayload.hero) ? normalizeEntries(rawPayload.hero, "hero-array") : []),
    ...normalizeEntries(update.players, "players"),
    ...normalizeEntries(update.heroes, "heroes"),
    ...normalizeEntries(update.enemyPlayers, "enemyPlayers"),
    ...normalizeEntries(update.enemyHeroes, "enemyHeroes"),
  ];

  for (const { entry, key } of sources) {
    const participant = extractParticipant(entry, key);

    if (!participant?.key) {
      continue;
    }

    participants.set(
      participant.key,
      mergeHeroRecord(participants.get(participant.key), participant)
    );
  }

  return participants;
}

function extractLocalHero(update = {}, rawPayload = {}) {
  const localSources = [
    update.hero,
    rawPayload.hero,
    update.player,
    rawPayload.player,
  ].filter((entry) => entry && !Array.isArray(entry));

  for (const source of localSources) {
    const heroName = extractHeroName(source);

    if (!heroName) {
      continue;
    }

    return {
      heroName,
      heroId: toNumber(source.id ?? source.hero_id ?? source.hero?.id),
      team: normalizeTeam(
        source.team_name ||
          source.team ||
          source.team_id ||
          source.hero?.team_name ||
          source.hero?.team ||
          source.hero?.team_id ||
          update.localTeam
      ),
      itemNames: extractItemNames(
        source.items || rawPayload.items || update.items || source.inventory || {}
      ),
    };
  }

  return {
    heroName: "",
    heroId: null,
    team: normalizeTeam(update.localTeam || rawPayload.player?.team_name || rawPayload.player?.team),
    itemNames: extractItemNames(rawPayload.items || update.items || {}),
  };
}

function extractDraftEnemyNames(draft, localTeam, localHeroName) {
  if (!draft || typeof draft !== "object") {
    return [];
  }

  const results = [];
  const queue = [{ value: draft, path: "draft" }];
  const visited = new Set();

  while (queue.length) {
    const current = queue.shift();

    if (!current?.value || typeof current.value !== "object") {
      continue;
    }

    if (visited.has(current.value)) {
      continue;
    }

    visited.add(current.value);

    if (Array.isArray(current.value)) {
      current.value.forEach((entry, index) => {
        queue.push({
          value: entry,
          path: `${current.path}[${index}]`,
        });
      });
      continue;
    }

    const heroName = extractHeroName(current.value, current.path);
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

    if (heroName && !isBanned && isPicked) {
      if (localTeam && team && isOpposingTeam(team, localTeam)) {
        results.push(heroName);
      } else if (!localHeroName || normalizeHeroLookupKey(heroName) !== normalizeHeroLookupKey(localHeroName)) {
        results.push(heroName);
      }
    }

    Object.entries(current.value).forEach(([childKey, childValue]) => {
      if (childValue && typeof childValue === "object") {
        queue.push({
          value: childValue,
          path: `${current.path}.${childKey}`,
        });
      }
    });
  }

  return [...new Set(results)];
}

function determinePhase(gameState, draftEnemyNames, myHeroName, participantMap, clockTime) {
  const normalizedState = normalizeText(gameState);
  const hasDraftSignal =
    normalizedState.includes("hero_selection") ||
    normalizedState.includes("strategy") ||
    normalizedState.includes("showcase") ||
    normalizedState.includes("wait_for_players") ||
    normalizedState.includes("custom_game_setup");
  const hasMatchSignal =
    normalizedState.includes("pre_game") ||
    normalizedState.includes("game_in_progress") ||
    normalizedState.includes("post_game") ||
    normalizedState.includes("last") ||
    Number.isFinite(clockTime);

  if (hasDraftSignal || draftEnemyNames.length) {
    return "draft";
  }

  if (hasMatchSignal || myHeroName || participantMap.size) {
    return "match";
  }

  return "idle";
}

function buildSnapshot(update = {}) {
  const rawPayload = update.raw || update.payload || update || {};
  const map = rawPayload.map || update.map || {};
  const localHero = extractLocalHero(update, rawPayload);
  const participantMap = buildParticipantMap(update, rawPayload);
  const draftEnemyNames = extractDraftEnemyNames(
    rawPayload.draft || update.draft,
    localHero.team,
    localHero.heroName
  );
  const phase = determinePhase(
    map.game_state,
    draftEnemyNames,
    localHero.heroName,
    participantMap,
    toNumber(map.clock_time)
  );

  return {
    rawPayload,
    receivedAt: update.receivedAt || new Date().toISOString(),
    packetCount: toNumber(update.packetCount) ?? null,
    matchId: map.matchid || map.match_id || null,
    gameState: map.game_state || "",
    mapStateLabel: formatGameStateLabel(map.game_state || ""),
    clockTime: toNumber(map.clock_time),
    clockLabel: formatClockLabel(toNumber(map.clock_time)),
    phase,
    localHero,
    participantMap,
    draftEnemyNames,
  };
}

function shouldResetState(previousState, snapshot) {
  if (!previousState) {
    return true;
  }

  if (previousState.matchId && snapshot.matchId && previousState.matchId !== snapshot.matchId) {
    return true;
  }

  if (
    previousState.myHeroName &&
    snapshot.localHero.heroName &&
    normalizeHeroLookupKey(previousState.myHeroName) !==
      normalizeHeroLookupKey(snapshot.localHero.heroName) &&
    snapshot.phase === "draft"
  ) {
    return true;
  }

  if (previousState.phase === "match" && snapshot.phase === "draft") {
    return true;
  }

  return false;
}

function createEmptyGsiState() {
  return {
    rawPayload: null,
    receivedAt: null,
    packetCount: 0,
    matchId: null,
    phase: "idle",
    gameState: "",
    mapStateLabel: "No match detected",
    clockLabel: "--:--",
    myHeroName: "",
    myItemNames: [],
    localTeam: null,
    audienceMode: "player",
    feedScope: "unknown",
    enemyHeroes: [],
    enemyHeroNames: [],
    enemyHealthList: [],
    enemyHealthMap: {},
    enemyItemNames: [],
    hasAnyLiveContext: false,
  };
}

function reduceGsiState(previousState, update) {
  const snapshot = buildSnapshot(update);
  const baseState = shouldResetState(previousState, snapshot)
    ? createEmptyGsiState()
    : previousState || createEmptyGsiState();
  const nextEnemyMap = new Map(
    (baseState.enemyHeroes || []).map((hero) => [hero.key || normalizeHeroLookupKey(hero.heroName), hero])
  );

  for (const draftHeroName of snapshot.draftEnemyNames) {
    const key = normalizeHeroLookupKey(draftHeroName);
    nextEnemyMap.set(
      key,
      mergeHeroRecord(nextEnemyMap.get(key), {
        key,
        heroName: draftHeroName,
        healthPercent: nextEnemyMap.get(key)?.healthPercent ?? 100,
        currentHealth: nextEnemyMap.get(key)?.currentHealth ?? null,
        maxHealth: nextEnemyMap.get(key)?.maxHealth ?? null,
        itemNames: nextEnemyMap.get(key)?.itemNames || [],
      })
    );
  }

  const liveParticipants = [...snapshot.participantMap.values()];
  const feedScope = liveParticipants.length > 1 ? "observer" : snapshot.localHero.heroName ? "player" : "unknown";
  const enemyParticipants = liveParticipants.filter((participant) => {
    if (snapshot.localHero.team && participant.team) {
      return isOpposingTeam(participant.team, snapshot.localHero.team);
    }

    if (snapshot.localHero.heroName) {
      return normalizeHeroLookupKey(participant.heroName) !== normalizeHeroLookupKey(snapshot.localHero.heroName);
    }

    return true;
  });

  for (const participant of enemyParticipants) {
    nextEnemyMap.set(
      participant.key,
      mergeHeroRecord(nextEnemyMap.get(participant.key), {
        ...participant,
        healthPercent:
          participant.healthPercent !== null && participant.healthPercent !== undefined
            ? participant.healthPercent
            : nextEnemyMap.get(participant.key)?.healthPercent ?? 100,
      })
    );
  }

  const enemyHeroes = [...nextEnemyMap.values()];
  const enemyHealthList = enemyHeroes.map((hero) => ({
    ...hero,
    healthPercent:
      hero.healthPercent !== null && hero.healthPercent !== undefined ? hero.healthPercent : 100,
  }));
  const enemyHealthMap = Object.fromEntries(
    enemyHealthList.map((hero) => [hero.heroName, hero.healthPercent])
  );
  const enemyItemNames = [
    ...new Set(enemyHeroes.flatMap((hero) => hero.itemNames || []).filter(Boolean)),
  ];
  const enemyHeroNames = enemyHeroes.map((hero) => hero.heroName);
  const audienceMode = snapshot.localHero.heroName ? "player" : enemyHeroNames.length ? "spectator" : "player";

  return {
    rawPayload: snapshot.rawPayload,
    receivedAt: snapshot.receivedAt,
    packetCount: snapshot.packetCount ?? baseState.packetCount ?? 0,
    matchId: snapshot.matchId || baseState.matchId || null,
    phase: snapshot.phase,
    gameState: snapshot.gameState,
    mapStateLabel: snapshot.mapStateLabel,
    clockLabel: snapshot.clockLabel,
    myHeroName: snapshot.localHero.heroName || baseState.myHeroName || "",
    myItemNames: snapshot.localHero.itemNames?.length
      ? snapshot.localHero.itemNames
      : baseState.myItemNames || [],
    localTeam: snapshot.localHero.team || baseState.localTeam || null,
    audienceMode,
    feedScope,
    enemyHeroes,
    enemyHeroNames,
    enemyHealthList,
    enemyHealthMap,
    enemyItemNames,
    hasAnyLiveContext:
      snapshot.phase !== "idle" ||
      Boolean(
        snapshot.localHero.heroName ||
          enemyHeroNames.length ||
          snapshot.gameState ||
          snapshot.packetCount
      ),
  };
}

export {
  buildSnapshot,
  createEmptyGsiState,
  formatGameStateLabel,
  normalizeTeam,
  reduceGsiState,
};
