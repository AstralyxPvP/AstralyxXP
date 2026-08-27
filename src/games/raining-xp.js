import { addXP } from '../utils/db.js';
import { checkLevelUp } from '../utils/levels.js';
import { COLORS } from '../utils/embeds.js';
import { sendChannelMessage, editMessage, ephemeralResponse, updateMessageResponse } from '../utils/discord.js';
import { scheduleExpiry, disabledButton } from './shared.js';

export async function createGame(interaction, env, ctx, xpReward) {
    const sessionId = crypto.randomUUID();
    const channelId = interaction.channel_id;
    const expiresAt = Date.now() + 15000;

    const embed = {
        title: "☔ It's Raining XP!",
        description: `Catch the drops! Click the button below to collect some XP.\n\n**Base Reward:** ${xpReward} XP\n*Ends in 15 seconds!*`,
        color: COLORS.MINIGAME
    };

    const components = [{
        type: 1,
        components: [{
            type: 2,
            style: 1,
            label: "☔ Collect XP!",
            custom_id: `game:raining_xp:${sessionId}:collect`
        }]
    }];

    const msg = await sendChannelMessage(env.DISCORD_TOKEN, channelId, {
        embeds: [embed],
        components
    });

    if (!msg || !msg.id) {
        throw new Error("Failed to send game message");
    }

    const state = JSON.stringify({ collectors: [], ended: false });

    await env.astralyx_xp.prepare(
        "INSERT INTO minigame_sessions (id, channel_id, game_type, message_id, xp_reward, state, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(sessionId, channelId, 'raining_xp', msg.id, xpReward, state, Date.now(), expiresAt).run();

    scheduleExpiry(env, ctx, sessionId, expiresAt, endAndReward);

    return { content: `Raining XP game started in <#${channelId}>!`, flags: 64 };
}

export async function handleComponent(interaction, env, ctx) {
    const parts = interaction.data.custom_id.split(':');
    const sessionId = parts[2];
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const username = interaction.member?.user?.username || interaction.user?.username;

    try {
        const session = await env.astralyx_xp.prepare(
            "SELECT * FROM minigame_sessions WHERE id = ?"
        ).bind(sessionId).first();

        if (!session) return ephemeralResponse("This game has already ended.");

        let state = JSON.parse(session.state);

        if (state.ended) {
            return ephemeralResponse("This game has already ended!");
        }

        // Expired — settle it right now, not on the next click.
        if (Date.now() > session.expires_at) {
            state.ended = true;
            await env.astralyx_xp.prepare(
                "UPDATE minigame_sessions SET state = ? WHERE id = ?"
            ).bind(JSON.stringify(state), sessionId).run();
            await endAndReward(session, state, env);
            return updateMessageResponse({
                components: disabledButton("☔ Collect XP!", `game:raining_xp:${session.id}:collect`)
            });
        }

        if (state.collectors.find(c => c.id === userId)) {
            return ephemeralResponse("You have already collected the drops! ☔");
        }

        state.collectors.push({ id: userId, username, timestamp: Date.now() });

        await env.astralyx_xp.prepare(
            "UPDATE minigame_sessions SET state = ? WHERE id = ?"
        ).bind(JSON.stringify(state), sessionId).run();

        return ephemeralResponse("✅ Collected!");
    } catch (e) {
        console.error(e);
        return ephemeralResponse("Something went wrong.");
    }
}

async function endAndReward(session, state, env) {
    if (state.collectors.length === 0) {
        await env.astralyx_xp.prepare("DELETE FROM minigame_sessions WHERE id = ?").bind(session.id).run();
        await editMessage(env.DISCORD_TOKEN, session.channel_id, session.message_id, {
            embeds: [{
                title: "☔ Raining XP Ended",
                description: "Nobody caught the drops! Better luck next time.",
                color: COLORS.INFO
            }],
            components: disabledButton("☔ Collect XP!", `game:raining_xp:${session.id}:collect`)
        });
        return;
    }

    state.collectors.sort((a, b) => a.timestamp - b.timestamp);

    const results = [];
    const { getUser } = await import('../utils/db.js');

    for (let i = 0; i < state.collectors.length; i++) {
        const c = state.collectors[i];
        const earned = i === 0 ? session.xp_reward : Math.floor(session.xp_reward * 0.6);

        const userBefore = await getUser(env.astralyx_xp, c.id);
        const oldXp = userBefore.xp;

        await addXP(env.astralyx_xp, c.id, earned);
        const newXp = oldXp + earned;
        const levelUp = checkLevelUp(oldXp, newXp);

        results.push(`${i === 0 ? '🥇' : '💧'} <@${c.id}> caught **${earned} XP**!`);

        if (levelUp && levelUp.newLevel > levelUp.oldLevel) {
            await sendChannelMessage(env.DISCORD_TOKEN, session.channel_id, {
                content: `🎉 Congratulations <@${c.id}>! You reached **Level ${levelUp.newLevel}**! 🚀`
            });
        }
    }

    await env.astralyx_xp.prepare("DELETE FROM minigame_sessions WHERE id = ?").bind(session.id).run();
    await editMessage(env.DISCORD_TOKEN, session.channel_id, session.message_id, {
        embeds: [{
            title: "☔ Raining XP Ended!",
            description: 'Here are the results!\n\n' + results.join('\n'),
            color: COLORS.SUCCESS
        }],
        components: disabledButton("☔ Collect XP!", `game:raining_xp:${session.id}:collect`)
    });
}