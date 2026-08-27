/**
 * XP thresholds for levels 0–50.
 * Index = level, value = cumulative XP required.
 */
export const XP_THRESHOLDS = [
  0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500,
  5500, 6600, 7800, 9100, 10500, 12000, 13600, 15300, 17100, 19000,
  21000, 23100, 25300, 27600, 30000, 32500, 35100, 37800, 40600, 43500,
  46500, 49600, 52800, 56100, 59500, 63000, 66600, 70300, 74100, 78000,
  82000, 86100, 90300, 94600, 99000, 103500, 108100, 112800, 117600, 122500,
  127500,
];

export const MAX_LEVEL = 50;

/**
 * Returns the current level for a given XP amount.
 */
export function getLevel(xp) {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) return i;
  }
  return 0;
}

/**
 * Returns detailed progress info for a given XP amount.
 */
export function getProgress(xp) {
  const level = getLevel(xp);
  const currentThreshold = XP_THRESHOLDS[level];
  const nextThreshold = level < MAX_LEVEL ? XP_THRESHOLDS[level + 1] : null;

  if (nextThreshold === null) {
    return { level, xp, currentThreshold, nextThreshold: null, xpIntoLevel: 0, xpNeeded: 0, progress: 1 };
  }

  const xpIntoLevel = xp - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  const progress = xpIntoLevel / xpNeeded;

  return { level, xp, currentThreshold, nextThreshold, xpIntoLevel, xpNeeded, progress };
}

/**
 * Checks if XP change caused a level-up and returns the new level, or null.
 */
export function checkLevelUp(oldXP, newXP) {
  const oldLevel = getLevel(oldXP);
  const newLevel = getLevel(newXP);
  if (newLevel > oldLevel) {
    return { oldLevel, newLevel };
  }
  return null;
}
