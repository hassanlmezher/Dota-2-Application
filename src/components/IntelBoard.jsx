import { useEffect, useState } from "react";
import { ROLES, ROLE_LOOKUP } from "../constants/roles";
import { useOverlayInsights } from "../hooks/useOverlayInsights";

function Avatar({ imageUrl, label }) {
  if (imageUrl) {
    return <img src={imageUrl} alt={label} className="intel-avatar__image" />;
  }

  return <span className="intel-avatar__fallback">{label.slice(0, 2).toUpperCase()}</span>;
}

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
  const roleRows = [ROLES.slice(0, 3), ROLES.slice(3)];
  const hasPackets = Boolean(serverStatus?.packetCount);
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
    counterLimit: compact ? 6 : 8,
    itemLimit: compact ? 4 : 6,
  });
  const [activeTab, setActiveTab] = useState("items");

  useEffect(() => {
    if (phase === "match") {
      setActiveTab("items");
    }
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
          {serverStatus?.running ? (
            <small className="intel-board__diagnostic">
              {hasPackets
                ? `Packets: ${serverStatus.packetCount}`
                : "Waiting for first packet"}
            </small>
          ) : null}
          {inMatch && audienceMode !== "spectator" ? (
            <strong>{currentItems.length} current items</strong>
          ) : null}
        </div>
      </div>

      {inDraft ? (
        <section className="intel-panel intel-draft-panel">
          <div className="intel-draft-role-block">
            <div className="intel-section-header">
              <h3>Select Your Role</h3>
              <span>{ROLE_LOOKUP[role]}</span>
            </div>

            <div className="intel-role-orb-rows">
              {roleRows.map((entries, rowIndex) => (
                <div
                  key={`role-row-${rowIndex + 1}`}
                  className={`intel-role-orb-row ${
                    rowIndex === 1 ? "intel-role-orb-row--short" : ""
                  }`}
                >
                  {entries.map((entry) => (
                    <RoleOrb
                      key={entry.value}
                      role={entry}
                      selected={entry.value === role}
                      onSelect={onRoleChange}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="intel-draft-picks">
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
          </div>

          <div className="intel-draft-suggestions">
            <div className="intel-section-header">
              <h3>Hero Suggestions</h3>
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
                title="No hero suggestions yet"
                description="Choose your role and wait for enemy picks to arrive."
              />
            )}
          </div>
        </section>
      ) : null}

      {inMatch ? (
        <>
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

          {activeTab === "items" ? (
            <section className="intel-panel">
              <div className="intel-section-header">
                <h3>{audienceMode === "spectator" ? "Observed Hero Items" : "Item Suggestions"}</h3>
                <span>
                  {audienceMode === "spectator"
                    ? enemyInventories.length
                    : itemLoading
                      ? "updating..."
                      : itemResults.length}
                </span>
              </div>

              {audienceMode === "spectator" ? (
                enemyInventories.length ? (
                  <div className="enemy-loadout-stack">
                    {enemyInventories.map((inventory) => (
                      <EnemyInventory
                        key={`${inventory.heroId || inventory.heroName}-inventory`}
                        inventory={inventory}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyCard
                    title={`${enemyLabel} inventories unavailable`}
                    description="If your GSI payload includes hero items, they will be grouped here automatically."
                  />
                )
              ) : itemLoading ? (
                <EmptyCard
                  title="Evaluating item timing"
                  description="Running your item-response RPC against the current enemy inventory."
                />
              ) : itemResults.length ? (
                <div className="intel-suggestion-list">
                  {itemResults.map((item) => (
                    <ItemSuggestionCard key={`${item.itemId}-${item.itemName}`} item={item} />
                  ))}
                </div>
              ) : (
                <EmptyCard
                  title="No item suggestions yet"
                  description="The panel needs your hero and enemy context before it can score purchases."
                />
              )}
            </section>
          ) : null}

          {activeTab === "hp" ? (
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
          ) : null}
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
