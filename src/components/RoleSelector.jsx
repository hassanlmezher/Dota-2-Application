import { ROLES } from "../constants/roles";

export default function RoleSelector({ value, onChange }) {
  return (
    <div className="field-group">
      <label className="field-label">Role</label>
      <div className="role-selector">
        {ROLES.map((role) => (
          <button
            key={role.value}
            type="button"
            className={`role-pill ${value === role.value ? "role-pill--active" : ""}`}
            onClick={() => onChange(role.value)}
          >
            <span>{role.shortLabel}</span>
            <strong>{role.label}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
