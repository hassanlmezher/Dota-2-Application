const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const { EventEmitter } = require("node:events");

function normalizeCollection(collection = {}) {
  if (Array.isArray(collection)) {
    return collection.filter(Boolean);
  }

  return Object.entries(collection)
    .map(([slot, entry]) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      return {
        slot,
        ...entry,
      };
    })
    .filter(Boolean);
}

function toEntityArray(value) {
  if (Array.isArray(value)) {
    return value.filter((entry) => entry && typeof entry === "object");
  }

  if (value && typeof value === "object") {
    return [value];
  }

  return [];
}

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeTeam(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalizedValue = String(value).trim().toLowerCase();

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

function normalizeNamedEntity(entity, fallbackName = "") {
  if (!entity) {
    return null;
  }

  return {
    id: entity.id || entity.hero_id || entity.item_id || null,
    name: entity.localized_name || entity.name || fallbackName,
    imageUrl: entity.image_url || entity.imageUrl || null,
    raw: entity,
  };
}

function normalizeInventory(collection = {}) {
  return normalizeCollection(collection).map((item) => ({
    id: item.id || item.item_id || null,
    name: item.localized_name || item.name || "empty",
    imageUrl: item.image || item.image_url || null,
    slot: item.slot || item.slot_index || item.slot_name || item.slot,
    raw: item,
  }));
}

function normalizeState(payload) {
  const isObserverPayload = Array.isArray(payload.hero) || Array.isArray(payload.player);
  const hero = isObserverPayload
    ? null
    : normalizeNamedEntity(payload.hero, payload.hero?.name || "Unknown Hero");
  const items = Array.isArray(payload.items) ? [] : normalizeInventory(payload.items);
  const abilities = normalizeCollection(payload.abilities).map((ability) => ({
    name: ability.name,
    level: ability.level,
    cooldown: ability.cooldown,
    raw: ability,
  }));
  const observerItemGroups = Array.isArray(payload.items) ? payload.items : [];
  const heroEntries = toEntityArray(payload.heroes).length
    ? toEntityArray(payload.heroes)
    : Array.isArray(payload.hero)
      ? toEntityArray(payload.hero)
      : [];
  const playerEntries = toEntityArray(payload.players).length
    ? toEntityArray(payload.players)
    : Array.isArray(payload.player)
      ? toEntityArray(payload.player)
      : [];
  const heroes = heroEntries.map((entry, index) => ({
    id: entry.id || entry.hero_id || null,
    name: entry.localized_name || entry.name || "Unknown Hero",
    team: normalizeTeam(entry.team_name || entry.team || entry.team_id),
    alive: entry.alive,
    health: toNumber(entry.health || entry.player_health || entry.hp),
    maxHealth: toNumber(entry.max_health || entry.maxHealth || entry.health_max),
    healthPercent:
      toNumber(entry.health_percent || entry.healthPercent || entry.hp_percent) ??
      (() => {
        const health = toNumber(entry.health || entry.player_health || entry.hp);
        const maxHealth = toNumber(entry.max_health || entry.maxHealth || entry.health_max);

        if (!health || !maxHealth) {
          return null;
        }

        return Math.round((health / maxHealth) * 100);
      })(),
    imageUrl: entry.image || entry.image_url || null,
    items: normalizeInventory(
      entry.items ||
        observerItemGroups[index]?.items ||
        observerItemGroups[index]
    ),
    raw: entry,
  }));
  const players = playerEntries.map((entry, index) => ({
    steamId: entry.steamid || entry.steam_id || null,
    heroId: entry.hero_id || null,
    team: normalizeTeam(entry.team_name || entry.team || entry.team_id),
    heroName: entry.hero_name || entry.localized_name || null,
    playerName: entry.name || entry.player_name || entry.steam_name || null,
    health: toNumber(entry.health || entry.player_health || entry.hp),
    maxHealth: toNumber(entry.max_health || entry.maxHealth || entry.health_max),
    healthPercent:
      toNumber(entry.health_percent || entry.healthPercent || entry.hp_percent) ??
      (() => {
        const health = toNumber(entry.health || entry.player_health || entry.hp);
        const maxHealth = toNumber(entry.max_health || entry.maxHealth || entry.health_max);

        if (!health || !maxHealth) {
          return null;
        }

        return Math.round((health / maxHealth) * 100);
      })(),
    imageUrl: entry.image || entry.image_url || null,
    items: normalizeInventory(
      entry.items ||
        observerItemGroups[index]?.items ||
        observerItemGroups[index]
    ),
    raw: entry,
  })).filter(
    (entry) =>
      Boolean(entry.heroId || entry.heroName || entry.imageUrl || entry.items.length)
  );
  const localTeam = Array.isArray(payload.player)
    ? null
    : normalizeTeam(
        payload.player?.team_name ||
          payload.player?.team ||
          payload.player?.team_id ||
          payload.hero?.team_name ||
          payload.hero?.team ||
          payload.hero?.team_id
      );
  const enemyHeroes = !localTeam
    ? heroes
    : heroes.filter((entry) => isOpposingTeam(entry.team, localTeam));
  const enemyPlayers = !localTeam
    ? players
    : players.filter((entry) => isOpposingTeam(entry.team, localTeam));

  return {
    raw: payload,
    receivedAt: new Date().toISOString(),
    provider: payload.provider || null,
    draft: payload.draft || null,
    map: payload.map || null,
    player: Array.isArray(payload.player) ? null : payload.player || null,
    hero,
    items,
    abilities,
    heroes,
    players,
    localTeam: localTeam || null,
    enemyHeroes,
    enemyPlayers,
    enemyItems: enemyPlayers.flatMap((entry) => entry.items),
  };
}

function createGsiServer({ port = 3001, host = "127.0.0.1" } = {}) {
  const app = express();
  const emitter = new EventEmitter();
  let server = null;
  let latestState = null;
  let packetCount = 0;

  app.use(cors());
  app.use(bodyParser.json({ limit: "2mb", type: "*/*" }));

  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      running: Boolean(server),
      port,
      packetCount,
      lastReceivedAt: latestState?.receivedAt || null,
    });
  });

  app.post(["/", "/gsi"], (request, response) => {
    packetCount += 1;
    console.log("Received GSI update");
    latestState = {
      ...normalizeState(request.body || {}),
      payload: request.body || {},
      packetCount,
    };
    emitter.emit("state", latestState);
    emitter.emit("status", getStatus());

    response.json({
      ok: true,
      receivedAt: latestState.receivedAt,
    });
  });

  async function start() {
    if (server) {
      return getStatus();
    }

    await new Promise((resolve, reject) => {
      server = app.listen(port, host, () => {
        const status = getStatus();
        emitter.emit("status", status);
        resolve();
      });

      server.on("error", reject);
    });

    return getStatus();
  }

  async function stop() {
    if (!server) {
      return getStatus();
    }

    const runningServer = server;

    await new Promise((resolve, reject) => {
      try {
        runningServer.close((error) => {
          if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
            reject(error);
            return;
          }

          server = null;
          emitter.emit("status", getStatus());
          resolve();
        });
      } catch (error) {
        if (error.code === "ERR_SERVER_NOT_RUNNING") {
          server = null;
          emitter.emit("status", getStatus());
          resolve();
          return;
        }

        reject(error);
      }
    });

    return getStatus();
  }

  function on(eventName, listener) {
    emitter.on(eventName, listener);
  }

  function getState() {
    return latestState;
  }

  function getStatus() {
    return {
      running: Boolean(server),
      host,
      port,
      endpoint: `http://${host}:${port}/gsi`,
      lastReceivedAt: latestState?.receivedAt || null,
      packetCount,
    };
  }

  return {
    getState,
    getStatus,
    on,
    start,
    stop,
  };
}

module.exports = { createGsiServer };
