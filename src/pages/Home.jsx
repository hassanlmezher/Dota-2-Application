import { Link } from "react-router-dom";

function readRecentSearches(storageKey) {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

export default function Home() {
  const recentPickSearches = readRecentSearches("dota-helper:recent-counter-searches");
  const recentItemSearches = readRecentSearches("dota-helper:recent-item-searches");

  return (
    <section className="page page-home">
      <div className="hero-banner">
        <div>
          <p className="eyebrow">Draft Faster. Buy Smarter.</p>
          <h1>Dota match prep with live overlay support.</h1>
          <p className="page-lead">
            Search counters from your Supabase matchup data, surface item responses,
            and keep a compact overlay pinned on top of the game.
          </p>
        </div>

        <div className="hero-actions">
          <Link to="/pick-assistant" className="button button-primary">
            Open Pick Assistant
          </Link>
          <Link to="/item-assistant" className="button button-secondary">
            Open Item Assistant
          </Link>
        </div>
      </div>

      <div className="dashboard-grid">
        <article className="panel feature-card">
          <span className="feature-card__badge">Counter Picks</span>
          <h2>Build your response to enemy drafts</h2>
          <p>
            Select a role, add enemy heroes, and run the `get_best_counter_picks`
            RPC to rank the strongest answers.
          </p>
          <Link to="/pick-assistant" className="button button-ghost">
            Launch draft tool
          </Link>
        </article>

        <article className="panel feature-card">
          <span className="feature-card__badge feature-card__badge--alt">Items</span>
          <h2>Turn threats into item timings</h2>
          <p>
            Pick your hero, list enemy pressure points, and translate them into item
            buys with `get_best_items_to_buy`.
          </p>
          <Link to="/item-assistant" className="button button-ghost">
            Launch item tool
          </Link>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="panel">
          <div className="section-heading">
            <h2>Recent Pick Searches</h2>
            <span>{recentPickSearches.length} saved</span>
          </div>

          {recentPickSearches.length ? (
            <div className="history-list">
              {recentPickSearches.slice(0, 5).map((entry) => (
                <div className="history-row" key={entry.id}>
                  <div>
                    <strong>{entry.roleLabel}</strong>
                    <p>{entry.enemyHeroes.join(", ")}</p>
                  </div>
                  <time>{new Date(entry.createdAt).toLocaleString()}</time>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No pick searches saved yet.</p>
          )}
        </article>

        <article className="panel">
          <div className="section-heading">
            <h2>Recent Item Searches</h2>
            <span>{recentItemSearches.length} saved</span>
          </div>

          {recentItemSearches.length ? (
            <div className="history-list">
              {recentItemSearches.slice(0, 5).map((entry) => (
                <div className="history-row" key={entry.id}>
                  <div>
                    <strong>{entry.heroName}</strong>
                    <p>{entry.enemyHeroes.join(", ") || "No enemy heroes selected"}</p>
                  </div>
                  <time>{new Date(entry.createdAt).toLocaleString()}</time>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No item searches saved yet.</p>
          )}
        </article>
      </div>
    </section>
  );
}
