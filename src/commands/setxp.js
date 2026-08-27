import { ensureUser, setXP, getUser } from '../utils/db.js';
import { checkLevelUp } from '../utils/levels.js';
import { isStaff } from '../utils/staff.js';
import { COLORS, xpEmbed } from '../utils/embeds.js';
import { deferredResponse, ephemeralResponse, patchOriginal } from '../utils/discord.js';

export async function execute(interaction, env, ctx) {
    if (!isStaff(interaction.member.roles)) {
        return ephemeralResponse("You do not have permission to use this command.");
    }

    const options = interaction.data.options || [];
    const targetUserId = options.find(o => o.name === 'user').value;
    let amount = options.find(o => o.name === 'amount').value;
    amount = Math.max(0, amount);
    
    ctx.waitUntil((async () => {
        try {
            await ensureUser(env.astralyx_xp, targetUserId);
            const user = await getUser(env.astralyx_xp, targetUserId);
            const oldXp = user.xp;
            
            await setXP(env.astralyx_xp, targetUserId, amount);
            const levelUpResult = checkLevelUp(oldXp, amount);
            
            let desc = `Set XP for <@${targetUserId}> from **${oldXp}** to **${amount}**!`;
            if (levelUpResult && levelUpResult.newLevel > levelUpResult.oldLevel) {
                desc += `\nThey leveled up to **${levelUpResult.newLevel}**! 🎉`;
            } else if (levelUpResult && levelUpResult.newLevel < levelUpResult.oldLevel) {
                desc += `\nThey leveled down to **${levelUpResult.newLevel}** 😔`;
            }

            const embed = xpEmbed('XP Set', desc, [], COLORS.STAFF);
            await patchOriginal(interaction.application_id, interaction.token, { embeds: [embed] });
        } catch (e) {
            console.error(e);
            await patchOriginal(interaction.application_id, interaction.token, { content: "Something went wrong." });
        }
    })());
    
    return deferredResponse();
}
