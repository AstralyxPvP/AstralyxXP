import { ensureUser, getUser, updateDaily, addXP } from '../utils/db.js';
import { checkLevelUp } from '../utils/levels.js';
import { COLORS, xpEmbed } from '../utils/embeds.js';
import { deferredResponse, ephemeralResponse, patchOriginal } from '../utils/discord.js';

export async function execute(interaction, env, ctx) {
    const userId = interaction.member.user.id;
    
    ctx.waitUntil((async () => {
        await ensureUser(env.astralyx_xp, userId);
        const user = await getUser(env.astralyx_xp, userId);
        
        const now = Date.now();
        const lastClaimed = user.daily_last_claimed ? new Date(user.daily_last_claimed).getTime() : 0;
        const hoursSinceLast = (now - lastClaimed) / (1000 * 60 * 60);
        
        if (hoursSinceLast < 24) {
            const hoursRemaining = 24 - hoursSinceLast;
            const minsRemaining = Math.floor((hoursRemaining * 60) % 60);
            const hrsRemaining = Math.floor(hoursRemaining);
            const embed = xpEmbed('Daily Reward', `You can claim your next daily reward in **${hrsRemaining}h ${minsRemaining}m**.`, COLORS.error);
            return patchOriginal(interaction.application_id, interaction.token, { embeds: [embed] });
        }
        
        let streak = user.daily_streak || 0;
        if (hoursSinceLast <= 48) {
            streak += 1;
        } else if (lastClaimed !== 0) {
            streak = 1;
        } else {
            streak = 1;
        }
        
        const baseReward = 10;
        const bonus = Math.floor(streak / 3) * 5;
        const reward = baseReward + bonus;
        
        await updateDaily(env.astralyx_xp, userId, now, streak);
        await addXP(env.astralyx_xp, userId, reward);
        
        const levelUpResult = await checkLevelUp(env.astralyx_xp, userId, user.xp, user.xp + reward);
        
        let desc = `You claimed your daily reward of **${reward} XP**!\nYour streak is now **${streak}**! 📅`;
        if (levelUpResult.leveledUp) {
            desc += `\n\n🎉 **LEVEL UP!** You are now level **${levelUpResult.newLevel}**! 🎉`;
        }
        
        const embed = xpEmbed('Daily Claimed!', desc, COLORS.success);
        await patchOriginal(interaction.application_id, interaction.token, { embeds: [embed] });
    })());
    
    return deferredResponse();
}
