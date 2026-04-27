import { getHeroCatalog } from "../api/supabaseClient";
import { normalizeHeroLookupKey } from "./formatHeroName";

const TEMPLATE_FINE_WIDTH = 32;
const TEMPLATE_FINE_HEIGHT = 18;
const TEMPLATE_COARSE_WIDTH = 12;
const TEMPLATE_COARSE_HEIGHT = 7;
const MATCH_THRESHOLD = 0.56;
const BOTTOM_MATCH_THRESHOLD = 0.52;
const HEALTH_ICON_THRESHOLD = 0.58;
const MAX_FRAME_WIDTH = 1280;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function normalizeSourceRect(image, aspectRatio = 16 / 9) {
  const sourceWidth = image.width || image.videoWidth || 0;
  const sourceHeight = image.height || image.videoHeight || 0;

  if (!sourceWidth || !sourceHeight) {
    return {
      x: 0,
      y: 0,
      width: sourceWidth,
      height: sourceHeight,
    };
  }

  const currentAspect = sourceWidth / sourceHeight;

  if (currentAspect > aspectRatio) {
    const width = Math.round(sourceHeight * aspectRatio);
    const x = Math.round((sourceWidth - width) / 2);

    return { x, y: 0, width, height: sourceHeight };
  }

  const height = Math.round(sourceWidth / aspectRatio);
  const y = Math.round((sourceHeight - height) / 2);

  return { x: 0, y, width: sourceWidth, height };
}

function extractVector(source, rect, outWidth, outHeight, scratchCanvas, scratchContext) {
  scratchCanvas.width = outWidth;
  scratchCanvas.height = outHeight;
  scratchContext.clearRect(0, 0, outWidth, outHeight);
  scratchContext.drawImage(
    source,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    outWidth,
    outHeight
  );

  const { data } = scratchContext.getImageData(0, 0, outWidth, outHeight);
  const vector = new Float32Array(outWidth * outHeight * 3);

  for (let index = 0; index < outWidth * outHeight; index += 1) {
    const sourceOffset = index * 4;
    const vectorOffset = index * 3;
    vector[vectorOffset] = data[sourceOffset] / 255;
    vector[vectorOffset + 1] = data[sourceOffset + 1] / 255;
    vector[vectorOffset + 2] = data[sourceOffset + 2] / 255;
  }

  return vector;
}

function scoreVectors(left, right) {
  if (!left || !right || left.length !== right.length) {
    return 0;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference += Math.abs(left[index] - right[index]);
  }

  return 1 - difference / left.length;
}

