import { addXP } from '../utils/db.js';
import { checkLevelUp } from '../utils/levels.js';
import { COLORS } from '../utils/embeds.js';
import { sendChannelMessage, editMessage, ephemeralResponse, updateMessageResponse } from '../utils/discord.js';
import { scheduleExpiry, disabledButton, randomInt } from './shared.js';

export async function createGame(interaction, env, ctx, xpReward) {
    const sessionId = crypto.randomUUID();
    const channelId = interaction.channel_id;
    const expiresAt = Date.now() + 60000;

    const tileCount = 9;

    const embed = {
        title: "🦆 Luck Duck!",
        description: `A duck is hiding under one of the ${tileCount} tiles! Click a tile to find it.\n\n**Reward:** ${xpReward} XP\n*Ends in 60 seconds!*`,
        color: COLORS.MINIGAME
    };

    const components = [{
        type: 1,
        components: Array.from({ length: tileCount }, (_, i) => ({
            type: 2,
            style: 2,
            label: "🪨",
            custom_id: `game:luck_duck:${sessionId}:${i}`
        }))
    }];

    const msg = await sendChannelMessage(env.DISCORD_TOKEN, channelId, {
        embeds: [embed],
        components
    });

    if (!msg || !msg.id) throw new Error("Failed to send game message");

    const duckIndex = randomInt(tileCount);
    const state = JSON.stringify({ duckIndex, guesses: [], found: false, ended: false });

    await env.astralyx_xp.prepare(
        "INSERT INTO minigame_sessions (id, channel_id, game_type, message_id, xp_reward, state, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(sessionId, channelId, 'luck_duck', msg.id, xpReward, state, Date.now(), expiresAt).run();

    scheduleExpiry(env, ctx, sessionId, expiresAt, endAndReward);

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

        if (!session) return ephemeralResponse("This game has already ended.");

        let state = JSON.parse(session.state);

        if (state.ended) {
            return ephemeralResponse("This game has already ended!");
        }

        if (Date.now() <= session.expires_at && state.found && Date.now() <= state.settleAt) {
            return ephemeralResponse("The duck was found! XP is being paid out... 🦆");
        }

        if (state.found) {
            state.ended = true;
            await env.astralyx_xp.prepare(
                "UPDATE minigame_sessions SET state = ? WHERE id = ?"
            ).bind(JSON.stringify(state), sessionId).run();
            await endAndReward(session, state, env);
            return updateMessageResponse({ components: disabledButton("🪨", `game:luck_duck:${session.id}:0`) });
        }

        if (Date.now() > session.expires_at) {
            state.ended = true;
            await env.astralyx_xp.prepare(
                "UPDATE minigame_sessions SET state = ? WHERE id = ?"
            ).bind(JSON.stringify(state), sessionId).run();
            await endAndReward(session, state, env);
            return updateMessageResponse({ components: disabledButton("🪨", `game:luck_duck:${session.id}:0`) });
        }

        if (state.guesses.find(g => g.id === userId)) {
            return ephemeralResponse("You already guessed!");
        }

        const isCorrect = index === state.duckIndex;
        state.guesses.push({ id: userId, index, correct: isCorrect, timestamp: Date.now(), username: interaction.member?.user?.username || interaction.user?.username });

        if (isCorrect && !state.found) {
            state.found = true;
            state.settleAt = Date.now() + 10000;

            await env.astralyx_xp.prepare(
                "UPDATE minigame_sessions SET state = ?, expires_at = ? WHERE id = ?"
            ).bind(JSON.stringify(state), state.settleAt, sessionId).run();

            ctx.waitUntil((async () => {
                await new Promise(r => setTimeout(r, 10000));
                const finalSession = await env.astralyx_xp.prepare("SELECT * FROM minigame_sessions WHERE id = ?").bind(sessionId).first();
                if (finalSession) {
                    const fs = JSON.parse(finalSession.state);
                    if (fs.found && !fs.ended) {
                        fs.ended = true;
                        await env.astralyx_xp.prepare("UPDATE minigame_sessions SET state = ? WHERE id = ?").bind(JSON.stringify(fs), sessionId).run();
                        await endAndReward(finalSession, fs, env);
                    }
                }
            })());

            return ephemeralResponse("🦆 Quack! You found it! You will receive your XP when the game ends in 10s.");
        }

        await env.astralyx_xp.prepare(
            "UPDATE minigame_sessions SET state = ? WHERE id = ?"
        ).bind(JSON.stringify(state), sessionId).run();

        return ephemeralResponse(isCorrect ? "🦆 Quack! You found it! You'll get partial XP." : "No duck here! 🚫");
    } catch (e) {
        console.error(e);
        return ephemeralResponse("Something went wrong.");
    }
}

async function endAndReward(session, state, env) {
    const correctPlayers = state.guesses.filter(g => g.correct).sort((a, b) => a.timestamp - b.timestamp);

    const { getUser } = await import('../utils/db.js');

    let description;
    if (correctPlayers.length === 0) {
        description = "Nobody found the duck! 🦆";
    } else {
        const lines = [];
        for (let i = 0; i < correctPlayers.length; i++) {
            const p = correctPlayers[i];
            const earned = i === 0 ? session.xp_reward : Math.floor(session.xp_reward * 0.8);

            const userBefore = await getUser(env.astralyx_xp, p.id);
            const oldXp = userBefore.xp;

            await addXP(env.astralyx_xp, p.id, earned);
            const newXp = oldXp + earned;
            const levelUp = checkLevelUp(oldXp, newXp);

            lines.push(`${i === 0 ? '🥇' : '🦆'} <@${p.id}> found the duck and earned **${earned} XP**!`);

            if (levelUp && levelUp.newLevel > levelUp.oldLevel) {
                await sendChannelMessage(env.DISCORD_TOKEN, session.channel_id, {
                    content: `🎉 Congratulations <@${p.id}>! You reached **Level ${levelUp.newLevel}**! 🚀`
                });
            }
        }
        description = lines.join('\n');
    }

    await env.astralyx_xp.prepare("DELETE FROM minigame_sessions WHERE id = ?").bind(session.id).run();

    await editMessage(env.DISCORD_TOKEN, session.channel_id, session.message_id, {
        embeds: [{
            title: "🦆 Luck Duck Ended!",
            description,
            color: COLORS.SUCCESS
        }],
        components: disabledButton("🪨", `game:luck_duck:${session.id}:0`)
    });
}