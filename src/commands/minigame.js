import { isStaff } from '../utils/staff.js';
import { deferredResponse, ephemeralResponse, patchOriginal } from '../utils/discord.js';
import { COLORS, xpEmbed } from '../utils/embeds.js';

const GAMES = ['raining_xp', 'guess', 'fallen_xp', 'ladders', 'luck_duck'];

export async function execute(interaction, env, ctx) {
    if (!isStaff(interaction.member.roles)) {
        return ephemeralResponse("You do not have permission to use this command.");
    }
    
    ctx.waitUntil((async () => {
        try {
            const gameType = GAMES[Math.floor(Math.random() * GAMES.length)];
            const xpReward = Math.floor(Math.random() * 41) + 10; // 10 to 50
            
            // Dynamic import the game module
            // We use static imports conceptually, but since filenames have hyphens let's map them
            const gameFileMap = {
                'raining_xp': 'raining-xp.js',
                'guess': 'guess.js',
                'fallen_xp': 'fallen-xp.js',
                'ladders': 'ladders.js',
                'luck_duck': 'luck-duck.js'
            };
            const gameFile = gameFileMap[gameType];
            const gameModule = await import(`../games/${gameFile}`);
            
            const embed = xpEmbed('Minigame Started', `Started a **${gameType}** minigame with a reward of **${xpReward} XP**.`, [], COLORS.SUCCESS);
            await patchOriginal(interaction.application_id, interaction.token, { embeds: [embed] });
            
            if (typeof gameModule.createGame === 'function') {
                await gameModule.createGame(interaction, env, ctx, xpReward);
            }
        } catch (e) {
            console.error(e);
            await patchOriginal(interaction.application_id, interaction.token, { content: "Failed to start minigame." });
        }
    })());
    
    return deferredResponse();
}
