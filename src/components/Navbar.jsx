import { NavLink } from "react-router-dom";

const navigationItems = [
  { to: "/", label: "Home" },
  { to: "/pick-assistant", label: "Pick Assistant" },
  { to: "/item-assistant", label: "Item Assistant" },
  { to: "/overlay", label: "Overlay" },
  { to: "/settings", label: "Settings" },
];

export default function Navbar({ serverStatus, onToggleOverlay }) {
  return (
    <header className="navbar">
      <div className="navbar__brand">
        <div className="navbar__crest">DH</div>
        <div>
          <strong>Dota Helper App</strong>
          <span>Electron + React + Supabase</span>
        </div>
      </div>

      <nav className="navbar__nav">
        {navigationItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `navbar__link ${isActive ? "navbar__link--active" : ""}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="navbar__status">
        <span
          className={`status-pill ${
            serverStatus?.running ? "status-pill--online" : "status-pill--offline"
          }`}
        >
          {serverStatus?.running ? "GSI Ready" : "GSI Down"}
        </span>
        <button type="button" className="button button-secondary" onClick={onToggleOverlay}>
          Toggle Overlay
        </button>
      </div>
    </header>
  );
}
