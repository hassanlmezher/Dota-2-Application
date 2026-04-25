import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import IntelBoard from "../components/IntelBoard";
import { ROLE_LOOKUP } from "../constants/roles";
import { PREFERENCE_KEYS, readPreference, writePreference } from "../utils/preferences";

export default function Home() {
  const gsi = useOutletContext();
  const rememberStartedState = readPreference(PREFERENCE_KEYS.overlayOnLaunch, true);
  const ambientMotion = readPreference(PREFERENCE_KEYS.ambientMotion, true);
  const [started, setStarted] = useState(
    rememberStartedState ? readPreference(PREFERENCE_KEYS.overlayStarted, false) : false
  );
  const [role, setRole] = useState(readPreference(PREFERENCE_KEYS.defaultRole, "carry"));

  async function handlePrimaryAction() {
    const nextStarted = true;
    setStarted(nextStarted);

    if (rememberStartedState) {
      writePreference(PREFERENCE_KEYS.overlayStarted, nextStarted);
    }

    if (gsi?.overlayState?.visible) {
      await gsi.hideOverlay();
      return;
    }

    const bootMode = readPreference(PREFERENCE_KEYS.overlayBootMode, "launcher");
    await gsi.showOverlay(bootMode);
  }

  function handleRoleChange(nextRole) {
    setRole(nextRole);
    writePreference(PREFERENCE_KEYS.defaultRole, nextRole);
  }

  return (
    <section
      className={`surface-page ${ambientMotion ? "surface-page--ambient" : ""}`}
    >
      <header className="surface-nav">
        <div className="surface-nav__brand">
          <span className="surface-nav__eyebrow">DOTA HELPER</span>
          <strong>Aether Draft Engine</strong>
        </div>

        <div className="surface-nav__actions">
          <span
            className={`status-pill ${
              gsi?.serverStatus?.running ? "status-pill--online" : "status-pill--offline"
            }`}
          >
            {gsi?.serverStatus?.running ? "GSI Online" : "GSI Offline"}
          </span>
          <Link to="/settings" className="surface-icon-button">
            Settings
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero__overlay" />
        <div className="landing-hero__content">
          <span className="landing-badge">Dota 2 Overlay Assistant</span>
          <h1>Dota Helper Overlay</h1>
          <p>
            Start with a single Dota-style button. The first toggle spawns a movable
            launcher on the right edge of the screen. Clicking that launcher opens the
            compact live panel for picks, enemy HP, and item suggestions.
          </p>

          <div className="landing-hero__actions">
            <button type="button" className="dota-cta" onClick={handlePrimaryAction}>
              <span className="dota-cta__icon">▶</span>
              <span>{started ? "CHANGE VIEW" : "START OVERLAY"}</span>
            </button>

            <Link to="/settings" className="surface-secondary-link">
              Settings
            </Link>
          </div>

          <div className="landing-hero__hint">
            <strong>Saved role:</strong> {ROLE_LOOKUP[role]}
          </div>
        </div>

        <div className="landing-status-pill">
          OVERLAY: {gsi?.overlayState?.visible ? gsi.overlayState.mode.toUpperCase() : "OFF"}
        </div>
      </section>

      {!started ? (
        <section className="landing-feature-grid">
          <article className="landing-feature">
            <span>01</span>
            <h3>Draft Read</h3>
            <p>During hero selection the dashboard flips to enemy picks and counter heroes.</p>
          </article>
          <article className="landing-feature">
            <span>02</span>
            <h3>Live Match</h3>
            <p>After the horn, the same space shifts into enemy HP and item response signals.</p>
          </article>
          <article className="landing-feature">
            <span>03</span>
            <h3>Overlay Launcher</h3>
            <p>A movable side widget keeps the compact view one click away while you play.</p>
          </article>
        </section>
      ) : (
        <section className="dashboard-surface">
          <div className="dashboard-surface__header">
            <div>
              <p className="intel-kicker">Full Screen View</p>
              <h2>Match intelligence board</h2>
            </div>
            <button
              type="button"
              className="surface-tertiary-button"
              onClick={() => gsi.showOverlay("launcher")}
            >
              Show Side Overlay
            </button>
          </div>

          <IntelBoard
            matchState={gsi?.matchState}
            serverStatus={gsi?.serverStatus}
            role={role}
            onRoleChange={handleRoleChange}
            variant="full"
          />
        </section>
      )}
    </section>
  );
}
