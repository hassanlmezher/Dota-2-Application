import { useEffect, useMemo, useState } from "react";
import { ROLE_LOOKUP } from "../constants/roles";
import PickAssistant from "../pages/PickAssistant";
import ItemAssistant from "../pages/ItemAssistant";
import RoleSelector from "./RoleSelector";

function Avatar({ imageUrl, label }) {
  if (imageUrl) {
    return <img src={imageUrl} alt={label} className="intel-avatar__image" />;
  }

  return <span className="intel-avatar__fallback">{label.slice(0, 2).toUpperCase()}</span>;
}

function EmptyCard({ title, description, action }) {
  return (
    <div className="intel-empty">
      <h4>{title}</h4>
      <p>{description}</p>
      {action || null}
    </div>
  );
}

function HealthRow({ hero }) {
  const healthPercent =
    hero.healthPercent !== null && hero.healthPercent !== undefined
      ? hero.healthPercent
      : 100;

  return (
    <article className="enemy-health-row">
      <div className="enemy-health-row__meta">
        <div className="intel-avatar intel-avatar--small">
          <Avatar imageUrl={hero.imageUrl} label={hero.heroName} />
        </div>
        <div>
          <h4>{hero.heroName}</h4>
          <p>
            {hero.currentHealth !== null && hero.maxHealth !== null
              ? `${hero.currentHealth}/${hero.maxHealth} HP`
              : healthPercent === 100
                ? "Hidden from view, assumed full HP"
                : "Visible on screen"}
          </p>
        </div>
      </div>

      <div className="enemy-health-row__bar">
        <span style={{ width: `${healthPercent}%` }} />
      </div>

      <strong>{healthPercent}%</strong>
    </article>
  );
}

