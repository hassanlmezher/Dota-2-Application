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

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
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
  const hero = normalizeNamedEntity(payload.hero, payload.hero?.name || "Unknown Hero");
  const items = normalizeInventory(payload.items);
  const abilities = normalizeCollection(payload.abilities).map((ability) => ({
    name: ability.name,
    level: ability.level,
    cooldown: ability.cooldown,
    raw: ability,
  }));
  const heroes = normalizeCollection(payload.heroes).map((entry) => ({
    id: entry.id || entry.hero_id || null,
    name: entry.localized_name || entry.name || "Unknown Hero",
    team: entry.team_name || entry.team || null,
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
    items: normalizeInventory(entry.items),
    raw: entry,
  }));
  const players = normalizeCollection(payload.players).map((entry) => ({
    steamId: entry.steamid || entry.steam_id || null,
    heroId: entry.hero_id || null,
    team: entry.team_name || entry.team || null,
    heroName: entry.hero_name || entry.localized_name || entry.name || null,
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
    items: normalizeInventory(entry.items),
    raw: entry,
  }));
  const localTeam =
    payload.player?.team_name || payload.player?.team || payload.hero?.team_name || payload.hero?.team;
  const enemyMatcher = !localTeam
    ? /dire|enemy/i
    : /radiant/i.test(localTeam)
      ? /dire|enemy/i
      : /radiant|enemy/i;
  const enemyHeroes = !localTeam
    ? heroes
    : heroes.filter((entry) => enemyMatcher.test(entry.team || ""));
  const enemyPlayers = !localTeam
    ? players
    : players.filter((entry) => enemyMatcher.test(entry.team || ""));

  return {
    raw: payload,
    receivedAt: new Date().toISOString(),
    provider: payload.provider || null,
    map: payload.map || null,
    player: payload.player || null,
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

  app.use(express.json({ limit: "2mb", type: "*/*" }));

  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      running: Boolean(server),
      port,
    });
  });

  app.post(["/", "/gsi"], (request, response) => {
    latestState = normalizeState(request.body || {});
    emitter.emit("state", latestState);

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
