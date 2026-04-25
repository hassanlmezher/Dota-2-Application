import { getScoreLabel, getScorePercentage } from "../utils/scoreCalculator";
import { formatHeroName } from "../utils/formatHeroName";

export default function HeroCard({ hero }) {
  const scorePercent = getScorePercentage(hero.score);

  return (
    <article className="card result-card">
      <div className="result-card__media">
        {hero.imageUrl ? (
          <img src={hero.imageUrl} alt={hero.heroName} />
        ) : (
          <div className="result-card__fallback">{hero.heroName.slice(0, 2)}</div>
        )}
      </div>

      <div className="result-card__body">
        <div className="result-card__header">
          <div>
            <h3>{formatHeroName(hero.heroName)}</h3>
            <p>{hero.primaryAttribute || "Flex counter option"}</p>
          </div>
          <strong>{getScoreLabel(hero.score)}</strong>
        </div>

        <div className="scorebar">
          <span style={{ width: `${scorePercent}%` }} />
        </div>

        <p className="result-card__reason">{hero.reason}</p>
      </div>
    </article>
  );
}
