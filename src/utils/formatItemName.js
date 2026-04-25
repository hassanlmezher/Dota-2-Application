function formatItemName(value = "") {
  return value
    .replace(/^item_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

export { formatItemName };
