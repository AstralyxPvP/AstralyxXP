import { addXP } from '../utils/db.js';
import { checkLevelUp } from '../utils/levels.js';
import { COLORS } from '../utils/embeds.js';
import { sendChannelMessage, editMessage, ephemeralResponse, updateMessageResponse } from '../utils/discord.js';

export async function createGame(interaction, env, ctx, xpReward) {
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 60000; // 60 seconds
    const channelId = interaction.channel_id;

    const embed = {
        title: "💫 XP Fell From The Sky!",
        description: `A chunk of XP just fell from space! First one to grab it gets **${xpReward} XP**!`,
        color: COLORS.primary
    };

    const components = [{
        type: 1,
        components: [{
            type: 2,
            style: 3, // SUCCESS
            label: "⚡ Grab it!",
            custom_id: `game:fallen_xp:${sessionId}:grab`
        }]
    }];

    const msg = await sendChannelMessage(env.DISCORD_TOKEN, channelId, {
        embeds: [embed],
        components
    });

    if (!msg || !msg.id) throw new Error("Failed to send game message");

    const state = JSON.stringify({ ended: false, winner: null });
    
    await env.astralyx_xp.prepare(
        "INSERT INTO minigame_sessions (id, channel_id, game_type, message_id, xp_reward, state, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(sessionId, channelId, 'fallen_xp', msg.id, xpReward, state, Date.now(), expiresAt).run();

    return { content: `Fallen XP game started in <#${channelId}>!`, flags: 64 };
}

export async function handleComponent(interaction, env, ctx) {
    const parts = interaction.data.custom_id.split(':');
    const sessionId = parts[2];
    const userId = interaction.member?.user?.id || interaction.user?.id;

    try {
        const session = await env.astralyx_xp.prepare(
            "SELECT * FROM minigame_sessions WHERE id = ?"
        ).bind(sessionId).first();

        if (!session) return ephemeralResponse("This game session no longer exists.");

        let state = JSON.parse(session.state);

        if (state.ended) {
            return ephemeralResponse("Better luck next time! 🍀");
        }

        state.ended = true;
        state.winner = userId;

        await env.astralyx_xp.prepare(
            "DELETE FROM minigame_sessions WHERE id = ?"
        ).bind(sessionId).run();

        const { getUser } = await import('../utils/db.js');
        const userBefore = await getUser(env.astralyx_xp, userId);
        const oldXp = userBefore.xp;

        await addXP(env.astralyx_xp, userId, session.xp_reward);
        const newXp = oldXp + session.xp_reward;
        
        const levelUp = checkLevelUp(oldXp, newXp);

        if (levelUp && levelUp.newLevel > levelUp.oldLevel) {
            await sendChannelMessage(env.DISCORD_TOKEN, session.channel_id, {
                content: `🎉 Congratulations <@${userId}>! You reached **Level ${levelUp.newLevel}**! 🚀`
            });
        }

        return updateMessageResponse({
            embeds: [{
                title: "💫 XP Caught!",
                description: `<@${userId}> was the fastest and grabbed **${session.xp_reward} XP**! ⚡`,
                color: COLORS.SUCCESS
            }],
            components: [{
                type: 1,
                components: [{
                    type: 2,
                    style: 3,
                    label: "⚡ Grabbed!",
                    custom_id: `game:fallen_xp:${sessionId}:grab`,
                    disabled: true
                }]
            }]
        });
    } catch (e) {
        console.error(e);
        return ephemeralResponse("Something went wrong.");
    }
}
