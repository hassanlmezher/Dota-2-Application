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

function EmptyCard({ title, description }) {
  return (
    <div className="intel-empty">
      <h4>{title}</h4>
      <p>{description}</p>
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
              : "Hidden from vision, assumed full HP"}
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

export default function IntelBoard({
  matchState,
  serverStatus,
  role,
  onRoleChange,
  variant = "full",
}) {
  const compact = variant === "compact";
  const phase = matchState?.phase || "idle";
  const audienceMode = matchState?.audienceMode || "player";
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
  const hasPackets = Boolean(serverStatus?.packetCount);
  const hasAnyLiveContext = Boolean(matchState?.hasAnyLiveContext);
  const [activeTab, setActiveTab] = useState("items");

  useEffect(() => {
    if (phase === "match") {
      setActiveTab("items");
    }
  }, [phase]);

  return (
    <section className={`intel-board intel-board--${variant}`}>
      <div className="intel-board__hero">
        <div>
          <p className="intel-kicker">
            {phase === "draft"
              ? audienceMode === "spectator"
                ? "Observed draft"
                : "Draft phase"
              : phase === "match"
                ? audienceMode === "spectator"
                  ? "Observed live match"
                  : "Live match"
                : "Awaiting Dota 2"}
          </p>
          <h2>
            {phase === "draft"
              ? "Enemy draft detected"
              : phase === "match"
                ? heroName || "Live match detected"
                : hasAnyLiveContext
                  ? "Live feed connected"
                  : "Waiting for live data"}
          </h2>
          <p>
            {phase === "draft"
              ? `Role-based counter suggestions are tied to your selected role: ${ROLE_LOOKUP[role]}.`
              : phase === "match"
                ? `Clock ${matchState?.clockLabel || "--:--"} • ${matchState?.mapStateLabel || "No match detected"}`
                : hasAnyLiveContext
                  ? "The app sees live Dota context and will populate heroes, items, and health as packets arrive."
                  : hasPackets
                    ? "Dota packets are arriving, but the current payload does not yet contain enough match context."
                    : "No Dota packets received yet. Add -gamestateintegration to Dota 2 launch options and point Game State Integration at localhost:3001."}
          </p>
        </div>

        <div className="intel-board__hero-status">
          <span
            className={`status-pill ${
              serverStatus?.running ? "status-pill--online" : "status-pill--offline"
            }`}
          >
            {serverStatus?.running ? "GSI Listening" : "GSI Offline"}
          </span>
          <small className="intel-board__diagnostic">
            {hasPackets ? `Packets: ${serverStatus.packetCount}` : "Waiting for first packet"}
          </small>
          {phase === "match" && heroName ? (
            <strong>{matchState?.myItemNames?.length || 0} current items</strong>
          ) : null}
        </div>
      </div>

      {phase === "draft" ? (
        <section className="intel-panel intel-draft-panel">
          <div className="intel-draft-role-block">
            <div className="intel-section-header">
              <h3>Select Your Role</h3>
              <span>{ROLE_LOOKUP[role]}</span>
            </div>
            <RoleSelector value={role} onChange={onRoleChange} />
          </div>

          <div className="intel-draft-picks">
            <div className="intel-section-header">
              <h3>Enemy Picks</h3>
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
            ) : enemyHeroNames.length ? (
              <div className="enemy-draft-list">
                {enemyHeroNames.map((heroNameValue) => (
                  <div className="draft-chip" key={heroNameValue}>
                    <div className="intel-avatar intel-avatar--small">
                      <Avatar imageUrl={null} label={heroNameValue} />
                    </div>
                    <span>{heroNameValue}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyCard
                title="No enemy heroes detected yet"
                description="As soon as the draft feed exposes enemy heroes, they will appear here."
              />
            )}
          </div>

          <div className="intel-draft-suggestions">
            <div className="intel-section-header">
              <h3>Best Picks</h3>
              <span>{ROLE_LOOKUP[role]}</span>
            </div>
            <PickAssistant
              active
              compact={compact}
              enemyHeroNames={enemyHeroNames}
              limit={compact ? 6 : 8}
              role={role}
            />
          </div>
        </section>
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
                <h3>Best Items</h3>
                <span>{enemyHeroNames.length ? `${enemyHeroNames.length} enemies` : "No enemies yet"}</span>
              </div>
              <ItemAssistant
                active
                enemyHeroNames={enemyHeroNames}
                enemyItemNames={matchState?.enemyItemNames || []}
                limit={compact ? 5 : 8}
                myHeroName={heroName}
              />
            </section>
          ) : null}

          {activeTab === "hp" ? (
            <section className="intel-panel">
              <div className="intel-section-header">
                <h3>Enemy Health</h3>
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
                  description="Once enemy heroes are known from draft or live packets, they will appear here at 100% HP by default."
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
              <h3>Best Picks</h3>
              <span>Draft only</span>
            </div>
            <EmptyCard
              title="Waiting for draft data"
              description="During hero selection, this panel switches to enemy picks and role-based counter recommendations."
            />
          </section>

          <section className="intel-panel">
            <div className="intel-section-header">
              <h3>Best Items + Enemy HP</h3>
              <span>Match only</span>
            </div>
            <EmptyCard
              title="Waiting for live match data"
              description="After the match starts, the board switches to item suggestions and a live enemy health list."
            />
          </section>
        </div>
      ) : null}
    </section>
  );
}
