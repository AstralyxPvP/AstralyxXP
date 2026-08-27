/**
 * Staff role IDs from the AstralyxPvP Discord server.
 * These are the admin-and-above roles sourced from the forums ROLE_MAP.
 */
export const STAFF_ROLE_IDS = new Set([
  '1477025238784151554', // Owner
  '1477291491003994214', // Co-Owner
  '1502815102716608552', // Chief Manager
  '1497335106074050620', // Sr. Manager
  '1483209618485284964', // Manager
  '1529483674817532066', // Sr. Developer
  '1497316294632931358', // Developer
  '1530947152900259930', // Jr. Developer
  '1497316250945323070', // Admin
  '1497316120452136960', // Sr. Mod
  '1477025502119334109', // Mod
  '1497316057214484735', // Jr. Mod
  '1477025528174219476', // Helper
  '1501217374102229185', // Trial
]);

/**
 * Check if a user has any staff role.
 * @param {string[]} roleIds - Array of role IDs from the interaction payload
 */
export function isStaff(roleIds) {
  if (!roleIds || !Array.isArray(roleIds)) return false;
  return roleIds.some((id) => STAFF_ROLE_IDS.has(id));
}
