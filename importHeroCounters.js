import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function importHeroCounters() {
  console.log("Fetching heroes list from Supabase...");

  const { data: heroes, error: heroError } = await supabase
    .from("heroes")
    .select("hero_id")
    .order("hero_id", { ascending: true });

  if (heroError) {
    console.error("Error fetching heroes:", heroError);
    return;
  }

  console.log(`Found ${heroes.length} heroes. Starting matchup import...`);

  let totalInserted = 0;

  for (const hero of heroes) {
    const heroId = hero.hero_id;

    console.log(`Fetching matchups for hero ${heroId}...`);

    let matchups = null;

    // retry logic
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const res = await fetch(
          `https://api.opendota.com/api/heroes/${heroId}/matchups`
        );

        if (!res.ok) {
          console.log(
            `⚠️ OpenDota error for hero ${heroId} (status ${res.status}), attempt ${attempt}`
          );

          await sleep(2000 * attempt);
          continue;
        }

        matchups = await res.json();
        break;
      } catch (err) {
        console.log(
          `⚠️ Fetch failed for hero ${heroId}, attempt ${attempt}:`,
          err.message
        );
        await sleep(2000 * attempt);
      }
    }

    if (!matchups) {
      console.log(`❌ Skipping hero ${heroId} (failed after retries)`);
      continue;
    }

    const formatted = matchups.map((m) => {
      const games = m.games_played;
      const wins = m.wins;
      const winrate = games > 0 ? (wins / games) * 100 : 50;

      return {
        hero_id: heroId,
        enemy_hero_id: m.hero_id,
        advantage_score: (winrate - 50) * 2,
        winrate: winrate,
        updated_at: new Date().toISOString(),
      };
    });

    // insert in chunks
    const chunkSize = 150;
    for (let i = 0; i < formatted.length; i += chunkSize) {
      const chunk = formatted.slice(i, i + chunkSize);

      const { error } = await supabase.from("hero_counters").upsert(chunk);

      if (error) {
        console.error(`❌ Supabase insert error for hero ${heroId}:`, error);
        return;
      }
    }

    totalInserted += formatted.length;
    console.log(`✅ Inserted ${formatted.length} matchups for hero ${heroId}`);

    // delay to avoid OpenDota rate limit
    await sleep(1200);
  }

  console.log(`🎉 Done! Total inserted: ${totalInserted} matchup rows.`);
}

importHeroCounters();