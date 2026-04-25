import { getScoreLabel, getScorePercentage } from "../utils/scoreCalculator";
import { formatHeroName } from "../utils/formatHeroName";

export default function HeroCard({ hero, compact = false }) {
  const scorePercent = getScorePercentage(hero.score);
  const heroName = formatHeroName(hero.heroName || "Unknown Hero");

  return (
    <article className={`intel-suggestion ${compact ? "intel-suggestion--compact" : ""}`}>
      <div className="intel-suggestion__hero">
        <div className="intel-avatar">
          {hero.imageUrl ? (
            <img src={hero.imageUrl} alt={heroName} className="intel-avatar__image" />
          ) : (
            <span className="intel-avatar__fallback">{heroName.slice(0, 2).toUpperCase()}</span>
          )}
        </div>

        <div>
          <h4>{heroName}</h4>
          <p>{hero.reason || hero.primaryAttribute || "Counter pick option"}</p>
        </div>
      </div>

      <div className="intel-suggestion__score">
        <span>{getScoreLabel(hero.score)}</span>
        <strong>{scorePercent}%</strong>
      </div>
    </article>
  );
}
