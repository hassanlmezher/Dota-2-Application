function formatHeroName(value = "") {
  return value
    .replace(/^npc_dota_hero_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

export { formatHeroName };
