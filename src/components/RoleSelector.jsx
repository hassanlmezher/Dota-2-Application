import { ROLES } from "../constants/roles";

const roleRows = [ROLES.slice(0, 3), ROLES.slice(3)];

function RoleOrb({ role, selected, onSelect }) {
  const positionLabel = role.shortLabel.replace(/^Pos\s*/i, "");

  return (
    <button
      type="button"
      className={selected ? "intel-role-orb intel-role-orb--active" : "intel-role-orb"}
      aria-label={`${role.label} (${role.shortLabel})`}
      title={`${role.label} (${role.shortLabel})`}
      onClick={() => onSelect(role.value)}
    >
      <span>{positionLabel}</span>
    </button>
  );
}

export default function RoleSelector({ value, onChange }) {
  return (
    <div className="intel-role-orb-rows">
      {roleRows.map((entries, rowIndex) => (
        <div
          key={`role-row-${rowIndex + 1}`}
          className={`intel-role-orb-row ${rowIndex === 1 ? "intel-role-orb-row--short" : ""}`}
        >
          {entries.map((role) => (
            <RoleOrb
              key={role.value}
              role={role}
              selected={role.value === value}
              onSelect={onChange}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
