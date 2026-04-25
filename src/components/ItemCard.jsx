import { getScoreLabel, getScorePercentage } from "../utils/scoreCalculator";
import { formatItemName } from "../utils/formatItemName";

export default function ItemCard({ item }) {
  const scorePercent = getScorePercentage(item.score);
  const itemName = formatItemName(item.itemName || "Unknown Item");

  return (
    <article className="intel-item-card">
      <div className="intel-item-card__media">
        <div className="intel-avatar">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={itemName} className="intel-avatar__image" />
          ) : (
            <span className="intel-avatar__fallback">{itemName.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
      </div>

      <div className="intel-item-card__body">
        <div className="intel-item-card__top">
          <div>
            <h4>{itemName}</h4>
            <p>{item.category || "utility"}</p>
          </div>
          <strong>{scorePercent}%</strong>
        </div>

        <p className="intel-item-card__reason">
          {item.reason || getScoreLabel(item.score)}
        </p>
      </div>
    </article>
  );
}
