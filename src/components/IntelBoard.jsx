import { useEffect, useState } from "react";
import { ROLES, ROLE_LOOKUP } from "../constants/roles";
import { useOverlayInsights } from "../hooks/useOverlayInsights";

function Avatar({ imageUrl, label }) {
  if (imageUrl) {
    return <img src={imageUrl} alt={label} className="intel-avatar__image" />;
  }

  return <span className="intel-avatar__fallback">{label.slice(0, 2).toUpperCase()}</span>;
}

function RolePill({ role, selected, onSelect, compact }) {
  return (
    <button
      type="button"
      className={`intel-role-pill ${selected ? "intel-role-pill--active" : ""} ${
        compact ? "intel-role-pill--compact" : ""
      }`}
      onClick={() => onSelect(role.value)}
    >
      <span>{role.shortLabel}</span>
      <strong>{role.label}</strong>
    </button>
  );
}

function SuggestionCard({ hero, compact }) {
  return (
    <article className={`intel-suggestion ${compact ? "intel-suggestion--compact" : ""}`}>
      <div className="intel-suggestion__hero">
        <div className="intel-avatar">
          <Avatar imageUrl={hero.imageUrl} label={hero.heroName} />
        </div>
        <div>
          <h4>{hero.heroName}</h4>
          <p>{hero.reason}</p>
        </div>
      </div>
      <div className="intel-suggestion__score">
        <span>Advantage</span>
        <strong>{Math.round(hero.score)}%</strong>
      </div>
    </article>
  );
}

function ItemSuggestionCard({ item }) {
  return (
    <article className="intel-item-card">
      <div className="intel-item-card__media">
        <Avatar imageUrl={item.imageUrl} label={item.itemName} />
      </div>
      <div className="intel-item-card__body">
        <div className="intel-item-card__top">
          <div>
            <h4>{item.itemName}</h4>
            <p>{item.category}</p>
          </div>
          <strong>{Math.round(item.score)}%</strong>
        </div>
        <p className="intel-item-card__reason">{item.reason}</p>
      </div>
    </article>
  );
}

