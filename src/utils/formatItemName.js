const ITEM_ALIASES = new Map([
  ["aegis", "Aegis of the Immortal"],
  ["aegis of the immortal", "Aegis of the Immortal"],
  ["aghanims scepter", "Aghanim's Scepter"],
  ["aghanims shard", "Aghanim's Shard"],
  ["aghanim scepter", "Aghanim's Scepter"],
  ["aghanim shard", "Aghanim's Shard"],
  ["assault", "Assault Cuirass"],
  ["assault cuirass", "Assault Cuirass"],
  ["bfury", "Battle Fury"],
  ["black king bar", "Black King Bar"],
  ["blink", "Blink Dagger"],
  ["blink dagger", "Blink Dagger"],
  ["boots of bearing", "Boots of Bearing"],
  ["boots of travel", "Boots of Travel"],
  ["boots of travel 2", "Boots of Travel 2"],
  ["cyclone", "Eul's Scepter of Divinity"],
  ["euls scepter of divinity", "Eul's Scepter of Divinity"],
  ["force staff", "Force Staff"],
  ["glimmer cape", "Glimmer Cape"],
  ["greater crit", "Daedalus"],
  ["helm of the dominator", "Helm of the Dominator"],
  ["helm of the overlord", "Helm of the Overlord"],
  ["invis sword", "Shadow Blade"],
  ["monkey king bar", "Monkey King Bar"],
  ["mystic staff", "Mystic Staff"],
  ["nullifier", "Nullifier"],
  ["octarine", "Octarine Core"],
  ["octarine core", "Octarine Core"],
  ["power treads", "Power Treads"],
  ["travel boots", "Boots of Travel"],
  ["travel boots 2", "Boots of Travel 2"],
  ["ultimate scepter", "Aghanim's Scepter"],
  ["ultimate orb", "Ultimate Orb"],
]);

function normalizeItemLookupKey(value = "") {
  return String(value)
    .replace(/^item_/, "")
    .replace(/^recipe_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compactItemLookupKey(value = "") {
  return normalizeItemLookupKey(value).replace(/[\s'-]+/g, "");
}

function titleCaseItemName(value = "") {
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

function isLikelyItemName(value = "") {
  const rawValue = String(value).trim();

  if (!rawValue) {
    return false;
  }

  if (rawValue.startsWith("item_")) {
    return true;
  }

  const normalizedKey = normalizeItemLookupKey(rawValue);
  const compactKey = compactItemLookupKey(rawValue);

  if (ITEM_ALIASES.has(normalizedKey) || ITEM_ALIASES.has(compactKey)) {
    return true;
  }

  return /^[a-z0-9\s'-]+$/i.test(rawValue);
}

function formatItemName(value = "") {
  const normalizedKey = normalizeItemLookupKey(value);

  if (!normalizedKey || normalizedKey === "empty") {
    return "";
  }

  const compactKey = compactItemLookupKey(value);
  const alias = ITEM_ALIASES.get(normalizedKey) || ITEM_ALIASES.get(compactKey);

  if (alias) {
    return alias;
  }

  return titleCaseItemName(normalizedKey);
}

export {
  compactItemLookupKey,
  formatItemName,
  isLikelyItemName,
  normalizeItemLookupKey,
};
