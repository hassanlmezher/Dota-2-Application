import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ROLES, ROLE_LOOKUP } from "../constants/roles";
import { hasCredentials } from "../api/supabaseClient";
import { PREFERENCE_KEYS, readPreference, writePreference } from "../utils/preferences";

export default function Settings() {
  const intel = useOutletContext();
  const [defaultRole, setDefaultRole] = useState(
    readPreference(PREFERENCE_KEYS.defaultRole, "carry")
  );
  const [overlayBootMode, setOverlayBootMode] = useState(
    readPreference(PREFERENCE_KEYS.overlayBootMode, "launcher")
  );
  const [ambientMotion, setAmbientMotion] = useState(
    readPreference(PREFERENCE_KEYS.ambientMotion, true)
  );
  const [savedMessage, setSavedMessage] = useState("");

  function handleSave() {
    writePreference(PREFERENCE_KEYS.defaultRole, defaultRole);
    writePreference(PREFERENCE_KEYS.overlayBootMode, overlayBootMode);
    writePreference(PREFERENCE_KEYS.ambientMotion, ambientMotion);
    setSavedMessage("Settings saved.");
    window.setTimeout(() => setSavedMessage(""), 1800);
  }

  return (
    <section className="settings-page settings-page--clean">
      <header className="surface-nav surface-nav--clean">
        <div className="surface-nav__brand">
          <Link to="/" className="surface-back-link">
            ← Back
          </Link>
          <strong>Settings</strong>
        </div>

        <div className="surface-nav__actions">
          <span
            className={`status-pill ${
              intel?.captureState?.active ? "status-pill--online" : "status-pill--offline"
            }`}
          >
            {intel?.captureState?.active ? "Capture Active" : "Capture Idle"}
          </span>
        </div>
      </header>

      <div className="settings-shell">
        <aside className="settings-sidebar settings-sidebar--clean">
          <span className="settings-sidebar__kicker">Capture First</span>
          <h1>Screen setup</h1>
          <p>
            This version uses user-approved screen capture instead of GSI or game
            memory. That keeps the desktop app and packaged Store builds on a safer,
            more standard path.
          </p>

          <div className="settings-premium-card">
            <strong>Current source</strong>
            <span>{intel?.captureState?.sourceLabel || "No source selected"}</span>
          </div>
        </aside>

        <div className="settings-content">
          <section className="settings-panel settings-panel--clean">
            <div className="intel-section-header">
              <h3>Overlay launch</h3>
              <span>{overlayBootMode === "launcher" ? "Launcher first" : "Panel first"}</span>
            </div>

            <div className="settings-toggle-row">
              <div>
                <strong>Launch as compact button first</strong>
                <p>Use the small movable launcher on each screen before opening the panel.</p>
              </div>
              <button
                type="button"
                className={`settings-switch ${
                  overlayBootMode === "launcher" ? "settings-switch--active" : ""
                }`}
                onClick={() =>
                  setOverlayBootMode((currentValue) =>
                    currentValue === "launcher" ? "panel" : "launcher"
                  )
                }
              >
                <span />
              </button>
            </div>

            <div className="settings-toggle-row">
              <div>
                <strong>Ambient motion</strong>
                <p>Keeps the soft background motion enabled on the main dashboard.</p>
              </div>
              <button
                type="button"
                className={`settings-switch ${
                  ambientMotion ? "settings-switch--active" : ""
                }`}
                onClick={() => setAmbientMotion((currentValue) => !currentValue)}
              >
                <span />
              </button>
            </div>
          </section>

          <section className="settings-panel settings-panel--clean">
            <div className="intel-section-header">
              <h3>Default role</h3>
              <span>{ROLE_LOOKUP[defaultRole]}</span>
            </div>

            <div className="intel-role-grid">
              {ROLES.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  className={`intel-role-pill ${
                    defaultRole === role.value ? "intel-role-pill--active" : ""
                  }`}
                  onClick={() => setDefaultRole(role.value)}
                >
                  <span>{role.shortLabel}</span>
                  <strong>{role.label}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-panel settings-panel--clean">
            <div className="intel-section-header">
              <h3>Runtime</h3>
              <span>{hasCredentials ? "Supabase ready" : "Missing Supabase credentials"}</span>
            </div>

            <div className="settings-callout settings-callout--clean">
              <strong>How capture works</strong>
              <p>
                The desktop app now tries to auto-select Dota 2 first. On macOS, if
                Screen Recording permission is blocked, enable it for{" "}
                <strong>{intel?.appInfo?.capturePermissionTarget || "Electron"}</strong> and
                then restart the app.
              </p>
            </div>

            <div className="settings-runtime-list">
              <div className="settings-runtime-row">
                <span>Capture status</span>
                <strong>{intel?.captureState?.status || "idle"}</strong>
              </div>
              <div className="settings-runtime-row">
                <span>Frames analyzed</span>
                <strong>{intel?.captureState?.frameCount || 0}</strong>
              </div>
              <div className="settings-runtime-row">
                <span>Last frame</span>
                <strong>{intel?.captureState?.lastAnalyzedAt || "None yet"}</strong>
              </div>
              <div className="settings-runtime-row">
                <span>Overlay state</span>
                <strong>
                  {intel?.overlayState?.visible ? intel.overlayState.mode : "hidden"}
                </strong>
              </div>
              <div className="settings-runtime-row">
                <span>Supabase</span>
                <strong>{hasCredentials ? "connected" : "missing env vars"}</strong>
              </div>
            </div>
          </section>

          <footer className="settings-footer">
            <span>{savedMessage || "Settings apply immediately after save."}</span>
            <button type="button" className="dota-cta dota-cta--small" onClick={handleSave}>
              <span>Save</span>
            </button>
          </footer>
        </div>
      </div>
    </section>
  );
}
