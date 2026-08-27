import { ensureUser, getUser, transferXP } from '../utils/db.js';
import { COLORS, xpEmbed } from '../utils/embeds.js';
import { deferredResponse, ephemeralResponse, patchOriginal } from '../utils/discord.js';

export async function execute(interaction, env, ctx) {
    const options = interaction.data.options || [];
    const targetUserId = options.find(o => o.name === 'user').value;
    const amount = options.find(o => o.name === 'amount').value;
    const senderId = interaction.member.user.id;
    
    if (amount < 1) {
        return ephemeralResponse({ content: "Amount must be at least 1 XP." });
    }
    if (senderId === targetUserId) {
        return ephemeralResponse({ content: "You cannot transfer XP to yourself." });
    }
    
    ctx.waitUntil((async () => {
        await ensureUser(env.astralyx_xp, senderId);
        await ensureUser(env.astralyx_xp, targetUserId);
        
        const sender = await getUser(env.astralyx_xp, senderId);
        if (sender.xp < amount) {
            const embed = xpEmbed('Transfer Failed', `You don't have enough XP. You only have ${sender.xp} XP.`, COLORS.error);
            return patchOriginal(interaction.application_id, interaction.token, { embeds: [embed] });
        }
        
        await transferXP(env.astralyx_xp, senderId, targetUserId, amount);
        
        const embed = xpEmbed('XP Transferred', `Successfully transferred **${amount} XP** to <@${targetUserId}>!`, COLORS.success);
        await patchOriginal(interaction.application_id, interaction.token, { embeds: [embed] });
    })());
    
    return deferredResponse();
}
