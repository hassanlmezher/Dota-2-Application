const ROLES = [
  { value: "carry", label: "Carry", shortLabel: "Pos 1" },
  { value: "mid", label: "Mid", shortLabel: "Pos 2" },
  { value: "offlane", label: "Offlane", shortLabel: "Pos 3" },
  { value: "soft_support", label: "Soft Support", shortLabel: "Pos 4" },
  { value: "hard_support", label: "Hard Support", shortLabel: "Pos 5" },
];

const ROLE_LOOKUP = Object.fromEntries(ROLES.map((role) => [role.value, role.label]));

export { ROLES, ROLE_LOOKUP };
