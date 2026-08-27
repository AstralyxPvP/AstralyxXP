import { ensureUser, setXP, getUser } from '../utils/db.js';
import { checkLevelUp } from '../utils/levels.js';
import { isStaff } from '../utils/staff.js';
import { COLORS, xpEmbed } from '../utils/embeds.js';
import { deferredResponse, ephemeralResponse, patchOriginal } from '../utils/discord.js';

export async function execute(interaction, env, ctx) {
    if (!isStaff(interaction.member.roles)) {
        return ephemeralResponse({ content: "You do not have permission to use this command." });
    }

    const options = interaction.data.options || [];
    const targetUserId = options.find(o => o.name === 'user').value;
    let amount = options.find(o => o.name === 'amount').value;
    amount = Math.max(0, amount);
    
    ctx.waitUntil((async () => {
        await ensureUser(env.astralyx_xp, targetUserId);
        const user = await getUser(env.astralyx_xp, targetUserId);
        const oldXp = user.xp;
        
        await setXP(env.astralyx_xp, targetUserId, amount);
        await checkLevelUp(env.astralyx_xp, targetUserId, oldXp, amount);
        
        const embed = xpEmbed('XP Set', `Set XP for <@${targetUserId}> from **${oldXp}** to **${amount}**!`, COLORS.success);
        await patchOriginal(interaction.application_id, interaction.token, { embeds: [embed] });
    })());
    
    return deferredResponse();
}
