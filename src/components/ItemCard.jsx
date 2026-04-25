import { getScoreLabel, getScorePercentage } from "../utils/scoreCalculator";
import { formatItemName } from "../utils/formatItemName";

export default function ItemCard({ item, compact = false }) {
  const scorePercent = getScorePercentage(item.score);

  return (
    <article className={`card result-card ${compact ? "result-card--compact" : ""}`}>
      <div className="result-card__media">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.itemName} />
        ) : (
          <div className="result-card__fallback">{item.itemName.slice(0, 2)}</div>
        )}
      </div>

      <div className="result-card__body">
        <div className="result-card__header">
          <div>
            <h3>{formatItemName(item.itemName)}</h3>
            <p>{item.category || "utility"}</p>
          </div>
          <strong>{getScoreLabel(item.score)}</strong>
        </div>

        <div className="scorebar">
          <span style={{ width: `${scorePercent}%` }} />
        </div>

        <p className="result-card__reason">{item.reason}</p>
      </div>
    </article>
  );
}
