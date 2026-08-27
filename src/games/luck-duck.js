import { addXP } from '../utils/db.js';
import { checkLevelUp } from '../utils/levels.js';
import { COLORS } from '../utils/embeds.js';
import { sendChannelMessage, editMessage, ephemeralResponse, updateMessageResponse } from '../utils/discord.js';

const EMOJIS = ['🌊', '🪨', '🌿', '🏠', '🌸'];

export async function createGame(interaction, env, ctx, xpReward) {
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 60000; // 60 seconds
    const channelId = interaction.channel_id;

    const duckIndex = Math.floor(Math.random() * EMOJIS.length);

    const embed = {
        title: "🦆 Luck Duck — Find the Duck!",
        description: `The duck is hiding behind one of these emojis!\n\n**Prize:** ${xpReward} XP\n*Ends in 60s!*`,
        color: COLORS.primary
    };

    const components = [{
        type: 1,
        components: EMOJIS.map((emoji, i) => ({
            type: 2,
            style: 2,
            emoji: { name: emoji },
            custom_id: `game:luck_duck:${sessionId}:${i}`
        }))
    }];

    const msg = await sendChannelMessage(env.DISCORD_TOKEN, channelId, {
        embeds: [embed],
        components
    });

    if (!msg || !msg.id) throw new Error("Failed to send game message");

    const state = JSON.stringify({ duckIndex, guesses: [], found: false, ended: false });
    
    await env.astralyx_xp.prepare(
        "INSERT INTO minigame_sessions (id, channel_id, game_type, message_id, xp_reward, state, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(sessionId, channelId, 'luck_duck', msg.id, xpReward, state, Date.now(), expiresAt).run();

    return { content: `Luck Duck game started in <#${channelId}>!`, flags: 64 };
}

export async function handleComponent(interaction, env, ctx) {
    const parts = interaction.data.custom_id.split(':');
    const sessionId = parts[2];
    const index = parseInt(parts[3], 10);
    const userId = interaction.member?.user?.id || interaction.user?.id;

    try {
        const session = await env.astralyx_xp.prepare(
            "SELECT * FROM minigame_sessions WHERE id = ?"
        ).bind(sessionId).first();

        if (!session) return ephemeralResponse("This game session no longer exists.");

        let state = JSON.parse(session.state);

        if (state.ended || Date.now() > session.expires_at) {
            if (!state.ended) {
                state.ended = true;
                await endAndReward(session, state, env);
            }
            return ephemeralResponse("This game has already ended!");
        }

        if (state.guesses.find(g => g.id === userId)) {
            return ephemeralResponse("You already guessed!");
        }

        const isCorrect = index === state.duckIndex;
        state.guesses.push({ id: userId, index, correct: isCorrect, timestamp: Date.now() });

        if (isCorrect && !state.found) {
            state.found = true;
            
            await env.astralyx_xp.prepare(
                "UPDATE minigame_sessions SET state = ?, expires_at = ? WHERE id = ?"
            ).bind(JSON.stringify(state), Date.now() + 10000, sessionId).run();
            
            ctx.waitUntil((async () => {
                await new Promise(r => setTimeout(r, 10000));
                const finalSession = await env.astralyx_xp.prepare("SELECT * FROM minigame_sessions WHERE id = ?").bind(sessionId).first();
                if (finalSession) {
                    let finalState = JSON.parse(finalSession.state);
                    if (!finalState.ended) {
                        finalState.ended = true;
                        await endAndReward(finalSession, finalState, env);
                    }
                }
            })());
            
            return ephemeralResponse("🦆 Quack! You found it! You will receive your XP when the game ends in 10s.");
        } else if (isCorrect) {
            await env.astralyx_xp.prepare("UPDATE minigame_sessions SET state = ? WHERE id = ?").bind(JSON.stringify(state), sessionId).run();
            return ephemeralResponse("🦆 Quack! You found it! You'll get partial XP.");
        }

        await env.astralyx_xp.prepare("UPDATE minigame_sessions SET state = ? WHERE id = ?").bind(JSON.stringify(state), sessionId).run();
        return ephemeralResponse("No duck here! 🚫");
    } catch (e) {
        console.error(e);
        return ephemeralResponse("Something went wrong.");
    }
}

async function endAndReward(session, state, env) {
    const correctPlayers = state.guesses.filter(g => g.correct).sort((a, b) => a.timestamp - b.timestamp);
    
    let description = "The game has ended! Here are the finders:\n\n";
    
    const { getUser } = await import('../utils/db.js');

    if (correctPlayers.length === 0) {
        description = "Nobody found the duck! 🦆";
    } else {
        for (let i = 0; i < correctPlayers.length; i++) {
            const p = correctPlayers[i];
            let earned = i === 0 ? session.xp_reward : Math.floor(session.xp_reward * 0.8);
            
            const userBefore = await getUser(env.astralyx_xp, p.id);
            const oldXp = userBefore.xp;

            await addXP(env.astralyx_xp, p.id, earned);
            const newXp = oldXp + earned;
            const levelUp = checkLevelUp(oldXp, newXp);
            
            description += `${i === 0 ? '🥇' : '🦆'} <@${p.id}> found the duck and earned **${earned} XP**!\n`;
            
            if (levelUp && levelUp.newLevel > levelUp.oldLevel) {
                await sendChannelMessage(env.DISCORD_TOKEN, session.channel_id, {
                    content: `🎉 Congratulations <@${p.id}>! You reached **Level ${levelUp.newLevel}**! 🚀`
                });
            }
        }
    }

    await env.astralyx_xp.prepare("DELETE FROM minigame_sessions WHERE id = ?").bind(session.id).run();
    
    await editMessage(env.DISCORD_TOKEN, session.channel_id, session.message_id, {
        embeds: [{
            title: "🦆 Luck Duck Ended!",
            description: description,
            color: COLORS.SUCCESS
        }]
    });
}
