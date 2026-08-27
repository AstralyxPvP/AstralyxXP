import { ensureUser, addXP, getUser } from '../utils/db.js';
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
    const amount = options.find(o => o.name === 'amount').value;
    
    ctx.waitUntil((async () => {
        try {
            await ensureUser(env.astralyx_xp, targetUserId);
            const user = await getUser(env.astralyx_xp, targetUserId);
            const oldXp = user.xp;
            
            await addXP(env.astralyx_xp, targetUserId, amount);
            const newXp = oldXp + amount;
            const levelUpResult = checkLevelUp(oldXp, newXp);
            
            let desc = `Added **${amount} XP** to <@${targetUserId}>. New balance: **${newXp}**`;
            if (levelUpResult) {
                desc += `\nThey leveled up to **${levelUpResult.newLevel}**! 🎉`;
            }

            const embed = xpEmbed('XP Added', desc, [], COLORS.STAFF);
            await patchOriginal(interaction.application_id, interaction.token, { embeds: [embed] });
        } catch (e) {
            console.error(e);
            await patchOriginal(interaction.application_id, interaction.token, { content: "Something went wrong." });
        }
    })());
    
    return deferredResponse();
}
