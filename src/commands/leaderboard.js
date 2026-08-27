import { getLeaderboard } from '../utils/db.js';
import { getLevel } from '../utils/levels.js';
import { COLORS, xpEmbed } from '../utils/embeds.js';
import { deferredResponse, patchOriginal } from '../utils/discord.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export async function execute(interaction, env, ctx) {
    const options = interaction.data.options || [];
    const countOpt = options.find(o => o.name === 'count');
    const count = countOpt ? Math.min(Math.max(countOpt.value, 1), 25) : 10;
    
    ctx.waitUntil((async () => {
        try {
            const topUsers = await getLeaderboard(env.astralyx_xp, count);
            let desc = '';
            
            for (let i = 0; i < topUsers.length; i++) {
                const user = topUsers[i];
                const level = getLevel(user.xp);
                const medal = i < 3 ? MEDALS[i] : `**${i + 1}.**`;
                const highlight = user.discord_id === interaction.member.user.id ? ' **(You)**' : '';
                desc += `${medal} <@${user.discord_id}>${highlight} - Level ${level} (${user.xp} XP)\n`;
            }
            
            if (topUsers.length === 0) {
                desc = "The leaderboard is currently empty.";
            }
            
            const embed = xpEmbed('🏆 XP Leaderboard', desc, [], COLORS.INFO);
            await patchOriginal(interaction.application_id, interaction.token, { embeds: [embed] });
        } catch (e) {
            console.error(e);
            await patchOriginal(interaction.application_id, interaction.token, { content: "Something went wrong." });
        }
    })());
    
    return deferredResponse();
}
