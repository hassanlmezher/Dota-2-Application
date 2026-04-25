import { useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import ItemCard from "../components/ItemCard";
import Loader from "../components/Loader";
import { useItemSuggestions } from "../hooks/useItemSuggestions";
import { formatHeroName } from "../utils/formatHeroName";
import { formatItemName } from "../utils/formatItemName";

function OverlayStat({ label, value }) {
  return (
    <div className="overlay-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function MatchOverlay() {
  const gsi = useOutletContext();
  const { results, loading, runItemSearch } = useItemSuggestions();
  const matchState = gsi?.matchState;
  const map = matchState?.map || {};
  const hero = matchState?.hero || {};
  const items = matchState?.items || [];
  const enemyHeroIds = (matchState?.enemyHeroes || [])
    .map((entry) => Number(entry.id))
    .filter(Boolean);
  const enemyItemIds = (matchState?.enemyItems || [])
    .map((entry) => Number(entry.id))
    .filter(Boolean);
  const heroId = Number(hero.id) || null;

  useEffect(() => {
    if (!heroId) {
      return;
    }

    const timer = window.setTimeout(() => {
      runItemSearch({
        heroId,
        enemyHeroIds,
        enemyItemIds,
        limit: 6,
      });
    }, 650);

    return () => {
      window.clearTimeout(timer);
    };
  }, [heroId, JSON.stringify(enemyHeroIds), JSON.stringify(enemyItemIds)]);

  if (!window.electronAPI?.isElectron) {
    return (
      <section className="page overlay-page">
        <div className="panel overlay-panel">
          <h1>Overlay is only available inside Electron.</h1>
          <p className="page-lead">
            Start the desktop app to receive live Dota 2 GSI payloads on
            `localhost:3001`.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="page overlay-page">
      <div className="overlay-shell-card">
        <div className="overlay-header">
          <div>
            <p className="eyebrow">Live Match Overlay</p>
            <h1>{hero.name ? formatHeroName(hero.name) : "Waiting for Dota 2..."}</h1>
          </div>
          <span
            className={`status-pill ${
              gsi?.serverStatus?.running ? "status-pill--online" : "status-pill--offline"
            }`}
          >
            {gsi?.serverStatus?.running ? "GSI Live" : "GSI Offline"}
          </span>
        </div>

        <div className="overlay-stats">
          <OverlayStat label="Game State" value={map.game_state || "Lobby"} />
          <OverlayStat
            label="Clock"
            value={
              typeof map.clock_time === "number"
                ? `${Math.floor(map.clock_time / 60)
                    .toString()
                    .padStart(2, "0")}:${Math.abs(map.clock_time % 60)
                    .toString()
                    .padStart(2, "0")}`
                : "--:--"
            }
          />
          <OverlayStat label="Level" value={matchState?.player?.level || hero.level || "--"} />
        </div>

        <div className="overlay-section">
          <div className="section-heading">
            <h2>Current Items</h2>
            <span>{items.length}</span>
          </div>

          {items.length ? (
            <div className="chip-grid">
              {items.map((item) => (
                <div className="mini-chip" key={`${item.slot}-${item.name}`}>
                  <span>{formatItemName(item.name)}</span>
                  <small>{item.slot}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No item data received yet.</p>
          )}
        </div>

        <div className="overlay-section">
          <div className="section-heading">
            <h2>Enemy Heroes Seen</h2>
            <span>{matchState?.enemyHeroes?.length || 0}</span>
          </div>

          {matchState?.enemyHeroes?.length ? (
            <div className="chip-grid">
              {matchState.enemyHeroes.map((enemy) => (
                <div className="mini-chip" key={`${enemy.id}-${enemy.name}`}>
                  {formatHeroName(enemy.name)}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">
              Enemy hero data depends on the GSI payload you expose from Dota 2.
            </p>
          )}
        </div>

        <div className="overlay-section">
          <div className="section-heading">
            <h2>Live Suggestions</h2>
            <span>{results.length}</span>
          </div>

          {loading ? <Loader label="Refreshing overlay suggestions..." /> : null}

          {!loading && !results.length ? (
            <p className="empty-state">
              As soon as your hero is known, the overlay will query item suggestions.
            </p>
          ) : null}

          <div className="result-stack result-stack--compact">
            {results.map((item) => (
              <ItemCard key={`${item.itemId}-${item.itemName}`} item={item} compact />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
