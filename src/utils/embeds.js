/**
 * Embed color constants and helper builders.
 */

export const COLORS = {
  XP_GOLD: 0xffc107,
  SUCCESS: 0x2ecc71,
  ERROR: 0xe74c3c,
  INFO: 0x3498db,
  LEVEL_UP: 0x9b59b6,
  GAMBLING: 0xe67e22,
  MINIGAME: 0x1abc9c,
  STAFF: 0xf39c12,
};

/**
 * Generate a visual progress bar.
 * @param {number} current - Current value
 * @param {number} max - Maximum value
 * @param {number} length - Bar length in characters (default 10)
 */
export function progressBar(current, max, length = 10) {
  if (max <= 0) return '██████████';
  const filled = Math.round((current / max) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Build a standardised embed object.
 */
export function xpEmbed(title, description, fields = [], color = COLORS.XP_GOLD) {
  return {
    title,
    description,
    fields,
    color,
    timestamp: new Date().toISOString(),
    footer: { text: 'AstralyxXP • Grind & Rise' },
  };
}

/**
 * Quick error embed (ephemeral-style content).
 */
export function errorEmbed(message) {
  return xpEmbed('❌ Error', message, [], COLORS.ERROR);
}

/**
 * Format a number with commas (e.g. 12,500).
 */
export function formatNumber(n) {
  return n.toLocaleString('en-US');
}
