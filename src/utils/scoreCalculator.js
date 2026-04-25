function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getScorePercentage(score) {
  if (!Number.isFinite(score)) {
    return 0;
  }

  if (score <= 1 && score >= 0) {
    return clamp(Math.round(score * 100), 0, 100);
  }

  return clamp(Math.round(score), 0, 100);
}

function getScoreLabel(score) {
  const percentage = getScorePercentage(score);

  if (percentage >= 80) {
    return `${percentage}% elite`;
  }

  if (percentage >= 60) {
    return `${percentage}% strong`;
  }

  if (percentage >= 40) {
    return `${percentage}% playable`;
  }

  return `${percentage}% niche`;
}

export { getScoreLabel, getScorePercentage };
