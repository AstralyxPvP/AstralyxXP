import { ensureUser, getUser, addXP, setXP } from '../utils/db.js';
import { checkLevelUp } from '../utils/levels.js';
import { COLORS, xpEmbed } from '../utils/embeds.js';
import { deferredResponse, ephemeralResponse, patchOriginal } from '../utils/discord.js';

export async function execute(interaction, env, ctx) {
    const options = interaction.data.options || [];
    const amountOpt = options.find(o => o.name === 'amount');
    const choiceOpt = options.find(o => o.name === 'choice');
    const amount = amountOpt.value;
    const choice = choiceOpt.value.toLowerCase();
    
    if (amount < 10 || amount > 5000) {
        return ephemeralResponse("Amount must be between 10 and 5000 XP.");
    }
    if (choice !== 'heads' && choice !== 'tails') {
        return ephemeralResponse("Choice must be 'heads' or 'tails'.");
    }
    
    const userId = interaction.member.user.id;
    
    ctx.waitUntil((async () => {
        try {
            await ensureUser(env.astralyx_xp, userId);
            const user = await getUser(env.astralyx_xp, userId);
            
            if (user.xp < amount) {
                const embed = xpEmbed('🪙 Coinflip Failed', `💸 You don't have enough XP. You only have ${user.xp} XP.`, [], COLORS.ERROR);
                return patchOriginal(interaction.application_id, interaction.token, { embeds: [embed] });
            }
            
            const buf = new Uint32Array(1);
            crypto.getRandomValues(buf);
            const result = buf[0] % 2 === 0 ? 'heads' : 'tails';
            const win = result === choice;
            
            let newXp;
            let desc;
            if (win) {
                newXp = user.xp + amount;
                await addXP(env.astralyx_xp, userId, amount);
                desc = `🪙 It landed on **${result}**!\n🎉 You won **${amount} XP**!\n💰 New balance: ${newXp} XP`;
            } else {
                newXp = user.xp - amount;
                await setXP(env.astralyx_xp, userId, newXp);
                desc = `🪙 It landed on **${result}**.\n😢 You lost **${amount} XP**.\n💰 New balance: ${newXp} XP`;
            }
            
            let levelUpResult = null;
            if (win) {
                levelUpResult = checkLevelUp(user.xp, newXp);
            }
            if (levelUpResult) {
                desc += `\n\n🎉 **LEVEL UP!** You are now level **${levelUpResult.newLevel}**! 🎉`;
            }
            
            const embed = xpEmbed('Coinflip', desc, [], win ? COLORS.SUCCESS : COLORS.ERROR);
            await patchOriginal(interaction.application_id, interaction.token, { embeds: [embed] });
        } catch (e) {
            console.error(e);
            await patchOriginal(interaction.application_id, interaction.token, { content: "Something went wrong." });
        }
    })());
    
    return deferredResponse();
}
