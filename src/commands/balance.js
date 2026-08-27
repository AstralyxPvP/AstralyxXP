import { ensureUser, getUser, getLinkedAccount } from '../utils/db.js';
import { getLevel, getProgress, XP_THRESHOLDS, MAX_LEVEL } from '../utils/levels.js';
import { COLORS, progressBar, xpEmbed } from '../utils/embeds.js';
import { deferredResponse, patchOriginal } from '../utils/discord.js';

export async function execute(interaction, env, ctx) {
    const options = interaction.data.options || [];
    const userOption = options.find(o => o.name === 'user');
    const targetUserId = userOption ? userOption.value : interaction.member.user.id;
    
    ctx.waitUntil((async () => {
        try {
            await ensureUser(env.astralyx_xp, targetUserId);
            const user = await getUser(env.astralyx_xp, targetUserId);
            const linkedAccount = await getLinkedAccount(env.astralyx_xp, targetUserId);
            
            const currentXP = user.xp;
            const { level, nextThreshold, xpIntoLevel, xpNeeded, progress } = getProgress(currentXP);
            
            const bar = progressBar(xpIntoLevel, xpNeeded);
            
            let description = `**Level:** ${level}\n**XP:** ${currentXP}`;
            if (nextThreshold === null) {
                description += `\n\n${bar} 100%\n*Max level reached!*`;
            } else {
                description += ` / ${nextThreshold}\n\n${bar} ${Math.floor(progress * 100)}%\n*Need ${xpNeeded - xpIntoLevel} more XP to level up!*`;
            }
            
            const embed = xpEmbed('Balance', description, COLORS.info);
            if (linkedAccount) {
                embed.footer = { text: `Linked Account: ${linkedAccount.minecraft_name}` };
            }
            
            await patchOriginal(interaction.application_id, interaction.token, {
                embeds: [embed]
            });
        } catch (e) {
            console.error(e);
            await patchOriginal(interaction.application_id, interaction.token, { content: "Something went wrong." });
        }
    })());
    
    return deferredResponse();
}