function DraftPanel({ compact, enemyHeroes, enemyHeroNames, role, onRoleChange }) {
  return (
    <section className="intel-panel intel-draft-panel">
      <div className="intel-draft-role-block">
        <div className="intel-section-header">
          <h3>Role</h3>
          <span>{ROLE_LOOKUP[role]}</span>
        </div>
        <RoleSelector value={role} onChange={onRoleChange} />
      </div>

      <div className="intel-draft-picks">
        <div className="intel-section-header">
          <h3>Enemy picks</h3>
          <span>{enemyHeroNames.length}</span>
        </div>

        {enemyHeroes.length ? (
          <div className="enemy-draft-list">
            {enemyHeroes.map((hero) => (
              <div className="draft-chip" key={hero.key || hero.heroName}>
                <div className="intel-avatar intel-avatar--small">
                  <Avatar imageUrl={hero.imageUrl} label={hero.heroName} />
                </div>
                <span>{hero.heroName}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyCard
            title="No enemy picks yet"
            description="Keep the draft HUD visible. Once the top bar portraits are readable, enemy picks appear here automatically."
          />
        )}
      </div>

      <div className="intel-draft-suggestions">
        <div className="intel-section-header">
          <h3>Best picks</h3>
          <span>{ROLE_LOOKUP[role]}</span>
        </div>
        <PickAssistant
          active
          compact={compact}
          enemyHeroNames={enemyHeroNames}
          feedScope="screen"
          limit={compact ? 5 : 8}
          role={role}
        />
      </div>
    </section>
  );
}

export default function IntelBoard({
  captureState,
  matchState,
  role,
  onRoleChange,
  variant = "full",
}) {
  const compact = variant === "compact";
  const phase = matchState?.phase || "idle";
  const heroName = matchState?.myHeroName || "";
  const enemyHeroes = matchState?.enemyHeroes || [];
  const enemyHeroNames = matchState?.enemyHeroNames || [];
  const enemyHealth = useMemo(
    () =>
      (matchState?.enemyHealthList || []).map((hero) => ({
        ...hero,
        healthPercent:
          hero.healthPercent !== null && hero.healthPercent !== undefined
            ? hero.healthPercent
            : 100,
      })),
    [matchState?.enemyHealthList]
  );
  const [activeTab, setActiveTab] = useState("items");
  const captureActive = Boolean(captureState?.active);

  useEffect(() => {
    if (phase === "match") {
      setActiveTab("items");
    }
  }, [phase]);

  return (
    <section className={`intel-board intel-board--${variant} intel-board--clean`}>
      <div className="intel-board__hero">
        <div>
          <p className="intel-kicker">
            {phase === "draft"
              ? "Draft scan"
              : phase === "match"
                ? "Live scan"
                : captureActive
                  ? "Scanning screen"
                  : "Awaiting capture"}
          </p>
          <h2>
            {phase === "draft"
              ? "Enemy draft detected"
              : phase === "match"
                ? heroName || "Live match detected"
                : captureActive
                  ? "Looking for Dota HUD"
                  : "Start screen capture"}
          </h2>
          <p>
            {phase === "draft"
              ? "Counter picks come from the top bar heroes currently detected on screen."
              : phase === "match"
                ? `Using ${heroName ? `${heroName} as the focus hero` : "the visible HUD"} to score item responses and estimate enemy HP.`
                : captureActive
                  ? "Keep the Dota HUD visible and unobstructed. The app needs the top hero bar and, for live matches, the focused hero HUD."
                  : "Choose the Dota window or display to begin. No GSI file is required in this mode."}
          </p>
        </div>

        <div className="intel-board__hero-status">
          <span
            className={`status-pill ${
              captureActive ? "status-pill--online" : "status-pill--offline"
            }`}
          >
            {captureActive ? "Capture live" : "Capture idle"}
          </span>
          <small className="intel-board__diagnostic">
            {captureState?.sourceLabel || "No source selected"}
          </small>
          {captureState?.frameCount ? (
            <strong>{captureState.frameCount} frames analyzed</strong>
          ) : null}
        </div>
      </div>

      {phase === "draft" ? (
        <DraftPanel
          compact={compact}
          enemyHeroes={enemyHeroes}
          enemyHeroNames={enemyHeroNames}
          role={role}
          onRoleChange={onRoleChange}
        />
      ) : null}

      {phase === "match" ? (
        <>
          <div className="intel-tabs">
            <button
              type="button"
              className={activeTab === "items" ? "intel-tab intel-tab--active" : "intel-tab"}
              onClick={() => setActiveTab("items")}
            >
              Best Items
            </button>
            <button
              type="button"
              className={activeTab === "hp" ? "intel-tab intel-tab--active" : "intel-tab"}
              onClick={() => setActiveTab("hp")}
            >
              Enemy HP
            </button>
          </div>

          {activeTab === "items" ? (
            <section className="intel-panel">
              <div className="intel-section-header">
                <h3>Best items</h3>
                <span>{heroName || "Focus hero required"}</span>
              </div>
              <ItemAssistant
                active
                enemyHeroNames={enemyHeroNames}
                enemyItemNames={matchState?.enemyItemNames || []}
                feedScope="screen"
                limit={compact ? 5 : 8}
                myHeroName={heroName}
              />
            </section>
          ) : null}

          {activeTab === "hp" ? (
            <section className="intel-panel">
              <div className="intel-section-header">
                <h3>Enemy health</h3>
                <span>{enemyHealth.length}</span>
              </div>

              {enemyHealth.length ? (
                <div className="enemy-health-list">
                  {enemyHealth.map((hero) => (
                    <HealthRow key={hero.key || hero.heroName} hero={hero} />
                  ))}
                </div>
              ) : enemyHeroNames.length ? (
                <div className="enemy-health-list">
                  {enemyHeroNames.map((heroNameValue) => (
                    <HealthRow
                      key={heroNameValue}
                      hero={{
                        heroName: heroNameValue,
                        currentHealth: null,
                        maxHealth: null,
                        healthPercent: 100,
                        imageUrl: null,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <EmptyCard
                  title="No enemy heroes detected yet"
                  description="Keep the top hero portraits visible. Once the enemy lineup is readable, each enemy is listed here and starts at 100% HP by default."
                />
              )}
            </section>
          ) : null}
        </>
      ) : null}

      {phase === "idle" ? (
        <div className={`intel-grid ${compact ? "intel-grid--stacked" : ""}`}>
          <section className="intel-panel">
            <div className="intel-section-header">
              <h3>Draft picks</h3>
              <span>Top bar required</span>
            </div>
            <EmptyCard
              title={captureActive ? "Waiting for draft heroes" : "No capture yet"}
              description={
                captureActive
                  ? "The app is scanning, but it has not locked onto enough top bar hero portraits yet."
                  : "Start capture first, then keep the Dota top bar visible for automatic draft detection."
              }
            />
          </section>

          <section className="intel-panel">
            <div className="intel-section-header">
              <h3>Live match</h3>
              <span>HUD required</span>
            </div>
            <EmptyCard
              title={captureActive ? "Waiting for live HUD" : "Ready for live HP and items"}
              description={
                captureActive
                  ? "Once the focused hero HUD and enemy portraits are readable, this board switches into item and HP mode."
                  : "After capture starts, the board will switch automatically between draft and live match modes."
              }
            />
          </section>
        </div>
      ) : null}
    </section>
  );
}
