import { ensureUser, getUser, setXP } from '../utils/db.js';
import { checkLevelUp } from '../utils/levels.js';
import { COLORS, xpEmbed } from '../utils/embeds.js';
import { deferredResponse, ephemeralResponse, patchOriginal } from '../utils/discord.js';

const SYMBOLS = ['🍒', '🍋', '🔔', '💎', '⭐', '7️⃣'];

export async function execute(interaction, env, ctx) {
    const options = interaction.data.options || [];
    const amountOpt = options.find(o => o.name === 'amount');
    const amount = amountOpt.value;
    
    if (amount < 10 || amount > 5000) {
        return ephemeralResponse("Amount must be between 10 and 5000 XP.");
    }
    
    const userId = interaction.member.user.id;
    
    ctx.waitUntil((async () => {
        try {
            await ensureUser(env.astralyx_xp, userId);
            const user = await getUser(env.astralyx_xp, userId);
            
            if (user.xp < amount) {
                const embed = xpEmbed('Slots Failed', `You don't have enough XP. You only have ${user.xp} XP.`, [], COLORS.ERROR);
                return patchOriginal(interaction.application_id, interaction.token, { embeds: [embed] });
            }
            
            const s1 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
            const s2 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
            const s3 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
            
            let winAmount = -amount;
            let color = COLORS.ERROR;
            let message = "You lost!";
            
            if (s1 === s2 && s2 === s3) {
                winAmount = amount * 5;
                color = COLORS.SUCCESS;
                message = `**JACKPOT!** You won 5x your bet (**${winAmount} XP**)!`;
            } else if (s1 === s2 || s2 === s3 || s1 === s3) {
                winAmount = amount * 2;
                color = COLORS.SUCCESS;
                message = `You won 2x your bet (**${winAmount} XP**)!`;
            } else {
                message = `You lost **${amount} XP**. Better luck next time!`;
            }
            
            let newXp = Math.max(0, user.xp + winAmount);
            await setXP(env.astralyx_xp, userId, newXp);
            
            let desc = `[ ${s1} | ${s2} | ${s3} ]\n\n${message}\nNew balance: ${newXp} XP`;
            
            if (winAmount > 0) {
                const levelUpResult = checkLevelUp(user.xp, newXp);
                if (levelUpResult) {
                    desc += `\n\n🎉 **LEVEL UP!** You are now level **${levelUpResult.newLevel}**! 🎉`;
                }
            }
            
            const embed = xpEmbed('🎰 Slots', desc, [], color);
            await patchOriginal(interaction.application_id, interaction.token, { embeds: [embed] });
        } catch (e) {
            console.error(e);
            await patchOriginal(interaction.application_id, interaction.token, { content: "Something went wrong." });
        }
    })());
    
    return deferredResponse();
}
