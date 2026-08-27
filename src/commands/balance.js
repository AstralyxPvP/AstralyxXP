import { ensureUser, getUser, getLinkedAccount } from '../utils/db.js';
import { getLevel, getProgress, XP_THRESHOLDS, MAX_LEVEL } from '../utils/levels.js';
import { COLORS, progressBar, xpEmbed } from '../utils/embeds.js';
import { deferredResponse, patchOriginal } from '../utils/discord.js';

export async function execute(interaction, env, ctx) {
    const options = interaction.data.options || [];
    const userOption = options.find(o => o.name === 'user');
    const targetUserId = userOption ? userOption.value : interaction.member.user.id;
    
    ctx.waitUntil((async () => {
        await ensureUser(env.astralyx_xp, targetUserId);
        const user = await getUser(env.astralyx_xp, targetUserId);
        const linkedAccount = await getLinkedAccount(env.astralyx_xp, targetUserId);
        
        const currentXP = user.xp;
        const level = getLevel(currentXP);
        const nextLevelXP = level < MAX_LEVEL ? XP_THRESHOLDS[level] : currentXP;
        
        const { progressPercent } = getProgress(currentXP);
        const bar = progressBar(progressPercent);
        
        let description = `**Level:** ${level}\n**XP:** ${currentXP}`;
        if (level < MAX_LEVEL) {
            description += ` / ${nextLevelXP}\n\n${bar} ${Math.floor(progressPercent * 100)}%\n*Need ${nextLevelXP - currentXP} more XP to level up!*`;
        } else {
            description += `\n\n${bar} 100%\n*Max level reached!*`;
        }
        
        const embed = xpEmbed('Balance', description, COLORS.info);
        if (linkedAccount) {
            embed.footer = { text: `Linked Account: ${linkedAccount}` };
        }
        
        await patchOriginal(interaction.application_id, interaction.token, {
            embeds: [embed]
        });
    })());
    
    return deferredResponse();
}