function EnemyInventory({ inventory }) {
  return (
    <article className="enemy-loadout">
      <div className="enemy-loadout__header">
        <div className="intel-avatar intel-avatar--small">
          <Avatar imageUrl={inventory.imageUrl} label={inventory.heroName} />
        </div>
        <div>
          <h4>{inventory.heroName}</h4>
          <p>{inventory.items.length} items seen</p>
        </div>
      </div>

      <div className="enemy-loadout__items">
        {inventory.items.map((item) => (
          <div className="enemy-item-chip" key={`${inventory.heroName}-${item.slot}-${item.name}`}>
            <span>{item.name}</span>
            <small>{item.slot}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function HealthRow({ hero }) {
  return (
    <article className="enemy-health-row">
      <div className="enemy-health-row__meta">
        <div className="intel-avatar intel-avatar--small">
          <Avatar imageUrl={hero.imageUrl} label={hero.name} />
        </div>
        <div>
          <h4>{hero.name}</h4>
          <p>
            {hero.health !== null && hero.maxHealth !== null
              ? `${hero.health}/${hero.maxHealth} HP`
              : "Health feed active"}
          </p>
        </div>
      </div>

      <div className="enemy-health-row__bar">
        <span style={{ width: `${hero.healthPercent || 0}%` }} />
      </div>

      <strong>{hero.healthPercent ?? "--"}%</strong>
    </article>
  );
}

function EmptyCard({ title, description }) {
  return (
    <div className="intel-empty">
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
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
  const {
    phase,
    audienceMode,
    phaseLabel,
    mapStateLabel,
    clockLabel,
    heroName,
    playerLevel,
    currentItems,
    enemyLabel,
    enemyHeroes,
    enemyInventories,
    enemyHealth,
    counterPickResults,
    counterPickLoading,
    itemResults,
    itemLoading,
    hasAnyLiveContext,
  } = useOverlayInsights({
    matchState,
    role,
    counterLimit: compact ? 3 : 5,
    itemLimit: compact ? 4 : 6,
  });
  const [activeTab, setActiveTab] = useState("items");

  useEffect(() => {
    setActiveTab(phase === "draft" ? "draft" : "items");
  }, [phase]);

  const inDraft = phase === "draft";
  const inMatch = phase === "match";

  return (
    <section className={`intel-board intel-board--${variant}`}>
      <div className="intel-board__hero">
        <div>
          <p className="intel-kicker">{phaseLabel}</p>
          <h2>
            {inMatch
              ? heroName
              : inDraft
                ? `${enemyLabel} draft detected`
                : hasAnyLiveContext
                  ? "Live feed connected"
                  : "Waiting for live data"}
          </h2>
          <p>
            {inMatch
              ? audienceMode === "spectator"
                ? `Clock ${clockLabel} • ${mapStateLabel} • Spectator or observed match feed`
                : `Clock ${clockLabel} • ${mapStateLabel}${playerLevel ? ` • Level ${playerLevel}` : ""}`
              : inDraft
                ? `Role-based counter suggestions are tied to your saved role: ${ROLE_LOOKUP[role]}.`
                : hasAnyLiveContext
                  ? "The app sees live match context. As more hero, item, and health data arrives it will populate automatically."
                  : "Start the overlay, launch Dota 2, and point Game State Integration at localhost:3001."}
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
          {inMatch && audienceMode !== "spectator" ? (
            <strong>{currentItems.length} current items</strong>
          ) : null}
        </div>
      </div>

      <section className="intel-role-section">
        <div className="intel-section-header">
          <h3>Select Your Role</h3>
          <span>{ROLE_LOOKUP[role]}</span>
        </div>

        <div className={`intel-role-grid ${compact ? "intel-role-grid--compact" : ""}`}>
          {ROLES.map((entry) => (
            <RolePill
              key={entry.value}
              role={entry}
              selected={entry.value === role}
              onSelect={onRoleChange}
              compact={compact}
            />
          ))}
        </div>
      </section>

      {inDraft ? (
        <div className={`intel-grid ${compact ? "intel-grid--stacked" : ""}`}>
          <section className="intel-panel">
            <div className="intel-section-header">
              <h3>{enemyLabel} Picks</h3>
              <span>{enemyHeroes.length}</span>
            </div>

            {enemyHeroes.length ? (
              <div className="enemy-draft-list">
                {enemyHeroes.map((hero) => (
                  <div className="draft-chip" key={`${hero.id}-${hero.name}`}>
                    <div className="intel-avatar intel-avatar--small">
                      <Avatar imageUrl={hero.imageUrl} label={hero.name} />
                    </div>
                    <span>{hero.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyCard
                title={`No ${enemyLabel.toLowerCase()} picks yet`}
                description="As soon as the feed sees draft heroes, they will appear here."
              />
            )}
          </section>

          <section className="intel-panel">
            <div className="intel-section-header">
              <h3>Recommended Heroes</h3>
              <span>{counterPickLoading ? "scanning..." : counterPickResults.length}</span>
            </div>

            {counterPickLoading ? (
              <EmptyCard
                title="Scoring matchup data"
                description="Pulling counter recommendations from your Supabase RPC."
              />
            ) : counterPickResults.length ? (
              <div className="intel-suggestion-list">
                {counterPickResults.map((hero) => (
                  <SuggestionCard
                    key={`${hero.heroId}-${hero.heroName}`}
                    hero={hero}
                    compact={compact}
                  />
                ))}
              </div>
            ) : (
              <EmptyCard
                title="No picks to score yet"
                description="Choose your role and wait for at least one enemy pick to arrive."
              />
            )}
          </section>
        </div>
      ) : null}

      {inMatch ? (
        <>
          {compact ? (
            <div className="intel-tabs">
              <button
                type="button"
                className={activeTab === "items" ? "intel-tab intel-tab--active" : "intel-tab"}
                onClick={() => setActiveTab("items")}
              >
                {audienceMode === "spectator" ? "Hero Items" : "Item Suggestions"}
              </button>
              <button
                type="button"
                className={activeTab === "hp" ? "intel-tab intel-tab--active" : "intel-tab"}
                onClick={() => setActiveTab("hp")}
              >
                {enemyLabel} HP
              </button>
            </div>
          ) : null}

          <div className={`intel-grid ${compact ? "intel-grid--stacked" : ""}`}>
            {(!compact || activeTab === "items") && (
              <section className="intel-panel">
                <div className="intel-section-header">
                  <h3>{audienceMode === "spectator" ? "Observed Hero Items" : "Item Suggestions"}</h3>
                  <span>{itemLoading ? "updating..." : itemResults.length}</span>
                </div>

                <div className="enemy-loadout-stack">
                  {enemyInventories.length ? (
                    enemyInventories.map((inventory) => (
                      <EnemyInventory
                        key={`${inventory.heroId || inventory.heroName}-inventory`}
                        inventory={inventory}
                      />
                    ))
                  ) : (
                    <EmptyCard
                      title={`${enemyLabel} inventories unavailable`}
                      description="If your GSI payload includes hero items, they will be grouped here automatically."
                    />
                  )}
                </div>

                <div className="intel-suggestion-list">
                  {itemLoading ? (
                    <EmptyCard
                      title="Evaluating item timing"
                      description="Running your item-response RPC against the current enemy inventory."
                    />
                  ) : itemResults.length ? (
                    itemResults.map((item) => (
                      <ItemSuggestionCard key={`${item.itemId}-${item.itemName}`} item={item} />
                    ))
                  ) : (
                    <EmptyCard
                      title={
                        audienceMode === "spectator"
                          ? "Observed items are live"
                          : "No item suggestions yet"
                      }
                      description={
                        audienceMode === "spectator"
                          ? "Hero inventories still update in spectator mode even when there is no single local hero to optimize around."
                          : "The panel needs your hero and enemy context before it can score purchases."
                      }
                    />
                  )}
                </div>
              </section>
            )}

            {(!compact || activeTab === "hp") && (
              <section className="intel-panel">
                <div className="intel-section-header">
                  <h3>{enemyLabel} HP</h3>
                  <span>{enemyHealth.length}</span>
                </div>

                {enemyHealth.length ? (
                  <div className="enemy-health-list">
                    {enemyHealth.map((hero) => (
                      <HealthRow key={`${hero.id}-${hero.name}`} hero={hero} />
                    ))}
                  </div>
                ) : (
                  <EmptyCard
                    title={`${enemyLabel} health feed inactive`}
                    description="If your GSI payload includes visible hero health, this panel will update live."
                  />
                )}
              </section>
            )}
          </div>
        </>
      ) : null}

      {phase === "idle" ? (
        <div className={`intel-grid ${compact ? "intel-grid--stacked" : ""}`}>
          <section className="intel-panel">
            <div className="intel-section-header">
              <h3>Draft Window</h3>
              <span>Counter Picks</span>
            </div>
            <EmptyCard
              title="Before the horn"
              description="During the picking phase, this board switches to observed picks and role-based counter recommendations."
            />
          </section>

          <section className="intel-panel">
            <div className="intel-section-header">
              <h3>Match Window</h3>
              <span>Items + HP</span>
            </div>
            <EmptyCard
              title="After the lane starts"
              description="Once the match is live, the same layout pivots into enemy health and item suggestions."
            />
          </section>
        </div>
      ) : null}
    </section>
  );
}
