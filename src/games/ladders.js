import { addXP } from '../utils/db.js';
import { checkLevelUp } from '../utils/levels.js';
import { COLORS } from '../utils/embeds.js';
import { sendChannelMessage, ephemeralResponse, updateMessageResponse } from '../utils/discord.js';

export async function createGame(interaction, env, ctx, xpReward) {
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 60000; // 60 seconds
    const channelId = interaction.channel_id;

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

        if (!session) return ephemeralResponse("This game session no longer exists.");

        let state = JSON.parse(session.state);

        if (state.ended || Date.now() > session.expires_at) {
            if (!state.ended) {
                state.ended = true;
                await env.astralyx_xp.prepare("DELETE FROM minigame_sessions WHERE id = ?").bind(sessionId).run();
            }
            return updateMessageResponse({ components: disableComponents(interaction.message.components) });
        }

        if (!state.players[userId]) {
            state.players[userId] = { position: 0, name: username, lastRoll: 0 };
        }

        const player = state.players[userId];
        
        // Cooldown check (prevent spam)
        if (Date.now() - player.lastRoll < 2000) {
            return ephemeralResponse("Please wait a moment before rolling again! ⏳");
        }
        
        const roll = Math.floor(Math.random() * 3) + 1; // 1 to 3
        player.position += roll;
        player.lastRoll = Date.now();
        let slip = false;

        if (player.position === 4) {
            if (Math.random() < 0.33) {
                player.position = 2; // Snake!
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

            return updateMessageResponse({
                embeds: [{
                    title: "🪜 Ladders Game Ended!",
                    description: `🏆 <@${winner}> reached the top and won **${session.xp_reward} XP**!\n\n${renderLadders(state.players)}`,
                    color: COLORS.SUCCESS
                }],
                components: disableComponents(interaction.message.components)
            });
        }

        let statusMsg = `<@${userId}> rolled a **${roll}**!`;
        if (slip) statusMsg += ` Oh no! You slipped down to step 2! 🐍`;

        return updateMessageResponse({
            embeds: [{
                title: "🪜 Ladders Game!",
                description: `${statusMsg}\n\n**Prize:** ${session.xp_reward} XP\n\n${renderLadders(state.players)}`,
                color: COLORS.INFO
            }],
            components: interaction.message.components
        });
    } catch (e) {
        console.error(e);
        return ephemeralResponse("Something went wrong.");
    }
}

function renderLadders(players) {
    let text = "**Leaderboard:**\n";
    for (const [id, p] of Object.entries(players)) {
        const stepDisplay = "🪜".repeat(Math.min(5, Math.max(0, p.position))) + "👤" + "⬛".repeat(5 - Math.min(5, Math.max(0, p.position)));
        text += `${p.name}: ${stepDisplay} (Step ${Math.min(5, p.position)})\n`;
    }
    return text || "No players yet!";
}

function disableComponents(components) {
    return components.map(row => ({
        ...row,
        components: row.components.map(btn => ({ ...btn, disabled: true }))
    }));
}
