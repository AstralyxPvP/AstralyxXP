import { addXP } from '../utils/db.js';
import { checkLevelUp } from '../utils/levels.js';
import { COLORS } from '../utils/embeds.js';
import { sendChannelMessage, ephemeralResponse, updateMessageResponse } from '../utils/discord.js';
import { scheduleExpiry, disabledButton, randomInt, pick } from './shared.js';

export async function createGame(interaction, env, ctx, xpReward) {
    const sessionId = crypto.randomUUID();
    const channelId = interaction.channel_id;
    const expiresAt = Date.now() + 60000;

    const embed = {
        title: "🪜 Ladders Game!",
        description: `Roll the dice to climb the ladder!\nWatch out for step 4 — you might slip! 🐍\n\n**Prize:** ${xpReward} XP to the first to reach step 5!\n*Ends in 60s!*`,
        color: COLORS.MINIGAME
    };

    const components = [{
        type: 1,
        components: [{
            type: 2,
            style: 1,
            label: "🎲 Roll",
            custom_id: `game:ladders:${sessionId}:roll`
        }]
    }];

    const msg = await sendChannelMessage(env.DISCORD_TOKEN, channelId, {
        embeds: [embed],
        components
    });

    if (!msg || !msg.id) throw new Error("Failed to send game message");

    const state = JSON.stringify({ players: {}, ended: false });

    await env.astralyx_xp.prepare(
        "INSERT INTO minigame_sessions (id, channel_id, game_type, message_id, xp_reward, state, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(sessionId, channelId, 'ladders', msg.id, xpReward, state, Date.now(), expiresAt).run();

    scheduleExpiry(env, ctx, sessionId, expiresAt, endAndReward);

    return { content: `Ladders game started in <#${channelId}>!`, flags: 64 };
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

        if (Date.now() > session.expires_at) {
            state.ended = true;
            await env.astralyx_xp.prepare(
                "UPDATE minigame_sessions SET state = ? WHERE id = ?"
            ).bind(JSON.stringify(state), sessionId).run();
            await endAndReward(session, state, env);
            return updateMessageResponse({ components: disabledButton("🎲 Roll", `game:ladders:${session.id}:roll`) });
        }

        if (!state.players[userId]) {
            state.players[userId] = { position: 0, name: username, lastRoll: 0 };
        }

        const player = state.players[userId];

        if (Date.now() - player.lastRoll < 2000) {
            return ephemeralResponse("Please wait a moment before rolling again! ⏳");
        }

        const roll = randomInt(3) + 1;
        player.position += roll;
        player.lastRoll = Date.now();
        let slip = false;

        if (player.position === 4) {
            if (randomInt(3) === 0) {
                player.position = 2;
                slip = true;
            }
        }

        let winner = null;
        if (player.position >= 5) {
            player.position = 5;
            state.ended = true;
            winner = userId;
        }

        if (state.ended) {
            await env.astralyx_xp.prepare("DELETE FROM minigame_sessions WHERE id = ?").bind(sessionId).run();
        } else {
            await env.astralyx_xp.prepare(
                "UPDATE minigame_sessions SET state = ? WHERE id = ?"
            ).bind(JSON.stringify(state), sessionId).run();
        }

        if (winner) {
            await endAndReward(session, state, env, winner);
            return updateMessageResponse({
                embeds: [{
                    title: "🪜 Ladders Game Ended!",
                    description: `🏆 <@${winner}> reached the top and won **${session.xp_reward} XP**!\n` + renderLadders(state.players),
                    color: COLORS.SUCCESS
                }],
                components: disabledButton("🎲 Roll", `game:ladders:${session.id}:roll`)
            });
        }

        let statusMsg = `<@${userId}> rolled a **${roll}**!`;
        if (slip) statusMsg += ` Oh no! You slipped down to step 2! 🐍`;

        return updateMessageResponse({
            embeds: [{
                title: "🪜 Ladders Game!",
                description: `${statusMsg}\n\n**Prize:** ${session.xp_reward} XP\n` + renderLadders(state.players),
                color: COLORS.INFO
            }],
            components: interaction.message.components
        });
    } catch (e) {
        console.error(e);
        return ephemeralResponse("Something went wrong.");
    }
}

async function endAndReward(session, state, env, winner = null) {
    await env.astralyx_xp.prepare("DELETE FROM minigame_sessions WHERE id = ?").bind(session.id).run();

    if (!winner) {
        await sendChannelMessage(env.DISCORD_TOKEN, session.channel_id, {
            content: `🪜 The ladders game ended — nobody reached the top this time!`
        });
        return;
    }

    const { getUser } = await import('../utils/db.js');
    const userBefore = await getUser(env.astralyx_xp, winner);
    const oldXp = userBefore.xp;

    await addXP(env.astralyx_xp, winner, session.xp_reward);
    const newXp = oldXp + session.xp_reward;
    const levelUp = checkLevelUp(oldXp, newXp);

    if (levelUp && levelUp.newLevel > levelUp.oldLevel) {
        await sendChannelMessage(env.DISCORD_TOKEN, session.channel_id, {
            content: `🎉 Congratulations <@${winner}>! You reached **Level ${levelUp.newLevel}**! 🚀`
        });
    }
}

function renderLadders(players) {
    let text = "**Leaderboard:**\n";
    const names = Object.values(players);
    for (const p of names) {
        const stepDisplay = "🪜".repeat(Math.min(5, Math.max(0, p.position))) + "👤" + "⬛".repeat(5 - Math.min(5, Math.max(0, p.position)));
        text += `${p.name}: ${stepDisplay} (Step ${Math.min(5, p.position)})\n`;
    }
    return text || "No players yet!";
}