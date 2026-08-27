import { isStaff } from '../utils/staff.js';
import { deferredResponse, ephemeralResponse, patchOriginal } from '../utils/discord.js';
import { COLORS, xpEmbed } from '../utils/embeds.js';

const GAMES = ['raining_xp', 'guess', 'fallen_xp', 'ladders', 'luck_duck'];

export async function execute(interaction, env, ctx) {
    if (!isStaff(interaction.member.roles)) {
        return ephemeralResponse({ content: "You do not have permission to use this command." });
    }
    
    ctx.waitUntil((async () => {
        try {
            const gameType = GAMES[Math.floor(Math.random() * GAMES.length)];
            const xpReward = Math.floor(Math.random() * 41) + 10; // 10 to 50
            const sessionId = crypto.randomUUID();
            
            await env.astralyx_xp.prepare(`
                INSERT INTO minigame_sessions (id, game_type, xp_reward, created_at)
                VALUES (?, ?, ?, ?)
            `).bind(sessionId, gameType, xpReward, Date.now()).run();
            
            const gameModule = await import(`../games/${gameType}.js`);
            
            const embed = xpEmbed('Minigame Started', `Started a **${gameType}** minigame with a reward of **${xpReward} XP**.`, COLORS.success);
            await patchOriginal(interaction.application_id, interaction.token, { embeds: [embed] });
            
            if (typeof gameModule.createGame === 'function') {
                await gameModule.createGame(interaction, env, ctx, xpReward, sessionId);
            }
        } catch (e) {
            console.error(e);
            await patchOriginal(interaction.application_id, interaction.token, { content: "Failed to start minigame." });
        }
    })());
    
    return deferredResponse();
}
