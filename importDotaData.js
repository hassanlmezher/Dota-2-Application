import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function importHeroes() {
  console.log("Fetching heroes from OpenDota...");

  const res = await fetch("https://api.opendota.com/api/heroes");
  const heroes = await res.json();

  const formatted = heroes.map((h) => ({
    hero_id: h.id,
    hero_name: h.localized_name,
    primary_attribute: h.primary_attr,
    roles: h.roles,
    image_url: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${h.name.replace(
      "npc_dota_hero_",
      ""
    )}.png`,
  }));

  console.log(`Inserting ${formatted.length} heroes into Supabase...`);

  const { error } = await supabase.from("heroes").upsert(formatted);

  if (error) {
    console.error("Error inserting heroes:", error);
  } else {
    console.log("✅ Heroes imported successfully!");
  }
}

async function importItems() {
  console.log("Fetching items from OpenDota...");

  const res = await fetch("https://api.opendota.com/api/constants/items");
  const itemsObj = await res.json();

  const items = Object.entries(itemsObj)
    .map(([key, value]) => ({
      item_id: value.id,
      item_name: value.dname || key, // ✅ fallback if null
      cost: value.cost || 0,
      category: value.qual || "unknown",
      image_url: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${key}.png`,
    }))
    .filter((item) => item.item_id); // keep only items with IDs

  console.log(`Inserting ${items.length} items into Supabase...`);

  const { error } = await supabase.from("items").upsert(items);

  if (error) {
    console.error("Error inserting items:", error);
  } else {
    console.log("✅ All items imported successfully!");
  }
}

async function run() {
  await importHeroes();
  await importItems();
}

run();