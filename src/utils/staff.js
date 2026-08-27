/**
 * Staff role IDs from the AstralyxPvP Discord server.
 * Only Mod and above have staff privileges for XP commands.
 */
export const STAFF_ROLE_IDS = new Set([
  '1477025238784151554', // Owner
  '1477291491003994214', // Co-Owner
  '1502815102716608552', // Chief Manager
  '1497335106074050620', // Sr. Manager
  '1483209618485284964', // Manager
  '1497316294632931358', // Developer
  '1497316250945323070', // Admin
  '1497316120452136960', // Sr. Mod
  '1477025502119334109', // Mod
]);

/**
 * Check if a user has any staff role.
 * @param {string[]} roleIds - Array of role IDs from the interaction payload
 */
export function isStaff(roleIds) {
  if (!roleIds || !Array.isArray(roleIds)) return false;
  return roleIds.some((id) => STAFF_ROLE_IDS.has(id));
}