async function loadBitmap(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch hero image: ${url}`);
  }

  const blob = await response.blob();
  return createImageBitmap(blob);
}

async function createTemplateRecord(hero, scratchCanvas, scratchContext) {
  if (!hero.imageUrl) {
    return null;
  }

  try {
    const bitmap = await loadBitmap(hero.imageUrl);
    const sourceRect = normalizeSourceRect(bitmap);
    const fineVector = extractVector(
      bitmap,
      sourceRect,
      TEMPLATE_FINE_WIDTH,
      TEMPLATE_FINE_HEIGHT,
      scratchCanvas,
      scratchContext
    );
    const coarseVector = extractVector(
      bitmap,
      sourceRect,
      TEMPLATE_COARSE_WIDTH,
      TEMPLATE_COARSE_HEIGHT,
      scratchCanvas,
      scratchContext
    );

    const iconSquareSize = Math.min(bitmap.width, bitmap.height);
    const iconSquareRect = {
      x: Math.round((bitmap.width - iconSquareSize) / 2),
      y: Math.round((bitmap.height - iconSquareSize) / 2),
      width: iconSquareSize,
      height: iconSquareSize,
    };
    const squareVector = extractVector(
      bitmap,
      iconSquareRect,
      20,
      20,
      scratchCanvas,
      scratchContext
    );

    bitmap.close?.();

    return {
      heroId: hero.heroId,
      heroName: hero.heroName,
      imageUrl: hero.imageUrl,
      primaryAttribute: hero.primaryAttribute,
      key: normalizeHeroLookupKey(hero.heroName),
      fineVector,
      coarseVector,
      squareVector,
    };
  } catch {
    return null;
  }
}

async function loadHeroTemplates() {
  const catalog = await getHeroCatalog();
  const scratchCanvas = createCanvas(TEMPLATE_FINE_WIDTH, TEMPLATE_FINE_HEIGHT);
  const scratchContext = scratchCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  const templates = (
    await Promise.all(
      catalog.map((hero) => createTemplateRecord(hero, scratchCanvas, scratchContext))
    )
  ).filter(Boolean);

  const templateMap = new Map(templates.map((template) => [template.key, template]));

  return {
    templates,
    templateMap,
  };
}

function createFrameRuntime() {
  const frameCanvas = createCanvas(320, 180);
  const frameContext = frameCanvas.getContext("2d", { willReadFrequently: true });
  const scratchCanvas = createCanvas(TEMPLATE_FINE_WIDTH, TEMPLATE_FINE_HEIGHT);
  const scratchContext = scratchCanvas.getContext("2d", { willReadFrequently: true });

  return {
    frameCanvas,
    frameContext,
    scratchCanvas,
    scratchContext,
    latestEnemyIconVectors: new Map(),
  };
}

function scaleVideoFrame(runtime, videoElement) {
  const sourceWidth = videoElement.videoWidth;
  const sourceHeight = videoElement.videoHeight;

  if (!sourceWidth || !sourceHeight) {
    return null;
  }

  const width = sourceWidth > MAX_FRAME_WIDTH ? MAX_FRAME_WIDTH : sourceWidth;
  const height = Math.round((sourceHeight / sourceWidth) * width);

  runtime.frameCanvas.width = width;
  runtime.frameCanvas.height = height;
  runtime.frameContext.drawImage(videoElement, 0, 0, width, height);

  return {
    width,
    height,
  };
}

function buildTopBarLayouts(width, height) {
  const centerX = width / 2;
  const scales = [0.034, 0.0375];
  const yScales = [0.0, 0.006];
  const centerGapScales = [0.019, 0.027];
  const gapScales = [0.0025, 0.004];
  const layouts = [];

  for (const scale of scales) {
    const slotWidth = clamp(Math.round(width * scale), 42, 86);
    const slotHeight = Math.round(slotWidth * (9 / 16));

    for (const yScale of yScales) {
      const y = Math.round(height * yScale);

      for (const centerGapScale of centerGapScales) {
        for (const gapScale of gapScales) {
          const gap = Math.round(width * gapScale);
          const centerGap = Math.round(width * centerGapScale);
          const allyStartX = Math.round(centerX - centerGap - (slotWidth * 5 + gap * 4));
          const enemyStartX = Math.round(centerX + centerGap);

          layouts.push({
            slotWidth,
            slotHeight,
            gap,
            y,
            allyStartX,
            enemyStartX,
          });
        }
      }
    }
  }

  return layouts;
}

function buildTopBarSlotRects(layout) {
  const allies = Array.from({ length: 5 }, (_, index) => ({
    x: layout.allyStartX + index * (layout.slotWidth + layout.gap),
    y: layout.y,
    width: layout.slotWidth,
    height: layout.slotHeight,
  }));
  const enemies = Array.from({ length: 5 }, (_, index) => ({
    x: layout.enemyStartX + index * (layout.slotWidth + layout.gap),
    y: layout.y,
    width: layout.slotWidth,
    height: layout.slotHeight,
  }));

  return { allies, enemies };
}

function bestHeroMatch(vector, templates, variant = "coarse") {
  let bestMatch = null;
  let bestScore = 0;

  for (const template of templates) {
    const score = scoreVectors(
      vector,
      variant === "coarse" ? template.coarseVector : template.fineVector
    );

    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
    }
  }

  return {
    template: bestMatch,
    score: bestScore,
  };
}

function evaluateLayout(runtime, templateRuntime, layout) {
  const slotRects = buildTopBarSlotRects(layout);
  let totalScore = 0;
  let validMatches = 0;

  for (const rect of [...slotRects.allies, ...slotRects.enemies]) {
    const vector = extractVector(
      runtime.frameCanvas,
      rect,
      TEMPLATE_COARSE_WIDTH,
      TEMPLATE_COARSE_HEIGHT,
      runtime.scratchCanvas,
      runtime.scratchContext
    );
    const match = bestHeroMatch(vector, templateRuntime.templates, "coarse");
    totalScore += match.score;

    if (match.score > 0.46) {
      validMatches += 1;
    }
  }

  return {
    averageScore: totalScore / 10,
    validMatches,
    layout,
  };
}

function detectTopBarHeroes(runtime, templateRuntime, previousState = null) {
  const layouts = buildTopBarLayouts(
    runtime.frameCanvas.width,
    runtime.frameCanvas.height
  );
  let bestLayoutResult = null;

  for (const layout of layouts) {
    const candidate = evaluateLayout(runtime, templateRuntime, layout);

    if (
      !bestLayoutResult ||
      candidate.validMatches > bestLayoutResult.validMatches ||
      (candidate.validMatches === bestLayoutResult.validMatches &&
        candidate.averageScore > bestLayoutResult.averageScore)
    ) {
      bestLayoutResult = candidate;
    }
  }

  if (!bestLayoutResult || bestLayoutResult.validMatches < 4) {
    return previousState || { allies: [], enemies: [], confidence: 0 };
  }

  const slotRects = buildTopBarSlotRects(bestLayoutResult.layout);

  function mapRow(rects) {
    const rowMatches = [];
    const used = new Set();

    for (const rect of rects) {
      const vector = extractVector(
        runtime.frameCanvas,
        rect,
        TEMPLATE_FINE_WIDTH,
        TEMPLATE_FINE_HEIGHT,
        runtime.scratchCanvas,
        runtime.scratchContext
      );

      let bestMatch = null;
      let bestScore = 0;

      for (const template of templateRuntime.templates) {
        const templateKey = template.key;

        if (used.has(templateKey)) {
          continue;
        }

        const score = scoreVectors(vector, template.fineVector);

        if (score > bestScore) {
          bestScore = score;
          bestMatch = template;
        }
      }

      if (bestMatch && bestScore >= MATCH_THRESHOLD) {
        used.add(bestMatch.key);
        rowMatches.push({
          ...bestMatch,
          score: bestScore,
          rect,
          iconVector: extractVector(
            runtime.frameCanvas,
            {
              x: rect.x,
              y: rect.y,
              width: rect.height,
              height: rect.height,
            },
            20,
            20,
            runtime.scratchCanvas,
            runtime.scratchContext
          ),
        });
      }
    }

    return rowMatches;
  }

  const allies = mapRow(slotRects.allies);
  const enemies = mapRow(slotRects.enemies);

  return {
    allies,
    enemies,
    confidence: bestLayoutResult.averageScore,
  };
}

function getBottomHudCandidateRects(width, height) {
  return [
    {
      x: Math.round(width * 0.2),
      y: Math.round(height * 0.765),
      width: Math.round(width * 0.145),
      height: Math.round(height * 0.12),
    },
    {
      x: Math.round(width * 0.19),
      y: Math.round(height * 0.74),
      width: Math.round(width * 0.17),
      height: Math.round(height * 0.15),
    },
    {
      x: Math.round(width * 0.18),
      y: Math.round(height * 0.725),
      width: Math.round(width * 0.19),
      height: Math.round(height * 0.17),
    },
  ];
}

function detectFocusHero(runtime, detectedHeroes, templateRuntime) {
  const width = runtime.frameCanvas.width;
  const height = runtime.frameCanvas.height;
  const candidateRects = getBottomHudCandidateRects(width, height);
  const topBarCandidates = [
    ...detectedHeroes.allies.map((hero) => ({ ...hero, side: "ally" })),
    ...detectedHeroes.enemies.map((hero) => ({ ...hero, side: "enemy" })),
  ];

  let bestHero = null;
  let bestScore = 0;

  for (const rect of candidateRects) {
    const vector = extractVector(
      runtime.frameCanvas,
      rect,
      TEMPLATE_FINE_WIDTH,
      TEMPLATE_FINE_HEIGHT,
      runtime.scratchCanvas,
      runtime.scratchContext
    );

    for (const hero of topBarCandidates) {
      const template = templateRuntime.templateMap.get(hero.key);

      if (!template) {
        continue;
      }

      const score = scoreVectors(vector, template.fineVector);

      if (score > bestScore) {
        bestScore = score;
        bestHero = {
          heroId: template.heroId,
          heroName: template.heroName,
          imageUrl: template.imageUrl,
          key: template.key,
          side: hero.side,
        };
      }
    }
  }

  if (bestHero && bestScore >= BOTTOM_MATCH_THRESHOLD) {
    return {
      ...bestHero,
      score: bestScore,
    };
  }

  for (const rect of candidateRects) {
    const vector = extractVector(
      runtime.frameCanvas,
      rect,
      TEMPLATE_FINE_WIDTH,
      TEMPLATE_FINE_HEIGHT,
      runtime.scratchCanvas,
      runtime.scratchContext
    );

    for (const template of templateRuntime.templates) {
      const score = scoreVectors(vector, template.fineVector);

      if (score > bestScore) {
        bestScore = score;
        bestHero = {
          heroId: template.heroId,
          heroName: template.heroName,
          imageUrl: template.imageUrl,
          key: template.key,
          side: null,
        };
      }
    }
  }

  if (bestHero && bestScore >= BOTTOM_MATCH_THRESHOLD) {
    return {
      ...bestHero,
      score: bestScore,
    };
  }

  return {
    heroId: null,
    heroName: "",
    imageUrl: null,
    key: "",
    side: null,
    score: 0,
  };
}

function colorAt(imageData, width, x, y) {
  const offset = (y * width + x) * 4;
  return {
    r: imageData[offset],
    g: imageData[offset + 1],
    b: imageData[offset + 2],
    a: imageData[offset + 3],
  };
}

function isEnemyBarPixel({ r, g, b, a }) {
  if (a < 200) {
    return false;
  }

  return r > 120 && g > 32 && g < 180 && b < 120 && r > g;
}

function isDarkPixel({ r, g, b }) {
  return r < 60 && g < 60 && b < 60;
}

function findHealthBarCandidates(runtime) {
  const width = runtime.frameCanvas.width;
  const height = runtime.frameCanvas.height;
  const imageData = runtime.frameContext.getImageData(0, 0, width, height).data;
  const candidates = [];
  const seen = [];
  const topBoundary = Math.round(height * 0.13);
  const bottomBoundary = Math.round(height * 0.72);

  for (let y = topBoundary; y < bottomBoundary; y += 4) {
    for (let x = 40; x < width - 140; x += 4) {
      const pixel = colorAt(imageData, width, x, y);

      if (!isEnemyBarPixel(pixel)) {
        continue;
      }

      let endX = x;

      while (endX < width - 40 && isEnemyBarPixel(colorAt(imageData, width, endX, y))) {
        endX += 1;
      }

      const barWidth = endX - x;

      if (barWidth < 36 || barWidth > 220) {
        x = endX;
        continue;
      }

      const above = colorAt(imageData, width, x + Math.floor(barWidth / 2), Math.max(y - 2, 0));
      const below = colorAt(
        imageData,
        width,
        x + Math.floor(barWidth / 2),
        Math.min(y + 5, height - 1)
      );

      if (!isDarkPixel(above) && !isDarkPixel(below)) {
        x = endX;
        continue;
      }

      const iconSize = clamp(Math.round(barWidth * 0.32), 16, 30);
      const iconRect = {
        x: clamp(x - iconSize - 6, 0, width - iconSize),
        y: clamp(y - Math.round(iconSize * 0.35), 0, height - iconSize),
        width: iconSize,
        height: iconSize,
      };

      const duplicate = seen.some(
        (entry) => Math.abs(entry.x - x) < 18 && Math.abs(entry.y - y) < 14
      );

      if (!duplicate) {
        seen.push({ x, y });
        candidates.push({
          x,
          y,
          width: barWidth,
          height: 8,
          iconRect,
        });
      }

      x = endX;
    }
  }

  return candidates;
}

function computeHealthPercent(runtime, candidate) {
  const width = runtime.frameCanvas.width;
  const imageData = runtime.frameContext.getImageData(
    candidate.x,
    candidate.y,
    candidate.width,
    candidate.height
  ).data;
  let lastFilledColumn = 0;

  for (let x = 0; x < candidate.width; x += 1) {
    for (let y = 0; y < candidate.height; y += 1) {
      const offset = (y * candidate.width + x) * 4;
      const pixel = {
        r: imageData[offset],
        g: imageData[offset + 1],
        b: imageData[offset + 2],
        a: imageData[offset + 3],
      };

      if (isEnemyBarPixel(pixel)) {
        lastFilledColumn = x + 1;
        break;
      }
    }
  }

  return clamp(Math.round((lastFilledColumn / candidate.width) * 100), 1, 100);
}

function detectVisibleEnemyHealth(runtime, enemies, previousHealthMap = {}) {
  if (!enemies.length) {
    return previousHealthMap;
  }

  const nextHealthMap = { ...previousHealthMap };
  const candidates = findHealthBarCandidates(runtime);

  for (const candidate of candidates) {
    const iconVector = extractVector(
      runtime.frameCanvas,
      candidate.iconRect,
      20,
      20,
      runtime.scratchCanvas,
      runtime.scratchContext
    );

    let bestEnemy = null;
    let bestScore = 0;

    for (const enemy of enemies) {
      if (!enemy.iconVector) {
        continue;
      }

      const score = scoreVectors(iconVector, enemy.iconVector);

      if (score > bestScore) {
        bestScore = score;
        bestEnemy = enemy;
      }
    }

    if (bestEnemy && bestScore >= HEALTH_ICON_THRESHOLD) {
      nextHealthMap[bestEnemy.heroName] = computeHealthPercent(runtime, candidate);
    }
  }

  return nextHealthMap;
}

function buildScreenState({
  previousState,
  detectedHeroes,
  focusHero,
  enemyHealthMap,
}) {
  const focusSide =
    focusHero?.side ||
    previousState?._analysisCache?.focusHero?.side ||
    previousState?._analysisCache?.resolvedFocusSide ||
    null;
  const enemySourceHeroes = focusSide === "enemy" ? detectedHeroes.allies : detectedHeroes.enemies;
  const enemyHeroes = enemySourceHeroes.map((hero) => ({
    key: hero.key,
    heroId: hero.heroId,
    heroName: hero.heroName,
    imageUrl: hero.imageUrl,
    healthPercent:
      enemyHealthMap[hero.heroName] ??
      previousState?.enemyHealthMap?.[hero.heroName] ??
      100,
    currentHealth: null,
    maxHealth: null,
  }));
  const visibleEnemyHealth = Object.keys(enemyHealthMap || {}).length;
  const totalDetectedHeroes = detectedHeroes.allies.length + detectedHeroes.enemies.length;
  const hasLiveFocus = Boolean(focusHero?.heroName);
  const phase =
    hasLiveFocus || visibleEnemyHealth || (previousState?.phase === "match" && totalDetectedHeroes >= 6)
      ? "match"
      : enemyHeroes.length
        ? "draft"
        : "idle";
  const audienceMode = hasLiveFocus ? "player" : enemyHeroes.length ? "spectator" : "idle";
  const mergedHealthMap = Object.fromEntries(
    enemyHeroes.map((hero) => [hero.heroName, hero.healthPercent ?? 100])
  );

  return {
    rawPayload: null,
    receivedAt: new Date().toISOString(),
    packetCount: 0,
    matchId: null,
    phase,
    gameState: "",
    mapStateLabel:
      phase === "draft"
        ? "Draft detected"
        : phase === "match"
          ? "Live screen capture"
          : "Waiting for screen capture",
    clockLabel: phase === "match" ? "Live" : "--:--",
    myHeroName: focusHero?.heroName || previousState?.myHeroName || "",
    myItemNames: [],
    localTeam: focusSide === "enemy" ? "Dire" : focusHero?.heroName ? "Radiant" : null,
    audienceMode,
    feedScope: "screen",
    enemyHeroes,
    enemyHeroNames: enemyHeroes.map((hero) => hero.heroName),
    enemyHealthList: enemyHeroes,
    enemyHealthMap: mergedHealthMap,
    enemyItemNames: [],
    hasAnyLiveContext: Boolean(enemyHeroes.length || focusHero?.heroName),
  };
}

function analyzeCapturedFrame(runtime, templateRuntime, videoElement, previousState = null) {
  const scaledFrame = scaleVideoFrame(runtime, videoElement);

  if (!scaledFrame) {
    return previousState || null;
  }

  const detectedHeroes = detectTopBarHeroes(
    runtime,
    templateRuntime,
    previousState?._analysisCache?.detectedHeroes || null
  );
  const focusHero = detectFocusHero(runtime, detectedHeroes, templateRuntime);
  const enemyHealthMap = detectVisibleEnemyHealth(
    runtime,
    focusHero?.side === "enemy" ? detectedHeroes.allies : detectedHeroes.enemies,
    previousState?.enemyHealthMap || {}
  );
  const nextState = buildScreenState({
    previousState,
    detectedHeroes,
    focusHero,
    enemyHealthMap,
  });

  return {
    ...nextState,
    _analysisCache: {
      detectedHeroes,
      focusHero,
      resolvedFocusSide: focusHero?.side || null,
    },
  };
}

export {
  analyzeCapturedFrame,
  createFrameRuntime,
  loadHeroTemplates,
};
