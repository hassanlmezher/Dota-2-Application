import { createClient } from "@supabase/supabase-js";
import {
  compactHeroLookupKey,
  formatHeroName,
  normalizeHeroLookupKey,
} from "../utils/formatHeroName";
import {
  compactItemLookupKey,
  formatItemName,
  normalizeItemLookupKey,
} from "../utils/formatItemName";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const hasCredentials = Boolean(supabaseUrl && supabaseAnonKey);

const supabase = hasCredentials
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

let heroCatalogPromise = null;
let itemCatalogPromise = null;

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env."
    );
  }

  return supabase;
}

function buildLookupKeys(name, normalizeKey, compactKey) {
  const rawKeys = [
    name,
    normalizeKey(name),
    compactKey(name),
  ].filter(Boolean);

  return [...new Set(rawKeys)];
}

function findCatalogMatch(records, rawName, normalizeKey, compactKey, formatName) {
  if (!rawName) {
    return null;
  }

  const formattedName = formatName(rawName);
  const desiredKeys = new Set([
    ...buildLookupKeys(rawName, normalizeKey, compactKey),
    ...buildLookupKeys(formattedName, normalizeKey, compactKey),
  ]);

  const exactMatch = records.find((record) =>
    record.lookupKeys.some((lookupKey) => desiredKeys.has(lookupKey))
  );

  if (exactMatch) {
    return exactMatch;
  }

  const compactNeedle = compactKey(formattedName || rawName);

  if (!compactNeedle) {
    return null;
  }

  return (
    records.find((record) =>
      record.lookupKeys.some(
        (lookupKey) =>
          lookupKey.includes(compactNeedle) || compactNeedle.includes(lookupKey)
      )
    ) || null
  );
}

async function getHeroCatalog() {
  if (!heroCatalogPromise) {
    heroCatalogPromise = (async () => {
      const client = requireSupabase();
      const { data, error } = await client
        .from("heroes")
        .select("hero_id, hero_name, image_url, primary_attribute")
        .order("hero_name", { ascending: true });

      if (error) {
        heroCatalogPromise = null;
        throw error;
      }

      return (data || []).map((hero) => {
        const heroName = formatHeroName(hero.hero_name);

        return {
          heroId: hero.hero_id,
          heroName,
          imageUrl: hero.image_url || null,
          primaryAttribute: hero.primary_attribute || null,
          lookupKeys: buildLookupKeys(
            heroName,
            normalizeHeroLookupKey,
            compactHeroLookupKey
          ),
          raw: hero,
        };
      });
    })();
  }

  return heroCatalogPromise;
}

async function getItemCatalog() {
  if (!itemCatalogPromise) {
    itemCatalogPromise = (async () => {
      const client = requireSupabase();
      const { data, error } = await client
        .from("items")
        .select("item_id, item_name, image_url, category, cost")
        .order("item_name", { ascending: true });

      if (error) {
        itemCatalogPromise = null;
        throw error;
      }

      return (data || []).map((item) => {
        const itemName = formatItemName(item.item_name);

        return {
          itemId: item.item_id,
          itemName,
          imageUrl: item.image_url || null,
          category: item.category || "utility",
          cost: item.cost ?? null,
          lookupKeys: buildLookupKeys(
            itemName,
            normalizeItemLookupKey,
            compactItemLookupKey
          ),
          raw: item,
        };
      });
    })();
  }

  return itemCatalogPromise;
}

async function resolveHeroName(name) {
  const records = await getHeroCatalog();
  return findCatalogMatch(
    records,
    name,
    normalizeHeroLookupKey,
    compactHeroLookupKey,
    formatHeroName
  );
}

async function resolveItemName(name) {
  const records = await getItemCatalog();
  return findCatalogMatch(
    records,
    name,
    normalizeItemLookupKey,
    compactItemLookupKey,
    formatItemName
  );
}

async function resolveHeroNames(names = []) {
  const records = await getHeroCatalog();
  const matches = [];
  const seenIds = new Set();

  for (const name of names) {
    const match = findCatalogMatch(
      records,
      name,
      normalizeHeroLookupKey,
      compactHeroLookupKey,
      formatHeroName
    );

    if (!match || seenIds.has(match.heroId)) {
      continue;
    }

    seenIds.add(match.heroId);
    matches.push(match);
  }

  return matches;
}

async function resolveItemNames(names = []) {
  const records = await getItemCatalog();
  const matches = [];
  const seenIds = new Set();

  for (const name of names) {
    const match = findCatalogMatch(
      records,
      name,
      normalizeItemLookupKey,
      compactItemLookupKey,
      formatItemName
    );

    if (!match || seenIds.has(match.itemId)) {
      continue;
    }

    seenIds.add(match.itemId);
    matches.push(match);
  }

  return matches;
}

export {
  getHeroCatalog,
  getItemCatalog,
  hasCredentials,
  requireSupabase,
  resolveHeroName,
  resolveHeroNames,
  resolveItemName,
  resolveItemNames,
  supabase,
};
