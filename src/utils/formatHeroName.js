const HERO_ALIASES = new Map([
  ["antimage", "Anti-Mage"],
  ["anti mage", "Anti-Mage"],
  ["bountyhunter", "Bounty Hunter"],
  ["bounty hunter", "Bounty Hunter"],
  ["centaur", "Centaur Warrunner"],
  ["clockwerk", "Clockwerk"],
  ["doombringer", "Doom"],
  ["doom bringer", "Doom"],
  ["furion", "Nature's Prophet"],
  ["io", "Io"],
  ["keeperofthelight", "Keeper of the Light"],
  ["keeper of the light", "Keeper of the Light"],
  ["life stealer", "Lifestealer"],
  ["lifestealer", "Lifestealer"],
  ["magnataur", "Magnus"],
  ["necrolyte", "Necrophos"],
  ["nevermore", "Shadow Fiend"],
  ["nightstalker", "Night Stalker"],
  ["night stalker", "Night Stalker"],
  ["obsidian destroyer", "Outworld Destroyer"],
  ["obsidiandestroyer", "Outworld Destroyer"],
  ["outworld destroyer", "Outworld Destroyer"],
  ["outworlddevourer", "Outworld Destroyer"],
  ["outworld devourer", "Outworld Destroyer"],
  ["phantomassassin", "Phantom Assassin"],
  ["phantom assassin", "Phantom Assassin"],
  ["queenofpain", "Queen of Pain"],
  ["queen of pain", "Queen of Pain"],
  ["rattletrap", "Clockwerk"],
  ["sand king", "Sand King"],
  ["sandking", "Sand King"],
  ["shadowfiend", "Shadow Fiend"],
  ["skeleton king", "Wraith King"],
  ["skeletonking", "Wraith King"],
  ["stormspirit", "Storm Spirit"],
  ["storm spirit", "Storm Spirit"],
  ["techies", "Techies"],
  ["templarassassin", "Templar Assassin"],
  ["templar assassin", "Templar Assassin"],
  ["timbersaw", "Timbersaw"],
  ["treant", "Treant Protector"],
  ["treant protector", "Treant Protector"],
  ["vengefulspirit", "Vengeful Spirit"],
  ["vengeful spirit", "Vengeful Spirit"],
  ["venomancer", "Venomancer"],
  ["windrunner", "Windranger"],
  ["wisp", "Io"],
  ["winterwyvern", "Winter Wyvern"],
  ["winter wyvern", "Winter Wyvern"],
  ["wraithking", "Wraith King"],
  ["wraith king", "Wraith King"],
  ["zuus", "Zeus"],
]);

function normalizeHeroLookupKey(value = "") {
  return String(value)
    .replace(/^npc_dota_hero_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compactHeroLookupKey(value = "") {
  return normalizeHeroLookupKey(value).replace(/[\s'-]+/g, "");
}

function titleCaseHeroName(value = "") {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word.includes("'")) {
        return word
          .split("'")
          .map((part) =>
            part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part
          )
          .join("'");
      }

      if (word.includes("-")) {
        return word
          .split("-")
          .map((part) =>
            part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part
          )
          .join("-");
      }

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function isLikelyHeroName(value = "") {
  const rawValue = String(value).trim();

  if (!rawValue) {
    return false;
  }

  if (rawValue.startsWith("npc_dota_hero_")) {
    return true;
  }

  const normalizedKey = normalizeHeroLookupKey(rawValue);
  const compactKey = compactHeroLookupKey(rawValue);

  if (HERO_ALIASES.has(normalizedKey) || HERO_ALIASES.has(compactKey)) {
    return true;
  }

  return /^[a-z\s'-]+$/i.test(rawValue);
}

function formatHeroName(value = "") {
  const normalizedKey = normalizeHeroLookupKey(value);

  if (!normalizedKey) {
    return "";
  }

  const compactKey = compactHeroLookupKey(value);
  const alias = HERO_ALIASES.get(normalizedKey) || HERO_ALIASES.get(compactKey);

  if (alias) {
    return alias;
  }

  return titleCaseHeroName(normalizedKey);
}

export {
  compactHeroLookupKey,
  formatHeroName,
  isLikelyHeroName,
  normalizeHeroLookupKey,
};
